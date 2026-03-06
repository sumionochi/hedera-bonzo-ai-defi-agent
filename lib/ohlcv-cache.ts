// ============================================
// VaultMind OHLCV Price Database
// Persistent in-memory cache with auto-refresh
// Pulls from SaucerSwap, serves fast on repeat queries
// ============================================

import { getOHLCV, type SSOHLCVBar } from "./saucerswap";

// ── Types ──

export interface OHLCVCacheEntry {
  poolId: number;
  interval: "DAY" | "HOUR" | "FIVEMIN";
  bars: SSOHLCVBar[];
  fetchedAt: number; // timestamp ms
  expiresAt: number; // timestamp ms
}

export interface PricePoint {
  timestamp: number;
  price: number;
  high: number;
  low: number;
  volume: number;
}

// ── Cache Config ──

const CACHE_TTL: Record<string, number> = {
  DAY: 60 * 60 * 1000, // 1 hour for daily bars
  HOUR: 5 * 60 * 1000, // 5 min for hourly bars
  FIVEMIN: 60 * 1000, // 1 min for 5-min bars
};

// Popular Hedera DeFi pools to pre-fetch
export const POPULAR_POOLS: Record<
  string,
  { poolId: number; pair: string; description: string }
> = {
  "hbar-usdc": {
    poolId: 2,
    pair: "HBAR/USDC",
    description: "Main HBAR trading pair",
  },
  "sauce-hbar": {
    poolId: 6,
    pair: "SAUCE/HBAR",
    description: "SaucerSwap governance token",
  },
  "hbarx-hbar": {
    poolId: 45,
    pair: "HBARX/HBAR",
    description: "Liquid staking derivative",
  },
  "usdc-usdt": {
    poolId: 3,
    pair: "USDC/USDT",
    description: "Stablecoin pair",
  },
  "pack-hbar": {
    poolId: 70,
    pair: "PACK/HBAR",
    description: "HashPack token",
  },
  "karate-hbar": {
    poolId: 100,
    pair: "KARATE/HBAR",
    description: "Karate Combat token",
  },
};

// ── In-Memory Cache (persists across API calls within the same server process) ──

const cache = new Map<string, OHLCVCacheEntry>();
const fetchLocks = new Map<string, Promise<SSOHLCVBar[]>>();

function cacheKey(poolId: number, interval: string): string {
  return `${poolId}:${interval}`;
}

// ── Core Functions ──

/**
 * Get OHLCV data with caching. Returns from cache if fresh, fetches if stale.
 * Deduplicates concurrent requests to the same pool/interval.
 */
export async function getCachedOHLCV(
  poolId: number,
  interval: "DAY" | "HOUR" | "FIVEMIN" = "DAY",
  limit: number = 30
): Promise<SSOHLCVBar[]> {
  const key = cacheKey(poolId, interval);
  const now = Date.now();

  // Check cache
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.bars.slice(-limit);
  }

  // Deduplicate concurrent fetches
  const existingFetch = fetchLocks.get(key);
  if (existingFetch) {
    const bars = await existingFetch;
    return bars.slice(-limit);
  }

  // Fetch fresh data
  const fetchPromise = (async () => {
    try {
      // Fetch more than requested for cache (max 90 days of daily data)
      const fetchLimit =
        interval === "DAY" ? 90 : interval === "HOUR" ? 168 : 288;
      const bars = await getOHLCV(poolId, interval, fetchLimit);

      // Store in cache
      cache.set(key, {
        poolId,
        interval,
        bars,
        fetchedAt: now,
        expiresAt: now + (CACHE_TTL[interval] || CACHE_TTL.DAY),
      });

      return bars;
    } catch (err: any) {
      console.error(
        `[OHLCV Cache] Fetch failed for pool ${poolId}:`,
        err.message
      );
      // Return stale data if available
      if (cached) return cached.bars;
      return [];
    } finally {
      fetchLocks.delete(key);
    }
  })();

  fetchLocks.set(key, fetchPromise);
  const bars = await fetchPromise;
  return bars.slice(-limit);
}

/**
 * Get simplified price history (just close prices with timestamps)
 */
