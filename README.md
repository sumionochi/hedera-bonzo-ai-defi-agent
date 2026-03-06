# 🧠 VaultMind — AI-Powered DeFi Keeper Agent on Hedera

> An autonomous AI agent that manages Bonzo Finance vault positions using real market sentiment, volatility analysis, and on-chain yield data — with every decision logged immutably on Hedera Consensus Service.

**Built for:** Hedera Hello Future Apex Hackathon 2026  
**Track:** AI & Agents | **Bounty:** Bonzo Finance

---

## The Problem

DeFi users face a constant dilemma: monitor markets 24/7 or risk liquidation, missed yield opportunities, and portfolio losses during volatility spikes. Manual vault management is time-consuming, emotionally driven, and error-prone — especially across lending protocols like Bonzo Finance where health factors, APY shifts, and market sentiment all matter simultaneously.

## The Solution

**VaultMind** is an autonomous keeper agent that:

1. **Monitors** real-time market sentiment, HBAR price action, Fear & Greed Index, and volatility
2. **Analyzes** your Bonzo Finance positions (supplied, borrowed, health factor, APYs)
3. **Decides** the optimal action using 5 prioritized strategies
4. **Executes** transactions on Bonzo Finance via Hedera Agent Kit
5. **Logs** every decision immutably on HCS with full market context

All while explaining its reasoning in plain English through a conversational chat interface.

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    VaultMind Frontend                     │
│                  (Next.js 14 + Tailwind)                  │
│                                                          │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐ │
│  │ Chat UI  │  │ Performance  │  │  HCS Audit Trail   │ │
│  │ (Agent)  │  │   Chart      │  │  (On-Chain Log)    │ │
│  └────┬─────┘  └──────┬───────┘  └─────────┬──────────┘ │
│       │               │                    │             │
│  ┌────┴───────────────┴────────────────────┴──────────┐ │
│  │              Keeper Decision Engine                  │ │
│  │  ┌────────────────────────────────────────────────┐ │ │
│  │  │ Strategy 1: Health Factor Emergency  (P1)      │ │ │
│  │  │ Strategy 2: Bearish Sentiment Harvest (P2)     │ │ │
│  │  │ Strategy 3: Volatility-Aware Hold    (P3)      │ │ │
│  │  │ Strategy 4: Yield Optimization       (P4)      │ │ │
│  │  │ Strategy 5: Bullish Accumulation     (P5)      │ │ │
│  │  └────────────────────────────────────────────────┘ │ │
│  └─────────────────────┬───────────────────────────────┘ │
│                        │                                  │
│  ┌─────────┬───────────┼───────────┬──────────────────┐  │
│  │Sentiment│  Bonzo    │  Agent    │  HCS Logger      │  │
│  │ Engine  │  Client   │(LangGraph)│  (Audit Trail)   │  │
│  └────┬────┘  └───┬────┘  └───┬────┘  └──────┬────────┘  │
└───────┼───────────┼───────────┼───────────────┼──────────┘
        │           │           │               │
   ┌────▼────┐ ┌────▼────┐ ┌───▼──────┐  ┌─────▼──────┐
   │CoinGecko│ │ Bonzo   │ │  Hedera  │  │   Hedera   │
   │Fear&    │ │ Finance │ │Agent Kit │  │   Mirror   │
   │Greed    │ │  API    │ │+ Bonzo   │  │   Node     │
   │NewsAPI  │ │         │ │ Plugin   │  │            │
   └─────────┘ └─────────┘ └───┬──────┘  └────────────┘
                               │
                         ┌─────▼──────┐
                         │   Hedera   │
                         │  Testnet   │
                         │ (HCS+HTS) │
                         └────────────┘
