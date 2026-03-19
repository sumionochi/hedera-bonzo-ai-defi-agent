import { NextRequest, NextResponse } from "next/server";
import {
  getVaultsWithLiveData,
  makeVaultDecision,
  compareVaults,
  getVaultsSummary,
  type VaultKeeperContext,
} from "@/lib/bonzo-vaults";
import {
  executeVaultDeposit,
  executeVaultWithdraw,
  executeVaultHarvest,
  queryVaultData,
} from "@/lib/vault-execute";
import { analyzeSentiment } from "@/lib/sentiment";
import { getHbarPrice } from "@/lib/pyth";

export const dynamic = "force-dynamic";

/**
 * GET /api/vaults
 *
 * Query params:
 *   ?action=list|compare|decide|summary|query
 *   ?goal=safe-yield|max-yield|balanced  (for compare)
 *   ?vaultId=xxx (for query — gets real on-chain data)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") || "list";
  const goal = (sp.get("goal") || "balanced") as
    | "safe-yield"
    | "max-yield"
    | "balanced";

  try {
    const vaults = await getVaultsWithLiveData();

    switch (action) {
      case "list": {
        return NextResponse.json({
          success: true,
          data: {
            vaults,
            count: vaults.length,
            totalTVL: vaults.reduce((sum, v) => sum + (v.tvl || 0), 0),
            avgAPY:
              vaults.reduce((sum, v) => sum + (v.apy || 0), 0) / vaults.length,
          },
        });
      }

      case "query": {
        const vaultId = sp.get("vaultId");
        if (!vaultId) {
          return NextResponse.json(
            { success: false, error: "vaultId required" },
            { status: 400 }
          );
        }
        const liveData = await queryVaultData(vaultId);
        if (!liveData) {
          return NextResponse.json(
            {
              success: false,
              error: `Vault not found or query failed: ${vaultId}`,
            },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: { vaultId, liveData },
        });
      }

      case "compare": {
        let sentimentScore = 0;
        let volatility = 40;
        try {
          const sentiment = await analyzeSentiment();
          sentimentScore = sentiment.score;
          volatility = sentiment.dataPoints.volatility;
        } catch {}

        const comparisons = compareVaults(
          vaults,
          goal,
          sentimentScore,
          volatility
        );
        return NextResponse.json({
          success: true,
          data: {
            goal,
            sentimentScore,
            volatility,
            comparisons,
          },
        });
      }

      case "decide": {
        let sentimentScore = 0;
        let volatility = 40;
        let hbarPrice = 0.2;
        let fearGreedIndex = 50;

        try {
          const sentiment = await analyzeSentiment();
          sentimentScore = sentiment.score;
          volatility = sentiment.dataPoints.volatility;
          fearGreedIndex = sentiment.dataPoints.fearGreedValue;
        } catch {}

        // Get real HBAR price from Pyth
        try {
          const pythPrice = await getHbarPrice();
          if (pythPrice.price > 0) hbarPrice = pythPrice.price;
        } catch {}

        const ctx: VaultKeeperContext = {
          vaults,
          sentimentScore,
          volatility,
          hbarPrice,
          fearGreedIndex,
          userHbarBalance: 1000,
          userPositions: [],
        };

        const decision = makeVaultDecision(ctx);

        return NextResponse.json({
          success: true,
          data: {
            decision,
            marketContext: {
              sentimentScore,
              volatility,
              hbarPrice,
              hbarPriceSource: "pyth",
              fearGreedIndex,
            },
            vaultState: vaults.find((v) => v.id === decision.vaultId),
          },
        });
      }

      case "summary": {
        const summary = getVaultsSummary(vaults);
        return NextResponse.json({
          success: true,
          data: { summary },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[API/vaults] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vaults
 *
 * Body: { action: "harvest"|"deposit"|"withdraw", vaultId: string, amount?: number }
 *
 * On mainnet: Executes REAL on-chain vault transactions.
 * On testnet: Returns error (vault contracts are mainnet-only).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, vaultId, amount } = body;

    if (!vaultId) {
      return NextResponse.json(
        { success: false, error: "vaultId required" },
        { status: 400 }
      );
    }

    switch (action) {
      case "harvest": {
        const result = await executeVaultHarvest(vaultId);
        return NextResponse.json({
          success: result.success,
          data: {
            action: "harvest",
            vault: result.vaultName,
            txIds: result.txIds,
            hashScanLinks: result.hashScanLinks,
            details: result.details,
            toolsUsed: result.toolsUsed,
          },
          error: result.error,
        });
      }

      case "deposit": {
        const depositAmount = amount || 100;
        const result = await executeVaultDeposit(vaultId, depositAmount);
        return NextResponse.json({
          success: result.success,
          data: {
            action: "deposit",
            vault: result.vaultName,
            amount: depositAmount,
            txIds: result.txIds,
            hashScanLinks: result.hashScanLinks,
            details: result.details,
            toolsUsed: result.toolsUsed,
          },
          error: result.error,
        });
      }

      case "withdraw": {
        const result = await executeVaultWithdraw(vaultId, amount);
        return NextResponse.json({
          success: result.success,
          data: {
            action: "withdraw",
            vault: result.vaultName,
            txIds: result.txIds,
            hashScanLinks: result.hashScanLinks,
            details: result.details,
            toolsUsed: result.toolsUsed,
          },
          error: result.error,
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[API/vaults] POST Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
