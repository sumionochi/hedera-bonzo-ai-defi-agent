// ============================================
// VaultMind — Sentinel Agent (Market Intelligence)
// ============================================
// Role: Continuously monitors market conditions and produces
//       structured market intelligence for other agents.
//
// Responsibilities:
//   1. Fetch real-time prices via Pyth Network
//   2. Analyze market sentiment (F&G, volatility, HBAR momentum)
//   3. Monitor Bonzo Lend market conditions (APYs, utilization)
//   4. Produce a MarketIntelligence report every cycle
//
// Consumers: StrategistAgent, ExecutorAgent, AuditorAgent
// ============================================

import {
  fetchPythPrices,
  getAllMarketPrices,
  type MarketPrices,
} from "../pyth";
import { analyzeSentiment, type SentimentResult } from "../sentiment";
import { getBonzoMarkets, type BonzoReserve } from "../bonzo";
import { getStaderData, type StaderData } from "../stader";
import { getVaultsWithLiveData, type BonzoVault } from "../bonzo-vaults";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export interface MarketIntelligence {
  timestamp: string;
  agent: "sentinel";

  // Prices (Pyth)
  prices: MarketPrices;

  // Sentiment
  sentiment: SentimentResult | null;

  // Bonzo Lend markets
  lendMarkets: BonzoReserve[];
  topYields: Array<{ symbol: string; supplyAPY: number; borrowAPY: number }>;

  // Vault data
  vaults: BonzoVault[];

  // Stader
  staderData: StaderData | null;

  // Derived signals
  signals: MarketSignals;
}

export interface MarketSignals {
  overallBias: "bullish" | "bearish" | "neutral";
  volatilityRegime: "low" | "moderate" | "high" | "extreme";
  yieldEnvironment: "rising" | "stable" | "falling";
  riskLevel: "low" | "medium" | "high" | "critical";
  hbarMomentum: "up" | "down" | "flat";
  actionUrgency: "none" | "low" | "medium" | "high";
  summary: string;
}

// ═══════════════════════════════════════════════════════════
// Sentinel Agent Core
// ═══════════════════════════════════════════════════════════

/**
 * Run a full market scan. This is the Sentinel's primary function.
 * Called by the Orchestrator before every decision cycle.
 */
export async function gatherMarketIntelligence(): Promise<MarketIntelligence> {
  const startTime = Date.now();
  console.log("[Sentinel] ▶ Gathering market intelligence...");

  // Parallel data fetch — all sources at once
  const [
    sentimentResult,
    marketsResult,
    staderResult,
    vaultsResult,
    pricesResult,
  ] = await Promise.allSettled([
    analyzeSentiment(),
    getBonzoMarkets(),
    getStaderData(),
    getVaultsWithLiveData(),
    getAllMarketPrices(),
  ]);

  const sentiment =
    sentimentResult.status === "fulfilled" ? sentimentResult.value : null;
  const markets =
    marketsResult.status === "fulfilled" ? marketsResult.value.reserves : [];
  const staderData =
    staderResult.status === "fulfilled" ? staderResult.value : null;
  const vaults = vaultsResult.status === "fulfilled" ? vaultsResult.value : [];
  const prices =
    pricesResult.status === "fulfilled"
      ? pricesResult.value
      : {
          hbar: 0,
          hbarConfidence: 0,
          hbarEma: 0,
          btc: 0,
          eth: 0,
          usdc: 1,
          hbarx: 0,
          source: "unavailable",
          timestamp: Date.now(),
        };

  // If Pyth gave us a real HBAR price, use it over CoinGecko
  if (prices.hbar > 0 && sentiment) {
    sentiment.dataPoints.hbarPrice = prices.hbar;
  }

  // Derive HBARX price if we have Stader data
  if (staderData && prices.hbar > 0) {
    prices.hbarx = prices.hbar / staderData.exchangeRate;
  }

  // Build top yields
  const topYields = markets
    .filter((m) => m.active && !m.frozen && m.supplyAPY > 0)
    .sort((a, b) => b.supplyAPY - a.supplyAPY)
    .slice(0, 5)
    .map((m) => ({
      symbol: m.symbol,
      supplyAPY: m.supplyAPY,
      borrowAPY: m.variableBorrowAPY,
    }));

  // Derive signals
  const signals = deriveSignals(sentiment, prices, markets, vaults);

  const elapsed = Date.now() - startTime;
  console.log(
    `[Sentinel] ✅ Intel gathered in ${elapsed}ms — ` +
      `bias: ${signals.overallBias}, vol: ${signals.volatilityRegime}, ` +
      `risk: ${signals.riskLevel}, HBAR: $${prices.hbar.toFixed(4)}`
  );

  return {
    timestamp: new Date().toISOString(),
    agent: "sentinel",
    prices,
    sentiment,
    lendMarkets: markets,
    topYields,
    vaults,
    staderData,
    signals,
  };
}

