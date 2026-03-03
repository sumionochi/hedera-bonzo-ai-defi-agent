// ============================================
// Sentiment Engine - REAL DATA ONLY
// Sources: CoinGecko, Alternative.me Fear & Greed, NewsAPI
// ============================================

export interface PriceData {
  price: number;
  change24h: number;
  change7d: number;
  marketCap: number;
  volume24h: number;
}

export interface FearGreedData {
  value: number;
  classification: string; // "Extreme Fear", "Fear", "Neutral", "Greed", "Extreme Greed"
  timestamp: string;
}

export interface NewsArticle {
  title: string;
  description: string;
  source: string;
  publishedAt: string;
  url: string;
}

export interface SentimentResult {
  score: number; // -100 (bearish) to +100 (bullish)
  signal: "HARVEST_NOW" | "HOLD" | "ACCUMULATE";
  confidence: number; // 0 to 1
  reasoning: string;
  dataPoints: {
    hbarPrice: number;
    hbarChange24h: number;
    fearGreedIndex: number;
    fearGreedLabel: string;
    newsCount: number;
  };
}

/**
 * Fetch live HBAR price data from CoinGecko
 * Free API: no key needed, 10-30 calls/minute
 */
export async function getHBARPrice(): Promise<PriceData> {
  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd&include_24hr_change=true&include_7d_change=true&include_market_cap=true&include_24hr_vol=true",
    { cache: "no-store" as RequestCache } // cache 2 min
  );

  if (!res.ok) {
    throw new Error(`CoinGecko API error: ${res.status}`);
  }

  const data = await res.json();
  const hbar = data["hedera-hashgraph"];

  return {
    price: hbar.usd,
    change24h: hbar.usd_24h_change || 0,
    change7d: hbar.usd_7d_change || 0,
    marketCap: hbar.usd_market_cap || 0,
    volume24h: hbar.usd_24h_vol || 0,
  };
}

/**
 * Fetch HBAR price history for volatility calculation
 * Returns hourly prices for the last N days
 */
export async function getHBARPriceHistory(
  days: number = 7
): Promise<{ timestamp: number; price: number }[]> {
  const res = await fetch(
    `https://api.coingecko.com/api/v3/coins/hedera-hashgraph/market_chart?vs_currency=usd&days=${days}`,
    { cache: "no-store" as RequestCache } // cache 5 min
  );

  if (!res.ok) {
    throw new Error(`CoinGecko history API error: ${res.status}`);
  }

  const data = await res.json();
  return data.prices.map(([timestamp, price]: [number, number]) => ({
    timestamp,
    price,
  }));
}

/**
 * Fetch the Crypto Fear & Greed Index
 * Source: alternative.me — free, no API key
 */
export async function getFearGreedIndex(): Promise<FearGreedData> {
  const res = await fetch("https://api.alternative.me/fng/?limit=1");

  if (!res.ok) {
    throw new Error(`Fear & Greed API error: ${res.status}`);
  }

  const data = await res.json();
  const entry = data.data[0];

  return {
    value: parseInt(entry.value),
    classification: entry.value_classification,
    timestamp: new Date(parseInt(entry.timestamp) * 1000).toISOString(),
  };
}

/**
 * Fetch recent crypto news about HBAR/Hedera
 * Source: NewsAPI.org — free tier: 100 requests/day
 */
export async function getCryptoNews(
  query: string = "HBAR OR Hedera OR hedera hashgraph"
): Promise<NewsArticle[]> {
  const apiKey = process.env.NEWS_API_KEY;

  if (!apiKey) {
    console.warn("[Sentiment] NEWS_API_KEY not set, skipping news fetch");
    return [];
  }

  const res = await fetch(
    `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&sortBy=publishedAt&language=en&pageSize=10&apiKey=${apiKey}`,
    { cache: "no-store" as RequestCache } // cache 15 min
  );

  if (!res.ok) {
    console.warn(`[Sentiment] NewsAPI error: ${res.status}`);
    return [];
  }

  const data = await res.json();

  return (data.articles || []).map((a: any) => ({
    title: a.title || "",
    description: a.description || "",
    source: a.source?.name || "Unknown",
    publishedAt: a.publishedAt || "",
    url: a.url || "",
  }));
}

/**
 * Calculate rolling volatility from price history
 * Returns annualized volatility as a percentage
 */
