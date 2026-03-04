import { NextRequest, NextResponse } from "next/server";
import { runBacktest } from "@/lib/simulator";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/performance — Run backtest simulation
 * Query params:
 *   ?days=30 — Number of days to simulate (default: 30)
 *   ?investment=1000 — Initial investment in USD (default: 1000)
 */
export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "30");
  const investment = parseFloat(
    req.nextUrl.searchParams.get("investment") || "1000"
  );

  try {
    const result = await runBacktest(
      Math.min(days, 90), // Cap at 90 days
      Math.max(100, Math.min(investment, 100000)) // Clamp
    );

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    console.error("[API/performance] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
