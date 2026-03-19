<p align="center">
  <img src="https://img.shields.io/badge/Track-AI_%26_Agents-7C3AED?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Bounty-Bonzo_Finance_$8K-a855f7?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hedera-Testnet_%26_Mainnet-00C853?style=for-the-badge&logo=hedera" />
  <img src="https://img.shields.io/badge/HCS-Immutable_Audit-FF6F00?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Architecture-Multi--Agent-E91E63?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Lines-10000%2B_TypeScript-3178C6?style=for-the-badge&logo=typescript" />
</p>

<h1 align="center">🧠 VaultMind</h1>
<h3 align="center">The First Autonomous Multi-Agent AI DeFi Keeper on Hedera</h3>

<p align="center">
  <strong>VaultMind doesn't just recommend — it thinks, decides, executes, and proves every action on-chain.</strong>
</p>

<p align="center">
  A multi-agent keeper system that fuses Pyth real-time price feeds, market sentiment, volatility analysis,<br/>
  and DeFi position data to make intelligent vault management decisions on Bonzo Finance — then logs every<br/>
  decision immutably to Hedera Consensus Service as a transparent, verifiable audit trail.
</p>

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-demo-video">Demo Video</a> •
  <a href="#-the-problem">Problem</a> •
  <a href="#-the-solution">Solution</a> •
  <a href="#-multi-agent-architecture">Architecture</a> •
  <a href="#-complete-feature-inventory">Features</a> •
  <a href="#-all-commands-reference">Commands</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-bonzo-bounty-alignment-8000">Bounty</a>
</p>

---

## 📋 Submission Summary

