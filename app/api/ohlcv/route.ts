import { NextRequest, NextResponse } from "next/server";
import {
  getCachedOHLCV,
  getPriceHistory,
  getLatestPrice,
  getTechnicalIndicators,
  getCacheStats,
  prefetchPopularPools,
  POPULAR_POOLS,
} from "@/lib/ohlcv-cache";

export const dynamic = "force-dynamic";

// Pre-fetch on first request
let prefetched = false;

/**
 * GET /api/ohlcv
 *
 * Query params:
 *   ?pool=hbar-usdc (or poolId=2)
 *   ?interval=DAY|HOUR|FIVEMIN
 *   ?limit=30
 *   ?action=candles|price|latest|indicators|stats|pools
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") || "candles";
  const poolName = sp.get("pool") || "hbar-usdc";
  const poolIdStr = sp.get("poolId");
  const interval = (sp.get("interval") || "DAY") as "DAY" | "HOUR" | "FIVEMIN";
  const limit = parseInt(sp.get("limit") || "30");

  // Resolve pool ID
  const poolId = poolIdStr
    ? parseInt(poolIdStr)
    : POPULAR_POOLS[poolName]?.poolId || 2;

  // Trigger pre-fetch on first request
  if (!prefetched) {
    prefetched = true;
    prefetchPopularPools().catch(console.error);
  }

  try {
    switch (action) {
      case "candles": {
        const bars = await getCachedOHLCV(poolId, interval, limit);
        const poolInfo = Object.values(POPULAR_POOLS).find(
          (p) => p.poolId === poolId
        );
        return NextResponse.json({
          success: true,
          data: {
            poolId,
            pair: poolInfo?.pair || `Pool ${poolId}`,
            interval,
            bars,
            count: bars.length,
            cached: true,
          },
        });
      }

      case "price": {
        const prices = await getPriceHistory(poolId, interval, limit);
        return NextResponse.json({
          success: true,
          data: { poolId, interval, prices, count: prices.length },
        });
      }

      case "latest": {
        const latest = await getLatestPrice(poolId);
        return NextResponse.json({
          success: true,
          data: { poolId, ...latest },
        });
      }

      case "indicators": {
        const indicators = await getTechnicalIndicators(poolId);
        return NextResponse.json({
          success: true,
          data: { poolId, indicators },
        });
      }

      case "stats": {
        const stats = getCacheStats();
        return NextResponse.json({ success: true, data: stats });
      }

      case "pools": {
        return NextResponse.json({
          success: true,
          data: { pools: POPULAR_POOLS },
        });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("[API/ohlcv] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
