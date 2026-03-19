// ============================================
// VaultMind — Strategist Agent (Decision Engine)
// ============================================
// Role: Consumes MarketIntelligence from Sentinel and produces
//       actionable decisions for the Executor.
//
// Responsibilities:
//   1. Lending strategy (deposit/borrow/repay/withdraw on Bonzo Lend)
//   2. Vault strategy (which vault, when to harvest, when to switch)
//   3. DCA scheduling decisions (execute due plans, pause if risky)
//   4. HBARX strategy (when to stake, leverage opportunities)
//   5. Portfolio health assessment
//
// Input: MarketIntelligence from Sentinel
// Output: StrategyPlan with prioritized actions
// ============================================

import type { MarketIntelligence } from "./sentinel-agent";
import type { PortfolioSummary, StrategyConfig } from "../keeper";
import type { DCAPlan } from "../dca";
import {
  makeVaultDecision,
  type VaultKeeperContext,
  type VaultDecision,
} from "../bonzo-vaults";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type ActionType =
  | "LEND_DEPOSIT"
  | "LEND_WITHDRAW"
  | "LEND_BORROW"
  | "LEND_REPAY"
  | "VAULT_DEPOSIT"
  | "VAULT_WITHDRAW"
  | "VAULT_HARVEST"
  | "VAULT_SWITCH"
  | "STADER_STAKE"
  | "STADER_STRATEGY"
  | "DCA_EXECUTE"
  | "DCA_PAUSE"
  | "HOLD"
  | "EMERGENCY_EXIT";

export interface StrategyAction {
  type: ActionType;
  priority: number; // 1 (highest) to 10 (lowest)
  confidence: number; // 0-1
  description: string;
  reasoning: string;
  params: Record<string, any>;
  estimatedImpact?: string;
}

export interface StrategyPlan {
  timestamp: string;
  agent: "strategist";
  actions: StrategyAction[];
  overallStrategy: string;
  riskAssessment: string;
  marketSummary: string;
}

// ═══════════════════════════════════════════════════════════
// Default Strategy Config
// ═══════════════════════════════════════════════════════════

const DEFAULT_STRATEGY: StrategyConfig = {
  bearishThreshold: -30,
  bullishThreshold: 50,
  confidenceMinimum: 0.6,
  healthFactorDanger: 1.3,
  healthFactorTarget: 1.8,
  highVolatilityThreshold: 80,
  minYieldDifferential: 2.0,
};

// ═══════════════════════════════════════════════════════════
// Strategist Core
// ═══════════════════════════════════════════════════════════

/**
 * Produce a strategy plan based on market intelligence and portfolio state.
 */
