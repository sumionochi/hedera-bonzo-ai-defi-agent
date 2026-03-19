// ============================================
// VaultMind — Executor Agent (Transaction Runner)
// ============================================
// Role: Receives action plans from the Strategist and executes
//       real on-chain transactions. Reports results back.
//
// Responsibilities:
//   1. Execute Bonzo Lend operations (deposit/borrow/repay/withdraw)
//   2. Execute vault operations (deposit/withdraw/harvest)
//   3. Execute Stader staking operations
//   4. Execute DCA plan deposits
//   5. Return structured execution results
//
// Input: StrategyAction from Strategist
// Output: ExecutionReport
// ============================================

import {
  executeDeposit,
  executeWithdraw,
  executeBorrow,
  executeRepay,
  type ExecutionResult,
} from "../bonzo-execute";
import {
  executeVaultDeposit,
  executeVaultWithdraw,
  executeVaultHarvest,
  type VaultExecutionResult,
} from "../vault-execute";
import {
  stakeHbar,
  executeHbarxStrategy,
  type StrategyResult,
} from "../stader";
import { executeDueDCAPlans, type DCAExecution } from "../dca";
import type { StrategyAction } from "./strategist-agent";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface ExecutionReport {
  timestamp: string;
  agent: "executor";
  action: StrategyAction;
  result: {
    success: boolean;
    txIds: string[];
    hashScanLinks: string[];
    details: string;
    error?: string;
    toolsUsed: string[];
    data?: any;
  };
  durationMs: number;
}

// ═══════════════════════════════════════════════════════════
// Executor Core
// ═══════════════════════════════════════════════════════════

/**
 * Execute a single strategy action on-chain.
 */
export async function executeAction(
  action: StrategyAction
): Promise<ExecutionReport> {
  const startTime = Date.now();
  console.log(`[Executor] ▶ Executing: ${action.type} — ${action.description}`);

  let result: ExecutionReport["result"];

  try {
    switch (action.type) {
      case "LEND_DEPOSIT":
        result = await executeLendDeposit(action);
        break;
      case "LEND_WITHDRAW":
        result = await executeLendWithdraw(action);
        break;
      case "LEND_BORROW":
        result = await executeLendBorrow(action);
        break;
      case "LEND_REPAY":
        result = await executeLendRepay(action);
        break;
      case "VAULT_DEPOSIT":
        result = await executeVaultDepositAction(action);
        break;
      case "VAULT_WITHDRAW":
        result = await executeVaultWithdrawAction(action);
        break;
      case "VAULT_HARVEST":
        result = await executeVaultHarvestAction(action);
        break;
      case "STADER_STAKE":
        result = await executeStaderStake(action);
        break;
      case "STADER_STRATEGY":
        result = await executeStaderStrategy(action);
        break;
      case "DCA_EXECUTE":
        result = await executeDCA(action);
        break;
      case "HOLD":
        result = {
          success: true,
          txIds: [],
          hashScanLinks: [],
          details: "No action taken — holding positions.",
          toolsUsed: [],
        };
        break;
      default:
        result = {
          success: false,
          txIds: [],
          hashScanLinks: [],
          details: `Unknown action type: ${action.type}`,
          error: "UNKNOWN_ACTION",
          toolsUsed: [],
        };
    }
  } catch (err: any) {
    result = {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: `Execution error: ${err.message}`,
      error: err.message,
      toolsUsed: [],
    };
  }

  const durationMs = Date.now() - startTime;
  const emoji = result.success ? "✅" : "❌";
  console.log(
    `[Executor] ${emoji} ${action.type} completed in ${durationMs}ms — ` +
      `${result.txIds.length} tx(s), ${result.toolsUsed.length} tools`
  );

  return {
    timestamp: new Date().toISOString(),
    agent: "executor",
    action,
    result,
    durationMs,
  };
}

/**
 * Execute multiple actions in sequence (respecting priority order).
 */
export async function executePlan(
  actions: StrategyAction[],
  maxActions: number = 3
): Promise<ExecutionReport[]> {
  const reports: ExecutionReport[] = [];

  // Only execute top N actions by priority
  const toExecute = actions
    .filter((a) => a.type !== "HOLD")
    .slice(0, maxActions);

  for (const action of toExecute) {
    const report = await executeAction(action);
    reports.push(report);

    // Stop on failure of critical actions (priority 1-2)
    if (!report.result.success && action.priority <= 2) {
      console.warn(
        `[Executor] ⚠️ Critical action failed (p${action.priority}), stopping plan execution`
      );
      break;
    }
  }

  return reports;
}

