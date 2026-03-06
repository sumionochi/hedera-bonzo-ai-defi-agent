// ============================================
// VaultMind RAG Knowledge Base
// Hedera DeFi strategies, loops, opportunities
// Injected into agent context for informed responses
// ============================================

export interface KnowledgeEntry {
  topic: string;
  category:
    | "strategy"
    | "protocol"
    | "risk"
    | "yield"
    | "basics"
    | "bonzo"
    | "education";
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

  // ── Advanced Strategies ──
  {
    topic: "Dollar Cost Averaging (DCA) on Hedera",
    category: "strategy",
    content: `DCA on Hedera is highly efficient due to near-zero gas fees:
- Set recurring buys of HBAR using SaucerSwap at $0.0001 per swap
- Optimal intervals: daily or weekly depending on volatility regime
- In bearish markets (sentiment < -30): increase DCA frequency to accumulate at lower prices
- In bullish markets (sentiment > 50): reduce frequency, let existing positions ride
- Combine with Bonzo: DCA into HBAR, then deposit into Bonzo for lending yield while accumulating
- Use VaultMind keeper to automate: set price alerts + auto-deposit triggers
Key advantage: On Ethereum, DCA costs $5-50 per swap in gas. On Hedera, 1000 swaps cost ~$0.10 total.`,
    tags: ["dca", "dollar cost average", "strategy", "accumulate", "recurring"],
  },
  {
    topic: "Bonzo Liquidation Mechanics (Detailed)",
    category: "risk",
    content: `When Health Factor drops below 1.0, liquidators can repay up to 50% of a borrower's debt:
- Liquidation bonus: 5-15% depending on asset (HBAR: 10%, USDC: 5%, SAUCE: 15%)
- Process: Liquidator repays X of your debt → receives X + bonus from your collateral
- Example: If you borrow 1000 USDC against 10000 HBAR and HF hits 0.95:
  - Liquidator repays 500 USDC of your debt
  - Liquidator receives ~555 USDC worth of your HBAR (10% bonus)
  - Your remaining debt: 500 USDC, remaining collateral: ~9445 USDC worth of HBAR
- Oracle dependency: Bonzo uses Supra + Pyth dual oracle for price feeds with 5-minute heartbeat
- Hedera advantage: No MEV front-running on liquidations due to fair ordering consensus
Prevention strategy: Keep HF above 1.8. Use VaultMind keeper with REPAY_DEBT strategy at HF < 1.3.`,
    tags: [
      "liquidation",
      "bonzo",
      "oracle",
      "supra",
      "pyth",
      "mev",
      "health factor",
    ],
  },
  {
    topic: "SaucerSwap LARI Rewards Program",
    category: "yield",
    content: `LARI (Liquidity Alliance Reward Initiative) distributes SAUCE + HBAR to active LPs:
- Applies to V2 concentrated liquidity positions only
- Rewards proportional to: (1) time in range, (2) concentration factor, (3) position size
- More concentrated = higher reward multiplier, but also higher IL risk
- Reward epoch: weekly distribution based on on-chain activity snapshots
- Top pools by LARI rewards: HBAR/USDC, SAUCE/HBAR, HBARX/HBAR
- Estimated additional APY from LARI: 5-25% on top of trading fees
- Claimed rewards can be staked in Infinity Pool for compounding
Pro tip: Position in HBAR/USDC with ±10-15% range during low volatility periods to maximize LARI multiplier.`,
    tags: [
      "lari",
      "rewards",
      "saucerswap",
      "liquidity",
      "mining",
      "sauce",
      "incentive",
    ],
  },
  {
    topic: "Multi-Protocol Portfolio Allocation on Hedera",
    category: "strategy",
    content: `Recommended portfolio allocation across Hedera DeFi:
Conservative (risk score 1-3):
- 50% Bonzo USDC lending (2-4% APY)
- 30% SaucerSwap USDC/USDT LP (5-10% APY)
- 20% HBAR native staking (2.5-6.5% APY)
- Expected portfolio APY: 3-6%

Balanced (risk score 4-6):
- 30% Bonzo HBAR lending (3-5% APY)
- 30% SaucerSwap HBAR/USDC V2 LP (10-20% APY with LARI)
- 20% Infinity Pool xSAUCE staking (8-15% APY)
- 20% HBAR native staking as reserve
- Expected portfolio APY: 8-12%

Aggressive (risk score 7-10):
- 40% Bonzo lending loop (3x leverage, 10-15% net APY)
- 30% SaucerSwap concentrated LP tight range (20-40% APY)
- 20% SaucerSwap Auto Pool (15-25% APY)
- 10% reserve HBAR for rebalancing
- Expected portfolio APY: 15-25%
- WARNING: Aggressive carries significant liquidation and IL risk`,
    tags: [
      "allocation",
      "portfolio",
      "conservative",
      "balanced",
      "aggressive",
      "diversify",
    ],
  },
  {
    topic: "Hedera Gas Optimization for DeFi",
    category: "basics",
    content: `Hedera fee structure for DeFi operations:
- HBAR transfer: $0.0001 (fixed)
- HTS token transfer: $0.001
- Smart contract call (Bonzo deposit): $0.05-0.08
- SaucerSwap V1 swap: $0.01-0.03
- SaucerSwap V2 swap: $0.02-0.05
- Bonzo flash loan execution: $0.10-0.15
- HCS message (audit log): $0.0001
Comparison: Same operations on Ethereum cost 100-1000x more.
Optimization tips:
1. Batch operations when possible (deposit + borrow in same session)
2. Use HTS transfers instead of ERC-20 when available
3. Flash loans on Hedera are extremely cheap vs Ethereum
4. VaultMind keeper logging to HCS costs < $0.01 per day at 5-minute intervals`,
    tags: ["gas", "fees", "optimization", "cost", "cheap", "hedera"],
  },
  {
    topic: "HBAR Tokenomics and Supply Schedule",
    category: "basics",
    content: `HBAR total supply: 50 billion tokens (fixed, no inflation beyond initial allocation)
- Circulating supply (2025): ~38 billion HBAR
- Remaining treasury: ~12 billion, released on schedule through 2025-2030
- No mining/minting: All 50B tokens created at genesis
- Network fee distribution: Fees paid in HBAR, portion goes to node operators as staking rewards
- Governance: Hedera Governing Council (39 multinational organizations)
Price drivers:
- Enterprise adoption (Google, IBM, Boeing on governing council)
- DeFi TVL growth ($200M+ total as of 2025)
- Staking lock-up reducing circulating supply
- EVM compatibility bringing Ethereum dApps to Hedera
For DeFi: HBAR's fixed supply means lending rates are driven by demand, not inflation. Bullish on-chain activity = higher borrow demand = higher supply APYs on Bonzo.`,
    tags: ["tokenomics", "supply", "hbar", "price", "governance", "treasury"],
  },
  {
    topic: "VaultMind Keeper Strategy Deep Dive",
    category: "strategy",
    content: `VaultMind's 5 keeper strategies ranked by priority:
1. HEALTH GUARD (highest priority): Triggers when health factor < danger threshold (default 1.3)
   - Action: REPAY_DEBT — repays 50% of highest-interest borrow
   - Goal: Prevent liquidation at all costs

2. BEARISH HARVEST: Triggers when sentiment score < bearish threshold (default -30)
   - Action: HARVEST/EXIT_TO_STABLE — withdraws volatile positions to USDC
   - Goal: Protect portfolio from downturn

3. VOLATILITY HOLD: Triggers when annualized volatility > ceiling (default 80%)
   - Action: HOLD — takes no action during chaotic markets
   - Goal: Avoid making decisions during unpredictable conditions

4. YIELD REBALANCE: Triggers when a better yield opportunity exists (default 2%+ APY improvement)
   - Action: REBALANCE — moves funds to higher-yielding reserve
   - Goal: Maximize returns by chasing best risk-adjusted yield

5. BULLISH INCREASE: Triggers when sentiment > bullish threshold (default 50) AND volatility < 40%
   - Action: INCREASE_POSITION — deposits more into best-performing position
   - Goal: Capitalize on bullish momentum with confirmation

Each strategy can be customized via the Strategy Config panel. The keeper evaluates all 5 in priority order and executes the first one that triggers. Every decision is logged to HCS for immutable audit trail.`,
    tags: [
      "keeper",
      "strategy",
      "vaultmind",
      "autonomous",
      "harvest",
      "rebalance",
      "health",
    ],
  },
  {
    topic: "Bonzo Finance Liquidation Protection Strategies",
    category: "strategy",
    content: `Proactive liquidation protection techniques:
1. Buffer strategy: Never borrow more than 50% of max LTV (keeps HF > 2.0)
2. Stablecoin hedge: Borrow USDC (stable) against HBAR (volatile) — your debt doesn't increase when market drops
3. Auto-repay with keeper: Set VaultMind health factor alert to 1.5, auto-repay 25% of debt
4. Flash loan unwind: If HF approaches 1.1, flash loan to repay all debt, withdraw collateral, sell portion, repay flash loan — exit cleanly in one transaction
5. Diversified collateral: Supply both HBAR and USDC as collateral — USDC portion doesn't fluctuate, stabilizing HF
6. Monitor correlation: If HBAR and SAUCE are highly correlated and you have positions in both, a crash affects everything simultaneously — use correlation matrix to spot this risk
Best practice: Run VaultMind keeper at 5-minute intervals with health factor alert at 1.5 and auto-execution enabled.`,
    tags: [
      "liquidation",
      "protection",
      "bonzo",
      "health factor",
      "flash loan",
      "strategy",
    ],
  },
  // ── Bonzo Vault Strategy Knowledge ──
  {
    topic: "Bonzo Vaults Overview — Automated Yield Strategies on Hedera",
    category: "bonzo",
    content: `Bonzo Vaults are Beefy-based automated yield optimization engines on Hedera. They accept deposits, route liquidity to DeFi protocols, auto-manage positions, harvest rewards, and compound returns. Key features:
- Based on Beefy Finance contracts (audited by Halborn)
- Users deposit single asset or pair → receive vault share tokens (mooTokens)
- Vault share tokens accrue value as strategy compounds rewards via getPricePerFullShare()
- Strategies are modular smart contracts — vault handles accounting, strategy handles yield
- Harvest-on-deposit: most vaults harvest when anyone deposits, preventing yield theft
- Permissionless: anyone can build and deploy vault strategies, earning a strategist fee
- Available at app.bonzo.finance/vaults/
VaultMind acts as the intelligent keeper that decides WHEN to harvest, WHICH vault to use, and WHETHER to switch positions based on market conditions.`,
    tags: [
      "bonzo",
      "vault",
      "beefy",
      "yield",
      "strategy",
      "deposit",
      "withdraw",
      "harvest",
      "auto-compound",
    ],
  },
  {
    topic: "Bonzo Vault Strategy: Single Asset DEX (CLM)",
    category: "strategy",
    content: `The Single Asset DEX vault uses Concentrated Liquidity Management (CLM) on SaucerSwap V2:
- Deposit ONE token (e.g., HBAR) → vault converts portion to pair token and creates concentrated position
- Active Boundary Management: price ranges auto-adjust as market moves to stay in productive range
- Volatility Dampening: automated rebalancing prevents whipsaw losses from manual management
- Inventory Management: strategy favors your deposited token (minimizes conversion)
- Auto-compounds trading fees earned from the SaucerSwap V2 pool
- On withdrawal, you receive a MIX of both underlying tokens (ratio shown before withdrawal)
Risk: Impermanent loss if deposited asset price diverges significantly from pair.
Best for: Users wanting DEX fee yield without managing LP positions manually.
VaultMind recommendation: Use in low-to-moderate volatility conditions. Switch to stablecoin vault if volatility exceeds 80%.`,
    tags: [
      "vault",
      "clm",
      "concentrated",
      "saucerswap",
      "liquidity",
      "single",
      "dex",
      "impermanent loss",
    ],
  },
  {
    topic: "Bonzo Vault Strategy: Leveraged LST (HBARX)",
    category: "strategy",
    content: `The Leveraged LST vault amplifies liquid staking yields through a leverage loop:
1. User deposits HBARX (liquid staking token from Stader Labs)
2. Vault supplies HBARX as collateral to Bonzo Lend
3. Vault borrows HBAR against HBARX at conservative LTV (preventing liquidation)
4. Vault stakes borrowed HBAR for more HBARX via Stader
5. Vault re-supplies new HBARX to Bonzo Lend → repeat
Result: ~2x effective leverage on HBARX staking yield.
Risk: If HBAR borrow APY exceeds HBARX staking APY, net yield goes negative. Strategy has built-in circuit breaker to stop re-leveraging when this occurs.
On withdrawal: positions unwind in reverse — HBARX swapped to HBAR via SaucerSwap (no cooldown).
VaultMind keeper value: Monitors HBAR borrow vs HBARX supply APY spread. If spread narrows below 1%, recommends withdrawal before yield turns negative.`,
    tags: [
      "vault",
      "leveraged",
      "lst",
      "hbarx",
      "staking",
      "bonzo lend",
      "stader",
      "leverage loop",
    ],
  },
  {
    topic: "Bonzo Vault Harvest Timing — Intelligent Keeper Strategy",
    category: "strategy",
    content: `Static vaults harvest on fixed schedules (every 4 hours). VaultMind's intelligent keeper optimizes harvest timing:
BEARISH sentiment (< -30): Harvest IMMEDIATELY — reward tokens may lose value. Convert to stablecoins or compound into position before price drops.
BULLISH sentiment (> 50): DELAY harvest — let reward tokens accumulate price appreciation. Compound at peak for maximum vault share value.
NEUTRAL: Standard 4-hour cycle works fine.
HIGH VOLATILITY (> 80%): Force harvest + consider switching to USDC-USDT stable vault. Concentrated liquidity vaults suffer range breakouts in volatility spikes.
Harvest rewards: Anyone calling harvest() on a Beefy vault earns 0.05-0.5% of harvested rewards as caller incentive — VaultMind earns this fee while protecting user positions.
Harvest-on-deposit: Most Bonzo Vaults trigger harvest when new deposits come in, so depositing itself acts as a compound event.`,
    tags: [
      "vault",
      "harvest",
      "keeper",
      "timing",
      "sentiment",
      "compound",
      "rewards",
      "strategy",
    ],
  },
  {
    topic: "Bonzo Vault vs Bonzo Lend — When To Use Each",
    category: "education",
    content: `Bonzo offers two main products — use the right one for your goal:
BONZO LEND (Aave v2 fork):
- Supply tokens to earn lending APY (variable, based on utilization)
- Borrow against collateral (overcollateralized loans)
- Best for: Single-asset yield, leveraged borrowing, flash loans
- Risk: Liquidation if health factor drops below 1.0
- You keep full control of your tokens

BONZO VAULTS (Beefy fork):
- Deposit into automated yield strategies
- Higher APY through active management + compounding
- Best for: Passive yield optimization, LP management, leveraged staking
- Risk: Smart contract risk (vault + strategy + underlying protocol), IL for DEX strategies
- Vault manages your tokens via strategy contracts

COMPARISON:
| Feature | Bonzo Lend | Bonzo Vaults |
| APY | 2-8% (supply only) | 4-15% (strategy dependent) |
| Effort | Low (deposit & earn) | Zero (vault manages everything) |
| Risk | Liquidation risk | Strategy-specific risks |
| Flexibility | Full control | Automated, less granular control |
VaultMind integrates BOTH — recommends the optimal product based on your risk tolerance and market conditions.`,
    tags: [
      "bonzo",
      "vault",
      "lend",
      "comparison",
      "apy",
      "strategy",
      "yield",
      "risk",
    ],
  },
  // ── Bonzo Vault Keeper Strategies ──
  {
    topic: "Bonzo Vault Harvest Timing Strategy",
    category: "strategy",
    content: `Bonzo Vaults (Beefy-based) accumulate rewards from underlying farms/pools that must be harvested and compounded.
INTELLIGENT HARVEST TIMING:
- Standard keeper: Harvests every 4 hours regardless of conditions (INEFFICIENT)
- VaultMind keeper: Adjusts harvest timing based on sentiment and market conditions

BEARISH SENTIMENT (score < -30):
  → HARVEST IMMEDIATELY — reward tokens may lose value if market drops further
  → Convert harvested rewards to stablecoins before they depreciate
  → Reduces exposure to volatile reward token price

BULLISH SENTIMENT (score > 50):
  → DELAY HARVEST — let rewards accumulate as their token price appreciates
  → Waiting 6-8 hours instead of 4 captures more upside
  → The reward token gains value while sitting in the strategy

NEUTRAL SENTIMENT:
  → Standard 4-hour harvest cycle is appropriate
  → No urgency to deviate from normal compounding schedule

KEY INSIGHT: Anyone can call harvest() on a Beefy vault and earn 0.05-0.5% of the harvested rewards. VaultMind acts as a smart keeper that optimizes WHEN to call harvest based on market intelligence.`,
    tags: [
      "vault",
      "harvest",
      "keeper",
      "timing",
      "sentiment",
      "beefy",
      "compound",
      "rewards",
    ],
  },
  {
    topic: "Bonzo Vault Volatility-Aware Rebalancing",
    category: "strategy",
    content: `Concentrated Liquidity Manager (CLM) vaults on SaucerSwap V2 suffer when price moves violently out of range.
VOLATILITY RESPONSE STRATEGY:
- LOW VOLATILITY (< 40% annualized): Vault tightens liquidity ranges for higher fee capture. Safe to be aggressive.
- MODERATE VOLATILITY (40-80%): Vault automatically widens ranges. VaultMind monitors but doesn't intervene — the CLM handles rebalancing.
- HIGH VOLATILITY (> 80%): VaultMind recommends switching to stablecoin vault (USDC-USDT Stable CLM) or withdrawing to single-sided Bonzo Lend supply. This preempts catastrophic IL.

VAULT SWITCHING LOGIC:
1. Current vault: HBAR-USDC CLM (8% APY, medium risk)
2. Volatility spikes to 90% → IL risk exceeds fee income
3. VaultMind recommends: Switch to USDC-USDT Stable CLM (3.8% APY, low risk)
4. When volatility drops below 50% → Switch back to higher-yield vault

The vault contracts handle micro-rebalancing (range adjustments). VaultMind handles macro-rebalancing (vault switching) based on broader market intelligence.`,
    tags: [
      "vault",
      "volatility",
      "rebalance",
      "clm",
      "concentrated",
      "liquidity",
      "range",
      "impermanent",
      "loss",
    ],
  },
  {
    topic: "Bonzo Vault Contract Interface (Beefy Standard)",
    category: "protocol",
    content: `Bonzo Vaults are EVM smart contracts forked from Beefy Finance, deployed on Hedera.
VAULT CONTRACT (BeefyVaultV7):
- deposit(uint256 amount): Deposit want tokens, receive mooTokens (vault shares)
- withdraw(uint256 shares): Burn mooTokens, receive want tokens proportionally
- depositAll(): Deposit entire wallet balance of want token
- withdrawAll(): Withdraw all vault shares
- getPricePerFullShare(): Returns current value of 1 mooToken in want tokens (starts at 1e18, grows as rewards compound)
- balance(): Total vault balance = vault holding + strategy deployed
- available(): Tokens sitting idle in vault (not yet deployed to strategy)
- earn(): Send available() tokens to strategy for deployment

STRATEGY CONTRACT:
- harvest(): Compound rewards — anyone can call, caller gets 0.05-0.5% fee
- harvest(address callFeeRecipient): Direct harvest reward to specified address
- balanceOf(): Total strategy balance in farming positions
- paused(): Check if strategy is paused (emergency)
- lastHarvest(): Timestamp of last harvest call
- harvestOnDeposit(): If true, deposits auto-trigger harvest (prevents yield stealing)

FLOW: User → deposit(amount) → Vault → earn() → Strategy → farms/pools → harvest() → compound`,
    tags: [
      "vault",
      "contract",
      "beefy",
      "deposit",
      "withdraw",
      "harvest",
      "technical",
      "evm",
      "solidity",
    ],
  },
  {
    topic: "Bonzo Vault Cross-Protocol Yield Optimization",
    category: "strategy",
    content: `VaultMind compares yields across ALL Bonzo products to recommend the best opportunity:

BONZO LEND (Aave v2):
- HBAR Supply: ~3.5% APY (variable, based on utilization)
- USDC Supply: ~5.2% APY (higher demand for stablecoin borrowing)
- SAUCE Supply: ~2.1% APY
- Pro: Direct control, instant withdraw, can borrow against collateral
- Con: Lower yields, no auto-compounding, manual management

BONZO VAULTS (Beefy):
- HBAR-USDC CLM: ~8.4% APY (concentrated liquidity fees)
- SAUCE-HBAR CLM: ~12.7% APY (higher volatility = more fees)
- HBARX Leveraged LST: ~15.3% APY (leveraged staking loop)
- USDC-USDT Stable: ~3.8% APY (near-zero IL risk)
- Pro: Auto-compounding, hands-off, institutional strategies
- Con: Smart contract layering risk, potential IL, withdrawal may give mixed tokens

SAUCERSWAP DIRECT:
- V2 Manual LP: Varies 5-20%+ but requires active range management
- LARI rewards may boost APY temporarily
- Infinity Pool (single-sided SAUCE staking): ~4.5% APY

DECISION FRAMEWORK:
1. Risk-averse → USDC-USDT Stable Vault or Bonzo Lend USDC supply
2. Balanced → HBAR-USDC CLM Vault
3. Growth → HBARX Leveraged LST Vault (if sentiment bullish)
4. Need liquidity/borrowing → Bonzo Lend (can borrow against deposits)`,
    tags: [
      "vault",
      "yield",
      "comparison",
      "optimization",
      "cross",
      "protocol",
      "apy",
      "saucerswap",
      "bonzo",
      "lend",
    ],
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