```

---

## Key Features

### 🤖 Autonomous Keeper Engine

Five prioritized strategies running in configurable auto-loop (1–15 minute intervals):

| Priority | Strategy                | Trigger                       | Action                              |
| -------- | ----------------------- | ----------------------------- | ----------------------------------- |
| P1       | Health Factor Emergency | HF < 1.3                      | Repay 25% of largest debt           |
| P2       | Bearish Harvesting      | Sentiment < -30               | Withdraw volatile assets to stables |
| P3       | Volatility Hold         | Vol > 80% annualized          | Hold, avoid new positions           |
| P4       | Yield Optimization      | >2% APY improvement available | Rebalance to better pool            |
| P5       | Bullish Accumulation    | Sentiment > 50 + low vol      | Increase positions                  |

### 💬 Context-Aware AI Chat

Every conversation is injected with live market data — HBAR price, sentiment score, volatility, top Bonzo yields, and portfolio status. The agent gives informed advice without extra tool calls.

### 📈 Performance Backtest

Real HBAR price history from CoinGecko with simulated keeper decisions. Interactive chart shows VaultMind strategy vs Passive HODL with decision markers, configurable from 7–90 days.

### 🔗 HCS Immutable Audit Trail

Every keeper decision is logged to Hedera Consensus Service with:

- Action taken and reasoning
- Confidence score
- Full market context (sentiment, volatility, price, Fear & Greed)
- Consensus timestamp
- Verifiable on HashScan

### 📊 Real-Time Dashboard

- Live Bonzo market rates (supply/borrow APYs, utilization)
- Multi-source sentiment analysis
- Portfolio positions with health factor badge
- Decision history log
- Auto-loop countdown timer

---

## Tech Stack

| Layer             | Technology                                                            |
| ----------------- | --------------------------------------------------------------------- |
| **AI Agent**      | Hedera Agent Kit JS v3.7 + LangChain + LangGraph                      |
| **DeFi Protocol** | Bonzo Finance (Aave v2 fork) via `@bonzofinancelabs/hak-bonzo-plugin` |
| **LLM**           | GPT-4o (temperature 0.1 for deterministic decisions)                  |
| **Blockchain**    | Hedera Testnet — HCS (consensus logging), HTS (token ops)             |
| **Sentiment**     | CoinGecko API, Fear & Greed Index, NewsAPI, Volatility Engine         |
| **Frontend**      | Next.js 14, Tailwind CSS, Recharts                                    |
| **Verification**  | Hedera Mirror Node, HashScan Explorer                                 |

---

## Quick Start

### Prerequisites

- Node.js 18+
- Hedera Testnet account ([portal.hedera.com](https://portal.hedera.com))
- OpenAI API key ([platform.openai.com](https://platform.openai.com))

### Setup

```bash
git clone https://github.com/your-username/vaultmind.git
cd vaultmind/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
```

Edit `.env.local`:

```env
HEDERA_ACCOUNT_ID=0.0.XXXXX
HEDERA_PRIVATE_KEY=your_ecdsa_private_key_hex
HEDERA_NETWORK=testnet
OPENAI_API_KEY=sk-xxxxx
NEWS_API_KEY=xxxxx          # Optional: enriches sentiment analysis
```

### Run

```bash
npm run dev
# Open http://localhost:3000
```

### Fund Your Testnet Account

1. Go to [portal.hedera.com](https://portal.hedera.com/dashboard)
2. Copy your testnet account ID
3. Use the faucet to get test HBAR

---

## API Endpoints

| Endpoint           | Method | Description                                  |
| ------------------ | ------ | -------------------------------------------- |
| `/api/agent`       | POST   | Chat with VaultMind AI agent (context-aware) |
| `/api/agent`       | GET    | Agent status and tool list                   |
| `/api/market`      | GET    | Bonzo markets + sentiment data               |
| `/api/positions`   | GET    | User's Bonzo portfolio positions             |
| `/api/keeper`      | GET    | Run keeper cycle (dry-run or execute)        |
| `/api/keeper`      | POST   | Run with custom strategy thresholds          |
| `/api/performance` | GET    | Backtest simulation data                     |
| `/api/hcs`         | GET    | Read HCS audit trail decisions               |
| `/api/hcs`         | POST   | Create new audit topic                       |

---

## Demo Flow

1. **Open Dashboard** — Live Bonzo market rates and sentiment load automatically
2. **Chat** — Ask "What are the current market rates?" or "Should I deposit HBAR?"
3. **Keeper Dry Run** — Click "Dry Run" to see what the keeper would decide
4. **Enable Auto-Loop** — Click "Auto" and set 1 min interval, watch decisions accumulate
5. **Performance Tab** — View VaultMind vs Passive HODL backtest with real price data
6. **HCS Audit Tab** — Create audit topic, run keeper with "Execute", verify on HashScan
7. **Execute Transaction** — Chat "Deposit 100 HBAR into Bonzo" for live on-chain action

---

## Project Structure

```
frontend/
├── app/
│   ├── page.tsx                 # Main dashboard (tabbed: Chat/Chart/Audit)
│   ├── layout.tsx               # App layout
│   ├── globals.css              # Theme styles
│   └── api/
│       ├── agent/route.ts       # AI agent with context injection
│       ├── market/route.ts      # Bonzo markets + sentiment
│       ├── positions/route.ts   # Portfolio reader
│       ├── keeper/route.ts      # Keeper decision engine API
│       ├── performance/route.ts # Backtest simulator API
│       ├── hcs/route.ts         # HCS audit trail API
│       └── dashboard/route.ts   # Legacy dashboard
├── components/
│   ├── PerformanceChart.tsx     # Recharts backtest visualization
│   └── HCSTimeline.tsx          # On-chain audit timeline
├── lib/
│   ├── agent.ts                 # LangGraph agent + context builder
│   ├── keeper.ts                # 5-strategy decision engine
│   ├── sentiment.ts             # Multi-source sentiment analysis
│   ├── simulator.ts             # Backtest engine (real price data)
│   ├── bonzo.ts                 # Bonzo Finance API client
│   ├── hcs.ts                   # HCS logging + reading
│   └── hedera.ts                # Hedera SDK client
└── scripts/
    └── verify-apis.ts           # API connectivity checker