// ═══════════════════════════════════════════════════════════
// Action Handlers
// ═══════════════════════════════════════════════════════════

async function executeLendDeposit(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { tokenSymbol, amount } = action.params;
  if (!tokenSymbol || !amount) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing tokenSymbol or amount for deposit",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeDeposit(tokenSymbol, amount);
  return mapExecutionResult(result);
}

async function executeLendWithdraw(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { tokenSymbol, amount } = action.params;
  if (!tokenSymbol) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing tokenSymbol for withdraw",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeWithdraw(tokenSymbol, amount);
  return mapExecutionResult(result);
}

async function executeLendBorrow(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { tokenSymbol, amount } = action.params;
  if (!tokenSymbol || !amount) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing params for borrow",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeBorrow(tokenSymbol, amount);
  return mapExecutionResult(result);
}

async function executeLendRepay(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { tokenSymbol, amount } = action.params;
  if (!tokenSymbol) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing tokenSymbol for repay",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const repayAmount = amount === "25%" ? undefined : amount;
  const result = await executeRepay(tokenSymbol, repayAmount);
  return mapExecutionResult(result);
}

async function executeVaultDepositAction(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { vaultId, amount } = action.params;
  if (!vaultId) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing vaultId",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeVaultDeposit(vaultId, amount || 100);
  return mapVaultResult(result);
}

async function executeVaultWithdrawAction(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { vaultId, shares } = action.params;
  if (!vaultId) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing vaultId",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeVaultWithdraw(vaultId, shares);
  return mapVaultResult(result);
}

async function executeVaultHarvestAction(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { vaultId } = action.params;
  if (!vaultId) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing vaultId",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeVaultHarvest(vaultId);
  return mapVaultResult(result);
}

async function executeStaderStake(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { amount } = action.params;
  if (!amount) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing amount for Stader stake",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await stakeHbar(amount);
  return mapExecutionResult(result);
}

async function executeStaderStrategy(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { amount, withBorrow, borrowAmount } = action.params;
  if (!amount) {
    return {
      success: false,
      txIds: [],
      hashScanLinks: [],
      details: "Missing amount for HBARX strategy",
      error: "MISSING_PARAMS",
      toolsUsed: [],
    };
  }
  const result = await executeHbarxStrategy(amount, withBorrow, borrowAmount);
  return {
    success: result.overallStatus === "success",
    txIds: result.steps.filter((s) => s.txId).map((s) => s.txId!),
    hashScanLinks: [],
    details: result.summary,
    error: result.overallStatus === "failed" ? result.summary : undefined,
    toolsUsed: result.steps.map((s) => s.name),
    data: result,
  };
}

async function executeDCA(
  action: StrategyAction
): Promise<ExecutionReport["result"]> {
  const { hbarPrice } = action.params;
  const executions = await executeDueDCAPlans(hbarPrice || 0, false);

  const successCount = executions.filter((e) => e.status === "success").length;
  const failCount = executions.filter((e) => e.status === "failed").length;

  return {
    success: failCount === 0 && successCount > 0,
    txIds: executions.filter((e) => e.txId).map((e) => e.txId!),
    hashScanLinks: [],
    details: `DCA: ${successCount} successful, ${failCount} failed out of ${executions.length} executions`,
    error: failCount > 0 ? `${failCount} DCA execution(s) failed` : undefined,
    toolsUsed: ["DCA.executeDueDCAPlans"],
    data: { executions },
  };
}

// ═══════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════

function mapExecutionResult(r: ExecutionResult): ExecutionReport["result"] {
  return {
    success: r.success,
    txIds: r.txIds,
    hashScanLinks: r.hashScanLinks,
    details: r.details,
    error: r.error,
    toolsUsed: r.toolsUsed,
  };
}

function mapVaultResult(r: VaultExecutionResult): ExecutionReport["result"] {
  return {
    success: r.success,
    txIds: r.txIds,
    hashScanLinks: r.hashScanLinks,
    details: r.details,
    error: r.error,
    toolsUsed: r.toolsUsed,
    data: r.data,
  };
}