// ═══════════════════════════════════════════════════════════
// Signal Derivation
// ═══════════════════════════════════════════════════════════

function deriveSignals(
  sentiment: SentimentResult | null,
  prices: MarketPrices,
  markets: BonzoReserve[],
  vaults: BonzoVault[]
): MarketSignals {
  const score = sentiment?.score || 0;
  const volatility = sentiment?.dataPoints?.volatility || 40;
  const fearGreed = sentiment?.dataPoints?.fearGreedValue || 50;
  const hbarChange = sentiment?.dataPoints?.hbarChange24h || 0;

  // Overall bias
  let overallBias: MarketSignals["overallBias"] = "neutral";
  if (score > 30 && fearGreed > 40) overallBias = "bullish";
  else if (score < -20 && fearGreed < 35) overallBias = "bearish";

  // Volatility regime
  let volatilityRegime: MarketSignals["volatilityRegime"] = "moderate";
  if (volatility < 25) volatilityRegime = "low";
  else if (volatility > 80) volatilityRegime = "extreme";
  else if (volatility > 50) volatilityRegime = "high";

  // Yield environment
  const avgSupplyAPY =
    markets.length > 0
      ? markets
          .filter((m) => m.active && m.supplyAPY > 0)
          .reduce((s, m) => s + m.supplyAPY, 0) /
        Math.max(1, markets.filter((m) => m.active && m.supplyAPY > 0).length)
      : 0;
  let yieldEnvironment: MarketSignals["yieldEnvironment"] = "stable";
  if (avgSupplyAPY > 5) yieldEnvironment = "rising";
  else if (avgSupplyAPY < 1) yieldEnvironment = "falling";

  // Risk level
  let riskLevel: MarketSignals["riskLevel"] = "medium";
  if (
    volatilityRegime === "extreme" ||
    (overallBias === "bearish" && fearGreed < 20)
  )
    riskLevel = "critical";
  else if (volatilityRegime === "high" || overallBias === "bearish")
    riskLevel = "high";
  else if (volatilityRegime === "low" && overallBias === "bullish")
    riskLevel = "low";

  // HBAR momentum
  let hbarMomentum: MarketSignals["hbarMomentum"] = "flat";
  if (hbarChange > 2) hbarMomentum = "up";
  else if (hbarChange < -2) hbarMomentum = "down";

  // Action urgency
  let actionUrgency: MarketSignals["actionUrgency"] = "none";
  if (riskLevel === "critical") actionUrgency = "high";
  else if (riskLevel === "high" || volatilityRegime === "extreme")
    actionUrgency = "medium";
  else if (overallBias !== "neutral") actionUrgency = "low";

  // Summary
  const summary =
    `Market ${overallBias} | Volatility ${volatilityRegime} (${volatility.toFixed(
      0
    )}%) | ` +
    `F&G: ${fearGreed} | HBAR $${prices.hbar.toFixed(4)} (${
      hbarChange >= 0 ? "+" : ""
    }${hbarChange.toFixed(1)}%) | ` +
    `Risk: ${riskLevel} | Best yield: ${markets[0]?.symbol || "N/A"} at ${
      markets[0]?.supplyAPY?.toFixed(1) || "0"
    }%`;

  return {
    overallBias,
    volatilityRegime,
    yieldEnvironment,
    riskLevel,
    hbarMomentum,
    actionUrgency,
    summary,
  };
}

/**
 * Quick price check without full intelligence gather.
 * Used for DCA execution and ad-hoc price queries.
 */
export async function quickPriceCheck(): Promise<{
  hbarPrice: number;
  source: string;
}> {
  try {
    const prices = await getAllMarketPrices();
    return { hbarPrice: prices.hbar, source: prices.source };
  } catch {
    return { hbarPrice: 0, source: "error" };
  }
}
