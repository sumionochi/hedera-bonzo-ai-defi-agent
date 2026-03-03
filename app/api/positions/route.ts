import { NextRequest, NextResponse } from "next/server";
import { getPortfolio } from "@/lib/keeper";

export const dynamic = "force-dynamic";

/**
 * GET /api/positions — Get user's Bonzo Finance positions
 * Query params:
 *   ?accountId=0.0.XXXXX — Override account (default: env HEDERA_ACCOUNT_ID)
 */
export async function GET(req: NextRequest) {
  const accountId =
    req.nextUrl.searchParams.get("accountId") || process.env.HEDERA_ACCOUNT_ID;

  if (!accountId) {
    return NextResponse.json(
      {
        success: false,
        error: "No account ID. Set HEDERA_ACCOUNT_ID in .env.local",
      },
      { status: 400 }
    );
  }

  try {
    const portfolio = await getPortfolio(accountId);

    return NextResponse.json({
      success: true,
      data: {
        accountId,
        ...portfolio,
      },
    });
  } catch (error: any) {
    // If it's a 404 or similar, the account likely has no positions
    console.error("[API/positions] Error:", error.message);
    return NextResponse.json({
      success: true,
      data: {
        accountId,
        positions: [],
        totalSuppliedUSD: 0,
        totalBorrowedUSD: 0,
        netWorthUSD: 0,
        healthFactor: 0,
        currentLtv: 0,
        maxLtv: 0,
        averageSupplyAPY: 0,
        averageBorrowAPY: 0,
        averageNetAPY: 0,
        note: "No Bonzo positions found or account not registered",
      },
    });
  }
}
