import { NextRequest, NextResponse } from "next/server";
import {
  getVaultsWithLiveData,
  makeVaultDecision,
  compareVaults,
  getVaultsSummary,
  type VaultKeeperContext,
} from "@/lib/bonzo-vaults";
import { analyzeSentiment } from "@/lib/sentiment";

export const dynamic = "force-dynamic";

/**
 * GET /api/vaults
 *
 * Query params:
 *   ?action=list|compare|decide|summary
 *   ?goal=safe-yield|max-yield|balanced  (for compare)
 *   ?execute=true (for decide — triggers harvest/deposit)
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

      case "compare": {
        // Get sentiment for context-aware comparison
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
        // Full keeper decision with market context
        let sentimentScore = 0;
        let volatility = 40;
        let hbarPrice = 0.2;
        let fearGreedIndex = 50;

        try {
          const sentiment = await analyzeSentiment();
          sentimentScore = sentiment.score;
          volatility = sentiment.dataPoints.volatility;
          hbarPrice = sentiment.dataPoints.hbarPrice;
          fearGreedIndex = sentiment.dataPoints.fearGreedValue;
        } catch {}

        const ctx: VaultKeeperContext = {
          vaults,
          sentimentScore,
          volatility,
          hbarPrice,
          fearGreedIndex,
          userHbarBalance: 1000, // Default; real value from wallet
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
 * Body: { action: "harvest" | "deposit" | "withdraw", vaultId: string, amount?: number }
 * Executes vault operations via the keeper
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, vaultId, amount } = body;

    const vaults = await getVaultsWithLiveData();
    const vault = vaults.find((v) => v.id === vaultId);

    if (!vault) {
      return NextResponse.json(
        { success: false, error: `Vault not found: ${vaultId}` },
        { status: 404 }
      );
    }

    // In a production system, these would call the actual vault contracts
    // via Hedera Agent Kit's EVM contract call functionality.
    // For the hackathon demo, we return the transaction details that WOULD be sent.

    switch (action) {
      case "harvest": {
        return NextResponse.json({
          success: true,
          data: {
            action: "harvest",
            vault: vault.name,
            strategyAddress: vault.strategyAddress,
            functionSignature: "harvest()",
            calldata: "0x4641257d",
            description: `Harvesting accumulated rewards from ${vault.name} strategy. Rewards will be auto-compounded back into the vault position.`,
            estimatedGas: "0.0025 HBAR",
            note: "Harvest caller receives 0.05-0.5% of harvested rewards as incentive.",
          },
        });
      }

      case "deposit": {
        const depositAmount = amount || 100;
        return NextResponse.json({
          success: true,
          data: {
            action: "deposit",
            vault: vault.name,
            vaultAddress: vault.vaultAddress,
            amount: depositAmount,
            wantToken: vault.wantToken,
            steps: [
              {
                step: 1,
                action: `Approve ${vault.name} vault to spend ${depositAmount} ${vault.wantToken}`,
                contract: vault.wantTokenId,
                function: "approve(address,uint256)",
              },
              {
                step: 2,
                action: `Deposit ${depositAmount} ${vault.wantToken} into vault`,
                contract: vault.vaultAddress,
                function: "deposit(uint256)",
              },
            ],
            expectedShares: `~${(
              depositAmount / (vault.pricePerShare || 1)
            ).toFixed(4)} ${vault.symbol}`,
            estimatedAPY: `${vault.apy?.toFixed(1)}%`,
            description: `Depositing ${depositAmount} ${vault.wantToken} into ${
              vault.name
            }. You will receive ${
              vault.symbol
            } vault tokens representing your share. ${
              vault.harvestOnDeposit
                ? "Note: This deposit will also trigger a harvest, compounding rewards for all depositors."
                : ""
            }`,
          },
        });
      }

      case "withdraw": {
        const withdrawAmount = amount || 100;
        return NextResponse.json({
          success: true,
          data: {
            action: "withdraw",
            vault: vault.name,
            vaultAddress: vault.vaultAddress,
            amount: withdrawAmount,
            wantToken: vault.wantToken,
            function: amount ? "withdraw(uint256)" : "withdrawAll()",
            calldata: amount ? "0x2e1a7d4d..." : "0x853828b6",
            description: `Withdrawing from ${vault.name}. You will receive ${
              vault.wantToken
            } tokens proportional to your vault share. ${
              vault.strategy === "single-asset-dex"
                ? "Note: You may receive a mix of both underlying tokens from the liquidity position."
                : ""
            }`,
          },
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
