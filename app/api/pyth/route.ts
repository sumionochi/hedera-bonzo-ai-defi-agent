import { NextRequest, NextResponse } from "next/server";
import {
  fetchPythPrices,
  getHbarPrice,
  getAllMarketPrices,
  getPythPriceOnChain,
} from "@/lib/pyth";

export const dynamic = "force-dynamic";

/**
 * GET /api/pyth — Fetch real-time prices from Pyth Network
 * Query params:
 *   ?pairs=HBAR/USD,BTC/USD,ETH/USD (comma-separated)
 *   ?action=prices|hbar|all|onchain
 *   ?pair=HBAR/USD (for onchain action)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const action = sp.get("action") || "all";

  try {
    switch (action) {
      case "hbar": {
        const result = await getHbarPrice();
        return NextResponse.json({
          success: true,
          data: result,
        });
      }

      case "prices": {
        const pairsParam =
          sp.get("pairs") || "HBAR/USD,BTC/USD,ETH/USD,USDC/USD";
        const pairs = pairsParam.split(",").map((p) => p.trim());
        const bundle = await fetchPythPrices(pairs);
        return NextResponse.json({
          success: true,
          data: bundle,
        });
      }

      case "onchain": {
        const pair = sp.get("pair") || "HBAR/USD";
        const price = await getPythPriceOnChain(pair);
        return NextResponse.json({
          success: true,
          data: price,
        });
      }

      case "all":
      default: {
        const prices = await getAllMarketPrices();
        return NextResponse.json({
          success: true,
          data: prices,
        });
      }
    }
  } catch (error: any) {
    console.error("[API/pyth] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
