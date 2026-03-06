import { NextRequest, NextResponse } from "next/server";
import { getBonzoAccountDashboard } from "@/lib/bonzo";
import { getVaultsWithLiveData } from "@/lib/bonzo-vaults";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard?accountId=0.0.XXXXX
 * Fetches real user positions from Bonzo Finance
 */
export async function GET(req: NextRequest) {
  const accountId =
    req.nextUrl.searchParams.get("accountId") || process.env.HEDERA_ACCOUNT_ID;

  if (!accountId) {
    return NextResponse.json(
      {
        success: false,
        error: "accountId required (query param or HEDERA_ACCOUNT_ID env)",
      },
      { status: 400 }
    );
  }

  try {
    const [dashboard, vaults] = await Promise.all([
      getBonzoAccountDashboard(accountId),
      getVaultsWithLiveData().catch(() => []),
    ]);

    // Filter to only reserves where user has a position
    const activePositions = dashboard.reserves.filter((r) => {
      const supplied = parseFloat(r.atokenBalance.token_display || "0");
      const borrowed =
        parseFloat(r.variableDebtBalance.token_display || "0") +
        parseFloat(r.stableDebtBalance.token_display || "0");
      return supplied > 0 || borrowed > 0;
    });

    return NextResponse.json({
      success: true,
      data: {
        accountId,
        evmAddress: dashboard.evmAddress,
        positions: activePositions.map((r) => ({
          symbol: r.symbol,
          supplied: r.atokenBalance.token_display,
          suppliedUSD: r.atokenBalance.usd_display,
          borrowed: r.variableDebtBalance.token_display,
          borrowedUSD: r.variableDebtBalance.usd_display,
          supplyAPY: r.supplyAPY,
          borrowAPY: r.variableBorrowAPY,
          collateralEnabled: r.useAsCollateralEnabled,
        })),
        // Bonzo Vaults data
        vaults: vaults.map((v) => ({
          id: v.id,
          name: v.name,
          strategy: v.strategy,
          apy: v.apy,
          tvl: v.tvl,
          risk: v.riskLevel,
          protocol: v.underlyingProtocol,
          wantToken: v.wantToken,
          isPaused: v.isPaused,
        })),
        vaultsSummary: {
          count: vaults.length,
          totalTVL: vaults.reduce((s, v) => s + (v.tvl || 0), 0),
          bestAPY: Math.max(...vaults.map((v) => v.apy || 0)),
          bestVault: vaults.sort((a, b) => (b.apy || 0) - (a.apy || 0))[0]
            ?.name,
        },
        credit: {
          totalSupplied: dashboard.userCredit.totalSupply.hbar_display,
          totalSuppliedUSD: dashboard.userCredit.totalSupply.usd_display,
          totalCollateral: dashboard.userCredit.totalCollateral.hbar_display,
          totalDebt: dashboard.userCredit.totalDebt.hbar_display,
          totalDebtUSD: dashboard.userCredit.totalDebt.usd_display,
          healthFactor: dashboard.userCredit.healthFactor,
          currentLtv: dashboard.userCredit.currentLtv,
          creditLimit: dashboard.userCredit.creditLimit.hbar_display,
        },
        averageNetApy: dashboard.averageNetApy,
        hbarBalance: dashboard.userCredit.hbarBalance.hbar_display,
        timestamp: dashboard.timestamp,
      },
    });
  } catch (error: any) {
    console.error("[API/dashboard] Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