| Field             | Value                                                        |
| ----------------- | ------------------------------------------------------------ |
| **Main Track**    | 🤖 AI & Agents                                               |
| **Bounty**        | 💰 Bonzo Finance ($8,000)                                    |
| **Team Size**     | 1 (Solo Builder)                                             |
| **GitHub Repo**   | [This repository]                                            |
| **Live Demo URL** | [https://vaultmind.vercel.app](https://vaultmind.vercel.app) |
| **Demo Video**    | [YouTube Link](https://youtube.com/watch?v=PLACEHOLDER)      |
| **Pitch Deck**    | [PDF in /docs/pitch-deck.pdf](./docs/pitch-deck.pdf)         |

---

## 📝 Project Description (100 words)

VaultMind is an autonomous **multi-agent** AI keeper system for Bonzo Finance on Hedera. Four specialized agents — Sentinel (market intelligence via Pyth price feeds), Strategist (decision engine), Executor (on-chain transactions), and Auditor (HCS compliance logging) — work together in a pipeline to manage DeFi positions. The system executes real vault deposits, withdrawals, and harvests on Bonzo's ICHI and Beefy vault contracts on mainnet, performs automated DCA with real Pyth-priced executions, and implements HBARX liquid staking strategies through Stader Labs. Every decision is logged immutably to HCS with full reasoning, creating a verifiable on-chain audit trail.

---

## 🔧 Tech Stack

| Category               | Technology                                           | Purpose                                          |
| ---------------------- | ---------------------------------------------------- | ------------------------------------------------ |
| **Framework**          | Next.js 14 + React 18 + TypeScript                   | Full-stack application                           |
| **AI Agent (Primary)** | LangChain + LangGraph + MemorySaver                  | Agentic tool-calling with conversation memory    |
| **AI Agent (Alt)**     | Vercel AI SDK v6 + `@ai-sdk/openai`                  | Alternative agent with `generateText` + tools    |
| **Multi-Agent**        | Custom Orchestrator (4 agents)                       | Sentinel → Strategist → Executor → Auditor       |
| **LLM**                | OpenAI GPT-4o                                        | Reasoning, tool selection, natural language      |
| **Blockchain SDK**     | Hedera Agent Kit v3                                  | Hedera network interactions                      |
| **DeFi Protocol**      | `@bonzofinancelabs/hak-bonzo-plugin`                 | Bonzo Lend + Vault operations                    |
| **Price Feeds**        | Pyth Network (Hermes API + on-chain contract)        | Real-time HBAR/USD, BTC, ETH, USDC prices        |
| **Consensus**          | Hedera Consensus Service (HCS)                       | Immutable decision audit trail                   |
| **Vault Contracts**    | ICHI Vaults + Beefy Vaults (real mainnet contracts)  | On-chain vault deposit/withdraw/harvest          |
| **Liquid Staking**     | Stader Labs (contract 0.0.800556)                    | HBAR → HBARX staking                             |
| **Data: Sentiment**    | CoinGecko + Fear & Greed + NewsAPI + Volatility calc | 4-source composite sentiment scoring             |
| **RAG**                | Custom TF-IDF similarity engine                      | 15+ DeFi knowledge documents                     |
| **Charts**             | Recharts + Custom SVG                                | 14 interactive visualization types               |
| **DCA**                | HCS event-sourced scheduler                          | Automated dollar-cost averaging with Pyth prices |
| **Deployment**         | Vercel                                               | Serverless hosting                               |

---

## 🌐 Live Demo

> **[https://vaultmind.vercel.app](https://vaultmind.vercel.app)**

Test with: `connect wallet 0.0.5907362` (or any Hedera testnet account)

---

## 📺 Demo Video

> **[Watch the 3-minute demo on YouTube →](https://youtube.com/watch?v=PLACEHOLDER)**

---

## 💡 The Problem

DeFi vaults today are **efficient but reactive**. They rely on static parameters or simple cron-job keepers. They cannot:

- Anticipate market volatility before it impacts positions
- Digest news or social sentiment to time harvests intelligently
- Use real-time oracle prices to optimize DCA timing
- Explain their reasoning to depositors in plain language
- Prove their decisions were sound with a verifiable audit trail
- Coordinate multiple specialized concerns (risk, execution, compliance)

**The result:** Depositors lose yield from late harvests, suffer unnecessary impermanent loss, and have zero visibility into why a keeper acted (or didn't).

---

## 💡 The Solution

**VaultMind** is a multi-agent AI system that replaces dumb keeper scripts with an intelligent, transparent, provable decision-making pipeline.

### The Multi-Agent Pipeline

```
┌──────────────────────────────────────────────────────────────────┐
│                   VaultMind Multi-Agent Pipeline                  │
│                                                                  │
│  ┌───────────┐  ┌────────────┐  ┌──────────┐  ┌────────────┐   │
│  │ SENTINEL  │─▶│ STRATEGIST │─▶│ AUDITOR  │─▶│  EXECUTOR  │   │
│  │           │  │            │  │          │  │            │   │
│  │ Pyth      │  │ 6-strategy │  │ Pre-     │  │ Real on-   │   │
│  │ prices    │  │ weighted   │  │ flight   │  │ chain tx   │   │
│  │ Sentiment │  │ decision   │  │ risk     │  │ Bonzo Lend │   │
│  │ Bonzo mkts│  │ engine     │  │ checks   │  │ ICHI vaults│   │
│  │ Stader    │  │ DCA plans  │  │ Rate     │  │ Beefy vault│   │
│  │ Vaults    │  │ Portfolio  │  │ limiting │  │ Stader     │   │
│  └───────────┘  └────────────┘  └────┬─────┘  └─────┬──────┘   │
│                                      │               │          │
│                                      ▼               ▼          │
│                                ┌──────────┐                     │
│                                │ AUDITOR  │                     │
│                                │ (post)   │                     │
│                                │          │                     │
│                                │ HCS log  │                     │
│                                │ immutable│                     │
│                                │ on-chain │                     │
│                                └──────────┘                     │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🏗 Multi-Agent Architecture

### Four Specialized Agents

| Agent             | Role                | What It Does                                                                                                             | Key Technology                           |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| **🔍 Sentinel**   | Market Intelligence | Fetches Pyth prices, sentiment, Bonzo markets, Stader data, vault state — all in parallel                                | Pyth Hermes API, CoinGecko, Fear & Greed |
| **🧠 Strategist** | Decision Engine     | Consumes Sentinel intel + portfolio + DCA plans → produces prioritized action list with confidence scores                | 6-strategy weighted engine               |
| **🛡️ Auditor**    | Compliance & Risk   | Pre-flight risk checks (blocks low-confidence, rate-limits, blocks leverage in bearish+volatile). Logs everything to HCS | HCS TopicMessageSubmit                   |
| **⚡ Executor**   | Transaction Runner  | Routes approved actions to correct on-chain handler: Bonzo Lend, ICHI vaults, Beefy vaults, Stader, DCA                  | ContractExecuteTransaction               |

### Data Flow — One Complete Keeper Cycle

```
 ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 │  Pyth    │  │Fear/Greed│  │  Bonzo   │  │  Stader  │  │  Bonzo   │
 │ HBAR $   │  │  Index   │  │ Markets  │  │  HBARX   │  │  Vaults  │
 │ BTC ETH  │  │  0-100   │  │ 13 assets│  │ exchange │  │ 20 vaults│
 └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
      │              │             │              │              │
      └──────────────┴──────┬──────┴──────────────┴──────────────┘
                            │
                     ┌──────▼──────┐
                     │  SENTINEL   │  Parallel fetch, signal derivation
                     │  Agent      │  bias, volatility regime, risk level
                     └──────┬──────┘
                            │ MarketIntelligence
                     ┌──────▼──────┐
                     │ STRATEGIST  │  + Portfolio + DCA plans
                     │  Agent      │  → Prioritized StrategyPlan
                     └──────┬──────┘
                            │ StrategyAction[]
                     ┌──────▼──────┐
                     │  AUDITOR    │  Pre-flight risk checks
                     │  (pre)      │  Block/approve each action
                     └──────┬──────┘
                            │ Approved actions only
                     ┌──────▼──────┐
                     │  EXECUTOR   │  Real on-chain transactions
                     │  Agent      │  ContractExecuteTransaction
                     └──────┬──────┘
                            │ ExecutionReport[]
                     ┌──────▼──────┐
                     │  AUDITOR    │  Log results to HCS
                     │  (post)     │  Immutable audit trail
                     └──────┘──────┘
```

---

## ✨ Complete Feature Inventory

### 🔷 Feature 1: Pyth Network Real-Time Price Feeds

Real prices from Pyth's Hermes API — no CoinGecko-only dependency.

- **HBAR/USD, BTC/USD, ETH/USD, USDC/USD** — live prices with confidence intervals
- **EMA prices** — exponential moving average for trend detection
- **On-chain verification** — can query Pyth contract directly on Hedera for verified pricing
- **10-second cache** — balances freshness with API efficiency
- **Used everywhere** — DCA execution, keeper decisions, Stader strategy, portfolio valuation

### 🏦 Feature 2: Real Vault Execution on Mainnet

Actual smart contract calls against Bonzo's vault contracts — not simulated.

**ICHI Single-Asset Vaults (14 vaults):**

- Deposit via `DepositGuard.forwardDepositToICHIVault()` — single-token entry
- Withdraw via `ICHIVault.withdraw(shares, to)` — returns both tokens
- On-chain queries: `getTotalAmounts()`, `balanceOf()`, `totalSupply()`

**Beefy Dual-Asset + Leveraged LST Vaults (5 vaults):**

- Deposit via `ERC20.approve()` → `BeefyVault.deposit(amount)`
- Withdraw via `BeefyVault.withdrawAll()` or `BeefyVault.withdraw(shares)`
- Harvest via `BeefyStrategy.harvest(callFeeRecipient)` — caller earns fee incentive
- On-chain queries: `getPricePerFullShare()`, `lastHarvest()`, `paused()`, `balance()`

### 📅 Feature 3: DCA Auto-Loop with Real Execution

Dollar-cost averaging that actually executes on-chain deposits automatically.

- **HCS event-sourced** — every DCA operation (create/pause/resume/cancel/execute) is an immutable on-chain event
- **Auto-execution** — every keeper tick checks all active plans and executes due ones
- **Real Pyth prices** — DCA tracks actual HBAR price at execution time
- **Real deposits** — `executeDueDCAPlans()` calls `executeDeposit()` on Bonzo Lend contracts
- **Smart pausing** — auto-pauses after 3 consecutive failures, pauses if health factor critical
- **Frequencies** — hourly, daily, weekly, biweekly, monthly

### 🔷 Feature 4: HBARX Liquid Staking Strategy

Full yield-on-yield pipeline: HBAR → Stader → HBARX → Bonzo Supply → Borrow.

- **Mainnet:** Real staking via Stader contract `0.0.800556` + real Bonzo deposit + real borrow
- **Testnet:** Staking simulated (no testnet contract), but Bonzo deposit/borrow are REAL testnet transactions
- **Pyth-priced** — all USD calculations use live Pyth HBAR/USD feed
- **Exchange rate** — queries Stader contract on-chain for real HBARX rate

### 🤖 Feature 5: Multi-Agent Keeper System

Four agents coordinated by an Orchestrator:

**Sentinel Agent:**

- Parallel fetches: Pyth prices + sentiment + Bonzo markets + Stader + vaults
- Derives signals: overall bias, volatility regime, risk level, HBAR momentum, action urgency

**Strategist Agent:**

- Consumes Sentinel intel + portfolio + active DCA plans
- Produces prioritized action list across all subsystems (lend, vault, DCA, Stader)
- 6-strategy weighted engine with confidence scoring

**Auditor Agent:**

- Pre-flight risk checks: blocks low-confidence actions, rate-limits, blocks leverage during bearish+volatile
- Logs all decisions and execution results to HCS
- Records `agentArchitecture: "multi-agent-v2"` in every HCS entry

**Executor Agent:**

- Routes each approved action to the correct on-chain handler
- Supports: Bonzo Lend, ICHI vaults, Beefy vaults, Stader staking, DCA execution
- Returns structured execution reports with tx IDs

### 🤖 Feature 6: Dual AI Agent Framework

| Capability       | LangChain Agent                      | Vercel AI SDK Agent          |
| ---------------- | ------------------------------------ | ---------------------------- |
| **File**         | `lib/agent.ts`                       | `lib/agent-vercel.ts`        |
| **Framework**    | LangChain + LangGraph                | `ai` v6 + `@ai-sdk/openai`   |
| **Tool Calling** | `createReactAgent()`                 | `generateText()` + `tool()`  |
| **Memory**       | `MemorySaver` (LangGraph checkpoint) | In-memory conversation array |

### 📊 Feature 7: 4-Source Sentiment Engine

| Source              | Data                                        | API                 |
| ------------------- | ------------------------------------------- | ------------------- |
| CoinGecko           | HBAR price, 24h change, 7-day history       | `api.coingecko.com` |
| Fear & Greed        | Market fear/greed score (0-100)             | `alternative.me`    |
| Realized Volatility | Annualized std dev from 7-day daily returns | Calculated          |
| NewsAPI             | Crypto headlines scored bullish/bearish     | `newsapi.org`       |

### 🛡️ Feature 8: 6-Strategy Keeper Decision Engine

| Priority | Strategy                 | Trigger          | Action              |
| -------- | ------------------------ | ---------------- | ------------------- |
| 1        | Health Factor Protection | HF < 1.3         | `REPAY_DEBT`        |
| 2        | Bearish Harvest          | Sentiment < -30  | `HARVEST` → stable  |
| 3        | Volatility Exit          | Volatility > 80% | `EXIT_TO_STABLE`    |
| 4        | Yield Optimization       | Yield gap > 2%   | `REBALANCE`         |
| 5        | Bullish Accumulation     | Sentiment > +50  | `INCREASE_POSITION` |
| 6        | Vault Rebalancing        | Range deviation  | `SWITCH_VAULT`      |

### 🔗 Feature 9: HCS Immutable Audit Trail

Every decision logged to Hedera Consensus Service with multi-agent metadata:

```json
{
  "agent": "VaultMind",
  "version": "2.0.0",
  "action": "VAULT_HARVEST",
  "reason": "USDC-HBAR vault hasn't been harvested in 6.2h...",
  "confidence": 0.7,
  "context": { "sentimentScore": -12, "volatility": 45, "hbarPrice": 0.1823 },
  "params": {
    "agentArchitecture": "multi-agent-v2",
    "agents": ["sentinel", "strategist", "executor", "auditor"]
  }
}
```

### 📈 Feature 10: 14 Interactive Chart Types

Portfolio Pie, Sentiment Gauge, APY Comparison, OHLCV Candlestick, Risk/Return Scatter, Correlation Matrix, DeFi Heatmap, Performance Backtest, Market Overview, Vault Comparison, Positions Table, Wallet Info, HCS Timeline, Decision History.

### 🛡️ Feature 11: Health Monitor

Real-time health factor gauge, liquidation distance calculation, per-asset risk breakdown, and proactive alerts when health factor drops.

### 📚 Feature 12: RAG Knowledge Base

Custom TF-IDF retrieval across 15+ DeFi strategy documents covering lending loops, health factor management, concentrated liquidity, impermanent loss, vault auto-compounding.

---

## 📋 All Commands Reference

### 👛 Wallet

| Command                      | Description                  |
| ---------------------------- | ---------------------------- |
| `connect wallet 0.0.5907362` | Connect Hedera account       |
| `show my wallet`             | Balance, tokens, EVM address |
| `disconnect wallet`          | Clear session                |

### 📊 Analytics & Charts

| Command                         | Description                     |
| ------------------------------- | ------------------------------- |
| `show my portfolio`             | Asset allocation pie chart      |
| `how's the market sentiment?`   | 4-source sentiment gauge        |
| `compare APYs across platforms` | Supply vs Borrow vs Vault APYs  |
| `compare Bonzo Vault APYs`      | All 20 vaults with APY/TVL/risk |
| `show correlation matrix`       | Inter-asset correlation heatmap |
| `show risk vs return`           | Volatility vs return scatter    |
| `show DeFi opportunities`       | Utilization × APY heatmap       |
| `show price chart`              | 30-day HBAR OHLCV candlestick   |
| `show Bonzo markets`            | All reserves with rates         |
| `show my positions`             | Supplied/borrowed per asset     |
| `show backtest`                 | VaultMind vs HODL simulation    |

### ⚡ Keeper

| Command                         | Description                                 |
| ------------------------------- | ------------------------------------------- |
| `run dry run`                   | Analyze market, show recommendation         |
| `execute keeper`                | Run and execute the recommendation          |
| `start auto keeper`             | Begin autonomous monitoring (default 5 min) |
| `start auto keeper every 1 min` | Custom interval (1-15 min)                  |
| `stop auto keeper`              | Stop autonomous monitoring                  |
| `show decision history`         | Past keeper decisions this session          |

### ⚙️ Strategy Configuration

| Command                          | Description             |
| -------------------------------- | ----------------------- |
| `show strategy config`           | Current thresholds      |
| `set bearish threshold to -25`   | Adjust bearish trigger  |
| `set bullish threshold to 60`    | Adjust bullish trigger  |
| `set volatility threshold to 75` | Adjust vol exit trigger |
| `reset strategy to defaults`     | Reset all thresholds    |

### 💰 Vault Operations

| Command                                 | Description                      |
| --------------------------------------- | -------------------------------- |
| `deposit 100 HBAR into HBAR-USDC vault` | Vault deposit                    |
| `deposit into vault`                    | Vault deposit (agent picks best) |
| `withdraw from vault`                   | Exit vault position              |
| `harvest SAUCE-HBAR vault now`          | Trigger harvest (Beefy only)     |
| `switch vault to stable`                | Move to low-risk vault           |

### 🏦 Bonzo Lending

| Command                    | Description               |
| -------------------------- | ------------------------- |
| `supply 500 HBAR to Bonzo` | Deposit to Bonzo Lend     |
| `deposit 100 HBAR`         | Same as supply            |
| `borrow 200 USDC`          | Borrow against collateral |
| `repay my USDC loan`       | Repay all USDC debt       |
| `repay 50 USDC`            | Partial repay             |
| `withdraw my HBAR`         | Withdraw supplied HBAR    |

### 📅 DCA (Dollar Cost Averaging)

| Command                          | Description                      |
| -------------------------------- | -------------------------------- |
| `DCA 50 HBAR daily`              | Create daily DCA plan            |
| `DCA 100 USDC weekly into Bonzo` | Weekly into Bonzo Lend           |
| `DCA 200 HBAR monthly`           | Monthly accumulation             |
| `show DCA status`                | All plans with execution history |
| `pause DCA`                      | Pause active plan                |
| `resume DCA`                     | Resume paused plan               |
| `cancel DCA`                     | Cancel a plan                    |
| `cancel all DCA`                 | Cancel everything                |

### 🔷 Stader HBARX

| Command                        | Description                    |
| ------------------------------ | ------------------------------ |
| `HBARX strategy with 100 HBAR` | Full stake→supply→borrow loop  |
| `stake 50 HBAR with Stader`    | Liquid staking only            |
| `show HBARX info`              | Exchange rate, APY, Pyth price |

### 🛡️ Health Monitor

| Command                 | Description              |
| ----------------------- | ------------------------ |
| `monitor my positions`  | Live health factor gauge |
| `show liquidation risk` | Per-asset risk breakdown |
| `show health monitor`   | Proactive alerts         |

### 🔗 HCS Audit Trail

| Command                       | Description        |
| ----------------------------- | ------------------ |
| `show audit log`              | All entries        |
| `show last 5 keeper actions`  | Newest 5           |
| `show first 3 entries`        | Oldest 3           |
| `show only HARVEST actions`   | Filter by type     |
| `show last 3 DEPOSIT actions` | Filtered + limited |
| `show only BORROW actions`    | All borrows        |
| `show only REPAY entries`     | All repays         |

### 📚 DeFi Research (RAG)

| Command                                | Description                  |
| -------------------------------------- | ---------------------------- |
| `what's the lending loop strategy?`    | RAG knowledge retrieval      |
| `when should I harvest vaults?`        | Strategy guidance            |
| `I want safe yield on my HBAR`         | Intent → AI recommendation   |
| `I want maximum yield, I'm aggressive` | Intent → aggressive strategy |

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Hedera testnet account ([portal.hedera.com](https://portal.hedera.com))
- OpenAI API key

### Installation

```bash
git clone https://github.com/YOUR_USERNAME/vaultmind.git
cd vaultmind/frontend
npm install
```

### Environment Setup

```bash
cp .env.example .env.local
```

```env
# === REQUIRED ===
HEDERA_ACCOUNT_ID=0.0.XXXXXX
HEDERA_PRIVATE_KEY=302e...
HEDERA_NETWORK=testnet          # or "mainnet" for real vault execution
OPENAI_API_KEY=sk-...

# === OPTIONAL ===
AI_PROVIDER=langchain           # or "vercel"
NEWS_API_KEY=your_key           # for news sentiment
HCS_AUDIT_TOPIC_ID=0.0.XXXXXXX # auto-discovered if not set
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### Run

```bash
npm run dev
# Open http://localhost:3000
```

---

## 📁 Project Structure

```
frontend/
├── app/
│   ├── page.tsx                          # Main dashboard (2,950+ lines)
│   ├── layout.tsx                        # Root layout
│   └── api/
│       ├── agent/route.ts                # Dual AI provider routing
│       ├── keeper/route.ts               # Multi-agent keeper API
│       ├── execute/route.ts              # Bonzo Lend execution
│       ├── vaults/route.ts               # Real vault operations (mainnet)
│       ├── dca/route.ts                  # DCA scheduler with Pyth prices
│       ├── stader/route.ts               # HBARX staking with Pyth
│       ├── pyth/route.ts                 # Pyth price feed API
│       ├── market/route.ts               # Market data + sentiment
│       ├── positions/route.ts            # Bonzo Lend positions
│       ├── hcs/route.ts                  # HCS audit trail reader
│       └── ...                           # Charts, OHLCV, backtest, etc.
├── lib/
│   ├── agents/                           # Multi-agent system
│   │   ├── orchestrator.ts               # Coordinates all 4 agents
│   │   ├── sentinel-agent.ts             # Market intelligence (Pyth+sentiment)
│   │   ├── strategist-agent.ts           # Decision engine
│   │   ├── executor-agent.ts             # Transaction runner
│   │   ├── auditor-agent.ts              # HCS logging + risk checks
│   │   └── index.ts                      # Barrel exports
│   ├── pyth.ts                           # Pyth Network price feeds
│   ├── vault-execute.ts                  # Real ICHI + Beefy vault execution
│   ├── agent.ts                          # LangChain agent (6 tools)
│   ├── agent-vercel.ts                   # Vercel AI SDK agent
│   ├── keeper.ts                         # Multi-agent keeper cycle wrapper
│   ├── sentiment.ts                      # 4-source sentiment fusion
│   ├── bonzo.ts                          # Bonzo Data API client
│   ├── bonzo-execute.ts                  # Bonzo Lend contract execution
│   ├── bonzo-vaults.ts                   # 20 vault registry + decision engine
│   ├── stader.ts                         # Stader HBARX with Pyth prices
│   ├── dca.ts                            # HCS event-sourced DCA scheduler
│   ├── hcs.ts                            # HCS topic management
│   ├── health-monitor.ts                 # Position health tracking
│   ├── rag.ts                            # RAG knowledge base (15+ docs)
│   └── hedera.ts                         # Hedera client setup
├── components/
│   ├── InlineCharts.tsx                  # 14 chart type renderer
│   ├── MarkdownMessage.tsx               # Rich markdown rendering
│   ├── TransactionModal.tsx              # Tx confirmation dialog
│   └── WalletConnect.tsx                 # Hedera wallet connection
└── package.json

45+ source files · 10,000+ lines of TypeScript
```

---

## 💰 Bonzo Bounty Alignment ($8,000)

### All 3 Bonzo Example Ideas — Fully Implemented

**1. "Volatility-Aware Rebalancer"** ✅ — Sentinel Agent calculates realized volatility from Pyth 7-day HBAR prices. When volatility > 80%, Strategist triggers `EXIT_TO_STABLE`. Low volatility + bullish → Strategist recommends HBARX leveraged vault.

**2. "Sentiment-Based Harvester"** ✅ — 4-source sentiment engine produces composite score. Sentinel feeds to Strategist. Sentiment < -30 → `HARVEST`. Sentiment > +50 → `INCREASE_POSITION`. RAG provides DeFi strategy context.

**3. "Intent-Based User Interface"** ✅ — "I want safe yield" → AI scans 20 vaults → recommends lowest-risk → user confirms → real deposit on Hedera.

### Bonzo's Suggested Tech Stack — Complete Match + Exceeded

| Bonzo Suggested       | VaultMind Uses                                       | Status      |
| --------------------- | ---------------------------------------------------- | ----------- |
| Hedera Agent Kit      | `hedera-agent-kit` v3                                | ✅          |
| Bonzo Vault Contracts | Real ICHI + Beefy vault calls on mainnet             | ✅ Exceeded |
| LangChain (RAG)       | LangChain + LangGraph + custom RAG                   | ✅          |
| Vercel AI SDK         | `ai` v6 + `@ai-sdk/openai` (dual provider)           | ✅          |
| Twitter/News API      | NewsAPI crypto headlines                             | ✅          |
| SupraOracles          | **Pyth Network** (400+ feeds, Hermes API + on-chain) | ✅ Better   |

---

## 🧪 Testing Instructions — Judge Verification Flow

| #   | Command                         | What to Verify                         |
| --- | ------------------------------- | -------------------------------------- |
| 1   | `connect wallet 0.0.5907362`    | Balance + tokens in sidebar            |
| 2   | `how's the market sentiment?`   | 4-source analysis with gauge chart     |
| 3   | `show Bonzo markets`            | All reserves with real APYs            |
| 4   | `run dry run`                   | Multi-agent decision with confidence   |
| 5   | `supply 100 HBAR to Bonzo`      | Preview → Confirm → Real tx → HashScan |
| 6   | `show my positions`             | Supplied assets with health factor     |
| 7   | `borrow 5 USDC`                 | HF impact preview → Real tx            |
| 8   | `DCA 50 HBAR daily`             | DCA plan created on HCS                |
| 9   | `show DCA status`               | Plan with next execution time          |
| 10  | `HBARX strategy with 100 HBAR`  | Stake → Supply → shows Pyth prices     |
| 11  | `show HBARX info`               | Exchange rate + Pyth USD prices        |
| 12  | `start auto keeper every 1 min` | Timer starts, DCA auto-executes        |
| 13  | `show audit log`                | HCS entries with multi-agent metadata  |
| 14  | `show only DEPOSIT entries`     | Filtered HCS audit                     |
| 15  | `monitor my positions`          | Health factor gauge                    |
| 16  | `repay my USDC loan`            | Real tx → positions updated            |
| 17  | `I want safe yield on my HBAR`  | AI recommends lowest-risk vault        |
| 18  | `show backtest`                 | VaultMind vs HODL chart                |
| 19  | Toggle **Vercel AI** in header  | Subsequent commands use Vercel SDK     |
| 20  | `disconnect wallet`             | Session cleared                        |

---

## 👤 Team

|                  | Details                                                                                                                   |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Name**         | Aaditya                                                                                                                   |
| **Role**         | Solo Full-Stack Developer & AI Engineer                                                                                   |
| **Track Record** | 31 shipped projects · 18 hackathon wins · Smart India Hackathon 2023                                                      |
| **Education**    | B.Tech AI & Data Science (AKTU) · M.Sc AI at Brandenburg University of Technology Cottbus–Senftenberg, Germany (Oct 2026) |

---

## 📜 License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <br/>
  <strong>🧠 VaultMind: Where DeFi Vaults Get a Brain</strong>
  <br/><br/>
  <em>Built for the Hedera Hello Future Apex Hackathon 2026</em>
  <br/>
  <em>Main Track: AI & Agents · Bounty: Bonzo Finance ($8,000)</em>
  <br/><br/>
  <code>45+ files · 10,000+ lines · Multi-agent architecture · Real on-chain execution</code>
</p>
