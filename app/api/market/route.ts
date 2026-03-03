import { NextResponse } from "next/server";
import { getBonzoMarkets, getBestYieldOpportunities } from "@/lib/bonzo";
import { analyzeSentiment } from "@/lib/sentiment";

export const dynamic = "force-dynamic";

export async function GET() {
  // Use Promise.allSettled so partial failures don't kill the response
  const results = await Promise.allSettled([
    getBonzoMarkets(),
    analyzeSentiment(),
    getBestYieldOpportunities(),
  ]);

  const markets = results[0].status === "fulfilled" ? results[0].value : null;
  const sentiment = results[1].status === "fulfilled" ? results[1].value : null;
  const bestYields =
    results[2].status === "fulfilled" ? results[2].value : null;

  // Log failures (but don't crash)
  const labels = ["Bonzo Markets", "Sentiment", "Best Yields"];
  const errors: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      const msg = r.reason?.message || "Unknown error";
      console.error(`[API/market] ${labels[i]} failed: ${msg}`);
      errors.push(`${labels[i]}: ${msg}`);
    }
  });

  return NextResponse.json({
    success: true,
    data: {
      markets: (markets?.reserves || []).map((r: any) => ({
        symbol: r.symbol,
        name: r.name,
        supplyAPY: r.supplyAPY,
        borrowAPY: r.variableBorrowAPY,
        utilizationRate: r.utilizationRate,
        priceUSD: parseFloat(r.priceUSD) || 0,
        totalSupply: r.totalSupply,
        isActive: r.active && !r.frozen,
        ltv: r.ltv,
        liquidationThreshold: r.liquidationThreshold,
        coingeckoId: r.coingeckoId,
      })),
      sentiment: sentiment
        ? {
            score: sentiment.score,
            signal: sentiment.signal,
            confidence: sentiment.confidence,
            reasoning: sentiment.reasoning,
            dataPoints: sentiment.dataPoints,
          }
        : null,
      bestYields: bestYields?.slice(0, 5) || [],
      timestamp: markets?.timestamp || new Date().toISOString(),
      networkName: markets?.networkName || "unknown",
      errors: errors.length > 0 ? errors : undefined,
    },
  });
}
