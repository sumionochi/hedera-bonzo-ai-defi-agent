// ============================================
// VaultMind Keeper — Decision Engine
// The core brain: gather data → analyze → decide → execute → log
// ============================================

import {
  getBonzoMarkets,
  getBonzoAccountDashboard,
  type BonzoReserve,
} from "./bonzo";
import { analyzeSentiment, type SentimentResult } from "./sentiment";
import {
  logDecisionToHCS,
  ensureAuditTopic,
  type AgentDecisionLog,
} from "./hcs";
import { chat } from "./agent";

// ── Types ──────────────────────────────────────────────────

export type KeeperAction =
  | "HARVEST" // Withdraw rewards, convert to stable
  | "HOLD" // No action needed
  | "REBALANCE" // Shift allocation between reserves
  | "EXIT_TO_STABLE" // Emergency: repay debt / exit volatile position
  | "INCREASE_POSITION" // Bullish: deposit more
  | "REPAY_DEBT"; // Health factor low: repay to avoid liquidation

export interface KeeperDecision {
  action: KeeperAction;
  reason: string;
  confidence: number; // 0-1
  params?: {
    amount?: string;
    tokenSymbol?: string;
    targetAsset?: string;
    healthFactor?: number;
  };
  timestamp: string;
}

export interface UserPosition {
  symbol: string;
  supplied: number;
  suppliedUSD: number;
  borrowed: number;
  borrowedUSD: number;
  supplyAPY: number;
  borrowAPY: number;
  isCollateral: boolean;
}

export interface PortfolioSummary {
  positions: UserPosition[];
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  netWorthUSD: number;
  healthFactor: number;
  currentLtv: number;
  maxLtv: number;
  averageSupplyAPY: number;
  averageBorrowAPY: number;
  averageNetAPY: number;
}

export interface KeeperCycleResult {
  decision: KeeperDecision;
  sentiment: SentimentResult;
  portfolio: PortfolioSummary | null;
  markets: BonzoReserve[];
  execution: {
    executed: boolean;
    agentResponse?: string;
    toolCalls?: Array<{ tool: string; input: string; output: string }>;
    error?: string;
  };
  hcsLog: {
    logged: boolean;
    topicId?: string;
    sequenceNumber?: number;
    error?: string;
  };
  timestamp: string;
  durationMs: number;
}

// ── Strategy Configuration ─────────────────────────────────

export interface StrategyConfig {
  // Sentiment thresholds
  bearishThreshold: number; // Below this → HARVEST (default: -30)
  bullishThreshold: number; // Above this → INCREASE_POSITION (default: 50)
  confidenceMinimum: number; // Min confidence to act (default: 0.6)

  // Health factor
  healthFactorDanger: number; // Below this → REPAY_DEBT (default: 1.3)
  healthFactorTarget: number; // Repay until reaching this (default: 1.8)

  // Volatility
  highVolatilityThreshold: number; // Above this → conservative (default: 80% annualized)

  // Yield
  minYieldDifferential: number; // Min APY improvement to rebalance (default: 2%)
}

const DEFAULT_STRATEGY: StrategyConfig = {
  bearishThreshold: -30,
  bullishThreshold: 50,
  confidenceMinimum: 0.6,
  healthFactorDanger: 1.3,
  healthFactorTarget: 1.8,
  highVolatilityThreshold: 80,
  minYieldDifferential: 2.0,
};

// ── Portfolio Reader ───────────────────────────────────────

/**
 * Read user's current Bonzo positions via the Data API
 */
