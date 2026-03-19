// ============================================
// VaultMind — Auditor Agent (Compliance & Audit)
// ============================================
// Role: Logs every decision and execution to HCS for immutable
//       audit trail. Validates actions before execution.
//
// Responsibilities:
//   1. Log all strategy decisions to HCS
//   2. Log all execution results to HCS
//   3. Pre-flight risk checks before execution
//   4. Track cumulative risk exposure
//   5. Provide audit history retrieval
// ============================================

import {
  ensureAuditTopic,
  logDecisionToHCS,
  getDecisionHistory,
  type AgentDecisionLog,
} from "../hcs";
import type { StrategyPlan, StrategyAction } from "./strategist-agent";
import type { ExecutionReport } from "./executor-agent";
import type { MarketIntelligence } from "./sentinel-agent";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface AuditEntry {
  timestamp: string;
  agent: "auditor";
  phase: "pre-flight" | "decision" | "execution" | "post-flight";
  action: string;
  approved: boolean;
  reason: string;
  hcsLog?: {
    logged: boolean;
    topicId?: string;
    sequenceNumber?: number;
    error?: string;
  };
}

export interface RiskCheckResult {
  approved: boolean;
  warnings: string[];
  blocks: string[];
  riskScore: number; // 0-100
}

// ═══════════════════════════════════════════════════════════
// Pre-Flight Risk Checks
// ═══════════════════════════════════════════════════════════

/**
 * Validate an action before the Executor runs it.
 * Returns approval/rejection with reasoning.
 */
export function preFlightCheck(
  action: StrategyAction,
  intel: MarketIntelligence,
  recentHistory: AuditEntry[] = []
): RiskCheckResult {
  const warnings: string[] = [];
  const blocks: string[] = [];
  let riskScore = 0;

  // Check: Don't execute low-confidence actions
  if (action.confidence < 0.4) {
    blocks.push(
      `Confidence too low (${(action.confidence * 100).toFixed(
        0
      )}% < 40% threshold)`
    );
    riskScore += 40;
  }

  // Check: Don't deposit during extreme volatility
  if (
    intel.signals.volatilityRegime === "extreme" &&
    (action.type === "LEND_DEPOSIT" || action.type === "VAULT_DEPOSIT")
  ) {
    warnings.push(
      `Depositing during extreme volatility (${intel.signals.volatilityRegime})`
    );
    riskScore += 25;
  }

  // Check: Don't borrow when risk is critical
  if (intel.signals.riskLevel === "critical" && action.type === "LEND_BORROW") {
    blocks.push("Borrowing blocked — market risk is critical");
    riskScore += 50;
  }

  // Check: Rate-limit actions (prevent spam)
  const recentSameType = recentHistory.filter(
    (e) =>
      e.action === action.type &&
      Date.now() - new Date(e.timestamp).getTime() < 5 * 60 * 1000
  );
  if (recentSameType.length >= 3) {
    blocks.push(
      `Rate limited: ${action.type} executed ${recentSameType.length} times in last 5 min`
    );
    riskScore += 30;
  }

  // Check: Don't leverage during bearish + high vol
  if (
    action.type === "STADER_STRATEGY" &&
    intel.signals.overallBias === "bearish" &&
    intel.signals.volatilityRegime === "high"
  ) {
    blocks.push("HBARX leverage blocked — bearish + high volatility");
    riskScore += 40;
  }

  const approved = blocks.length === 0;

  if (!approved) {
    console.log(`[Auditor] ❌ BLOCKED: ${action.type} — ${blocks.join("; ")}`);
  } else if (warnings.length > 0) {
    console.log(
      `[Auditor] ⚠️ APPROVED with warnings: ${action.type} — ${warnings.join(
        "; "
      )}`
    );
  }

  return {
    approved,
    warnings,
    blocks,
    riskScore: Math.min(100, riskScore),
  };
}

// ═══════════════════════════════════════════════════════════
// HCS Logging
// ═══════════════════════════════════════════════════════════

/**
 * Log a strategy decision to HCS.
 */
