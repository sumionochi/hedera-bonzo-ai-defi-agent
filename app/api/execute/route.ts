// ============================================
// /api/execute — Real Transaction Execution
// Direct contract calls to Bonzo Finance
// HBAR → WETHGateway | ERC20 → LendingPool
// Every action = real on-chain transaction
// ============================================

import { NextRequest, NextResponse } from "next/server";
import {
  executeDeposit,
  executeWithdraw,
  executeBorrow,
  executeRepay,
  type ExecutionResult,
} from "@/lib/bonzo-execute";
import {
  ensureAuditTopic,
  logDecisionToHCS,
  type AgentDecisionLog,
} from "@/lib/hcs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Normalize token symbol from user input
 */
function normalizeToken(raw: string): string {
  const upper = raw.toUpperCase().trim();
  if (upper.includes("-") || upper.includes("/")) {
    return upper.split(/[-\/]/)[0].trim();
  }
  return upper;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await req.json();
    const { action, params = {}, account } = body;

    if (!action) {
      return NextResponse.json(
        { success: false, error: "Action is required" },
        { status: 400 }
      );
    }

    const token = normalizeToken(params.token || params.asset || "HBAR");
    const amount = parseFloat(params.amount) || 0;
    const rateMode = params.rateMode || "variable";

    console.log(`[Execute] ═══════════════════════════════════════`);
    console.log(`[Execute] Action: ${action}`);
    console.log(`[Execute] Token: ${token}, Amount: ${amount}`);
    console.log(`[Execute] Account: ${account || "operator"}`);

    let result: ExecutionResult;

    switch (action) {
      // ── Lending: Supply / Deposit ──
      case "supply":
      case "deposit":
      case "vault_deposit": {
        if (amount <= 0) {
          return NextResponse.json(
            { success: false, error: "Amount must be > 0" },
            { status: 400 }
          );
        }
        result = await executeDeposit(token, amount);
        break;
      }

      // ── Lending: Withdraw ──
      case "withdraw":
      case "vault_withdraw": {
        result = await executeWithdraw(token, amount > 0 ? amount : undefined);
        break;
      }

      // ── Lending: Borrow ──
      case "borrow": {
        if (amount <= 0) {
          return NextResponse.json(
            { success: false, error: "Borrow amount must be > 0" },
            { status: 400 }
          );
        }
        result = await executeBorrow(token, amount, rateMode);
        break;
      }

      // ── Lending: Repay ──
      case "repay": {
        result = await executeRepay(
          token,
          amount > 0 ? amount : undefined,
          rateMode
        );
        break;
      }

      // ── Vault: Harvest ──
      case "vault_harvest": {
        result = {
          success: true,
          action: "harvest",
          txIds: [],
          hashScanLinks: [],
          details: `Bonzo Lend interest accrues automatically — no harvest transaction needed. Your aToken balance increases every second. For Beefy vault strategies (when deployed), harvest() would compound LP rewards.`,
          toolsUsed: ["interest-accrual-check"],
        };
        break;
      }

      // ── Vault: Switch ──
      case "vault_switch": {
        const withdrawResult = await executeWithdraw(token);
        if (!withdrawResult.success) {
          result = withdrawResult;
          break;
        }
        const depositResult = await executeDeposit(
          token,
          amount > 0 ? amount : 100
        );
        result = {
          success: depositResult.success,
          action: "switch",
          txIds: [...withdrawResult.txIds, ...depositResult.txIds],
          hashScanLinks: [
            ...withdrawResult.hashScanLinks,
            ...depositResult.hashScanLinks,
          ],
          details: `Vault switch: Withdrew ${token} → Deposited into ${
            params.target || "new strategy"
          }. ${depositResult.details}`,
          error: depositResult.error,
          toolsUsed: [...withdrawResult.toolsUsed, ...depositResult.toolsUsed],
        };
        break;
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    const elapsed = Date.now() - startTime;

    console.log(`[Execute] Status: ${result.success ? "SUCCESS" : "FAILED"}`);
    console.log(`[Execute] Tx IDs: ${result.txIds.join(", ") || "none"}`);
    console.log(`[Execute] Tools: ${result.toolsUsed.join(", ")}`);
    console.log(`[Execute] Completed in ${elapsed}ms`);

    // Log to HCS for immutable audit trail
    let hcsLog = null;
    try {
      const topicId = await ensureAuditTopic();
      const decision: AgentDecisionLog = {
        timestamp: new Date().toISOString(),
        agent: "VaultMind",
        version: "1.0.0",
        action: `EXECUTE_${action.toUpperCase()}`,
        reason: `${action} ${amount} ${token}: ${
          result.success ? "SUCCESS" : "FAILED"
        }${result.txIds.length > 0 ? ` (tx: ${result.txIds[0]})` : ""}`,
        confidence: result.success ? 1.0 : 0.0,
        context: {},
        params: {
          token,
          amount,
          rateMode,
          txIds: result.txIds,
          tools: result.toolsUsed,
        },
        walletAddress: account,
      };
      const hcsResult = await logDecisionToHCS(topicId, decision);
      hcsLog = { topicId, sequenceNumber: hcsResult.sequenceNumber };
      console.log(
        `[Execute] ✅ Logged to HCS: topic ${topicId}, seq ${hcsResult.sequenceNumber}`
      );
    } catch (hcsErr: any) {
      console.warn(
        `[Execute] HCS logging failed: ${(hcsErr as Error).message}`
      );
    }

    console.log(`[Execute] ═══════════════════════════════════════`);

    return NextResponse.json({
      success: true,
      data: {
        action,
        params: { token, amount, rateMode },
        status: result.success ? "success" : "failed",
        txIds: result.txIds,
        hashScanLinks: result.hashScanLinks,
        agentResponse: result.details,
        toolCalls: result.toolsUsed.map((t) => ({
          tool: t,
          input: "",
          output: "",
        })),
        hcsLog,
        durationMs: elapsed,
        error: result.error,
      },
    });
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Execute] ❌ Error after ${elapsed}ms:`, error.message);

    return NextResponse.json(
      {
        success: false,
        error: error.message || "Execution failed",
        durationMs: elapsed,
      },
      { status: 500 }
    );
  }
}