export async function getPortfolio(
  accountId: string
): Promise<PortfolioSummary> {
  const dashboard = await getBonzoAccountDashboard(accountId);

  const positions: UserPosition[] = dashboard.reserves
    .map((r) => ({
      symbol: r.symbol,
      supplied: parseFloat(r.atokenBalance.token_display) || 0,
      suppliedUSD: parseFloat(r.atokenBalance.usd_display) || 0,
      borrowed:
        (parseFloat(r.variableDebtBalance.token_display) || 0) +
        (parseFloat(r.stableDebtBalance.token_display) || 0),
      borrowedUSD:
        (parseFloat(r.variableDebtBalance.usd_display) || 0) +
        (parseFloat(r.stableDebtBalance.usd_display) || 0),
      supplyAPY: r.supplyAPY,
      borrowAPY: r.variableBorrowAPY,
      isCollateral: r.useAsCollateralEnabled,
    }))
    .filter((p) => p.supplied > 0 || p.borrowed > 0);

  const totalSuppliedUSD = positions.reduce((s, p) => s + p.suppliedUSD, 0);
  const totalBorrowedUSD = positions.reduce((s, p) => s + p.borrowedUSD, 0);

  return {
    positions,
    totalSuppliedUSD,
    totalBorrowedUSD,
    netWorthUSD: totalSuppliedUSD - totalBorrowedUSD,
    healthFactor: dashboard.userCredit.healthFactor,
    currentLtv: dashboard.userCredit.currentLtv,
    maxLtv: dashboard.userCredit.maxLtv,
    averageSupplyAPY: dashboard.averageSupplyApy,
    averageBorrowAPY: dashboard.averageBorrowApy,
    averageNetAPY: dashboard.averageNetApy,
  };
}

// ── Decision Engine ────────────────────────────────────────

/**
 * Core strategy: analyze all data and produce a decision
 */