```

---

## How the Keeper Works

```
Every N minutes (configurable):

  ┌─────────────────────────┐
  │  1. Gather Data         │  Parallel: Sentiment + Markets + Portfolio
  └───────────┬─────────────┘
              │
  ┌───────────▼─────────────┐
  │  2. Make Decision       │  5 strategies in priority order
  │     Health → Bearish →  │  First match wins
  │     Volatility → Yield  │
  │     → Bullish → HOLD    │
  └───────────┬─────────────┘
              │
  ┌───────────▼─────────────┐
  │  3. Execute (optional)  │  Routes to LangGraph agent
  │     HARVEST → Withdraw  │  Agent uses Bonzo Plugin tools
  │     REPAY → Repay debt  │
  │     etc.                │
  └───────────┬─────────────┘
              │
  ┌───────────▼─────────────┐
  │  4. Log to HCS          │  Immutable on-chain record
  │     Decision + Context  │  Verifiable on HashScan
  │     + Timestamp         │
  └─────────────────────────┘
```

---

## Hedera Integration Points

| Feature              | Hedera Service      | How It's Used                                         |
| -------------------- | ------------------- | ----------------------------------------------------- |
| Decision audit trail | HCS (Consensus)     | Every keeper decision logged with full market context |
| Token operations     | HTS (Token Service) | Deposit, withdraw, borrow, repay via Bonzo            |
| Balance queries      | Mirror Node         | Account balances, token associations                  |
| Transaction history  | Mirror Node         | Verify executions, read HCS messages                  |
| Smart contracts      | EVM on Hedera       | Bonzo Finance (Aave v2) lending pool interactions     |

---

## Why VaultMind?

**For Users:** Set it and forget it. VaultMind watches markets 24/7, protects your positions during crashes, captures yield opportunities, and explains every move.

**For the Ecosystem:** Demonstrates how Hedera Agent Kit + Bonzo Plugin enable sophisticated autonomous DeFi agents. Proves HCS as a transparency layer for AI decision-making.

**For Judges:** Real integrations (not mocks), real market data, real on-chain logging, real backtest with actual HBAR price history. Every decision is verifiable on HashScan.

---

## License

MIT
