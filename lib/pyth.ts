// ============================================
// VaultMind — Pyth Network Price Feed Integration
// ============================================
// Multi-layer price resolution:
//   1. Pyth Hermes (primary, 10s cache)
//   2. CoinGecko (fallback, 60s cache, handles 429)
//   3. Last Known Good (never returns $0 if we ever had a price)
//   4. Hardcoded reasonable defaults (absolute last resort)
//
// Docs: https://docs.pyth.network/price-feeds
// Hermes API: https://hermes.pyth.network
// ============================================

import { ContractCallQuery, ContractId, Hbar } from "@hashgraph/sdk";
import { defaultAbiCoder } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";

// ═══════════════════════════════════════════════════════════
// PYTH PRICE FEED IDS
// ═══════════════════════════════════════════════════════════

export const PYTH_FEED_IDS: Record<string, string> = {
  "HBAR/USD":
    "0x3728e591a4b3e5404d14bcd1e4c0c50369515c459db31963a7e7e82e3c4a5e44",
  "BTC/USD":
    "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
  "ETH/USD":
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
  "SOL/USD":
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  "USDC/USD":
    "0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a",
  "USDT/USD":
    "0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b",
  "SAUCE/USD": "",
  "HBARX/USD": "",
  "KARATE/USD": "",
};

// Pyth contract on Hedera
const PYTH_CONTRACT_MAINNET = "0xa2aa501b19aff244d90cc15a4cf739d2725b5729";
const PYTH_CONTRACT_TESTNET = "0xa2aa501b19aff244d90cc15a4cf739d2725b5729";

const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

const PYTH_CONTRACT =
  HEDERA_NETWORK === "mainnet" ? PYTH_CONTRACT_MAINNET : PYTH_CONTRACT_TESTNET;

// Hermes endpoints — public + beta
const HERMES_URLS = [
  "https://hermes.pyth.network",
  "https://hermes-beta.pyth.network",
];

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface PythPrice {
  feedId: string;
  pair: string;
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
  emaPrice: number;
  emaConfidence: number;
  status: "trading" | "halted" | "unknown";
  source: "hermes" | "on-chain" | "cached" | "coingecko" | "fallback";
}

export interface PythPriceBundle {
  prices: Record<string, PythPrice>;
  timestamp: number;
  source: string;
}

// ═══════════════════════════════════════════════════════════
// MULTI-LAYER CACHE
// ═══════════════════════════════════════════════════════════

// Layer 1: Hermes cache (10s TTL — fast refresh)
let hermesCache: PythPriceBundle | null = null;
let hermesCacheTs = 0;
const HERMES_CACHE_TTL = 10_000;

// Layer 2: CoinGecko cache (60s TTL — avoid 429 rate limit)
interface CoinGeckoCache {
  hbar: number;
  btc: number;
  eth: number;
  timestamp: number;
}
let cgCache: CoinGeckoCache | null = null;
const CG_CACHE_TTL = 60_000; // 60s — CoinGecko free tier allows ~10-30 req/min

// Layer 3: Last Known Good — NEVER expires, prevents $0 prices
interface LastKnownGood {
  hbar: number;
  btc: number;
  eth: number;
  usdc: number;
  timestamp: number;
  source: string;
}
let lastKnownGood: LastKnownGood = {
  hbar: 0.19, // reasonable default as of March 2026
  btc: 84000,
  eth: 2000,
  usdc: 1.0,
  timestamp: 0,
  source: "default",
};

// Update last known good whenever we get real prices
function updateLastKnownGood(
  prices: Record<string, PythPrice>,
  source: string
) {
  const hbar = prices["HBAR/USD"]?.price;
  const btc = prices["BTC/USD"]?.price;
  const eth = prices["ETH/USD"]?.price;
  const usdc = prices["USDC/USD"]?.price;

  if (hbar && hbar > 0.001) lastKnownGood.hbar = hbar;
  if (btc && btc > 100) lastKnownGood.btc = btc;
  if (eth && eth > 10) lastKnownGood.eth = eth;
  if (usdc && usdc > 0.9 && usdc < 1.1) lastKnownGood.usdc = usdc;

  if (hbar && hbar > 0.001) {
    lastKnownGood.timestamp = Date.now();
    lastKnownGood.source = source;
  }
}

// ═══════════════════════════════════════════════════════════
// LAYER 1: HERMES API (Primary)
// ═══════════════════════════════════════════════════════════