export function makeDecision(
  sentiment: SentimentResult,
  portfolio: PortfolioSummary | null,
  markets: BonzoReserve[],
  config: StrategyConfig = DEFAULT_STRATEGY
): KeeperDecision {
  const now = new Date().toISOString();

  // ──────────────────────────────────────────
  // STRATEGY 1: Health Factor Emergency
  // Highest priority — prevent liquidation
  // ──────────────────────────────────────────
  if (
    portfolio &&
    portfolio.healthFactor > 0 &&
    portfolio.healthFactor < config.healthFactorDanger &&
    portfolio.totalBorrowedUSD > 0
  ) {
    // Find the largest borrowed position to repay
    const largestDebt = [...portfolio.positions]
      .filter((p) => p.borrowed > 0)
      .sort((a, b) => b.borrowedUSD - a.borrowedUSD)[0];

    return {
      action: "REPAY_DEBT",
      reason: `Health factor critically low at ${portfolio.healthFactor.toFixed(
        2
      )} (danger < ${config.healthFactorDanger}). Repaying ${
        largestDebt?.symbol || "debt"
      } to avoid liquidation.`,
      confidence: 0.95,
      params: {
        tokenSymbol: largestDebt?.symbol,
        amount: "25%",
        healthFactor: portfolio.healthFactor,
      },
      timestamp: now,
    };
  }

  // ──────────────────────────────────────────
  // STRATEGY 2: Bearish Sentiment Harvesting
  // If market looks bad → protect value
  // ──────────────────────────────────────────
  if (
    sentiment.score < config.bearishThreshold &&
    sentiment.confidence >= config.confidenceMinimum
  ) {
    // Check if user has non-stable positions to protect
    const volatilePositions = portfolio?.positions.filter(
      (p) => p.supplied > 0 && !["USDC", "USDT", "DAI"].includes(p.symbol)
    );

    if (volatilePositions && volatilePositions.length > 0) {
      const largest = volatilePositions.sort(
        (a, b) => b.suppliedUSD - a.suppliedUSD
      )[0];

      return {
        action: "HARVEST",
        reason: `Bearish sentiment detected (score: ${sentiment.score}, signal: ${sentiment.signal}). ${sentiment.reasoning}. Withdrawing ${largest.symbol} and converting to USDC to protect value.`,
        confidence: sentiment.confidence,
        params: {
          tokenSymbol: largest.symbol,
          targetAsset: "USDC",
        },
        timestamp: now,
      };
    }

    // No volatile positions — just signal awareness
    return {
      action: "HOLD",
      reason: `Bearish sentiment (score: ${sentiment.score}) but no volatile positions to protect. Staying in stables.`,
      confidence: sentiment.confidence,
      timestamp: now,
    };
  }

  // ──────────────────────────────────────────
  // STRATEGY 3: Volatility-Aware Rebalancing
  // High volatility → stay conservative
  // ──────────────────────────────────────────
  if (sentiment.dataPoints.volatility > config.highVolatilityThreshold) {
    // If user has positions, check if rebalancing helps
    if (portfolio && portfolio.positions.length > 0) {
      return {
        action: "HOLD",
        reason: `High volatility detected (${sentiment.dataPoints.volatility.toFixed(
          0
        )}% annualized, threshold: ${
          config.highVolatilityThreshold
        }%). Holding current positions until volatility subsides.`,
        confidence: 0.7,
        timestamp: now,
      };
    }
  }

  // ──────────────────────────────────────────
  // STRATEGY 4: Yield Optimization
  // Check if better yields are available
  // ──────────────────────────────────────────
  if (portfolio && portfolio.positions.length > 0) {
    const activeMarkets = markets.filter((m) => m.active && !m.frozen);

    for (const pos of portfolio.positions) {
      if (pos.supplied > 0) {
        // Find if there's a significantly better yield
        const betterYield = activeMarkets.find(
          (m) =>
            m.symbol !== pos.symbol &&
            m.supplyAPY > pos.supplyAPY + config.minYieldDifferential &&
            m.utilizationRate < 90 // Don't chase illiquid pools
        );

        if (betterYield) {
          return {
            action: "REBALANCE",
            reason: `${
              betterYield.symbol
            } offers ${betterYield.supplyAPY.toFixed(2)}% supply APY vs your ${
              pos.symbol
            } at ${pos.supplyAPY.toFixed(2)}% (+${(
              betterYield.supplyAPY - pos.supplyAPY
            ).toFixed(2)}% improvement). Rebalancing recommended.`,
            confidence: 0.7,
            params: {
              tokenSymbol: pos.symbol,
              targetAsset: betterYield.symbol,
            },
            timestamp: now,
          };
        }
      }
    }
  }

  // ──────────────────────────────────────────
  // STRATEGY 5: Bullish Accumulation
  // Strong bullish + low volatility → increase
  // ──────────────────────────────────────────
  if (
    sentiment.score > config.bullishThreshold &&
    sentiment.confidence >= config.confidenceMinimum &&
    sentiment.dataPoints.volatility < config.highVolatilityThreshold
  ) {
    // Find the best yield opportunity
    const bestYield = markets
      .filter((m) => m.active && !m.frozen && m.supplyAPY > 0)
      .sort((a, b) => b.supplyAPY - a.supplyAPY)[0];

    if (bestYield) {
      return {
        action: "INCREASE_POSITION",
        reason: `Strong bullish sentiment (score: ${
          sentiment.score
        }) with manageable volatility (${sentiment.dataPoints.volatility.toFixed(
          0
        )}%). Best yield: ${bestYield.symbol} at ${bestYield.supplyAPY.toFixed(
          2
        )}% APY.`,
        confidence: sentiment.confidence,
        params: {
          tokenSymbol: bestYield.symbol,
        },
        timestamp: now,
      };
    }
  }

  // ──────────────────────────────────────────
  // DEFAULT: Hold and monitor
  // ──────────────────────────────────────────
  const volatilityStr = sentiment.dataPoints.volatility
    ? `${sentiment.dataPoints.volatility.toFixed(0)}%`
    : "N/A";

  return {
    action: "HOLD",
    reason: `Market conditions stable. Sentiment: ${sentiment.score} (${sentiment.signal}), Volatility: ${volatilityStr}. No action needed.`,
    confidence: 0.5,
    timestamp: now,
  };
}

// ── Action Executor ────────────────────────────────────────

/**
 * Execute a keeper decision through the LangGraph agent
 */
