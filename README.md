<p align="center">
  <img src="https://img.shields.io/badge/Track-AI_%26_Agents-7C3AED?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Bounty-Bonzo_Finance_$8K-a855f7?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hedera-Testnet_Live-00C853?style=for-the-badge&logo=hedera" />
  <img src="https://img.shields.io/badge/HCS-Immutable_Audit-FF6F00?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Lines-8600%2B_TypeScript-3178C6?style=for-the-badge&logo=typescript" />
</p>

<h1 align="center">🧠 VaultMind</h1>
<h3 align="center">The First Autonomous AI DeFi Keeper Agent on Hedera</h3>

<p align="center">
  <strong>VaultMind doesn't just recommend — it thinks, decides, executes, and proves every action on-chain.</strong>
</p>

<p align="center">
  An autonomous keeper agent that fuses real-time market sentiment, volatility analysis, and DeFi<br/>
  position data to make intelligent vault management decisions on Bonzo Finance — then logs every<br/>
  decision immutably to Hedera Consensus Service as a transparent, verifiable audit trail.
</p>

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-demo-video">Demo Video</a> •
  <a href="#-the-problem">Problem</a> •
  <a href="#-the-solution">Solution</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-complete-feature-inventory">Features</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-bonzo-bounty-alignment-8000">Bounty</a> •
  <a href="#-judging-criteria-mapping-100-coverage">Judging</a>
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

VaultMind is an autonomous AI keeper agent for Bonzo Finance on Hedera that replaces static vault management with intelligent, context-aware decision-making. It ingests four real-time data sources (CoinGecko prices, Fear & Greed Index, realized volatility, crypto news), runs a 6-strategy weighted decision engine, and autonomously executes lending and vault operations through the Hedera Agent Kit and Bonzo Plugin. Every decision — with its reasoning, confidence score, and market context — is logged immutably to Hedera Consensus Service, creating a verifiable on-chain audit trail. Users interact through a conversational chat interface supporting 40+ natural language commands with dual AI frameworks (LangChain + Vercel AI SDK).

---

## 🔧 Tech Stack

| Category               | Technology                                            | Purpose                                        |
| ---------------------- | ----------------------------------------------------- | ---------------------------------------------- |
| **Framework**          | Next.js 14 + React 18 + TypeScript                    | Full-stack application                         |
| **AI Agent (Primary)** | LangChain + LangGraph + MemorySaver                   | Agentic tool-calling with conversation memory  |
| **AI Agent (Alt)**     | Vercel AI SDK v6 + `@ai-sdk/openai`                   | Alternative agent with `generateText` + tools  |
| **LLM**                | OpenAI GPT-4o                                         | Reasoning, tool selection, natural language    |
| **Blockchain SDK**     | Hedera Agent Kit v3                                   | Hedera network interactions                    |
| **DeFi Protocol**      | `@bonzofinancelabs/hak-bonzo-plugin`                  | Bonzo Lend + Vault operations                  |
| **Consensus**          | Hedera Consensus Service (HCS)                        | Immutable decision audit trail                 |
| **Token Service**      | Hedera Token Service (HTS)                            | Token associations, WHBAR wrapping             |
| **Smart Contracts**    | Bonzo Lend (Aave v3 fork) + Bonzo Vaults (Beefy fork) | On-chain DeFi execution                        |
| **Data: Prices**       | CoinGecko API                                         | HBAR price, 24h change, 7-day history          |
| **Data: Sentiment**    | Alternative.me Fear & Greed Index                     | Market fear/greed score                        |
| **Data: Volatility**   | Calculated from CoinGecko 7-day prices                | Realized volatility (annualized)               |
| **Data: News**         | NewsAPI                                               | Crypto headlines with bullish/bearish scoring  |
| **RAG**                | Custom TF-IDF similarity engine                       | 15+ DeFi knowledge documents                   |
| **Charts**             | Recharts + Custom SVG                                 | 14 interactive visualization types             |
| **Styling**            | Tailwind CSS                                          | Bonzo Finance-inspired dark purple theme       |
| **Markdown**           | react-markdown + remark-gfm                           | Rich agent message rendering                   |
| **Mirror Node**        | Hedera Mirror Node REST API                           | Topic discovery, account data, tx verification |
| **Deployment**         | Vercel                                                | Serverless hosting                             |

---

## 🌐 Live Demo