async function fetchFromHermes(
  pairs: string[]
): Promise<Record<string, PythPrice> | null> {
  const feedIds = pairs
    .map((p) => PYTH_FEED_IDS[p])
    .filter((id) => id && id.length > 0);

  if (feedIds.length === 0) return null;

  for (const base of HERMES_URLS) {
    try {
      const params = feedIds.map((id) => `ids[]=${id}`).join("&");
      const url = `${base}/v2/updates/price/latest?${params}&encoding=hex&parsed=true`;

      console.log(`[Pyth] Fetching from Hermes: ${pairs.join(", ")}`);

      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        console.warn(`[Pyth] Hermes ${base}: ${res.status}`);
        continue;
      }

      const data = await res.json();
      const prices: Record<string, PythPrice> = {};

      if (data.parsed && Array.isArray(data.parsed)) {
        for (const feed of data.parsed) {
          const feedId = "0x" + feed.id;
          const pair = Object.entries(PYTH_FEED_IDS).find(
            ([, id]) => id === feedId
          )?.[0];

          if (!pair) continue;

          const priceData = feed.price;
          const emaData = feed.ema_price;

          const rawPrice = parseInt(priceData.price);
          const expo = parseInt(priceData.expo);
          const price = rawPrice * Math.pow(10, expo);

          const rawConf = parseInt(priceData.conf);
          const confidence = rawConf * Math.pow(10, expo);

          const rawEma = parseInt(emaData.price);
          const emaPrice = rawEma * Math.pow(10, expo);
          const rawEmaConf = parseInt(emaData.conf);
          const emaConfidence = rawEmaConf * Math.pow(10, expo);

          prices[pair] = {
            feedId,
            pair,
            price,
            confidence,
            expo,
            publishTime: parseInt(priceData.publish_time),
            emaPrice,
            emaConfidence,
            status: "trading",
            source: "hermes",
          };
        }
      }

      if (Object.keys(prices).length > 0) {
        console.log(
          `[Pyth] ✅ Got ${Object.keys(prices).length} prices from Hermes`
        );
        return prices;
      }
    } catch (err: any) {
      console.warn(
        `[Pyth] Hermes ${base} error: ${err.message?.substring(0, 80)}`
      );
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// LAYER 2: COINGECKO (Fallback, cached 60s)
// ═══════════════════════════════════════════════════════════

async function fetchFromCoinGecko(): Promise<CoinGeckoCache | null> {
  const now = Date.now();

  // Return cached if fresh (prevents 429)
  if (cgCache && now - cgCache.timestamp < CG_CACHE_TTL) {
    console.log("[Pyth] Using cached CoinGecko prices");
    return cgCache;
  }

  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph,bitcoin,ethereum&vs_currencies=usd",
      {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/json" },
      }
    );

    if (res.status === 429) {
      console.warn("[Pyth] CoinGecko 429 rate limited — using cached/fallback");
      return cgCache; // Return stale cache, it's better than nothing
    }

    if (!res.ok) {
      console.warn(`[Pyth] CoinGecko ${res.status}`);
      return cgCache;
    }

    const data = await res.json();
    const result: CoinGeckoCache = {
      hbar: data["hedera-hashgraph"]?.usd || 0,
      btc: data["bitcoin"]?.usd || 0,
      eth: data["ethereum"]?.usd || 0,
      timestamp: now,
    };

    // Only cache if we got real data
    if (result.hbar > 0) {
      cgCache = result;
      console.log(
        `[Pyth] ✅ CoinGecko: HBAR=$${result.hbar}, BTC=$${result.btc}`
      );
    }

    return result;
  } catch (err: any) {
    console.warn(`[Pyth] CoinGecko error: ${err.message?.substring(0, 60)}`);
    return cgCache; // Return stale cache on network error
  }
}

function cgToPythPrices(cg: CoinGeckoCache): Record<string, PythPrice> {
  const now = Math.floor(Date.now() / 1000);
  const make = (pair: string, price: number): PythPrice => ({
    feedId: PYTH_FEED_IDS[pair] || "",
    pair,
    price,
    confidence: price * 0.005, // ~0.5% confidence band
    expo: -8,
    publishTime: now,
    emaPrice: price,
    emaConfidence: price * 0.005,
    status: "trading",
    source: "coingecko",
  });

  const prices: Record<string, PythPrice> = {};
  if (cg.hbar > 0) prices["HBAR/USD"] = make("HBAR/USD", cg.hbar);
  if (cg.btc > 0) prices["BTC/USD"] = make("BTC/USD", cg.btc);
  if (cg.eth > 0) prices["ETH/USD"] = make("ETH/USD", cg.eth);
  prices["USDC/USD"] = make("USDC/USD", 1.0);
  return prices;
}

