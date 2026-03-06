// ============================================
// VaultMind RAG Knowledge Base
// Hedera DeFi strategies, loops, opportunities
// Injected into agent context for informed responses
// ============================================

export interface KnowledgeEntry {
  topic: string;
  category: "strategy" | "protocol" | "risk" | "yield" | "basics";
  content: string;
  tags: string[];
}

export const HEDERA_DEFI_KNOWLEDGE: KnowledgeEntry[] = [
  // ── Bonzo Finance Strategies ──
  {
    topic: "Bonzo Finance Lending Loop",
    category: "strategy",
    content: `The Bonzo lending loop is a leveraged yield strategy:
  1. Deposit HBAR as collateral in Bonzo
  2. Borrow USDC against your HBAR (max ~70% LTV)
  3. Swap borrowed USDC back to HBAR on SaucerSwap
  4. Re-deposit the HBAR into Bonzo
  5. Repeat 2-3 times for up to 3x effective yield
  Risk: Liquidation if HBAR drops below your liquidation threshold. Health factor must stay above 1.0. Recommended minimum: 1.5 for safety.
  Key metric: Net APY = (Supply APY × leverage) - (Borrow APY × borrowed amount). Only profitable when supply APY spread exceeds borrow cost.`,
    tags: ["bonzo", "loop", "leverage", "lending", "hbar", "yield"],
  },
  {
    topic: "Bonzo Health Factor Management",
    category: "risk",
    content: `Health Factor (HF) = Total Collateral × Liquidation Threshold / Total Borrows.
  - HF > 2.0: Safe, can add more borrows
  - HF 1.5-2.0: Moderate risk, monitor daily
  - HF 1.3-1.5: Warning zone, consider repaying
  - HF 1.0-1.3: DANGER, liquidation imminent
  - HF < 1.0: Position will be liquidated
  When HBAR drops 10%, your HF drops proportionally. A 30% HBAR crash with 70% LTV usage would likely trigger liquidation. Always maintain a buffer by borrowing less than max LTV.`,
    tags: ["bonzo", "health", "liquidation", "risk", "collateral"],
  },
  {
    topic: "Bonzo Flash Loans",
    category: "strategy",
    content: `Bonzo supports Aave v2-style flash loans — instant, uncollateralized loans that must be repaid within the same transaction. Use cases:
  - Liquidation bots: borrow → liquidate undercollateralized position → repay with profit
  - Arbitrage: borrow → swap on SaucerSwap at different price → repay with spread
  - Position unwinding: flash borrow to repay debt, withdraw collateral, sell collateral, repay flash loan
  Fee: 0.09% of borrowed amount. Available for all Bonzo-listed assets.`,
    tags: ["bonzo", "flash loan", "arbitrage", "liquidation"],
  },

  // ── SaucerSwap Strategies ──
  {
    topic: "SaucerSwap V2 Concentrated Liquidity",
    category: "strategy",
    content: `SaucerSwap V2 uses Uniswap V3-style concentrated liquidity (CLMM). Key concepts:
  - Tighter range = more fees when price stays in range, but higher impermanent loss risk
  - Wider range = fewer fees but more resilient to price swings
  - Optimal strategy for HBAR/USDC: set range to ±15-25% of current price for balanced risk/reward
  - Fee tiers: 0.05% (stablecoins), 0.15% (blue chips), 0.30% (volatile), 1.00% (exotic)
  - LARI rewards: Active liquidity positions automatically earn SAUCE/HBAR incentives proportional to how concentrated your liquidity is.
  Pro tip: Use Auto Pools (ICHI vaults) for automated range management if you don't want to actively manage positions.`,
    tags: [
      "saucerswap",
      "clmm",
      "concentrated liquidity",
      "lp",
      "impermanent loss",
      "lari",
    ],
  },
  {
    topic: "SaucerSwap Auto Pools (ICHI Vaults)",
    category: "strategy",
    content: `Auto Pools simplify concentrated liquidity provision:
  - Deposit a single token (e.g., just HBAR or just USDC)
  - ICHI algorithm automatically manages the price range
  - 5 operational states: Healthy, Over-Inventory, Under-Inventory, High Volatility, Extreme Volatility
  - In High Volatility: liquidity spreads to full range (like V1) for protection
  - In Extreme Volatility: new deposits are paused
  - Management fee: 14% of earned fees (split between ICHI Protocol and SaucerSwap)
  Best for: Users who want concentrated liquidity yields without active management.`,
    tags: ["saucerswap", "auto pools", "ichi", "vault", "passive"],
  },
  {
    topic: "SaucerSwap Single-Sided Staking (Infinity Pool)",
    category: "yield",
    content: `The Infinity Pool lets you stake SAUCE for xSAUCE — a yield-bearing token:
  - No impermanent loss (single asset)
  - Receives protocol fee revenue: 1/6 of all swap fees are used for SAUCE buybacks
  - xSAUCE appreciates over time relative to SAUCE
  - Can be used in DeFi (e.g., provide xSAUCE liquidity in SAUCE/xSAUCE pool for double yield)
  Current APY varies based on trading volume. Check SaucerSwap dashboard for live rates.`,
    tags: ["saucerswap", "staking", "xsauce", "infinity pool", "single sided"],
  },

  // ── Cross-Protocol Strategies ──
  {
    topic: "HBAR Yield Maximizer Strategy",
    category: "strategy",
    content: `Combine Bonzo + SaucerSwap for maximum HBAR yield:
  1. Deposit 60% of HBAR into Bonzo for lending yield (~2-5% APY)
  2. Take remaining 40% and pair with USDC in SaucerSwap V2 HBAR/USDC pool
  3. Set concentrated range ±20% for balanced fee capture
  4. Earn LARI rewards (SAUCE tokens) on top of trading fees
  5. Stake earned SAUCE in Infinity Pool for compounding
  Expected combined APY: 8-15% (varies with market conditions)
  Risk factors: IL on LP position, HBAR price volatility, smart contract risk on two protocols.`,
    tags: ["hbar", "yield", "bonzo", "saucerswap", "maximizer", "combined"],
  },
  {
    topic: "Stablecoin Yield Farming on Hedera",
    category: "yield",
    content: `Low-risk stablecoin strategies on Hedera:
  1. Bonzo USDC lending: ~2-4% APY, lowest risk
  2. SaucerSwap USDC/USDT V2 pool (0.05% fee tier): ~5-10% APY from fees + LARI
  3. Bonzo USDC lending + borrow HBAR → stake in SaucerSwap (advanced loop)
  Key advantage: Hedera's low gas fees ($0.0001 per tx) make frequent rebalancing profitable even for small positions. On Ethereum, the same strategies would cost $50-100 in gas per rebalance.`,
    tags: ["stablecoin", "usdc", "farming", "low risk", "yield"],
  },

  // ── Risk Management ──
  {
    topic: "Impermanent Loss on Hedera DEXs",
    category: "risk",
    content: `Impermanent loss (IL) occurs when the price ratio of paired tokens changes:
  - 10% price change: ~0.11% IL
  - 25% price change: ~0.64% IL
  - 50% price change: ~2.02% IL
  - 100% price change: ~5.72% IL
  With HBAR's typical daily volatility of 3-8%, daily IL on HBAR/USDC is usually 0.01-0.1%. SaucerSwap V2 concentrated positions amplify both fees AND IL — tighter ranges mean more of both.
  Mitigation: Use wider ranges during volatile periods, or switch to single-sided staking when volatility > 80% annualized.`,
    tags: ["impermanent loss", "risk", "saucerswap", "volatility"],
  },
  {
    topic: "Smart Contract Risk on Hedera DeFi",
    category: "risk",
    content: `Key risk considerations:
  - Bonzo Finance: Based on Aave v2 (battle-tested on Ethereum). Audited. Uses Supra + Pyth oracle redundancy for price feeds.
  - SaucerSwap: Based on Uniswap V2/V3. Has been running on Hedera since 2022. Audited by multiple firms.
  - Hedera advantage: No MEV (miner extractable value) due to fair ordering consensus. Your transactions can't be front-run or sandwich attacked.
  - Hedera risk: Smaller ecosystem = less liquidity. Large trades can move prices significantly on low-liquidity pairs.
  General rule: Don't put more than 20% of portfolio in any single protocol.`,
    tags: ["risk", "smart contract", "audit", "mev", "security"],
  },

  // ── Hedera Basics ──
  {
    topic: "Hedera Token Service (HTS) vs ERC-20",
    category: "basics",
    content: `HTS tokens are native Hedera assets (not smart contracts):
  - Faster: No EVM execution needed for basic transfers
  - Cheaper: ~$0.0001 per token transfer vs $0.001+ for ERC-20 on Hedera EVM
  - Built-in features: Royalties, KYC flags, freeze/pause, custom fees
  - Bonzo supports both HTS and EVM-wrapped tokens
  - SaucerSwap bridges between HTS and EVM representations using WHBAR
  When interacting with DeFi protocols, HTS tokens are often wrapped to their EVM equivalents automatically.`,
    tags: ["hts", "tokens", "basics", "erc20", "hedera"],
  },
  {
    topic: "HBAR Staking and Proxy Staking",
    category: "yield",
    content: `Native HBAR staking:
  - Stake directly to a Hedera node (no lock-up, no slashing)
  - Current reward rate: ~2.5-6.5% APY depending on network participation
  - Rewards paid every ~24 hours
  - No minimum stake amount
  Alternative: Stader's HBARX is a liquid staking derivative:
  - Stake HBAR → receive HBARX
  - HBARX appreciates relative to HBAR as staking rewards accrue
  - Can use HBARX in DeFi while still earning staking rewards
  - Available on SaucerSwap for trading/LP`,
    tags: ["staking", "hbar", "hbarx", "stader", "yield", "native"],
  },
];