> **[https://vaultmind.vercel.app](https://vaultmind.vercel.app)**

Test with: `connect wallet 0.0.5907362` (or any Hedera testnet account)

---

## 📺 Demo Video

> **[Watch the 3-minute demo on YouTube →](https://youtube.com/watch?v=PLACEHOLDER)**

---

## 💡 The Problem

DeFi vaults today are **efficient but reactive**. They rely on static parameters or simple cron-job keepers to harvest rewards and rebalance liquidity ranges. They fundamentally **cannot**:

```
❌ Anticipate market volatility before it impacts positions
❌ Digest news or social sentiment to time harvests intelligently
❌ Adapt strategies based on off-chain context (fear/greed, news cycle)
❌ Explain their reasoning to depositors in plain language
❌ Prove their decisions were sound with a verifiable audit trail
❌ Learn from intent — understand "I want safe yield" vs "maximize returns"
```

**The result:** Depositors lose yield from late harvests, suffer unnecessary impermanent loss, miss rebalancing windows, and have zero visibility into why a keeper acted (or didn't act).

**The market is massive:** Over $4.7 billion is locked in DeFi vaults across chains. Even a 1% yield improvement through intelligent management represents $47 million in recovered value annually.

---

## 💡 The Solution

**VaultMind** is an autonomous AI agent that serves as the **brain** of DeFi vault management. It replaces dumb keeper scripts with an intelligent, transparent, provable decision-making system.

### The Decision Loop

```
┌──────────────────────────────────────────────────────────────┐
│                    VaultMind Decision Loop                    │
│                                                              │
│   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌──────────┐  │
│   │ INGEST  │──▶│  THINK  │──▶│ DECIDE  │──▶│ EXECUTE  │  │
│   │         │   │         │   │         │   │          │  │
│   │ 4 data  │   │ Weighted│   │ Action: │   │ Real tx  │  │
│   │ sources │   │ scoring │   │ HARVEST │   │ on Hedera│  │
│   │ in real │   │ across  │   │ or HOLD │   │ testnet  │  │
│   │ time    │   │ 6 strat-│   │ or EXIT │   │          │  │
│   │         │   │ egies   │   │ or ...  │   │          │  │
│   └─────────┘   └─────────┘   └─────────┘   └────┬─────┘  │
│                                                    │        │
│   ┌──────────┐   ┌──────────┐                     │        │
│   │ EXPLAIN  │◀──│  PROVE   │◀────────────────────┘        │
│   │          │   │          │                               │
│   │ Natural  │   │ HCS log  │                               │
│   │ language │   │ immutable│                               │
│   │ reasoning│   │ on-chain │                               │
│   └──────────┘   └──────────┘                               │
└──────────────────────────────────────────────────────────────┘
```

### A Real Interaction

```
User: "I want safe yield on my HBAR"

VaultMind: *[INGEST]  Fetches HBAR price ($0.0989), volatility (67%),
            Fear & Greed (32 = Fear), crypto news (3 bearish headlines)*
           *[THINK]   Sentiment score: -23. High volatility. Bearish bias.*
           *[DECIDE]  Avoid volatile vaults. Recommend USDC-USDT Stable CLM
            at 4.2% APY — lowest risk, auto-compounding.*
           *[EXECUTE] Wraps HBAR → deposits to stable vault → real tx hash*
           *[PROVE]   Logs decision + reasoning + tx to HCS Topic 0.0.XXXXX*
           *[EXPLAIN] "Given the current bearish sentiment (-23) and elevated
            volatility (67%), I've deposited into the USDC-USDT Stable CLM
            vault at 4.2% APY. This vault has the lowest risk profile.
            Your tx: 0.0.5907362@1708... — verify on HashScan."*
```

---

## 🏗 Architecture

### System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          VaultMind System Architecture                    │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                     PRESENTATION LAYER                             │  │
│  │                                                                    │  │
│  │  Next.js 14 Frontend — Bonzo-Inspired Dark Purple Theme            │  │
│  │  ┌──────────┐ ┌──────────────┐ ┌───────────┐ ┌────────────────┐  │  │
│  │  │ Chat UI  │ │ 14 Inline    │ │ Sidebar   │ │ Strategy       │  │  │
│  │  │ 40+ cmds │ │ Chart Types  │ │ Dashboard │ │ Config Panel   │  │  │
│  │  │ Markdown │ │ Recharts+SVG │ │ Live Data │ │ Price Alerts   │  │  │
│  │  │ Thinking │ │ Interactive  │ │ Pulse FX  │ │ Parameter Edit │  │  │
│  │  └────┬─────┘ └──────────────┘ └───────────┘ └────────────────┘  │  │
│  │       │            Provider Toggle: [🟢 LangChain | 🔵 Vercel AI] │  │
│  └───────┼────────────────────────────────────────────────────────────┘  │
│          │                                                               │
│  ┌───────┼────────────────────────────────────────────────────────────┐  │
│  │       ▼              AI AGENT LAYER                                │  │
│  │                                                                    │  │
│  │  ┌──────────────────────┐    ┌──────────────────────┐             │  │
│  │  │    LangChain Agent   │    │   Vercel AI Agent    │             │  │
│  │  │                      │    │                      │             │  │
│  │  │ • LangGraph state    │    │ • generateText()     │             │  │
│  │  │ • MemorySaver memory │    │ • stopWhen:stepCount  │             │  │
│  │  │ • createReactAgent() │    │ • In-memory history  │             │  │
│  │  │ • Tool binding       │    │ • Zod tool schemas   │             │  │
│  │  └──────────┬───────────┘    └──────────┬───────────┘             │  │
│  │             │   Runtime Switch (UI/ENV)   │                        │  │
│  │             └────────────┬────────────────┘                        │  │
│  │                          ▼                                         │  │
│  │  ┌────────────────────────────────────────────────────────┐       │  │
│  │  │              6 Shared AI Tools                          │       │  │
│  │  │                                                         │       │  │
│  │  │  🔍 analyze_sentiment    — 4-source composite scoring   │       │  │
│  │  │  📊 get_bonzo_markets    — Live reserve data + APYs     │       │  │
│  │  │  🏦 get_vault_data       — CLM vault APY/TVL/risk       │       │  │
│  │  │  📚 get_defi_knowledge   — RAG retrieval (15+ docs)     │       │  │
│  │  │  💼 check_portfolio      — User positions + health      │       │  │
│  │  │  🤖 make_keeper_decision — 6-strategy weighted engine   │       │  │
│  │  └────────────────────────────────────────────────────────┘       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │         DATA & DECISION LAYER   │                                 │  │
│  │                                 ▼                                 │  │
│  │  ┌──────────────────┐  ┌────────────────────────────────────┐    │  │
│  │  │ Sentiment Engine │  │    Keeper Decision Engine           │    │  │
│  │  │                  │  │                                      │    │  │
│  │  │ Source 1:        │  │  Priority 1: Health Factor Guard    │    │  │
│  │  │  CoinGecko HBAR  │  │  Priority 2: Bearish Harvest       │    │  │
│  │  │  price + 7d hist │  │  Priority 3: Volatility Exit       │    │  │
│  │  │                  │  │  Priority 4: Yield Optimization     │    │  │
│  │  │ Source 2:        │  │  Priority 5: Bullish Accumulation   │    │  │
│  │  │  Fear & Greed    │  │  Priority 6: Vault Rebalancing     │    │  │
│  │  │  Index (0-100)   │  │                                      │    │  │
│  │  │                  │  │  Output:                              │    │  │
│  │  │ Source 3:        │  │  • Action (HOLD/HARVEST/EXIT/...)   │    │  │
│  │  │  Realized Vol.   │  │  • Confidence (0.0 – 1.0)          │    │  │
│  │  │  from price σ    │  │  • Reasoning (natural language)      │    │  │
│  │  │                  │  │  • Parameters (token, amount, etc)   │    │  │
│  │  │ Source 4:        │  └────────────────────────────────────┘    │  │
│  │  │  NewsAPI crypto  │                                             │  │
│  │  │  headlines       │  ┌────────────────────────────────────┐    │  │
│  │  └──────────────────┘  │    RAG Knowledge Base              │    │  │
│  │                        │    15+ DeFi strategy documents       │    │  │
│  │  Composite Score:      │    TF-IDF similarity retrieval      │    │  │
│  │  -100 (max bear)       └────────────────────────────────────┘    │  │
│  │  to +100 (max bull)                                               │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                    │                                     │
│  ┌─────────────────────────────────┼─────────────────────────────────┐  │
│  │       HEDERA EXECUTION LAYER    │                                 │  │
│  │                                 ▼                                 │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │  │
│  │  │Hedera Agent  │  │ Bonzo Plugin │  │ HCS Audit Trail      │   │  │
│  │  │Kit v3        │  │              │  │                      │   │  │
│  │  │ • HTS assoc  │  │ Lend:        │  │ Every decision:      │   │  │
│  │  │ • WHBAR wrap │  │ • Supply     │  │ • Action + reason    │   │  │
│  │  │ • Approvals  │  │ • Borrow     │  │ • Confidence score   │   │  │
│  │  │ • Key mgmt   │  │ • Repay      │  │ • Sentiment data     │   │  │
│  │  │              │  │ • Withdraw   │  │ • Market snapshot    │   │  │
│  │  │              │  │              │  │ • Tx hash (if exec)  │   │  │
│  │  │              │  │ Vaults:      │  │ • Timestamp          │   │  │
│  │  │              │  │ • Deposit    │  │                      │   │  │
│  │  │              │  │ • Withdraw   │  │ Verifiable on        │   │  │
│  │  │              │  │ • Harvest    │  │ HashScan by anyone   │   │  │
│  │  │              │  │ • Switch     │  │                      │   │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow — One Complete Keeper Cycle

```
 ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
 │CoinGecko │  │Fear/Greed│  │ NewsAPI  │  │  Bonzo   │  │  Bonzo   │
 │ HBAR $   │  │  Index   │  │Headlines │  │ Markets  │  │  Vaults  │
 │ 7d hist  │  │  0-100   │  │ scoring  │  │ 6 assets │  │ 5 CLMs   │
 └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
      │              │             │              │              │
      └──────────────┴──────┬──────┴──────────────┴──────────────┘
                            │
                            ▼
               ┌────────────────────────┐
               │   Sentiment Analysis   │
               │                        │
               │  Price momentum: -15   │
               │  Fear & Greed:   32    │
               │  Volatility:     67%   │
               │  News score:     -8    │
               │  ─────────────────     │
               │  Composite: -23        │
               │  Signal: HOLD          │
               │  Confidence: 0.72      │
               └───────────┬────────────┘
                           │
                           ▼
               ┌────────────────────────┐
               │ Keeper Decision Engine │
               │                        │
               │ Priority 1: HF = 2.1   │
               │   ✅ Safe (> 1.3)      │
               │ Priority 2: Score -23  │
               │   ✅ Above -30 cutoff  │
               │ Priority 3: Vol 67%    │
               │   ✅ Below 80% cutoff  │
               │ Priority 4: Gap 1.2%   │
               │   ✅ Below 2% minimum  │
               │ Priority 5: Score -23  │
               │   ❌ Not bullish (>50) │
               │ ─────────────────────  │
               │ Decision: HOLD         │
               │ Confidence: 0.68       │
               │ Reason: "Markets show  │
               │ mild fear but within   │
               │ normal parameters..."  │
               └───────────┬────────────┘
                           │
                           ▼
               ┌────────────────────────┐
               │    HCS Audit Log       │
               │                        │
               │ Topic: 0.0.XXXXXXX     │
               │ Sequence: #42          │
               │ {                      │
               │   action: "HOLD",      │
               │   confidence: 0.68,    │
               │   sentiment: -23,      │
               │   volatility: 67,      │
               │   hbarPrice: 0.0989,   │
               │   reason: "Markets..." │
               │ }                      │
               │                        │
               │ 🔗 Verify on HashScan  │
               └────────────────────────┘
```

---

## ✨ Complete Feature Inventory

### 🤖 Feature 1: Dual AI Agent Framework

VaultMind implements **both** AI frameworks recommended by Bonzo — with a runtime toggle:

| Capability        | LangChain Agent                      | Vercel AI SDK Agent              |
| ----------------- | ------------------------------------ | -------------------------------- |
| **File**          | `lib/agent.ts`                       | `lib/agent-vercel.ts`            |
| **Framework**     | LangChain + LangGraph                | `ai` v6 + `@ai-sdk/openai`       |
| **Model**         | GPT-4o via LangChain                 | GPT-4o via `openai()`            |
| **Tool Calling**  | `createReactAgent()`                 | `generateText()` + `tool()`      |
| **Memory**        | `MemorySaver` (LangGraph checkpoint) | In-memory conversation array     |
| **Agentic Loops** | LangGraph state machine              | `stopWhen: stepCountIs(5)`       |
| **Schema**        | `DynamicStructuredTool`              | Zod v4 `inputSchema`             |
| **Shared Tools**  | ✅ All 6 tools                       | ✅ Same 6 tools (re-implemented) |
| **Switch**        | UI toggle in header                  | `AI_PROVIDER` env variable       |

Both agents export the same `AgentResponse` interface — seamless switching with zero UI changes.

### 📊 Feature 2: Real-Time 4-Source Sentiment Engine

| #   | Source                  | Data                                                 | API                              |
| --- | ----------------------- | ---------------------------------------------------- | -------------------------------- |
| 1   | **CoinGecko**           | HBAR price, 24h change, 7-day price history          | `api.coingecko.com`              |
| 2   | **Fear & Greed Index**  | Crypto market fear/greed score (0-100)               | `alternative.me`                 |
| 3   | **Realized Volatility** | Annualized std dev from 7-day daily returns          | Calculated in `lib/sentiment.ts` |
| 4   | **NewsAPI**             | Crypto headlines scored for bullish/bearish keywords | `newsapi.org`                    |

**Output:** Composite score (-100 to +100), signal (HARVEST_NOW / HOLD / ACCUMULATE), confidence (0-1), and natural language reasoning.

### 🛡️ Feature 3: 6-Strategy Keeper Decision Engine

| Priority | Strategy                 | Trigger          | Action                     |
| -------- | ------------------------ | ---------------- | -------------------------- |
| **1**    | Health Factor Protection | HF < 1.3         | `REPAY_DEBT`               |
| **2**    | Bearish Harvest          | Sentiment < -30  | `HARVEST` → swap to stable |
| **3**    | Volatility Exit          | Volatility > 80% | `EXIT_TO_STABLE`           |
| **4**    | Yield Optimization       | Yield gap > 2%   | `REBALANCE`                |
| **5**    | Bullish Accumulation     | Sentiment > +50  | `INCREASE_POSITION`        |
| **6**    | Vault Rebalancing        | Range deviation  | `SWITCH_VAULT`             |

### 💬 Feature 4: Intent-Based Chat Interface (40+ Commands)

**📊 Analytics:** Show portfolio, sentiment, APY comparison, vault APYs, positions, markets, risk/return scatter, DeFi heatmap, correlation matrix, backtest, price chart, wallet info

**⚡ Keeper:** Run dry run, execute keeper, start/stop auto keeper (1-15 min), show decision history, show audit log (with action/count/order filters)

**⚙️ Strategy:** Show/set bearish threshold, bullish threshold, confidence minimum, volatility exit, HF danger, yield differential, reset to defaults

**💰 Vault Actions:** Deposit, withdraw, harvest, switch vaults — all with preview → confirm → real tx

**🏦 Lending:** Supply, borrow, repay — with health factor impact preview and liquidation warnings

**👛 Wallet:** Connect/disconnect Hedera testnet accounts

**📈 Research:** Intent-based queries ("I want safe yield") → AI recommendation → execution

### 🔗 Feature 5: HCS Immutable Audit Trail

Every keeper decision logged to Hedera Consensus Service:

```json
{
  "agent": "VaultMind",
  "version": "1.0.0",
  "action": "HARVEST",
  "reason": "Bearish sentiment (-34) with elevated volatility...",
  "confidence": 0.78,
  "sentiment": { "score": -34, "signal": "HARVEST_NOW", "volatility": 82 },
  "execution": { "txId": "0.0.5907362@1708900000.000", "status": "SUCCESS" },
  "timestamp": "2026-02-20T15:30:00Z"
}
```

- **Auto-discovery** via Mirror Node (no hardcoded topic IDs, Vercel-compatible)
- **Filterable:** `Show only BORROW actions`, `Show last 5 entries`, `Show first 3 DEPOSIT entries`
- **Verifiable:** Every entry links directly to HashScan

### 📈 Feature 6: 14 Interactive Chart Types

All render inline in chat with live data:

| #   | Chart                | Description                          |
| --- | -------------------- | ------------------------------------ |
| 1   | Portfolio Pie        | Asset allocation with USD values     |
| 2   | Sentiment Gauge      | Score bar (-100 to +100) with signal |
| 3   | APY Comparison       | Supply vs Borrow vs Vault APYs       |
| 4   | OHLCV Candlestick    | 30-day HBAR price chart              |
| 5   | Risk/Return Scatter  | Vol vs return, bubble = Sharpe ratio |
| 6   | Correlation Matrix   | Inter-asset correlation heatmap      |
| 7   | DeFi Heatmap         | Utilization × APY opportunity map    |
| 8   | Performance Backtest | VaultMind vs HODL ($1K simulation)   |
| 9   | Market Overview      | All reserves with rates              |
| 10  | Vault Comparison     | CLM vaults: APY, TVL, risk tier      |
| 11  | Positions Table      | Supplied/borrowed/HF per asset       |
| 12  | Wallet Info          | HBAR balance, tokens, EVM address    |
| 13  | HCS Timeline         | Audit entries with HashScan links    |
| 14  | Decision History     | Session keeper decisions             |

### 🏦 Feature 7: Deep Bonzo Finance Integration

**Bonzo Lend:** Supply/Borrow/Repay/Withdraw across HBAR, USDC, SAUCE, HBARX, KARATE, XSAUCE with real-time health factor monitoring.

**Bonzo Vaults:** 5 CLM vault strategies — deposit, withdraw, harvest, switch. Auto-compounding detection, share-to-asset conversion.

**All transactions are real** — executed on Hedera testnet with verifiable tx hashes on HashScan.

### 📚 Feature 8: RAG Knowledge Base (15+ Documents)

Custom TF-IDF retrieval covering: lending loops, health factor management, concentrated liquidity mechanics, impermanent loss mitigation, vault auto-compounding, risk-adjusted APY methodology, Bonzo protocol docs.

### 🎨 Feature 9: Bonzo-Inspired Professional UI

Dark purple gradient theme, glassmorphism header, synchronized sidebar pulse animations, AI thinking loader (5-step), inline interactive components, AI-powered suggestion chips, provider toggle.

### ⚡ Feature 10: Auto-Keeper Mode

Autonomous operation on configurable schedule (1-15 min). Each cycle: ingest → analyze → decide → log to HCS. Live countdown timer, sidebar pulse on completion.

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
HEDERA_NETWORK=testnet
OPENAI_API_KEY=sk-...

# === OPTIONAL ===
AI_PROVIDER=langchain           # or "vercel"
NEWS_API_KEY=your_key           # for news sentiment
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
│   ├── page.tsx                         # Main dashboard (2,500+ lines)
│   ├── layout.tsx                       # Root layout + metadata
│   ├── globals.css                      # Tailwind + custom animations
│   └── api/
│       ├── agent/route.ts               # Dual AI provider routing
│       ├── keeper/route.ts              # Keeper decision engine API
│       ├── execute/route.ts             # Real blockchain tx execution
│       ├── market/route.ts              # Market data + sentiment
│       ├── positions/route.ts           # Bonzo Lend positions
│       ├── vaults/route.ts              # Bonzo Vaults data
│       ├── hcs/route.ts                 # HCS audit trail reader
│       ├── charts/route.ts              # Chart data endpoints
│       ├── ohlcv/route.ts              # HBAR OHLCV price data
│       ├── performance/route.ts         # VaultMind vs HODL backtest
│       ├── dashboard/route.ts           # Dashboard aggregation
│       ├── associate/route.ts           # HTS token association
│       └── diagnose/route.ts            # Debug diagnostics
├── lib/
│   ├── agent.ts                         # LangChain agent (6 tools, GPT-4o)
│   ├── agent-vercel.ts                  # Vercel AI SDK agent (6 tools)
│   ├── keeper.ts                        # 6-strategy decision engine
│   ├── sentiment.ts                     # 4-source sentiment fusion
│   ├── bonzo.ts                         # Bonzo Lend API client
│   ├── bonzo-vaults.ts                  # Bonzo Vaults data + mapping
│   ├── bonzo-execute.ts                 # Real vault tx execution
│   ├── rag.ts                           # RAG knowledge base (15+ docs)
│   └── hcs.ts                           # HCS logging + topic discovery
├── components/
│   ├── InlineCharts.tsx                 # 14 chart type renderer
│   ├── MarkdownMessage.tsx              # Rich markdown rendering
│   ├── AgentThinking.tsx                # 5-step thinking animation
│   ├── WalletConnect.tsx                # Hedera wallet connection
│   ├── TransactionModal.tsx             # Tx confirmation dialog
│   ├── StrategyConfig.tsx               # Strategy parameter editor
│   ├── Performancechart.tsx             # VaultMind vs HODL chart
│   └── HCSTimeline.tsx                  # HCS audit trail viewer
└── package.json

31 source files · 8,600+ lines of TypeScript · Zero mock data
```

---

## 💰 Bonzo Bounty Alignment ($8,000)

### Bounty Requirements — Every Point Addressed

| Bounty Requirement (verbatim)                                     | VaultMind Implementation                                                                   | Code Location                      |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ---------------------------------- |
| _"Hedera Agent Kit"_                                              | `hedera-agent-kit` v3 initialized with testnet credentials                                 | `lib/agent.ts`                     |
| _"Agent should not just execute transactions but make decisions"_ | 6-strategy weighted decision engine with confidence scoring and natural language reasoning | `lib/keeper.ts` — `makeDecision()` |
| _"Integrating external data (prices)"_                            | CoinGecko real-time HBAR price + 24h change + 7-day price history                          | `lib/sentiment.ts`                 |
| _"Integrating external data (volatility)"_                        | Realized volatility from 7-day price standard deviation, annualized                        | `lib/sentiment.ts`                 |
| _"Integrating external data (sentiment)"_                         | Fear & Greed Index + NewsAPI headline scoring                                              | `lib/sentiment.ts`                 |
| _"via RAG or Oracle tools"_                                       | Custom RAG with 15+ DeFi documents + TF-IDF retrieval                                      | `lib/rag.ts`                       |
| _"autonomously interact with Bonzo Vault contracts"_              | Real deposits, withdrawals, harvests, switches on Hedera testnet                           | `lib/bonzo-execute.ts`             |
| _"maximize returns"_                                              | APY comparison across vaults + yield optimization strategy                                 | Keeper strategy #4                 |
| _"while minimizing risk"_                                         | Health factor protection + volatility exit + risk-tier awareness                           | Keeper strategies #1, #3           |

### All 3 Bonzo Example Ideas — Fully Implemented

**1. "Volatility-Aware Rebalancer"** ✅

> _Bonzo: "An agent that monitors volatility indices... High Volatility: widens ranges or withdraws to single-sided staking."_

VaultMind calculates realized volatility from 7-day HBAR prices. When volatility > 80%, keeper triggers `EXIT_TO_STABLE`, switching from volatile CLM vaults to stable USDC-USDT positions. Low volatility → evaluates higher-yield aggressive vaults.

**2. "Sentiment-Based Harvester"** ✅

> _Bonzo: "Uses RAG to ingest crypto news... Negative Sentiment: immediate harvest and swap to stablecoins."_

4-source sentiment engine produces composite score. Sentiment < -30 → immediate `HARVEST` + swap to stables. Sentiment > +50 → delay harvest, `INCREASE_POSITION`. RAG provides DeFi strategy context for all explanations.

**3. "Intent-Based User Interface"** ✅

> _Bonzo: "A chat interface where users state: 'I want low risk yield on my HBAR.' The agent interprets the intent, scans Bonzo Vaults, and executes the deposit."_

Full conversational chat. "I want safe yield" → AI scans 5 CLM vaults → recommends lowest-risk → user confirms → real deposit on Hedera testnet.

### Bonzo's Suggested Tech Stack — Complete Match

| Bonzo Suggested       | VaultMind Uses                                  | Status    |
| --------------------- | ----------------------------------------------- | --------- |
| Hedera Agent Kit      | `hedera-agent-kit` v3                           | ✅        |
| Bonzo Vault Contracts | `@bonzofinancelabs/hak-bonzo-plugin`            | ✅        |
| LangChain (RAG)       | LangChain + LangGraph + custom RAG              | ✅        |
| Vercel AI SDK         | `ai` v6 + `@ai-sdk/openai` (dual provider)      | ✅        |
| Twitter/News API      | NewsAPI crypto headlines                        | ✅        |
| SupraOracles          | CoinGecko + Fear/Greed + Volatility (4 sources) | ✅ Better |

---

## 📊 Judging Criteria Mapping (100% Coverage)

### 1. Innovation — 10%

| Guiding Point                                                  | Answer                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Does the project align to the hackathon track?_               | ✅ AI & Agents — VaultMind is an autonomous AI agent that makes decisions and executes transactions                                                                                                                                     |
| _How innovative is the solution? Does this exist cross-chain?_ | ✅ First keeper combining: 4-source sentiment + weighted decision engine + HCS audit + dual AI frameworks. Cross-chain: Yearn/Beefy have dumb keepers; Gauntlet does risk analysis but doesn't execute autonomously with on-chain proof |
| _Has this been seen before in the Hedera ecosystem?_           | ✅ No. Past winners (Major Gainz, KeyRing) recommend actions but don't autonomously decide and execute                                                                                                                                  |
| _Does this extend capabilities for the Hedera ecosystem?_      | ✅ Novel use of HCS as AI decision audit trail — a pattern that could become standard for all AI agents on Hedera                                                                                                                       |

### 2. Feasibility — 10%

| Guiding Point                                          | Answer                                                                                                                                                                                                                    |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Can the idea be created using Hedera?_                | ✅ Already built and running on Hedera testnet with real transactions                                                                                                                                                     |
| _Does this need to be Web3? Could it be done on Web2?_ | ✅ Three things are impossible on Web2: (1) immutable HCS audit trail depositors can verify independently, (2) autonomous smart contract execution without custodial intermediary, (3) trustless token operations via HTS |
| _Does the team understand the problem space?_          | ✅ Deep DeFi domain knowledge demonstrated — solved real CONTRACT_REVERT bugs in Bonzo's WHBAR wrapping, token associations, and debt validation across 8 debugging sessions                                              |
| _Does the team have capability to execute?_            | ✅ Solo builder: 31 shipped projects, 18 hackathon wins (incl. Smart India Hackathon 2023), 8,600+ lines of TypeScript                                                                                                    |
| _Business Model Canvas?_                               | ✅ Revenue model: free tier (<$10K TVL), 0.5% performance fee on yield improvement above baseline. Target market: Hedera DeFi power users → expand cross-chain                                                            |

### 3. Execution — 20%

| Guiding Point                                      | Answer                                                                                                                                                                                         |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _MVP created?_                                     | ✅ Far beyond MVP — fully functioning solution with all planned features                                                                                                                       |
| _PoC with limited features?_                       | No — this is a complete product: 14 charts, 40+ commands, 6 strategies, real execution, HCS audit                                                                                              |
| _Fully functioning solution?_                      | ✅ Every command triggers real actions. Zero mock data. Tx hashes verifiable on HashScan                                                                                                       |
| _Team functioned well together?_                   | ✅ Solo builder — all 31 files, 25 development sessions, complete ownership                                                                                                                    |
| _Long-term development strategy beyond hackathon?_ | ✅ 4-phase roadmap: Hackathon → Multi-chain → Mainnet with fees → Agent marketplace                                                                                                            |
| _Go-To-Market (GTM) strategy?_                     | ✅ Target Bonzo/SaucerSwap DeFi communities → Hedera Discord → DeFi Twitter. Free tier drives adoption, performance fees at scale                                                              |
| _Market feedback cycles?_                          | ✅ Strategy config lets users tune agent sensitivity → track which defaults get changed → improve. Plan: Hedera Discord beta with 3-5 users                                                    |
| _Important design decisions?_                      | ✅ Documented: dual AI providers (Bonzo asked for both), deterministic scoring (not LLM-only), HCS audit (not DB), 4-source sentiment (not single), priority-ordered strategies (safety first) |
| _Emphasis on UX/accessibility?_                    | ✅ Bonzo-themed UI, thinking animations, inline charts, AI suggestions, confirmation dialogs, synchronized sidebar pulse effects, mobile-responsive                                            |

### 4. Integration — 15%

| Guiding Point                                 | Answer                                                                                                                                                                                                                                                                                 |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _To what degree does the project use Hedera?_ | ✅ Deeply — 5 Hedera services used, not just basic token transfers                                                                                                                                                                                                                     |
| _How integrated? What services?_              | **HCS:** Immutable audit trail (novel). **HTS:** Token associations, WHBAR wrapping, approvals. **Smart Contracts:** Bonzo Lend + Vaults (10+ contract interactions). **Mirror Node:** Topic discovery, account queries, tx verification. **Agent Kit:** Foundation for all Hedera ops |
| _Ecosystem platforms used?_                   | ✅ **Bonzo Finance** (Lend + Vaults — deepest possible integration), **SaucerSwap** (WHBAR wrapping, OHLCV), **CoinGecko**, **HashScan**                                                                                                                                               |
| _Hedera service integrated in a new way?_     | ✅ **HCS as AI decision audit trail** — novel pattern never seen in the ecosystem. Creates transparent, verifiable proof of autonomous agent behavior                                                                                                                                  |

### 5. Success — 20%

| Guiding Point                             | Answer                                                                                                                                            |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Positively impacts Hedera network?_      | ✅ Demonstrates Hedera as ideal chain for AI-native DeFi. HCS for AI auditability is a unique Hedera differentiator no other chain has            |
| _Leads to more Hedera accounts?_          | ✅ Every user needs a testnet account. Auto-keeper incentivizes persistent accounts                                                               |
| _High number of monthly active accounts?_ | ✅ Auto-keeper users are active by definition — generating transactions every 1-15 minutes continuously                                           |
| _Greater TPS on Hedera?_                  | ✅ Each keeper cycle = 3-5 transactions (sentiment, decision, execution, HCS log, token ops). 100 users × 5-min intervals = 3,600-6,000 tx/hour   |
| _Exposure to greater audience?_           | ✅ AI + DeFi crossover attracts both crypto natives AND AI/ML engineers. "AI agent on blockchain" is the trending narrative across all ecosystems |

### 6. Validation — 15%

| Guiding Point                        | Answer                                                                                                                                                   |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Identified where to gain feedback?_ | ✅ Hedera Discord (#builders), Bonzo Finance Discord, DeFi Twitter/X, hackathon mentor office hours                                                      |
| _Established feedback cycles?_       | ✅ Strategy config = built-in feedback: users adjust parameters → we learn which defaults are suboptimal. AI suggestion acceptance rate = quality signal |
| _Market traction?_                   | ✅ Competitive analysis conducted on 6 past Hedera hackathon winners — identified every feature gap and built solutions                                  |
| _Early adopters / trials?_           | Plan: 3-5 beta testers from Hedera Discord before submission deadline                                                                                    |
| _Market sentiment?_                  | DeFi users universally want: better yields + less risk + less manual work. VaultMind addresses all three                                                 |

### 7. Pitch — 10%

| Guiding Point                                 | Answer                                                                                                                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| _Problem and solution clear?_                 | ✅ "DeFi vaults are dumb scripts that can't think. VaultMind gives them a brain." — simple, memorable, true                                                                        |
| _Problem big enough for sustained growth?_    | ✅ $4.7B in DeFi vaults. Growing market. 1% yield improvement = $47M/year in value                                                                                                 |
| _Style and narrative well executed?_          | ✅ "Where DeFi Vaults Get a Brain" — tagline. Demo shows complete autonomous loop in 3 minutes                                                                                     |
| _Significant & exciting opportunity?_         | ✅ AI agent management of DeFi is nascent — no dominant player. First-mover advantage on Hedera                                                                                    |
| _Numbers/metrics make sense?_                 | ✅ TPS contribution quantified. Growth model: users × keeper frequency = measurable network impact                                                                                 |
| _How was Hedera represented?_                 | ✅ HCS audit trail is uniquely Hedera. Low fees ($0.001/tx) make autonomous keepers economically viable (impossible on Ethereum at $2-5/tx). Fast finality enables real-time loops |
| _MVP features clearly stated with rationale?_ | ✅ This README + pitch deck enumerate every feature with implementation justification                                                                                              |

---

## 🔑 Key Design Decisions

| Decision                                 | Rationale                                                                                                              |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Dual AI providers**                    | Bonzo mentions both LangChain and Vercel AI SDK. Supporting both shows depth and lets judges evaluate either framework |
| **Deterministic scoring (not LLM-only)** | LLMs hallucinate. Weighted scoring ensures consistent, reproducible decisions. LLM adds reasoning on top               |
| **HCS for audit (not database)**         | Immutable, decentralized, independently verifiable. True transparency for depositors                                   |
| **4-source sentiment**                   | Single-source signals are noisy. Multi-source fusion filters false signals                                             |
| **Inline components**                    | Judges see the entire flow in one screen — no page navigation                                                          |
| **Real transactions**                    | Every action hits Hedera testnet contracts. Tx hashes verifiable on HashScan                                           |
| **Priority-ordered strategies**          | Capital preservation (HF protection) always overrides yield chasing                                                    |
| **HCS auto-discovery**                   | Mirror Node topic discovery enables serverless deployment (Vercel-compatible)                                          |

---

## 🗺️ Roadmap

| Phase              | Timeline   | Focus                                                                  |
| ------------------ | ---------- | ---------------------------------------------------------------------- |
| **1. Hackathon**   | Current ✅ | All features built and working                                         |
| **2. Enhancement** | Q2 2026    | Multi-vault orchestration, SupraOracles, ML volatility prediction      |
| **3. Mainnet**     | Q3 2026    | Real funds, performance fees, institutional dashboards, DAO governance |
| **4. Scale**       | Q4 2026    | Cross-chain, agent-to-agent HCS communication, strategy marketplace    |

---

## 🧪 Testing Instructions

### Judge Verification Flow (5 minutes)

| #   | Command                         | What to Verify                                |
| --- | ------------------------------- | --------------------------------------------- |
| 1   | `connect wallet 0.0.5907362`    | Balance + tokens appear in sidebar            |
| 2   | `How's the market sentiment?`   | 4-source analysis with gauge chart            |
| 3   | `Show Bonzo markets`            | All reserves match testnet.bonzo.finance      |
| 4   | `Run dry run`                   | Decision with action + confidence + reasoning |
| 5   | `Supply 100 HBAR to Bonzo`      | Preview → Confirm → Real tx hash → HashScan   |
| 6   | `Show my positions`             | Supplied assets with health factor            |
| 7   | `Borrow 5 USDC`                 | HF impact preview → Confirm → Real tx         |
| 8   | `Show audit log`                | HCS entries with HashScan verification        |
| 9   | `Start auto keeper every 1 min` | Timer starts; autonomous cycles run           |
| 10  | `Set bearish threshold to -20`  | Parameter updated                             |
| 11  | Toggle **Vercel AI** in header  | Subsequent commands use Vercel AI SDK         |
| 12  | `I want safe yield on my HBAR`  | AI recommends lowest-risk vault               |
| 13  | `Show only DEPOSIT entries`     | Filtered HCS audit                            |
| 14  | `Repay my USDC loan`            | Real tx → positions updated                   |
| 15  | `Show backtest`                 | VaultMind vs HODL chart                       |
| 16  | `Disconnect wallet`             | Session cleared                               |

---

## 👤 Team

|                  | Details                                                                              |
| ---------------- | ------------------------------------------------------------------------------------ |
| **Name**         | Aaditya                                                                              |
| **Role**         | Solo Full-Stack Developer & AI Engineer                                              |
| **Track Record** | 31 shipped projects · 18 hackathon wins · Smart India Hackathon 2023 winner          |
| **Education**    | B.Tech AI & Data Science (AKTU) · M.Sc CS at Leibniz Universität Hannover (Oct 2026) |

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
  <code>31 files · 8,600+ lines · Zero mock data · Every tx real on Hedera</code>
</p>