export async function executeDecision(
  decision: KeeperDecision,
  threadId: string = "keeper"
): Promise<{
  executed: boolean;
  agentResponse?: string;
  toolCalls?: Array<{ tool: string; input: string; output: string }>;
  error?: string;
}> {
  if (decision.action === "HOLD") {
    return { executed: false, agentResponse: "No action needed." };
  }

  let prompt: string;

  switch (decision.action) {
    case "HARVEST":
      prompt = `KEEPER ACTION: Withdraw my supplied ${
        decision.params?.tokenSymbol || "tokens"
      } from Bonzo Finance. This is an automated keeper action triggered because: ${
        decision.reason
      }`;
      break;

    case "REPAY_DEBT":
      prompt = `KEEPER ACTION: Repay ${
        decision.params?.amount || "some"
      } of my ${
        decision.params?.tokenSymbol || ""
      } debt on Bonzo Finance. My health factor is ${
        decision.params?.healthFactor?.toFixed(2) || "low"
      }. This is an automated keeper action to prevent liquidation.`;
      break;

    case "REBALANCE":
      prompt = `KEEPER ACTION: I want to rebalance. First, check my current positions on Bonzo, then tell me the optimal move. Current position in ${
        decision.params?.tokenSymbol || "unknown"
      }, considering moving to ${
        decision.params?.targetAsset || "better yield"
      }. Reason: ${decision.reason}`;
      break;

    case "INCREASE_POSITION":
      prompt = `KEEPER ACTION: Check my HBAR balance, then tell me if I should deposit into ${
        decision.params?.tokenSymbol || "the best yield opportunity"
      } on Bonzo Finance. Reason: ${decision.reason}`;
      break;

    case "EXIT_TO_STABLE":
      prompt = `KEEPER ACTION: Emergency exit. Withdraw all non-stable positions from Bonzo Finance. Reason: ${decision.reason}`;
      break;

    default:
      return { executed: false, error: `Unknown action: ${decision.action}` };
  }

  try {
    const result = await chat(prompt, threadId);
    return {
      executed: true,
      agentResponse: result.response,
      toolCalls: result.toolCalls,
    };
  } catch (error: any) {
    return {
      executed: false,
      error: error.message,
    };
  }
}

// ── HCS Logger ─────────────────────────────────────────────

/**
 * Log a keeper decision to HCS for immutable audit trail
 */
async function logToHCS(
  decision: KeeperDecision,
  sentiment: SentimentResult,
  portfolio: PortfolioSummary | null
): Promise<{
  logged: boolean;
  topicId?: string;
  sequenceNumber?: number;
  error?: string;
}> {
  try {
    const topicId = await ensureAuditTopic();

    const log: AgentDecisionLog = {
      timestamp: decision.timestamp,
      agent: "VaultMind",
      version: "1.0.0",
      action: decision.action,
      reason: decision.reason,
      confidence: decision.confidence,
      context: {
        sentimentScore: sentiment.score,
        sentimentSignal: sentiment.signal,
        volatility: sentiment.dataPoints.volatility,
        fearGreedIndex: sentiment.dataPoints.fearGreedValue,
        hbarPrice: sentiment.dataPoints.hbarPrice,
        hbarChange24h: sentiment.dataPoints.hbarChange24h,
      },
      params: decision.params,
    };

    const result = await logDecisionToHCS(topicId, log);
    return {
      logged: true,
      topicId,
      sequenceNumber: result.sequenceNumber,
    };
  } catch (error: any) {
    console.error("[Keeper] HCS logging failed:", error.message);
    return { logged: false, error: error.message };
  }
}

// ── Full Keeper Cycle ──────────────────────────────────────

/**
 * Run one complete keeper cycle:
 * 1. Gather market data + sentiment
 * 2. Read user positions (if account configured)
 * 3. Make decision
 * 4. Execute (if not HOLD)
 * 5. Log to HCS
 */
