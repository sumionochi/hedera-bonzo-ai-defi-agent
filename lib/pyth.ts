// ============================================
// VaultMind — Pyth Network Price Feed Integration
// ============================================
// Pyth provides 400+ real-time price feeds on Hedera.
// Uses the Hermes REST API for off-chain price retrieval
// and on-chain Pyth contract for verification when needed.
//
// Docs: https://docs.pyth.network/price-feeds
// Hermes API: https://hermes.pyth.network
// ============================================

import { ContractCallQuery, ContractId, Hbar } from "@hashgraph/sdk";
import { defaultAbiCoder } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";

// ═══════════════════════════════════════════════════════════
// PYTH PRICE FEED IDS — from https://pyth.network/developers/price-feed-ids
// These are the same across all chains (Pyth universal feed IDs)
// ═══════════════════════════════════════════════════════════

export const PYTH_FEED_IDS: Record<string, string> = {
  // Crypto
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
  // Hedera ecosystem tokens — use HBAR as proxy where direct feed unavailable
  "SAUCE/USD": "", // No direct Pyth feed — derive from DEX
  "HBARX/USD": "", // Derived: HBAR/USD * exchangeRate
  "KARATE/USD": "", // No direct feed
};

// Pyth contract on Hedera mainnet
// Deployed by Pyth governance — verified address
const PYTH_CONTRACT_MAINNET = "0xa2aa501b19aff244d90cc15a4cf739d2725b5729";
const PYTH_CONTRACT_TESTNET = "0xa2aa501b19aff244d90cc15a4cf739d2725b5729";

const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

const PYTH_CONTRACT =
  HEDERA_NETWORK === "mainnet" ? PYTH_CONTRACT_MAINNET : PYTH_CONTRACT_TESTNET;

// Hermes API — the recommended way to get Pyth prices off-chain
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
  source: "hermes" | "on-chain" | "cached";
}

export interface PythPriceBundle {
  prices: Record<string, PythPrice>;
  timestamp: number;
  source: string;
}

// ═══════════════════════════════════════════════════════════
// HERMES API — Primary price source (low latency, free)
// ═══════════════════════════════════════════════════════════

// Cache with 10s TTL
let priceCache: PythPriceBundle | null = null;
let priceCacheTs = 0;
const PRICE_CACHE_TTL = 10_000; // 10s

/**
 * Fetch latest prices from Pyth Hermes API.
 * This is the recommended approach for off-chain price consumption.
 */
export async function fetchPythPrices(
  pairs: string[] = ["HBAR/USD", "BTC/USD", "ETH/USD", "USDC/USD"]
): Promise<PythPriceBundle> {
  const now = Date.now();
  if (priceCache && now - priceCacheTs < PRICE_CACHE_TTL) {
    return priceCache;
  }

  // Collect feed IDs for requested pairs
  const feedIds = pairs
    .map((p) => PYTH_FEED_IDS[p])
    .filter((id) => id && id.length > 0);

  if (feedIds.length === 0) {
    console.warn("[Pyth] No valid feed IDs for requested pairs");
    return { prices: {}, timestamp: now, source: "none" };
  }

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

      console.log(
        `[Pyth] ✅ Got ${Object.keys(prices).length} prices from Hermes`
      );

      const bundle: PythPriceBundle = {
        prices,
        timestamp: now,
        source: base,
      };

      priceCache = bundle;
      priceCacheTs = now;
      return bundle;
    } catch (err: any) {
      console.warn(
        `[Pyth] Hermes ${base} error: ${err.message?.substring(0, 80)}`
      );
    }
  }

  // Return cached if available
  if (priceCache) {
    console.log("[Pyth] Using cached prices (Hermes unavailable)");
    return priceCache;
  }

  return { prices: {}, timestamp: now, source: "fallback" };
}

/**
 * Get a single price for a pair.
 */
export async function getPythPrice(pair: string): Promise<number> {
  const bundle = await fetchPythPrices([pair]);
  return bundle.prices[pair]?.price || 0;
}