export function calculateVolatility(
  prices: { timestamp: number; price: number }[]
): {
  volatility: number;
  isHigh: boolean;
  trend: "uptrend" | "downtrend" | "sideways";
  recentPrices: number[];
} {
  if (prices.length < 2) {
    return {
      volatility: 0,
      isHigh: false,
      trend: "sideways",
      recentPrices: [],
    };
  }

  // Calculate log returns
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i].price > 0 && prices[i - 1].price > 0) {
      returns.push(Math.log(prices[i].price / prices[i - 1].price));
    }
  }

  if (returns.length === 0) {
    return {
      volatility: 0,
      isHigh: false,
      trend: "sideways",
      recentPrices: [],
    };
  }

  // Standard deviation of returns
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);

  // Annualize (hourly data × sqrt(8760 hours/year))
  const annualizedVol = stdDev * Math.sqrt(8760) * 100;

  // Determine trend from first vs last price
  const firstPrice = prices[0].price;
  const lastPrice = prices[prices.length - 1].price;
  const changePercent = ((lastPrice - firstPrice) / firstPrice) * 100;

  const trend: "uptrend" | "downtrend" | "sideways" =
    changePercent > 3 ? "uptrend" : changePercent < -3 ? "downtrend" : "sideways";

  return {
    volatility: annualizedVol,
    isHigh: annualizedVol > 80, // >80% annualized vol = high for crypto
    trend,
    recentPrices: prices.slice(-24).map((p) => p.price),
  };
}

/**
 * Run full sentiment analysis — combines all data sources
 * Uses rule-based scoring (no LLM needed for this part = faster + cheaper)
 */
export async function analyzeSentiment(): Promise<SentimentResult> {
  // Fetch all data in parallel
  const [priceData, fearGreed, news, priceHistory] = await Promise.all([
    getHBARPrice(),
    getFearGreedIndex(),
    getCryptoNews(),
    getHBARPriceHistory(7),
  ]);

  const vol = calculateVolatility(priceHistory);

  // === SCORING ALGORITHM ===
  // Each factor contributes to the overall score

  let score = 0;
  const reasons: string[] = [];

  // Factor 1: 24h price change (-30 to +30 points)
  const priceScore = Math.max(-30, Math.min(30, priceData.change24h * 3));
  score += priceScore;
  if (priceData.change24h < -5) {
    reasons.push(`HBAR down ${priceData.change24h.toFixed(1)}% in 24h`);
  } else if (priceData.change24h > 5) {
    reasons.push(`HBAR up ${priceData.change24h.toFixed(1)}% in 24h`);
  }

  // Factor 2: Fear & Greed Index (-30 to +30 points)
  // 0-25 = Extreme Fear → bearish, 75-100 = Extreme Greed → bullish
  const fgScore = ((fearGreed.value - 50) / 50) * 30;
  score += fgScore;
  if (fearGreed.value < 25) {
    reasons.push(`Market in ${fearGreed.classification} (${fearGreed.value})`);
  } else if (fearGreed.value > 75) {
    reasons.push(`Market in ${fearGreed.classification} (${fearGreed.value})`);
  }

  // Factor 3: Volatility (-20 to +10 points)
  // High volatility is generally negative for yield farming
  if (vol.isHigh) {
    score -= 20;
    reasons.push(`High volatility: ${vol.volatility.toFixed(0)}% annualized`);
  } else if (vol.volatility < 40) {
    score += 10;
    reasons.push(`Low volatility: ideal for yield farming`);
  }

  // Factor 4: Trend (-20 to +20 points)
  if (vol.trend === "uptrend") {
    score += 20;
    reasons.push("7-day uptrend detected");
  } else if (vol.trend === "downtrend") {
    score -= 20;
    reasons.push("7-day downtrend detected");
  }

  // Clamp to -100..+100
  score = Math.max(-100, Math.min(100, Math.round(score)));

  // Determine signal
  let signal: "HARVEST_NOW" | "HOLD" | "ACCUMULATE";
  if (score < -25) {
    signal = "HARVEST_NOW";
  } else if (score > 25) {
    signal = "ACCUMULATE";
  } else {
    signal = "HOLD";
  }

  // Confidence based on how extreme the signals are
  const confidence = Math.min(
    1,
    (Math.abs(priceData.change24h) / 10 +
      Math.abs(fearGreed.value - 50) / 50 +
      (vol.isHigh ? 0.3 : 0.1)) /
      2
  );

  return {
    score,
    signal,
    confidence: Math.round(confidence * 100) / 100,
    reasoning:
      reasons.length > 0
        ? reasons.join(". ") + "."
        : "Market conditions are neutral.",
    dataPoints: {
      hbarPrice: priceData.price,
      hbarChange24h: priceData.change24h,
      fearGreedIndex: fearGreed.value,
      fearGreedLabel: fearGreed.classification,
      newsCount: news.length,
    },
  };
}