export function formulateStrategy(
  intel: MarketIntelligence,
  portfolio: PortfolioSummary | null,
  activeDCAPlans: DCAPlan[] = [],
  config: StrategyConfig = DEFAULT_STRATEGY
): StrategyPlan {
  console.log("[Strategist] ▶ Formulating strategy...");

  const actions: StrategyAction[] = [];
  const { signals, sentiment, prices, lendMarkets, vaults, staderData } = intel;

  // ──────────────────────────────────────────
  // PRIORITY 1: Health Factor Emergency
  // ──────────────────────────────────────────
  if (
    portfolio &&
    portfolio.healthFactor > 0 &&
    portfolio.healthFactor < config.healthFactorDanger &&
    portfolio.totalBorrowedUSD > 0
  ) {
    const largestDebt = [...portfolio.positions]
      .filter((p) => p.borrowed > 0)
      .sort((a, b) => b.borrowedUSD - a.borrowedUSD)[0];

    actions.push({
      type: "LEND_REPAY",
      priority: 1,
      confidence: 0.95,
      description: `Emergency repay ${
        largestDebt?.symbol || "debt"
      } — health factor at ${portfolio.healthFactor.toFixed(2)}`,
      reasoning: `Health factor ${portfolio.healthFactor.toFixed(
        2
      )} is below danger threshold ${
        config.healthFactorDanger
      }. Immediate repayment required to prevent liquidation.`,
      params: {
        tokenSymbol: largestDebt?.symbol,
        amount: "25%",
        healthFactor: portfolio.healthFactor,
      },
    });

    // Also pause DCA if health is critical
    for (const plan of activeDCAPlans) {
      if (plan.status === "active") {
        actions.push({
          type: "DCA_PAUSE",
          priority: 2,
          confidence: 0.9,
          description: `Pause DCA plan ${plan.id} — health factor critical`,
          reasoning:
            "Pausing automated deposits while health factor is in danger zone.",
          params: { planId: plan.id },
        });
      }
    }
  }

  // ──────────────────────────────────────────
  // PRIORITY 2: DCA Execution
  // ──────────────────────────────────────────
  const now = new Date();
  for (const plan of activeDCAPlans) {
    if (plan.status !== "active") continue;
    if (now < new Date(plan.nextExecutionAt)) continue;

    // Check if we should skip due to extreme market conditions
    if (signals.riskLevel === "critical") {
      actions.push({
        type: "DCA_PAUSE",
        priority: 3,
        confidence: 0.8,
        description: `Temporarily skip DCA execution — market risk critical`,
        reasoning: `Market conditions are critical (${signals.summary}). Skipping DCA execution to protect capital.`,
        params: { planId: plan.id, reason: "critical_risk" },
      });
      continue;
    }

    actions.push({
      type: "DCA_EXECUTE",
      priority: 3,
      confidence: 0.85,
      description: `Execute DCA: ${plan.amount} ${plan.asset} → ${plan.action}`,
      reasoning: `Scheduled DCA execution due. HBAR at $${prices.hbar.toFixed(
        4
      )}.`,
      params: {
        planId: plan.id,
        amount: plan.amount,
        asset: plan.asset,
        action: plan.action,
        hbarPrice: prices.hbar,
      },
    });
  }

  // ──────────────────────────────────────────
  // PRIORITY 3: Vault Strategy
  // ──────────────────────────────────────────
  if (vaults.length > 0) {
    const vaultCtx: VaultKeeperContext = {
      vaults,
      sentimentScore: sentiment?.score || 0,
      volatility: sentiment?.dataPoints?.volatility || 40,
      hbarPrice: prices.hbar,
      fearGreedIndex: sentiment?.dataPoints?.fearGreedValue || 50,
      userHbarBalance: 1000, // TODO: fetch real balance
      userPositions: [],
    };

    const vaultDecision = makeVaultDecision(vaultCtx);

    if (vaultDecision.action !== "HOLD") {
      const typeMap: Record<string, ActionType> = {
        DEPOSIT: "VAULT_DEPOSIT",
        WITHDRAW: "VAULT_WITHDRAW",
        HARVEST: "VAULT_HARVEST",
        SWITCH_VAULT: "VAULT_SWITCH",
      };

      actions.push({
        type: typeMap[vaultDecision.action] || "HOLD",
        priority: 4,
        confidence: vaultDecision.confidence / 100,
        description: `Vault ${vaultDecision.action}: ${vaultDecision.vaultId}`,
        reasoning: vaultDecision.reason,
        params: {
          vaultId: vaultDecision.vaultId,
          amount: vaultDecision.amount,
          targetVaultId: vaultDecision.targetVaultId,
        },
      });
    }
  }

  // ──────────────────────────────────────────
  // PRIORITY 4: Lending Strategy
  // ──────────────────────────────────────────
  const score = sentiment?.score || 0;
  const volatility = sentiment?.dataPoints?.volatility || 40;

  // Bearish → Harvest/protect
  if (
    score < config.bearishThreshold &&
    (sentiment?.confidence || 0) >= config.confidenceMinimum
  ) {
    const volatilePositions = portfolio?.positions.filter(
      (p) => p.supplied > 0 && !["USDC", "USDT"].includes(p.symbol)
    );

    if (volatilePositions && volatilePositions.length > 0) {
      const largest = volatilePositions.sort(
        (a, b) => b.suppliedUSD - a.suppliedUSD
      )[0];

      actions.push({
        type: "LEND_WITHDRAW",
        priority: 5,
        confidence: sentiment?.confidence || 0.7,
        description: `Defensive withdraw ${largest.symbol} — bearish sentiment`,
        reasoning: `Sentiment score ${score} below bearish threshold. Withdrawing volatile position to protect capital.`,
        params: {
          tokenSymbol: largest.symbol,
          targetAsset: "USDC",
        },
      });
    }
  }

  // Bullish + low vol → Increase positions
  if (
    score > config.bullishThreshold &&
    volatility < config.highVolatilityThreshold &&
    (sentiment?.confidence || 0) >= config.confidenceMinimum
  ) {
    const bestYield = lendMarkets
      .filter((m) => m.active && !m.frozen && m.supplyAPY > 0)
      .sort((a, b) => b.supplyAPY - a.supplyAPY)[0];

    if (bestYield) {
      actions.push({
        type: "LEND_DEPOSIT",
        priority: 6,
        confidence: sentiment?.confidence || 0.7,
        description: `Bullish deposit into ${
          bestYield.symbol
        } (${bestYield.supplyAPY.toFixed(1)}% APY)`,
        reasoning: `Strong bullish sentiment (${score}) with manageable volatility (${volatility.toFixed(
          0
        )}%). Best yield: ${bestYield.symbol}.`,
        params: {
          tokenSymbol: bestYield.symbol,
          supplyAPY: bestYield.supplyAPY,
        },
      });
    }
  }

  // ──────────────────────────────────────────
  // PRIORITY 5: HBARX Strategy Opportunities
  // ──────────────────────────────────────────
  if (
    staderData &&
    signals.overallBias === "bullish" &&
    signals.volatilityRegime !== "extreme"
  ) {
    const lendingAPY =
      lendMarkets.find((m) => m.symbol === "HBARX" || m.symbol === "WHBAR")
        ?.supplyAPY || 0;

    const combinedAPY = staderData.stakingAPY + lendingAPY;

    if (combinedAPY > 3) {
      actions.push({
        type: "STADER_STRATEGY",
        priority: 7,
        confidence: 0.65,
        description: `HBARX yield-on-yield: staking ${
          staderData.stakingAPY
        }% + lending ${lendingAPY.toFixed(1)}% = ${combinedAPY.toFixed(
          1
        )}% combined`,
        reasoning: `Bullish conditions favor leveraged staking. HBARX exchange rate: ${staderData.exchangeRate.toFixed(
          6
        )}.`,
        params: {
          stakingAPY: staderData.stakingAPY,
          lendingAPY,
          combinedAPY,
          exchangeRate: staderData.exchangeRate,
        },
      });
    }
  }

  // ──────────────────────────────────────────
  // PRIORITY 6: Yield Rebalancing
  // ──────────────────────────────────────────
  if (portfolio && portfolio.positions.length > 0) {
    for (const pos of portfolio.positions) {
      if (pos.supplied > 0) {
        const betterYield = lendMarkets.find(
          (m) =>
            m.symbol !== pos.symbol &&
            m.active &&
            !m.frozen &&
            m.supplyAPY > pos.supplyAPY + config.minYieldDifferential &&
            m.utilizationRate < 90
        );

        if (betterYield) {
          actions.push({
            type: "LEND_DEPOSIT",
            priority: 8,
            confidence: 0.65,
            description: `Rebalance: ${pos.symbol} → ${betterYield.symbol} (+${(
              betterYield.supplyAPY - pos.supplyAPY
            ).toFixed(1)}% APY)`,
            reasoning: `${
              betterYield.symbol
            } at ${betterYield.supplyAPY.toFixed(1)}% vs current ${
              pos.symbol
            } at ${pos.supplyAPY.toFixed(1)}%.`,
            params: {
              fromToken: pos.symbol,
              toToken: betterYield.symbol,
              apyImprovement: betterYield.supplyAPY - pos.supplyAPY,
            },
          });
        }
      }
    }
  }

  // Default: HOLD if no actions
  if (actions.length === 0) {
    actions.push({
      type: "HOLD",
      priority: 10,
      confidence: 0.5,
      description: "No action needed — market stable",
      reasoning: signals.summary,
      params: {},
    });
  }

  // Sort by priority
  actions.sort((a, b) => a.priority - b.priority);

  const plan: StrategyPlan = {
    timestamp: new Date().toISOString(),
    agent: "strategist",
    actions,
    overallStrategy: deriveOverallStrategy(actions, signals),
    riskAssessment: `Risk: ${signals.riskLevel} | Volatility: ${
      signals.volatilityRegime
    } | Health: ${portfolio?.healthFactor?.toFixed(2) || "N/A"}`,
    marketSummary: signals.summary,
  };

  console.log(
    `[Strategist] ✅ Strategy: ${actions.length} actions — ` +
      `top: ${actions[0].type} (p${actions[0].priority}, conf ${(
        actions[0].confidence * 100
      ).toFixed(0)}%)`
  );

  return plan;
}

function deriveOverallStrategy(
  actions: StrategyAction[],
  signals: any
): string {
  const topAction = actions[0];
  if (!topAction) return "Monitor and hold";

  const strategyLabels: Record<string, string> = {
    EMERGENCY_EXIT: "Emergency capital protection",
    LEND_REPAY: "Defensive — repaying debt to maintain health",
    DCA_EXECUTE: "Systematic accumulation via DCA",
    VAULT_HARVEST: "Yield optimization — compounding rewards",
    VAULT_DEPOSIT: "Vault positioning for yield",
    LEND_WITHDRAW: "Defensive — reducing exposure",
    LEND_DEPOSIT: "Accumulation — increasing positions",
    STADER_STRATEGY: "Yield stacking — HBARX leverage play",
    HOLD: "Monitoring — no immediate action needed",
  };

  return (
    strategyLabels[topAction.type] ||
    `Executing ${topAction.type.toLowerCase().replace("_", " ")}`
  );
}