export async function getPriceHistory(
  poolId: number,
  interval: "DAY" | "HOUR" | "FIVEMIN" = "DAY",
  limit: number = 30
): Promise<PricePoint[]> {
  const bars = await getCachedOHLCV(poolId, interval, limit);
  return bars.map((bar) => ({
    timestamp: bar.timestamp,
    price: bar.close,
    high: bar.high,
    low: bar.low,
    volume: bar.volumeUsd,
  }));
}

/**
 * Get latest price for a pool
 */
export async function getLatestPrice(
  poolId: number
): Promise<{
  price: number;
  change24h: number;
  high24h: number;
  low24h: number;
} | null> {
  const bars = await getCachedOHLCV(poolId, "HOUR", 24);
  if (bars.length === 0) return null;

  const latest = bars[bars.length - 1];
  const oldest = bars[0];
  const change24h =
    oldest.close > 0 ? ((latest.close - oldest.close) / oldest.close) * 100 : 0;

  const high24h = Math.max(...bars.map((b) => b.high));
  const low24h = Math.min(...bars.map((b) => b.low).filter((l) => l > 0));

  return {
    price: latest.close,
    change24h: Math.round(change24h * 100) / 100,
    high24h,
    low24h,
  };
}

/**
 * Pre-fetch popular pools (call on server startup or first request)
 */
export async function prefetchPopularPools(): Promise<void> {
  const pools = Object.values(POPULAR_POOLS);
  console.log(`[OHLCV Cache] Pre-fetching ${pools.length} popular pools...`);

  await Promise.allSettled(
    pools.map(async (pool) => {
      await getCachedOHLCV(pool.poolId, "DAY", 90);
      await getCachedOHLCV(pool.poolId, "HOUR", 24);
    })
  );

  console.log(
    `[OHLCV Cache] Pre-fetch complete. Cache size: ${cache.size} entries`
  );
}

/**
 * Get cache stats (for debugging/dashboard)
 */
export function getCacheStats(): {
  entries: number;
  pools: number;
  totalBars: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  let totalBars = 0;
  let oldest: number | null = null;
  let newest: number | null = null;
  const poolIds = new Set<number>();

  cache.forEach((entry) => {
    totalBars += entry.bars.length;
    poolIds.add(entry.poolId);
    if (!oldest || entry.fetchedAt < oldest) oldest = entry.fetchedAt;
    if (!newest || entry.fetchedAt > newest) newest = entry.fetchedAt;
  });

  return {
    entries: cache.size,
    pools: poolIds.size,
    totalBars,
    oldestEntry: oldest,
    newestEntry: newest,
  };
}

/**
 * Calculate technical indicators from cached data
 */
export async function getTechnicalIndicators(poolId: number): Promise<{
  sma7: number;
  sma30: number;
  rsi14: number;
  volatility30d: number;
  trend: "bullish" | "bearish" | "neutral";
} | null> {
  const bars = await getCachedOHLCV(poolId, "DAY", 30);
  if (bars.length < 14) return null;

  const closes = bars.map((b) => b.close);

  // SMA 7
  const sma7 =
    closes.slice(-7).reduce((a, b) => a + b, 0) / Math.min(7, closes.length);

  // SMA 30
  const sma30 = closes.reduce((a, b) => a + b, 0) / closes.length;

  // RSI 14
  const gains: number[] = [];
  const losses: number[] = [];
  for (let i = Math.max(1, closes.length - 14); i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) {
      gains.push(diff);
      losses.push(0);
    } else {
      gains.push(0);
      losses.push(Math.abs(diff));
    }
  }
  const avgGain = gains.reduce((a, b) => a + b, 0) / gains.length;
  const avgLoss = losses.reduce((a, b) => a + b, 0) / losses.length;
  const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  const rsi14 = 100 - 100 / (1 + rs);

  // 30-day volatility (annualized)
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
  const dailyVol = Math.sqrt(variance);
  const volatility30d = dailyVol * Math.sqrt(365) * 100;

  // Trend
  const latestPrice = closes[closes.length - 1];
  const trend: "bullish" | "bearish" | "neutral" =
    latestPrice > sma7 && sma7 > sma30
      ? "bullish"
      : latestPrice < sma7 && sma7 < sma30
      ? "bearish"
      : "neutral";

  return {
    sma7: Math.round(sma7 * 10000) / 10000,
    sma30: Math.round(sma30 * 10000) / 10000,
    rsi14: Math.round(rsi14 * 100) / 100,
    volatility30d: Math.round(volatility30d * 100) / 100,
    trend,
  };
}
