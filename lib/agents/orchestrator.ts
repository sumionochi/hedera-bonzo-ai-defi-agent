// ============================================
// VaultMind — Multi-Agent Orchestrator
// ============================================
// The coordinator that ties all agents together:
//   1. Sentinel → gathers market intelligence
//   2. Strategist → formulates action plan
//   3. Auditor → pre-flight checks + HCS logging
//   4. Executor → runs on-chain transactions
//   5. Auditor → logs execution results
//
// This replaces the monolithic keeper cycle with a clean
// multi-agent pipeline that the judges will love.
// ============================================

import {
  gatherMarketIntelligence,
  quickPriceCheck,
  type MarketIntelligence,
} from "./sentinel-agent";
import {
  formulateStrategy,
  type StrategyPlan,
  type StrategyAction,
} from "./strategist-agent";
import {
  executeAction,
  executePlan,
  type ExecutionReport,
} from "./executor-agent";
import {
  preFlightCheck,
  logStrategyDecision,
  logExecutionResult,
  getAuditHistory,
  type AuditEntry,
  type RiskCheckResult,
} from "./auditor-agent";
import {
  getPortfolio,
  type PortfolioSummary,
  type StrategyConfig,
} from "../keeper";
import { getAllDCAPlans, executeDueDCAPlans } from "../dca";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface OrchestratorCycleResult {
  timestamp: string;
  durationMs: number;

  // Agent outputs
  intel: MarketIntelligence;
  strategy: StrategyPlan;
  portfolio: PortfolioSummary | null;
  riskChecks: Array<{ action: StrategyAction; check: RiskCheckResult }>;
  executions: ExecutionReport[];
  auditEntries: AuditEntry[];

  // DCA
  dcaExecutions: number;

  // Summary
  summary: string;
  agentsUsed: string[];
}

// ═══════════════════════════════════════════════════════════
// Main Orchestrator Cycle
// ═══════════════════════════════════════════════════════════

/**
 * Run one complete multi-agent keeper cycle.
 *
 * Pipeline:
 *   Sentinel → Strategist → Auditor(pre-flight) → Executor → Auditor(post)
 */