export async function logStrategyDecision(
  plan: StrategyPlan,
  intel: MarketIntelligence
): Promise<AuditEntry> {
  const topAction = plan.actions[0];

  try {
    const topicId = await ensureAuditTopic();

    const log: AgentDecisionLog = {
      timestamp: plan.timestamp,
      agent: "VaultMind",
      version: "2.0.0",
      action: topAction?.type || "HOLD",
      reason: topAction?.reasoning || plan.overallStrategy,
      confidence: topAction?.confidence || 0.5,
      context: {
        sentimentScore: intel.sentiment?.score,
        sentimentSignal: intel.sentiment?.signal,
        volatility: intel.sentiment?.dataPoints?.volatility,
        fearGreedIndex: intel.sentiment?.dataPoints?.fearGreedValue,
        hbarPrice: intel.prices.hbar,
        hbarChange24h: intel.sentiment?.dataPoints?.hbarChange24h,
      },
      params: {
        actionCount: plan.actions.length,
        overallStrategy: plan.overallStrategy,
        riskAssessment: plan.riskAssessment,
        agentArchitecture: "multi-agent-v2",
        agents: ["sentinel", "strategist", "executor", "auditor"],
      },
    };

    const result = await logDecisionToHCS(topicId, log);

    console.log(
      `[Auditor] ✅ Decision logged to HCS: topic ${topicId}, seq ${result.sequenceNumber}`
    );

    return {
      timestamp: new Date().toISOString(),
      agent: "auditor",
      phase: "decision",
      action: topAction?.type || "HOLD",
      approved: true,
      reason: `Logged: ${plan.overallStrategy}`,
      hcsLog: {
        logged: true,
        topicId,
        sequenceNumber: result.sequenceNumber,
      },
    };
  } catch (err: any) {
    console.error(`[Auditor] HCS logging failed: ${err.message}`);
    return {
      timestamp: new Date().toISOString(),
      agent: "auditor",
      phase: "decision",
      action: topAction?.type || "HOLD",
      approved: true,
      reason: `Decision made but HCS log failed: ${err.message}`,
      hcsLog: { logged: false, error: err.message },
    };
  }
}

/**
 * Log an execution result to HCS.
 */
export async function logExecutionResult(
  report: ExecutionReport
): Promise<AuditEntry> {
  try {
    const topicId = await ensureAuditTopic();

    const log: AgentDecisionLog = {
      timestamp: report.timestamp,
      agent: "VaultMind",
      version: "2.0.0",
      action: `EXEC_${report.action.type}`,
      reason: report.result.success
        ? `Executed: ${report.result.details}`
        : `Failed: ${report.result.error}`,
      confidence: report.action.confidence,
      context: {
        hbarPrice: report.action.params.hbarPrice,
      },
      params: {
        success: report.result.success,
        txIds: report.result.txIds,
        toolsUsed: report.result.toolsUsed,
        durationMs: report.durationMs,
        agentArchitecture: "multi-agent-v2",
      },
    };

    const result = await logDecisionToHCS(topicId, log);

    return {
      timestamp: new Date().toISOString(),
      agent: "auditor",
      phase: "execution",
      action: `EXEC_${report.action.type}`,
      approved: true,
      reason: report.result.details,
      hcsLog: {
        logged: true,
        topicId,
        sequenceNumber: result.sequenceNumber,
      },
    };
  } catch (err: any) {
    return {
      timestamp: new Date().toISOString(),
      agent: "auditor",
      phase: "execution",
      action: `EXEC_${report.action.type}`,
      approved: true,
      reason: `Execution logged locally but HCS failed: ${err.message}`,
      hcsLog: { logged: false, error: err.message },
    };
  }
}

/**
 * Get audit history from HCS.
 */
export async function getAuditHistory(
  limit: number = 50
): Promise<AgentDecisionLog[]> {
  try {
    const topicId = await ensureAuditTopic();
    return getDecisionHistory(topicId, limit);
  } catch (err: any) {
    console.error(`[Auditor] Failed to fetch history: ${err.message}`);
    return [];
  }
}