// ═══════════════════════════════════════════════════════════
// LAYER 3: LAST KNOWN GOOD (never returns $0)
// ═══════════════════════════════════════════════════════════

function lastKnownGoodPrices(): Record<string, PythPrice> {
  const now = Math.floor(Date.now() / 1000);
  const ageMinutes = lastKnownGood.timestamp
    ? Math.floor((Date.now() - lastKnownGood.timestamp) / 60000)
    : -1;

  console.warn(
    `[Pyth] ⚠️ Using last known good prices (${lastKnownGood.source}, ${
      ageMinutes >= 0 ? `${ageMinutes}m old` : "defaults"
    })`
  );

  const make = (pair: string, price: number): PythPrice => ({
    feedId: PYTH_FEED_IDS[pair] || "",
    pair,
    price,
    confidence: price * 0.01, // 1% confidence — stale data
    expo: -8,
    publishTime: now,
    emaPrice: price,
    emaConfidence: price * 0.01,
    status: "unknown",
    source: "cached",
  });

  return {
    "HBAR/USD": make("HBAR/USD", lastKnownGood.hbar),
    "BTC/USD": make("BTC/USD", lastKnownGood.btc),
    "ETH/USD": make("ETH/USD", lastKnownGood.eth),
    "USDC/USD": make("USDC/USD", lastKnownGood.usdc),
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN FETCH — Cascading fallback
// ═══════════════════════════════════════════════════════════

export async function fetchPythPrices(
  pairs: string[] = ["HBAR/USD", "BTC/USD", "ETH/USD", "USDC/USD"]
): Promise<PythPriceBundle> {
  const now = Date.now();

  // Check Hermes cache first
  if (hermesCache && now - hermesCacheTs < HERMES_CACHE_TTL) {
    return hermesCache;
  }

  // Layer 1: Try Hermes
  const hermesPrices = await fetchFromHermes(pairs);
  if (hermesPrices && Object.keys(hermesPrices).length > 0) {
    // Validate prices — reject if HBAR is $0 or obviously wrong
    const hbarPrice = hermesPrices["HBAR/USD"]?.price || 0;
    if (hbarPrice > 0.001) {
      updateLastKnownGood(hermesPrices, "hermes");
      const bundle: PythPriceBundle = {
        prices: hermesPrices,
        timestamp: now,
        source: "hermes",
      };
      hermesCache = bundle;
      hermesCacheTs = now;
      return bundle;
    } else {
      console.warn(
        `[Pyth] Hermes returned suspicious HBAR price: $${hbarPrice} — falling back`
      );
    }
  }

  // Layer 2: Try CoinGecko
  const cgData = await fetchFromCoinGecko();
  if (cgData && cgData.hbar > 0.001) {
    const cgPrices = cgToPythPrices(cgData);
    updateLastKnownGood(cgPrices, "coingecko");
    const bundle: PythPriceBundle = {
      prices: cgPrices,
      timestamp: now,
      source: "coingecko",
    };
    // Don't overwrite hermes cache — CG is lower quality
    // But do return it
    return bundle;
  }

  // Layer 3: Last Known Good (never $0)
  const fallbackPrices = lastKnownGoodPrices();
  return {
    prices: fallbackPrices,
    timestamp: now,
    source: `fallback (${lastKnownGood.source})`,
  };
}

// ═══════════════════════════════════════════════════════════
// SINGLE PRICE HELPERS
// ═══════════════════════════════════════════════════════════

export async function getPythPrice(pair: string): Promise<number> {
  const bundle = await fetchPythPrices([pair]);
  return bundle.prices[pair]?.price || 0;
}

export async function getHbarPrice(): Promise<{
  price: number;
  confidence: number;
  emaPrice: number;
  source: string;
}> {
  const bundle = await fetchPythPrices(["HBAR/USD"]);
  const hbar = bundle.prices["HBAR/USD"];

  if (hbar && hbar.price > 0.001) {
    return {
      price: hbar.price,
      confidence: hbar.confidence,
      emaPrice: hbar.emaPrice,
      source: hbar.source,
    };
  }

  // Absolute fallback — return last known good, never $0
  return {
    price: lastKnownGood.hbar,
    confidence: lastKnownGood.hbar * 0.01,
    emaPrice: lastKnownGood.hbar,
    source: `fallback (${lastKnownGood.source})`,
  };
}

export async function getHbarxPrice(
  staderExchangeRate: number
): Promise<number> {
  const hbar = await getHbarPrice();
  if (!hbar.price || !staderExchangeRate) return 0;
  return hbar.price / staderExchangeRate;
}

// ═══════════════════════════════════════════════════════════
// ON-CHAIN PYTH QUERY
// ═══════════════════════════════════════════════════════════

export async function getPythPriceOnChain(
  pair: string
): Promise<PythPrice | null> {
  const feedId = PYTH_FEED_IDS[pair];
  if (!feedId) return null;

  try {
    const client = getHederaClient();
    const selector = "0xd47eed45";
    const feedIdBytes = feedId.replace("0x", "").padStart(64, "0");
    const calldata = selector + feedIdBytes;

    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(PYTH_CONTRACT))
      .setGas(200_000)
      .setFunctionParameters(Buffer.from(calldata.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));

    const result = await query.execute(client);

    if (result.bytes && result.bytes.length >= 128) {
      const decoded = defaultAbiCoder.decode(
        ["int64", "uint64", "int32", "uint256"],
        result.bytes
      );

      const rawPrice = Number(decoded[0]);
      const expo = Number(decoded[2]);
      const price = rawPrice * Math.pow(10, expo);
      const rawConf = Number(decoded[1]);
      const confidence = rawConf * Math.pow(10, expo);

      // Validate on-chain price too
      if (price > 0.001 || pair !== "HBAR/USD") {
        return {
          feedId,
          pair,
          price,
          confidence,
          expo,
          publishTime: Number(decoded[3]),
          emaPrice: price,
          emaConfidence: confidence,
          status: "trading",
          source: "on-chain",
        };
      }
    }
  } catch (err: any) {
    console.warn(
      `[Pyth] On-chain query failed for ${pair}: ${err.message?.substring(
        0,
        60
      )}`
    );
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// PRICE UPDATE DATA (for on-chain transactions)
// ═══════════════════════════════════════════════════════════

export async function getPriceUpdateData(
  pairs: string[]
): Promise<string[] | null> {
  const feedIds = pairs
    .map((p) => PYTH_FEED_IDS[p])
    .filter((id) => id && id.length > 0);

  if (feedIds.length === 0) return null;

  for (const base of HERMES_URLS) {
    try {
      const params = feedIds.map((id) => `ids[]=${id}`).join("&");
      const url = `${base}/v2/updates/price/latest?${params}&encoding=hex`;

      const res = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        headers: { Accept: "application/json" },
      });

      if (!res.ok) continue;

      const data = await res.json();
      if (data.binary?.data && Array.isArray(data.binary.data)) {
        return data.binary.data.map((d: string) => "0x" + d);
      }
    } catch {}
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// MULTI-PRICE HELPER
// ═══════════════════════════════════════════════════════════

export interface MarketPrices {
  hbar: number;
  hbarConfidence: number;
  hbarEma: number;
  btc: number;
  eth: number;
  usdc: number;
  hbarx: number;
  source: string;
  timestamp: number;
}

export async function getAllMarketPrices(
  staderExchangeRate?: number
): Promise<MarketPrices> {
  const bundle = await fetchPythPrices([
    "HBAR/USD",
    "BTC/USD",
    "ETH/USD",
    "USDC/USD",
  ]);

  const hbar = bundle.prices["HBAR/USD"];
  const hbarPrice = hbar?.price || lastKnownGood.hbar;
  const hbarxPrice =
    staderExchangeRate && hbarPrice ? hbarPrice / staderExchangeRate : 0;

  return {
    hbar: hbarPrice,
    hbarConfidence: hbar?.confidence || hbarPrice * 0.005,
    hbarEma: hbar?.emaPrice || hbarPrice,
    btc: bundle.prices["BTC/USD"]?.price || lastKnownGood.btc,
    eth: bundle.prices["ETH/USD"]?.price || lastKnownGood.eth,
    usdc: bundle.prices["USDC/USD"]?.price || 1.0,
    hbarx: hbarxPrice,
    source: bundle.source,
    timestamp: bundle.timestamp,
  };
}