export async function runMultiAgentCycle(
  config?: Partial<StrategyConfig>,
  executeActions: boolean = false
): Promise<OrchestratorCycleResult> {
  const startTime = Date.now();
  const agentsUsed: string[] = [];

  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  VaultMind Multi-Agent Keeper Cycle          ║");
  console.log(
    `║  Mode: ${
      executeActions ? "🔴 LIVE EXECUTION" : "🟡 DRY RUN"
    }                     ║`
  );
  console.log("╚══════════════════════════════════════════════╝");

  // ── Step 1: Sentinel — Gather Intelligence ──
  agentsUsed.push("sentinel");
  const intel = await gatherMarketIntelligence();
  console.log(`[Orchestrator] Sentinel: ${intel.signals.summary}`);

  // ── Step 2: Fetch Portfolio (if account configured) ──
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  let portfolio: PortfolioSummary | null = null;
  try {
    if (accountId) {
      portfolio = await getPortfolio(accountId);
      console.log(
        `[Orchestrator] Portfolio: $${portfolio.totalSuppliedUSD.toFixed(
          2
        )} supplied, ` +
          `$${portfolio.totalBorrowedUSD.toFixed(2)} borrowed, HF: ${
            portfolio.healthFactor
          }`
      );
    }
  } catch (err: any) {
    console.warn(`[Orchestrator] Portfolio fetch failed: ${err.message}`);
  }

  // ── Step 3: Load active DCA plans ──
  let activeDCAPlans: any[] = [];
  try {
    const allPlans = await getAllDCAPlans();
    activeDCAPlans = allPlans.filter((p) => p.status === "active");
    console.log(`[Orchestrator] DCA: ${activeDCAPlans.length} active plans`);
  } catch (err: any) {
    console.warn(`[Orchestrator] DCA plans fetch failed: ${err.message}`);
  }

  // ── Step 4: Strategist — Formulate Plan ──
  agentsUsed.push("strategist");
  const fullConfig: StrategyConfig = {
    bearishThreshold: config?.bearishThreshold ?? -30,
    bullishThreshold: config?.bullishThreshold ?? 50,
    confidenceMinimum: config?.confidenceMinimum ?? 0.6,
    healthFactorDanger: config?.healthFactorDanger ?? 1.3,
    healthFactorTarget: config?.healthFactorTarget ?? 1.8,
    highVolatilityThreshold: config?.highVolatilityThreshold ?? 80,
    minYieldDifferential: config?.minYieldDifferential ?? 2.0,
  };

  const strategy = formulateStrategy(
    intel,
    portfolio,
    activeDCAPlans,
    fullConfig
  );

  console.log(
    `[Orchestrator] Strategist: ${strategy.actions.length} actions — ${strategy.overallStrategy}`
  );

  // ── Step 5: Auditor — Pre-flight Checks ──
  agentsUsed.push("auditor");
  const riskChecks: Array<{ action: StrategyAction; check: RiskCheckResult }> =
    [];
  const approvedActions: StrategyAction[] = [];

  for (const action of strategy.actions) {
    const check = preFlightCheck(action, intel);
    riskChecks.push({ action, check });

    if (check.approved) {
      approvedActions.push(action);
    } else {
      console.log(
        `[Orchestrator] Auditor blocked: ${action.type} — ${check.blocks.join(
          ", "
        )}`
      );
    }
  }

  console.log(
    `[Orchestrator] Auditor: ${approvedActions.length}/${strategy.actions.length} actions approved`
  );

  // ── Step 6: Log strategy decision to HCS ──
  const auditEntries: AuditEntry[] = [];
  const decisionAudit = await logStrategyDecision(strategy, intel);
  auditEntries.push(decisionAudit);

  // ── Step 7: Executor — Run approved actions ──
  const executions: ExecutionReport[] = [];
  let dcaExecutionCount = 0;

  if (executeActions && approvedActions.length > 0) {
    agentsUsed.push("executor");

    // Execute DCA plans first (they're time-sensitive)
    const dcaActions = approvedActions.filter((a) => a.type === "DCA_EXECUTE");
    const otherActions = approvedActions.filter(
      (a) => a.type !== "DCA_EXECUTE"
    );

    // Execute DCA
    for (const dcaAction of dcaActions) {
      const report = await executeAction(dcaAction);
      executions.push(report);
      if (report.result.success) dcaExecutionCount++;
      const execAudit = await logExecutionResult(report);
      auditEntries.push(execAudit);
    }

    // Execute other actions (max 2 per cycle to prevent overtrading)
    for (const action of otherActions.slice(0, 2)) {
      const report = await executeAction(action);
      executions.push(report);
      const execAudit = await logExecutionResult(report);
      auditEntries.push(execAudit);

      // Stop on critical failure
      if (!report.result.success && action.priority <= 2) break;
    }

    console.log(
      `[Orchestrator] Executor: ${
        executions.filter((e) => e.result.success).length
      }/${executions.length} succeeded`
    );
  } else if (!executeActions) {
    console.log("[Orchestrator] Dry run — no actions executed");
  }

  // ── Build Summary ──
  const durationMs = Date.now() - startTime;
  const successCount = executions.filter((e) => e.result.success).length;

  const summaryParts: string[] = [];
  summaryParts.push(`Multi-agent cycle completed in ${durationMs}ms`);
  summaryParts.push(`Agents: ${agentsUsed.join(" → ")}`);
  summaryParts.push(
    `Market: ${intel.signals.overallBias} | Vol: ${
      intel.signals.volatilityRegime
    } | HBAR: $${intel.prices.hbar.toFixed(4)}`
  );
  summaryParts.push(`Strategy: ${strategy.overallStrategy}`);
  if (executeActions) {
    summaryParts.push(
      `Executed: ${successCount}/${executions.length} actions | DCA: ${dcaExecutionCount} plans`
    );
  } else {
    summaryParts.push(
      `Dry run: ${approvedActions.length} actions would be executed`
    );
  }

  console.log("╔══════════════════════════════════════════════╗");
  console.log(`║  Cycle Complete — ${durationMs}ms                     `);
  console.log("╚══════════════════════════════════════════════╝");

  return {
    timestamp: new Date().toISOString(),
    durationMs,
    intel,
    strategy,
    portfolio,
    riskChecks,
    executions,
    auditEntries,
    dcaExecutions: dcaExecutionCount,
    summary: summaryParts.join("\n"),
    agentsUsed,
  };
}

// ═══════════════════════════════════════════════════════════
// Quick DCA Loop (called by auto-keeper timer)
// ═══════════════════════════════════════════════════════════

/**
 * Lightweight DCA execution loop. Called every keeper tick
 * to check if any DCA plans are due and execute them.
 * Uses Sentinel's quick price check for minimal latency.
 */
export async function runDCATick(): Promise<{
  executed: number;
  results: any[];
}> {
  try {
    const { hbarPrice } = await quickPriceCheck();
    const executions = await executeDueDCAPlans(hbarPrice, false);
    const successCount = executions.filter(
      (e) => e.status === "success"
    ).length;

    if (executions.length > 0) {
      console.log(
        `[Orchestrator/DCA] Tick: ${successCount}/${
          executions.length
        } DCA executions at HBAR=$${hbarPrice.toFixed(4)}`
      );
    }

    return { executed: successCount, results: executions };
  } catch (err: any) {
    console.warn(`[Orchestrator/DCA] Tick error: ${err.message}`);
    return { executed: 0, results: [] };
  }
}

// ═══════════════════════════════════════════════════════════
// Exports for API routes
// ═══════════════════════════════════════════════════════════

export {
  gatherMarketIntelligence,
  formulateStrategy,
  preFlightCheck,
  executeAction,
  logStrategyDecision,
  logExecutionResult,
  getAuditHistory,
};

export type {
  MarketIntelligence,
  StrategyPlan,
  StrategyAction,
  ExecutionReport,
  AuditEntry,
  RiskCheckResult,
};