/**
 * Get HBAR price specifically — most commonly needed.
 */
export async function getHbarPrice(): Promise<{
  price: number;
  confidence: number;
  emaPrice: number;
  source: string;
}> {
  const bundle = await fetchPythPrices(["HBAR/USD"]);
  const hbar = bundle.prices["HBAR/USD"];

  if (hbar) {
    return {
      price: hbar.price,
      confidence: hbar.confidence,
      emaPrice: hbar.emaPrice,
      source: hbar.source,
    };
  }

  // Fallback: try CoinGecko-style endpoint
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd",
      { signal: AbortSignal.timeout(3000) }
    );
    if (res.ok) {
      const data = await res.json();
      const price = data["hedera-hashgraph"]?.usd || 0;
      return { price, confidence: 0, emaPrice: price, source: "coingecko" };
    }
  } catch {}

  return { price: 0, confidence: 0, emaPrice: 0, source: "unavailable" };
}

/**
 * Derive HBARX price from HBAR price and Stader exchange rate.
 */
export async function getHbarxPrice(
  staderExchangeRate: number
): Promise<number> {
  const hbar = await getHbarPrice();
  if (!hbar.price || !staderExchangeRate) return 0;
  // HBARX represents staked HBAR at a growing rate
  // 1 HBARX = (1 / exchangeRate) HBAR
  // So HBARX price = HBAR price / exchangeRate
  return hbar.price / staderExchangeRate;
}

// ═══════════════════════════════════════════════════════════
// ON-CHAIN PYTH QUERY (for verification / smart contract use)
// ═══════════════════════════════════════════════════════════

const PYTH_ABI_GET_PRICE = [
  "function getPriceUnsafe(bytes32 id) view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))",
  "function getPriceNoOlderThan(bytes32 id, uint256 age) view returns (tuple(int64 price, uint64 conf, int32 expo, uint256 publishTime))",
];

/**
 * Query Pyth price directly on-chain via Hedera contract call.
 * Use this when you need verified on-chain pricing (e.g., for liquidation checks).
 */
export async function getPythPriceOnChain(
  pair: string
): Promise<PythPrice | null> {
  const feedId = PYTH_FEED_IDS[pair];
  if (!feedId) {
    console.warn(`[Pyth] No feed ID for pair: ${pair}`);
    return null;
  }

  try {
    const client = getHederaClient();
    // getPriceUnsafe(bytes32) — returns latest cached price
    const selector = "0xd47eed45"; // keccak256("getPriceUnsafe(bytes32)")
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
      const rawConf = Number(decoded[1]);
      const expo = Number(decoded[2]);
      const publishTime = Number(decoded[3]);

      const price = rawPrice * Math.pow(10, expo);
      const confidence = rawConf * Math.pow(10, expo);

      return {
        feedId,
        pair,
        price,
        confidence,
        expo,
        publishTime,
        emaPrice: price,
        emaConfidence: confidence,
        status: "trading",
        source: "on-chain",
      };
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
// PRICE UPDATE DATA (for on-chain transactions needing fresh prices)
// ═══════════════════════════════════════════════════════════

/**
 * Get Pyth price update data (VAA) for on-chain consumption.
 * This is needed when calling contracts that require a Pyth price update.
 */
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
// MULTI-PRICE HELPER (for keeper/agent context)
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

/**
 * Get all relevant market prices in a single call.
 * Used by the keeper/agent for market context.
 */
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
  const hbarPrice = hbar?.price || 0;
  const hbarxPrice =
    staderExchangeRate && hbarPrice ? hbarPrice / staderExchangeRate : 0;

  return {
    hbar: hbarPrice,
    hbarConfidence: hbar?.confidence || 0,
    hbarEma: hbar?.emaPrice || 0,
    btc: bundle.prices["BTC/USD"]?.price || 0,
    eth: bundle.prices["ETH/USD"]?.price || 0,
    usdc: bundle.prices["USDC/USD"]?.price || 1.0,
    hbarx: hbarxPrice,
    source: bundle.source,
    timestamp: bundle.timestamp,
  };
}