export async function runKeeperCycle(
  config: StrategyConfig = DEFAULT_STRATEGY,
  executeActions: boolean = false // Safety: default to dry-run
): Promise<KeeperCycleResult> {
  const startTime = Date.now();
  const accountId = process.env.HEDERA_ACCOUNT_ID;

  console.log("[Keeper] ═══════════════════════════════════════");
  console.log("[Keeper] Starting keeper cycle...");
  console.log(`[Keeper] Account: ${accountId}`);
  console.log(`[Keeper] Execute mode: ${executeActions ? "LIVE" : "DRY-RUN"}`);

  // ── Step 1: Gather data in parallel ──
  const [sentimentResult, marketsResult, portfolioResult] =
    await Promise.allSettled([
      analyzeSentiment(),
      getBonzoMarkets(),
      accountId ? getPortfolio(accountId) : Promise.resolve(null),
    ]);

  const sentiment =
    sentimentResult.status === "fulfilled" ? sentimentResult.value : null;
  const markets =
    marketsResult.status === "fulfilled" ? marketsResult.value.reserves : [];
  const portfolio =
    portfolioResult.status === "fulfilled" ? portfolioResult.value : null;

  if (!sentiment) {
    console.error("[Keeper] Sentiment analysis failed — cannot make decision");
    const fallbackDecision: KeeperDecision = {
      action: "HOLD",
      reason: "Sentiment analysis unavailable. Holding until data is restored.",
      confidence: 0,
      timestamp: new Date().toISOString(),
    };
    return {
      decision: fallbackDecision,
      sentiment: {
        score: 0,
        signal: "HOLD",
        confidence: 0,
        reasoning: "Sentiment unavailable",
        dataPoints: {} as any,
      },
      portfolio,
      markets,
      execution: { executed: false, error: "No sentiment data" },
      hcsLog: { logged: false, error: "Skipped — no decision made" },
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  // Log data summary
  console.log(`[Keeper] Sentiment: ${sentiment.score} (${sentiment.signal})`);
  console.log(
    `[Keeper] Volatility: ${
      sentiment.dataPoints.volatility?.toFixed(0) || "N/A"
    }%`
  );
  console.log(
    `[Keeper] HBAR: $${
      sentiment.dataPoints.hbarPrice
    } (${sentiment.dataPoints.hbarChange24h?.toFixed(2)}%)`
  );
  if (portfolio) {
    console.log(
      `[Keeper] Portfolio: $${portfolio.totalSuppliedUSD.toFixed(
        2
      )} supplied, $${portfolio.totalBorrowedUSD.toFixed(2)} borrowed`
    );
    console.log(`[Keeper] Health factor: ${portfolio.healthFactor}`);
    console.log(
      `[Keeper] Positions: ${
        portfolio.positions.map((p) => p.symbol).join(", ") || "none"
      }`
    );
  } else {
    console.log(
      "[Keeper] No portfolio data (account may have no Bonzo positions)"
    );
  }

  // ── Step 2: Make decision ──
  const decision = makeDecision(sentiment, portfolio, markets, config);
  console.log(
    `[Keeper] Decision: ${decision.action} (confidence: ${decision.confidence})`
  );
  console.log(`[Keeper] Reason: ${decision.reason}`);

  // ── Step 3: Execute (if enabled and not HOLD) ──
  let execution: KeeperCycleResult["execution"] = {
    executed: false,
  };

  if (executeActions && decision.action !== "HOLD") {
    console.log(`[Keeper] Executing ${decision.action}...`);
    execution = await executeDecision(decision);
    if (execution.executed) {
      console.log(
        `[Keeper] ✅ Executed. Tools used: ${execution.toolCalls?.length || 0}`
      );
    } else {
      console.log(`[Keeper] ⚠️ Execution failed: ${execution.error}`);
    }
  } else if (!executeActions && decision.action !== "HOLD") {
    execution = {
      executed: false,
      agentResponse: `[DRY RUN] Would execute: ${decision.action}. Enable execution to perform this action.`,
    };
    console.log(`[Keeper] [DRY RUN] Would execute: ${decision.action}`);
  }

  // ── Step 4: Log to HCS ──
  const hcsLog = await logToHCS(decision, sentiment, portfolio);
  if (hcsLog.logged) {
    console.log(
      `[Keeper] ✅ Logged to HCS: topic ${hcsLog.topicId}, seq ${hcsLog.sequenceNumber}`
    );
  } else {
    console.log(`[Keeper] ⚠️ HCS log failed: ${hcsLog.error}`);
  }

  const durationMs = Date.now() - startTime;
  console.log(`[Keeper] Cycle complete in ${durationMs}ms`);
  console.log("[Keeper] ═══════════════════════════════════════");

  return {
    decision,
    sentiment,
    portfolio,
    markets,
    execution,
    hcsLog,
    timestamp: new Date().toISOString(),
    durationMs,
  };
}
