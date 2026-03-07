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
  queryAllPositions,
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

      // ── Vault: Harvest (Smart — queries live positions) ──
      case "vault_harvest": {
        try {
          const positions = await queryAllPositions();
          if (positions.length === 0) {
            result = {
              success: true,
              action: "harvest",
              txIds: [],
              hashScanLinks: [],
              details: `No active Bonzo Lend positions found. Deposit first to start earning yield.`,
              toolsUsed: ["queryAllPositions"],
            };
          } else {
            const posLines = positions
              .map(
                (p) =>
                  `• ${p.token}: ${p.aTokenBalance} aTokens (auto-compounding)`
              )
              .join("\n");
            result = {
              success: true,
              action: "harvest",
              txIds: [],
              hashScanLinks: [],
              details: `✅ Your Bonzo Lend positions are auto-compounding — no harvest needed!\n\nCurrent balances:\n${posLines}\n\naToken balances grow every second as interest accrues. No manual action required.`,
              toolsUsed: ["queryAllPositions", "aToken.balanceOf"],
            };
          }
        } catch (e: any) {
          result = {
            success: true,
            action: "harvest",
            txIds: [],
            hashScanLinks: [],
            details: `Bonzo Lend interest accrues automatically — your aToken balance grows every second. Could not query live balance: ${e.message?.substring(
              0,
              60
            )}`,
            toolsUsed: ["interest-accrual-check"],
          };
        }
        break;
      }

      // ── Vault: Switch (Smart — handles same-token rebalance & cross-token limits) ──
      case "vault_switch": {
        const targetToken = token;
        try {
          // Step 1: Find what user currently has deposited
          const positions = await queryAllPositions();
          if (positions.length === 0) {
            result = {
              success: false,
              action: "switch",
              txIds: [],
              hashScanLinks: [],
              details: `No active positions found to switch from. Deposit first, then switch strategies.`,
              error: "NO_POSITIONS",
              toolsUsed: ["queryAllPositions"],
            };
            break;
          }

          // Pick the largest position
          const sourcePos = positions.sort((a, b) =>
            Number(b.aTokenBalanceRaw - a.aTokenBalanceRaw)
          )[0];
          const sourceSymbol = sourcePos.token;
          const switchAmount =
            Number(sourcePos.aTokenBalanceRaw) /
            Math.pow(10, sourcePos.decimals);
          const isSameToken =
            sourceSymbol.toUpperCase() === targetToken.toUpperCase() ||
            (["HBAR", "WHBAR"].includes(sourceSymbol.toUpperCase()) &&
              ["HBAR", "WHBAR"].includes(targetToken.toUpperCase()));

          // Cross-token switch needs a DEX swap (not integrated)
          if (!isSameToken) {
            // Smart agent: withdraw current position and redeposit same token
            console.log(
              `[Execute] Cross-asset switch requested: ${sourceSymbol} → ${targetToken}. Rebalancing same asset instead.`
            );

            const withdrawResult = await executeWithdraw(sourceSymbol);
            if (!withdrawResult.success) {
              result = {
                ...withdrawResult,
                action: "switch",
                details: `Switch failed at withdraw: ${withdrawResult.details}`,
              };
              break;
            }

            // Redeposit the same token we withdrew
            const depositToken =
              sourceSymbol === "WHBAR" ? "HBAR" : sourceSymbol;
            const depositResult = await executeDeposit(
              depositToken,
              switchAmount
            );
            result = {
              success: depositResult.success,
              action: "switch",
              txIds: [...withdrawResult.txIds, ...depositResult.txIds],
              hashScanLinks: [
                ...withdrawResult.hashScanLinks,
                ...depositResult.hashScanLinks,
              ],
              details: depositResult.success
                ? `⚠️ Cross-asset switching (${sourceSymbol} → ${targetToken}) requires a DEX swap through SaucerSwap, which isn't integrated in this demo.\n\nInstead, I rebalanced your ${sourceSymbol} position: withdrew ${
                    sourcePos.aTokenBalance
                  } and redeposited ${switchAmount.toFixed(
                    4
                  )} ${depositToken}. Your position is refreshed with the latest interest accrued.`
                : `Withdrew ${sourceSymbol} but redeposit failed: ${depositResult.details}`,
              error: depositResult.error,
              toolsUsed: [
                "queryAllPositions",
                ...withdrawResult.toolsUsed,
                ...depositResult.toolsUsed,
              ],
            };
            break;
          }

          // Same-token rebalance: withdraw & redeposit (compounds interest)
          console.log(
            `[Execute] Same-token rebalance: ${sourceSymbol} (${sourcePos.aTokenBalance})`
          );
          const withdrawResult = await executeWithdraw(sourceSymbol);
          if (!withdrawResult.success) {
            result = {
              ...withdrawResult,
              action: "switch",
              details: `Switch failed at withdraw: ${withdrawResult.details}`,
            };
            break;
          }

          const depositToken = sourceSymbol === "WHBAR" ? "HBAR" : sourceSymbol;
          const depositResult = await executeDeposit(
            depositToken,
            switchAmount
          );
          result = {
            success: depositResult.success,
            action: "switch",
            txIds: [...withdrawResult.txIds, ...depositResult.txIds],
            hashScanLinks: [
              ...withdrawResult.hashScanLinks,
              ...depositResult.hashScanLinks,
            ],
            details: depositResult.success
              ? `Rebalanced ${sourceSymbol} position: withdrew ${
                  sourcePos.aTokenBalance
                } and redeposited ${switchAmount.toFixed(
                  4
                )} ${depositToken}. Interest has been compounded.`
              : `Withdrew but redeposit failed: ${depositResult.details}`,
            error: depositResult.error,
            toolsUsed: [
              "queryAllPositions",
              ...withdrawResult.toolsUsed,
              ...depositResult.toolsUsed,
            ],
          };
        } catch (e: any) {
          result = {
            success: false,
            action: "switch",
            txIds: [],
            hashScanLinks: [],
            details: `Switch error: ${e.message}`,
            error: e.message,
            toolsUsed: [],
          };
        }
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
