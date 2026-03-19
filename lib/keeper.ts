// ============================================
// VaultMind Keeper — Multi-Agent Decision Engine
// ============================================
// Now powered by the multi-agent architecture:
//   Sentinel → Strategist → Auditor → Executor → Auditor
//
// This file serves as the backward-compatible wrapper.
// The real logic lives in lib/agents/*.
//
// DCA AUTO-LOOP: Integrated into every keeper tick so DCA
// plans execute automatically when auto-keeper is running.
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
import {
  runMultiAgentCycle,
  runDCATick,
  type OrchestratorCycleResult,
} from "./agents/orchestrator";

// ── Types ──────────────────────────────────────────────────

export type KeeperAction =
  | "HARVEST"
  | "HOLD"
  | "REBALANCE"
  | "EXIT_TO_STABLE"
  | "INCREASE_POSITION"
  | "REPAY_DEBT";

export interface KeeperDecision {
  action: KeeperAction;
  reason: string;
  confidence: number;
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
  // Multi-agent fields
  vaultDecision?: any;
  dcaExecutions?: number;
  agentsUsed?: string[];
  multiAgentResult?: OrchestratorCycleResult;
  timestamp: string;
  durationMs: number;
}

// ── Strategy Configuration ─────────────────────────────────

export interface StrategyConfig {
  bearishThreshold: number;
  bullishThreshold: number;
  confidenceMinimum: number;
  healthFactorDanger: number;
  healthFactorTarget: number;
  highVolatilityThreshold: number;
  minYieldDifferential: number;
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

// ── Decision Engine (legacy, kept for backward compat) ─────

export function makeDecision(
  sentiment: SentimentResult,
  portfolio: PortfolioSummary | null,
  markets: BonzoReserve[],
  config: StrategyConfig = DEFAULT_STRATEGY
): KeeperDecision {
  const now = new Date().toISOString();

  // Health Factor Emergency
  if (
    portfolio &&
    portfolio.healthFactor > 0 &&
    portfolio.healthFactor < config.healthFactorDanger &&
    portfolio.totalBorrowedUSD > 0
  ) {
    const largestDebt = [...portfolio.positions]
      .filter((p) => p.borrowed > 0)
      .sort((a, b) => b.borrowedUSD - a.borrowedUSD)[0];

    return {
      action: "REPAY_DEBT",
      reason: `Health factor critically low at ${portfolio.healthFactor.toFixed(
        2
      )}. Repaying ${largestDebt?.symbol || "debt"} to avoid liquidation.`,
      confidence: 0.95,
      params: {
        tokenSymbol: largestDebt?.symbol,
        amount: "25%",
        healthFactor: portfolio.healthFactor,
      },
      timestamp: now,
    };
  }

  // Bearish
  if (
    sentiment.score < config.bearishThreshold &&
    sentiment.confidence >= config.confidenceMinimum
  ) {
    const volatilePositions = portfolio?.positions.filter(
      (p) => p.supplied > 0 && !["USDC", "USDT", "DAI"].includes(p.symbol)
    );
    if (volatilePositions && volatilePositions.length > 0) {
      const largest = volatilePositions.sort(
        (a, b) => b.suppliedUSD - a.suppliedUSD
      )[0];
      return {
        action: "HARVEST",
        reason: `Bearish sentiment (score: ${sentiment.score}). Withdrawing ${largest.symbol} to protect value.`,
        confidence: sentiment.confidence,
        params: { tokenSymbol: largest.symbol, targetAsset: "USDC" },
        timestamp: now,
      };
    }
    return {
      action: "HOLD",
      reason: `Bearish sentiment (${sentiment.score}) but no volatile positions. Staying in stables.`,
      confidence: sentiment.confidence,
      timestamp: now,
    };
  }

  // High Volatility
  if (sentiment.dataPoints.volatility > config.highVolatilityThreshold) {
    if (portfolio && portfolio.positions.length > 0) {
      return {
        action: "HOLD",
        reason: `High volatility (${sentiment.dataPoints.volatility.toFixed(
          0
        )}%). Holding until it subsides.`,
        confidence: 0.7,
        timestamp: now,
      };
    }
  }

  // Yield Optimization
  if (portfolio && portfolio.positions.length > 0) {
    const activeMarkets = markets.filter((m) => m.active && !m.frozen);
    for (const pos of portfolio.positions) {
      if (pos.supplied > 0) {
        const betterYield = activeMarkets.find(
          (m) =>
            m.symbol !== pos.symbol &&
            m.supplyAPY > pos.supplyAPY + config.minYieldDifferential &&
            m.utilizationRate < 90
        );
        if (betterYield) {
          return {
            action: "REBALANCE",
            reason: `${
              betterYield.symbol
            } offers ${betterYield.supplyAPY.toFixed(2)}% vs ${
              pos.symbol
            } at ${pos.supplyAPY.toFixed(2)}%.`,
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

  // Bullish
  if (
    sentiment.score > config.bullishThreshold &&
    sentiment.confidence >= config.confidenceMinimum &&
    sentiment.dataPoints.volatility < config.highVolatilityThreshold
  ) {
    const bestYield = markets
      .filter((m) => m.active && !m.frozen && m.supplyAPY > 0)
      .sort((a, b) => b.supplyAPY - a.supplyAPY)[0];
    if (bestYield) {
      return {
        action: "INCREASE_POSITION",
        reason: `Bullish sentiment (${
          sentiment.score
        }) with low volatility. Best yield: ${
          bestYield.symbol
        } at ${bestYield.supplyAPY.toFixed(2)}%.`,
        confidence: sentiment.confidence,
        params: { tokenSymbol: bestYield.symbol },
        timestamp: now,
      };
    }
  }

  // Default
  return {
    action: "HOLD",
    reason: `Market stable. Sentiment: ${sentiment.score}, Volatility: ${
      sentiment.dataPoints.volatility?.toFixed(0) || "N/A"
    }%. No action needed.`,
    confidence: 0.5,
    timestamp: now,
  };
}

// ── Action Executor (legacy) ────────────────────────────────

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
      } from Bonzo Finance. Reason: ${decision.reason}`;
      break;
    case "REPAY_DEBT":
      prompt = `KEEPER ACTION: Repay ${
        decision.params?.amount || "some"
      } of my ${decision.params?.tokenSymbol || ""} debt. Health factor: ${
        decision.params?.healthFactor?.toFixed(2) || "low"
      }.`;
      break;
    case "REBALANCE":
      prompt = `KEEPER ACTION: Rebalance from ${
        decision.params?.tokenSymbol || "unknown"
      } to ${decision.params?.targetAsset || "better yield"}. Reason: ${
        decision.reason
      }`;
      break;
    case "INCREASE_POSITION":
      prompt = `KEEPER ACTION: Check balance, then deposit into ${
        decision.params?.tokenSymbol || "best yield"
      } on Bonzo. Reason: ${decision.reason}`;
      break;
    case "EXIT_TO_STABLE":
      prompt = `KEEPER ACTION: Emergency exit. Withdraw all non-stable positions. Reason: ${decision.reason}`;
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
    return { executed: false, error: error.message };
  }
}

// ── Full Keeper Cycle (Multi-Agent Powered) ────────────────

/**
 * Run one complete keeper cycle using the multi-agent architecture.
 * Also automatically runs DCA tick to execute any due plans.
 *
 * Pipeline: Sentinel → Strategist → Auditor → Executor → Auditor
 */
export async function runKeeperCycle(
  config: StrategyConfig = DEFAULT_STRATEGY,
  executeActions: boolean = false
): Promise<KeeperCycleResult> {
  const startTime = Date.now();
  const accountId = process.env.HEDERA_ACCOUNT_ID;

  console.log("[Keeper] ═══════════════════════════════════════");
  console.log("[Keeper] Starting multi-agent keeper cycle...");
  console.log(`[Keeper] Account: ${accountId}`);
  console.log(`[Keeper] Execute mode: ${executeActions ? "LIVE" : "DRY-RUN"}`);

  try {
    // Run the full multi-agent cycle
    const multiResult = await runMultiAgentCycle(config, executeActions);

    // Also run DCA tick if execution is enabled
    let dcaCount = multiResult.dcaExecutions;
    if (executeActions) {
      const dcaTick = await runDCATick();
      dcaCount += dcaTick.executed;
    }

    // Map multi-agent result to legacy KeeperCycleResult format
    const topAction = multiResult.strategy.actions[0];
    const actionMap: Record<string, KeeperAction> = {
      LEND_DEPOSIT: "INCREASE_POSITION",
      LEND_WITHDRAW: "HARVEST",
      LEND_BORROW: "INCREASE_POSITION",
      LEND_REPAY: "REPAY_DEBT",
      VAULT_DEPOSIT: "INCREASE_POSITION",
      VAULT_WITHDRAW: "HARVEST",
      VAULT_HARVEST: "HARVEST",
      VAULT_SWITCH: "REBALANCE",
      STADER_STAKE: "INCREASE_POSITION",
      STADER_STRATEGY: "INCREASE_POSITION",
      DCA_EXECUTE: "INCREASE_POSITION",
      DCA_PAUSE: "HOLD",
      HOLD: "HOLD",
      EMERGENCY_EXIT: "EXIT_TO_STABLE",
    };

    const decision: KeeperDecision = {
      action: actionMap[topAction?.type || "HOLD"] || "HOLD",
      reason: topAction?.reasoning || "No action needed",
      confidence: topAction?.confidence || 0.5,
      params: topAction?.params,
      timestamp: multiResult.timestamp,
    };

    const sentiment = multiResult.intel.sentiment || {
      score: 0,
      signal: "HOLD" as const,
      confidence: 0,
      reasoning: "Sentiment unavailable",
      dataPoints: {
        hbarPrice: multiResult.intel.prices.hbar,
        hbarChange24h: 0,
        fearGreedIndex: 50,
        fearGreedValue: 50,
        fearGreedLabel: "Neutral",
        volatility: 40,
        volatilityTrend: "stable",
        newsCount: 0,
        btcDominance: 0,
      },
    };

    // Extract vault decision from strategy
    const vaultAction = multiResult.strategy.actions.find((a) =>
      a.type.startsWith("VAULT_")
    );
    const vaultDecision = vaultAction
      ? {
          vaultId: vaultAction.params.vaultId,
          action: vaultAction.type.replace("VAULT_", ""),
          reason: vaultAction.reasoning,
          confidence: vaultAction.confidence * 100,
        }
      : null;

    // HCS log status
    const hcsEntry = multiResult.auditEntries.find(
      (e) => e.phase === "decision"
    );
    const hcsLog = hcsEntry?.hcsLog || { logged: false, error: "Not logged" };

    // Execution status
    const execReport = multiResult.executions[0];
    const execution = execReport
      ? {
          executed: execReport.result.success,
          agentResponse: execReport.result.details,
          toolCalls: execReport.result.toolsUsed.map((t) => ({
            tool: t,
            input: "",
            output: "",
          })),
          error: execReport.result.error,
        }
      : {
          executed: false,
          agentResponse: executeActions
            ? "No actions to execute"
            : `[DRY RUN] Would execute: ${decision.action}`,
        };

    return {
      decision,
      sentiment,
      portfolio: multiResult.portfolio,
      markets: multiResult.intel.lendMarkets,
      execution,
      hcsLog,
      vaultDecision,
      dcaExecutions: dcaCount,
      agentsUsed: multiResult.agentsUsed,
      multiAgentResult: multiResult,
      timestamp: multiResult.timestamp,
      durationMs: Date.now() - startTime,
    };
  } catch (error: any) {
    console.error(`[Keeper] Multi-agent cycle failed: ${error.message}`);

    // Fallback: run legacy single-agent cycle
    console.log("[Keeper] Falling back to legacy single-agent cycle...");
    return runLegacyKeeperCycle(config, executeActions, startTime);
  }
}

// ── Legacy fallback (in case multi-agent pipeline fails) ───

async function runLegacyKeeperCycle(
  config: StrategyConfig,
  executeActions: boolean,
  startTime: number
): Promise<KeeperCycleResult> {
  const accountId = process.env.HEDERA_ACCOUNT_ID;

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
    return {
      decision: {
        action: "HOLD",
        reason: "Sentiment analysis unavailable.",
        confidence: 0,
        timestamp: new Date().toISOString(),
      },
      sentiment: {
        score: 0,
        signal: "HOLD",
        confidence: 0,
        reasoning: "Unavailable",
        dataPoints: {} as any,
      },
      portfolio,
      markets,
      execution: { executed: false, error: "No sentiment data" },
      hcsLog: { logged: false, error: "Skipped" },
      agentsUsed: ["legacy"],
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
    };
  }

  const decision = makeDecision(sentiment, portfolio, markets, config);

  let execution: KeeperCycleResult["execution"] = { executed: false };
  if (executeActions && decision.action !== "HOLD") {
    execution = await executeDecision(decision);
  } else if (!executeActions && decision.action !== "HOLD") {
    execution = {
      executed: false,
      agentResponse: `[DRY RUN] Would execute: ${decision.action}`,
    };
  }

  // Also run DCA tick
  if (executeActions) {
    try {
      await runDCATick();
    } catch {}
  }

  // HCS log
  let hcsLog: KeeperCycleResult["hcsLog"] = { logged: false };
  try {
    const topicId = await ensureAuditTopic();
    const log: AgentDecisionLog = {
      timestamp: decision.timestamp,
      agent: "VaultMind",
      version: "2.0.0",
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
    hcsLog = { logged: true, topicId, sequenceNumber: result.sequenceNumber };
  } catch (err: any) {
    hcsLog = { logged: false, error: err.message };
  }

  return {
    decision,
    sentiment,
    portfolio,
    markets,
    execution,
    hcsLog,
    agentsUsed: ["legacy"],
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
  };
}

// Re-export vault types for API compatibility
export {
  makeVaultDecision,
  getVaultsWithLiveData,
  compareVaults,
  getVaultsSummary,
  type VaultDecision,
  type BonzoVault,
  type VaultKeeperContext,
} from "./bonzo-vaults";