// ── RAG Search Function ──

/**
 * Search the knowledge base for relevant entries.
 * Returns top N matching entries ranked by tag overlap.
 */
export function searchKnowledge(
  query: string,
  topN: number = 3
): KnowledgeEntry[] {
  const queryLower = query.toLowerCase();
  const queryWords = queryLower.split(/\s+/).filter((w) => w.length > 2);

  const scored = HEDERA_DEFI_KNOWLEDGE.map((entry) => {
    let score = 0;

    // Tag matches (strongest signal)
    for (const tag of entry.tags) {
      if (queryLower.includes(tag)) score += 10;
      for (const word of queryWords) {
        if (tag.includes(word)) score += 5;
      }
    }

    // Topic match
    const topicLower = entry.topic.toLowerCase();
    for (const word of queryWords) {
      if (topicLower.includes(word)) score += 3;
    }

    // Content keyword match
    const contentLower = entry.content.toLowerCase();
    for (const word of queryWords) {
      if (contentLower.includes(word)) score += 1;
    }

    return { entry, score };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.entry);
}

/**
 * Build RAG context block for agent injection
 */
export function buildRAGContext(query: string): string {
  const entries = searchKnowledge(query);
  if (entries.length === 0) return "";

  let block = "\n=== HEDERA DEFI KNOWLEDGE BASE ===\n";
  for (const entry of entries) {
    block += `\n[${entry.category.toUpperCase()}] ${entry.topic}\n`;
    block += entry.content + "\n";
  }
  block += "=== END KNOWLEDGE BASE ===\n";

  return block;
}
