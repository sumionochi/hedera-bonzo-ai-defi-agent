<p align="center">
  <img src="https://img.shields.io/badge/Track-AI_%26_Agents-7C3AED?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Bounty-Bonzo_Finance_$8K-a855f7?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Hedera-Testnet_%26_Mainnet-00C853?style=for-the-badge&logo=hedera" />
  <img src="https://img.shields.io/badge/HCS-Immutable_Audit-FF6F00?style=for-the-badge" />
  <img src="https://img.shields.io/badge/HTS-VKS_Reputation_Token-00B0FF?style=for-the-badge" />
  <img src="https://img.shields.io/badge/EVM-VaultMindAudit.sol-E91E63?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Architecture-Multi--Agent_4--Agent-E91E63?style=for-the-badge" />
  <img src="https://img.shields.io/badge/Lines-12000%2B_TypeScript-3178C6?style=for-the-badge&logo=typescript" />
</p>

<h1 align="center">🧠 VaultMind</h1>

<h3 align="center"><em>An autonomous multi-agent AI system that monitors markets, makes DeFi decisions, executes real transactions on Bonzo Finance, and proves every action on-chain through HCS audit logs, HTS reputation tokens, and its own deployed EVM smart contract.</em></h3>

<br/>

<p align="center">
  <a href="#-live-demo">Live Demo</a> •
  <a href="#-demo-video">Demo Video</a> •
  <a href="#-why-this-must-be-web3">Why Web3</a> •
  <a href="#-multi-agent-architecture">Architecture</a> •
  <a href="#-on-chain-contracts--services">Contracts</a> •
  <a href="#-complete-feature-inventory">Features</a> •
  <a href="#-all-commands-reference">Commands</a> •
  <a href="#-api-reference">API</a> •
  <a href="#-key-design-decisions-adr">ADR</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-bonzo-bounty-alignment">Bounty</a>
</p>

---

## 📋 Submission Summary

| Field               | Value                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------- |
| **Main Track**      | 🤖 AI & Agents                                                                                       |
| **Bounty**          | 💰 Bonzo Finance ($8,000)                                                                            |
| **Team Size**       | 1 (Solo Builder)                                                                                     |
| **Live Demo**       | [Deployed](https://hedera-bonzo-ai-defi-agent.vercel.app/)                                           |
| **Demo Video**      | [Video →](https://vimeo.com/1176425523)                                                              |
| **Hedera Services** | HCS (audit) + HTS (VKS token) + EVM (VaultMindAudit.sol) + Smart Contracts (Bonzo/ICHI/Beefy/Stader) |

---

## 📝 Project Description

VaultMind is an autonomous **multi-agent** AI keeper system for Bonzo Finance on Hedera. Four specialized agents — **Sentinel** (market intelligence via Pyth price feeds), **Strategist** (6-strategy decision engine), **Executor** (real on-chain transactions), and **Auditor** (HCS compliance logging) — work in a coordinated pipeline to manage DeFi positions. The system executes real vault deposits, withdrawals, and harvests on Bonzo's 20 ICHI and Beefy vault contracts on mainnet, performs automated DCA with Pyth-priced executions, implements HBARX liquid staking through Stader Labs, mints VKS reputation tokens via HTS after each keeper cycle, and records decision hashes to its own deployed EVM smart contract. Every decision is logged immutably to HCS with full reasoning, creating a 3-layer verifiable audit trail: HCS + HTS + EVM.

---

## 🌐 Live Demo

> **[Deployed](https://hedera-bonzo-ai-defi-agent.vercel.app/)**

Test with: `connect wallet 0.0.5907362` (or any Hedera testnet account)

## 📺 Demo Video

> **[Watch the demo →](https://vimeo.com/1176425523)**

---

## 🌐 Why This Must Be Web3

This is not an AI agent that happens to use a blockchain. Every core feature requires Hedera-specific infrastructure that has no Web2 equivalent.

| Capability            | Web2 Approach                                | VaultMind on Hedera                                                                     | Why Web2 Can't Do This                                                            |
| --------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Audit Trail**       | Database logs (deletable, editable)          | HCS TopicMessageSubmit — immutable, public, timestamped by network consensus            | No admin can alter past decisions. Anyone can verify on HashScan.                 |
| **Reputation Tokens** | Points in a database (one company controls)  | HTS VKS fungible token — user-owned, transferable, lives in their wallet                | User owns their reputation. Works across any Hedera app. Not locked to VaultMind. |
| **Decision Hashing**  | Server-side hash log (trust the server)      | VaultMindAudit.sol on Hedera EVM — keccak256 of every decision stored in smart contract | Hash is cryptographically anchored. Contract is permissionless to read.           |
| **DeFi Execution**    | API calls to centralized exchange            | ContractExecuteTransaction to Bonzo LendingPool, ICHI DepositGuard, Beefy Vault, Stader | Non-custodial. User's keys sign. No intermediary holds funds.                     |
| **DCA Persistence**   | Cron job on a server (dies when server dies) | HCS event sourcing — DCA state reconstructed from on-chain events via Mirror Node       | Plans survive server restarts. State lives on Hedera, not in memory.              |
| **Price Feeds**       | CoinGecko API (centralized, rate-limited)    | Pyth Network Hermes API + on-chain contract — 400+ feeds, sub-second latency            | Decentralized oracle. Can verify prices on-chain. Confidence intervals included.  |

---

## 🏗 Multi-Agent Architecture

### The Pipeline

```
  ┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌─────────────┐
  │  🔍 SENTINEL │───▶│ 🧠 STRATEGIST │───▶│ 🛡️ AUDITOR  │───▶│ ⚡ EXECUTOR  │
  │             │    │              │    │   (pre)     │    │             │
  │ Pyth prices │    │ 6-strategy   │    │ Risk checks │    │ Real on-    │
  │ Sentiment   │    │ weighted     │    │ Rate limits │    │ chain tx    │
  │ Bonzo mkts  │    │ decision     │    │ Confidence  │    │ Bonzo Lend  │
  │ Stader rate │    │ engine       │    │ gate        │    │ ICHI/Beefy  │
  │ 20 vaults   │    │ + DCA plans  │    │             │    │ Stader      │
  └─────────────┘    └──────────────┘    └──────┬──────┘    └──────┬──────┘
                                                │                   │
                                                ▼                   ▼
                                         ┌─────────────┐    ┌─────────────┐
                                         │ 🛡️ AUDITOR  │    │ 🎖️ HTS MINT │
                                         │   (post)    │    │             │
                                         │ HCS log     │    │ Mint 1 VKS  │
                                         │ EVM hash    │    │ to user     │
                                         └─────────────┘    └─────────────┘
```

### One Complete Keeper Cycle — 7 Steps

| Step  | Agent             | Action                                                                            | Hedera Service     |
| :---: | ----------------- | --------------------------------------------------------------------------------- | ------------------ |
| **1** | 🔍 Sentinel       | Parallel fetch: Pyth prices + sentiment + Bonzo markets + Stader + vaults         | — (off-chain APIs) |
| **2** | — Orchestrator    | Load user portfolio from Bonzo Data API + DCA plans from HCS Mirror Node          | HCS (read)         |
| **3** | 🧠 Strategist     | Evaluate 6 strategies → produce prioritized action list with confidence scores    | — (computation)    |
| **4** | 🛡️ Auditor (pre)  | Risk checks: block low-confidence, rate-limit, block leverage in bearish+volatile | — (validation)     |
| **5** | ⚡ Executor       | Route approved actions to on-chain handlers → real ContractExecuteTransaction     | Smart Contracts    |
| **6** | 🛡️ Auditor (post) | Log decision + results to HCS. Record keccak256 hash on VaultMindAudit.sol        | **HCS + EVM**      |
| **7** | 🎖️ Rewards        | Mint 1 VKS (VaultMind Keeper Score) token to user's wallet                        | **HTS**            |

> Every HCS entry records `agentArchitecture: "multi-agent-v2"` and `agents: ["sentinel","strategist","executor","auditor"]` — the multi-agent pipeline is verifiable on-chain by anyone via HashScan.

---

## 📜 On-Chain Contracts & Services

### Hedera Service Coverage

| Hedera Service           | How VaultMind Uses It                                                           | Contract/Topic ID                                                                  |
| ------------------------ | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| **HCS** (Consensus)      | Immutable audit log for every keeper decision + DCA event sourcing              | Topic: `0.0.7984171` ([HashScan →](https://hashscan.io/testnet/topic/0.0.7984171)) |
| **HTS** (Token Service)  | VKS (VaultMind Keeper Score) fungible token — minted per keeper cycle           | Token: auto-created on first run                                                   |
| **EVM** (Smart Contract) | VaultMindAudit.sol — stores keccak256 of every decision on-chain                | Contract: auto-deployed on first run                                               |
| **Smart Contracts**      | Bonzo LendingPool, WETHGateway, ICHI DepositGuard, Beefy Vault/Strategy, Stader | See table below                                                                    |

### Bonzo Finance Contracts (from [official docs](https://docs.bonzo.finance))

| Contract              | Testnet EVM Address    | Mainnet EVM Address   | Mainnet Hedera ID |
| --------------------- | ---------------------- | --------------------- | ----------------- |
| **LendingPool**       | `0x7710a96b...c128c62` | `0x236897c5...BA1afc` | `0.0.7308459`     |
| **WETHGateway**       | `0xA824820e...C3Cf964` | `0x9a601543...127105` | `0.0.7308485`     |
| **DataProvider**      | `0xe7432d90...680c958` | `0x78feDC4D...dCde18` | `0.0.7308483`     |
| **Oracle**            | `0x4aa505a3...635d3a6` | `0xc0Bb4030...03cBB`  | `0.0.7308480`     |
| **AddressesProvider** | `0xa184010a...551e6f`  | `0x76b846DA...56D1`   | `0.0.7308451`     |

### Bonzo Vault Contracts (20 vaults)

| Vault                          | Type              | EVM Address                                                 | Underlying           |
| ------------------------------ | ----------------- | ----------------------------------------------------------- | -------------------- |
| **HBAR-USDC**                  | ICHI Single-Asset | `0xebaFaBBD...40c76eB`                                      | SaucerSwap V2        |
| **USDC-HBAR**                  | ICHI Single-Asset | `0x1b90B8f8...d79089`                                       | SaucerSwap V2        |
| **BONZO-HBAR**                 | ICHI Single-Asset | `0x5D1e9BCA...0716bc`                                       | SaucerSwap V2        |
| **SAUCE-HBAR**                 | ICHI Single-Asset | `0x8e253F35...fb8193`                                       | SaucerSwap V2        |
| **USDC-HBAR Dual**             | Beefy Dual-Asset  | `0x724F19f5...13B2C7`                                       | SaucerSwap V2 + LARI |
| **SAUCE-XSAUCE Dual**          | Beefy Dual-Asset  | `0x8AEE31dF...6b783`                                        | SaucerSwap V2 + LARI |
| **HBARX Leveraged**            | Beefy LST         | `0x10288A0F...af3780`                                       | Bonzo Lend + Stader  |
| _...14 ICHI + 4 Beefy + 1 LST_ | **20 total**      | [Full list in `lib/bonzo-vaults.ts`](./lib/bonzo-vaults.ts) |                      |

### VaultMind's Own Contracts

| Contract               | Purpose                                                 | How It's Used                                                                                                              |
| ---------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **VaultMindAudit.sol** | Stores keccak256 hashes of keeper decisions             | `recordAudit(bytes32)` every cycle. `getAuditCount()`, `getLatestAudit()`, `getAudit(index)`. Emits `AuditRecorded` event. |
| **VKS Token (HTS)**    | Fungible reputation token (0 decimals, infinite supply) | 1 VKS minted per keeper cycle. User-owned, transferable, visible on HashScan.                                              |

---

## 🔧 Tech Stack

| Category               | Technology                                      | Purpose                                       |
| ---------------------- | ----------------------------------------------- | --------------------------------------------- |
| **Framework**          | Next.js 14 + React 18 + TypeScript              | Full-stack application                        |
| **AI Agent (Primary)** | LangChain + LangGraph + MemorySaver             | Agentic tool-calling with conversation memory |
| **AI Agent (Alt)**     | Vercel AI SDK v6 + `@ai-sdk/openai`             | Alternative agent with `generateText` + tools |
| **Multi-Agent**        | Custom Orchestrator (4 agents)                  | Sentinel → Strategist → Auditor → Executor    |
| **LLM**                | OpenAI GPT-4o                                   | Reasoning, tool selection, natural language   |
| **Blockchain SDK**     | Hedera Agent Kit v3                             | Hedera network interactions                   |
| **DeFi Protocol**      | `@bonzofinancelabs/hak-bonzo-plugin`            | Bonzo Lend + Vault operations                 |
| **Price Oracle**       | Pyth Network (Hermes API + on-chain)            | HBAR/USD, BTC, ETH, USDC real-time            |
| **Consensus**          | Hedera Consensus Service (HCS)                  | Immutable audit trail + DCA event sourcing    |
| **Token Service**      | Hedera Token Service (HTS)                      | VKS reputation token creation + minting       |
| **EVM Contract**       | VaultMindAudit.sol (Solidity 0.8.19)            | On-chain decision hash storage                |
| **Vault Contracts**    | ICHI + Beefy (real mainnet)                     | Vault deposit/withdraw/harvest                |
| **Liquid Staking**     | Stader Labs (`0.0.800556`)                      | HBAR → HBARX staking                          |
| **Sentiment**          | CoinGecko + Fear & Greed + NewsAPI + Volatility | 4-source composite scoring                    |
| **RAG**                | Custom TF-IDF similarity engine                 | 15+ DeFi knowledge documents                  |
| **Charts**             | Recharts + Custom SVG                           | 14 interactive visualization types            |
| **DCA**                | HCS event-sourced scheduler                     | Automated DCA with Pyth prices                |
| **Deployment**         | Vercel                                          | Serverless hosting                            |

---

## ✨ Complete Feature Inventory

### 🔷 Pyth Network Real-Time Price Feeds

Real prices from Pyth's Hermes API — not single-source CoinGecko dependency. HBAR/USD, BTC/USD, ETH/USD, USDC/USD with confidence intervals and EMA prices for trend detection. 10-second cache balances freshness with API efficiency. Fallback to CoinGecko if Hermes unavailable. Used everywhere: DCA execution, keeper decisions, Stader strategy, portfolio valuation.

### 🏦 Real Vault Execution on Mainnet

Actual smart contract calls against Bonzo's vault contracts — not simulated. **14 ICHI single-asset vaults** via `DepositGuard.forwardDepositToICHIVault()` for deposits and `ICHIVault.withdraw(shares, to)` for withdrawals. **5 Beefy vaults** (4 dual-asset + 1 leveraged LST) via `BeefyVault.deposit(amount)`, `BeefyVault.withdrawAll()`, and `BeefyStrategy.harvest(callFeeRecipient)` where the caller earns the fee incentive. On-chain queries for `getTotalAmounts()`, `getPricePerFullShare()`, `lastHarvest()`, `balanceOf()`.

### 📅 DCA Auto-Loop with Real Execution

Dollar-cost averaging that actually executes on-chain deposits automatically. HCS event-sourced — every DCA operation is an immutable on-chain event. State reconstructed from Mirror Node. Auto-execution every keeper tick. Real Pyth prices recorded at execution time. Auto-pauses after 3 failures or critical health factor. Frequencies: hourly, daily, weekly, biweekly, monthly.

### 🔷 HBARX Liquid Staking Strategy

Full yield-on-yield pipeline: HBAR → Stader → HBARX → Bonzo Supply → optional Borrow. **Mainnet:** real staking via Stader contract `0.0.800556` + real Bonzo deposit + real borrow. **Testnet:** staking simulated (no testnet contract), Bonzo deposit/borrow are real transactions. Pyth-priced USD calculations.

### 🤖 Multi-Agent Keeper System

Four agents: **Sentinel** (parallel Pyth + sentiment + Bonzo + Stader + vaults), **Strategist** (6-strategy engine with confidence scoring), **Auditor** (pre-flight risk + post-flight HCS/EVM logging), **Executor** (routes to correct on-chain handler). Coordinated by Orchestrator that also runs DCA auto-tick and VKS minting.

### 🎖️ HTS Keeper Score Token (VKS)

Fungible HTS token minted per keeper cycle. Name: "VaultMind Keeper Score", symbol: VKS, decimals: 0, supply: infinite. Uses `TokenCreateTransaction` (once), `TokenMintTransaction` + `TransferTransaction` (per cycle). Auto-creates on first run.

### 📝 EVM Audit Smart Contract (VaultMindAudit.sol)

VaultMind's own Solidity contract on Hedera EVM. Stores keccak256 hashes with timestamp, agent address, block number. Functions: `recordAudit(bytes32)`, `getAuditCount()`, `getLatestAudit()`, `getAudit(index)`. Emits `AuditRecorded` event. Auto-deploys via `ContractCreateFlow`.

### 🧠 6-Strategy Decision Engine

| Priority | Strategy                 | Trigger          | Action              |
| :------: | ------------------------ | ---------------- | ------------------- |
|    1     | Health Factor Protection | HF < 1.3         | `REPAY_DEBT`        |
|    2     | Bearish Harvest          | Sentiment < -30  | `HARVEST` → stable  |
|    3     | Volatility Exit          | Volatility > 80% | `EXIT_TO_STABLE`    |
|    4     | Yield Optimization       | Yield gap > 2%   | `REBALANCE`         |
|    5     | Bullish Accumulation     | Sentiment > +50  | `INCREASE_POSITION` |
|    6     | Vault Rebalancing        | Range deviation  | `SWITCH_VAULT`      |

### 📊 4-Source Sentiment Engine

CoinGecko (HBAR price + 7-day history), Fear & Greed Index (0-100), Realized Volatility (annualized), NewsAPI (bullish/bearish scoring). Fused into composite score -100 to +100.

### 🔗 HCS Immutable Audit Trail + EVM Hash

Every decision logged to HCS with multi-agent metadata. Additionally, keccak256 hash stored on VaultMindAudit.sol. Dual verification: full JSON on HCS, compact hash on EVM.

### 📈 14 Interactive Chart Types

Portfolio Pie, Sentiment Gauge, APY Comparison, OHLCV Candlestick, Risk/Return Scatter, Correlation Matrix, DeFi Heatmap, Performance Backtest, Market Overview, Vault Comparison, Positions Table, Wallet Info, HCS Timeline, Decision History.

### 🛡️ Health Monitor + 🤖 Dual AI Framework + 📚 RAG Knowledge Base

Real-time health factor tracking with auto-protection. LangChain + Vercel AI SDK dual agents (user-toggleable). TF-IDF retrieval across 15+ DeFi documents.

---

## 📋 All Commands Reference

### Wallet

| Command                      | Description                  |
| ---------------------------- | ---------------------------- |
| `connect wallet 0.0.5907362` | Connect Hedera account       |
| `show my wallet`             | Balance, tokens, EVM address |

### Analytics & Charts

| Command                         | Description                     |
| ------------------------------- | ------------------------------- |
| `show my portfolio`             | Asset allocation pie chart      |
| `how's the market sentiment?`   | 4-source sentiment gauge        |
| `compare APYs across platforms` | Supply vs Borrow vs Vault APYs  |
| `compare Bonzo Vault APYs`      | All 20 vaults with APY/TVL/risk |
| `show correlation matrix`       | Inter-asset correlation heatmap |
| `show risk vs return`           | Volatility vs return scatter    |
| `show price chart`              | 30-day HBAR OHLCV candlestick   |
| `show my positions`             | Supplied/borrowed per asset     |
| `show backtest`                 | VaultMind vs HODL simulation    |

### Keeper

| Command                         | Description                         |
| ------------------------------- | ----------------------------------- |
| `run dry run`                   | Analyze market, show recommendation |
| `execute keeper`                | Run and execute the recommendation  |
| `start auto keeper`             | Begin autonomous monitoring         |
| `start auto keeper every 1 min` | Custom interval (1-15 min)          |
| `stop auto keeper`              | Stop monitoring                     |
| `show decision history`         | Past keeper decisions               |

### Vault Operations

| Command                       | Description      |
| ----------------------------- | ---------------- |
| `deposit 100 HBAR into vault` | Vault deposit    |
| `withdraw from vault`         | Exit position    |
| `harvest vault`               | Trigger harvest  |
| `switch vault to stable`      | Move to low-risk |

### Bonzo Lending

| Command                    | Description               |
| -------------------------- | ------------------------- |
| `supply 500 HBAR to Bonzo` | Deposit to Bonzo Lend     |
| `borrow 200 USDC`          | Borrow against collateral |
| `repay my USDC loan`       | Repay debt                |
| `withdraw my HBAR`         | Withdraw supplied         |

### DCA

| Command               | Description           |
| --------------------- | --------------------- |
| `DCA 50 HBAR daily`   | Create daily DCA plan |
| `DCA 100 USDC weekly` | Weekly into Bonzo     |
| `show DCA status`     | Plans + history       |
| `cancel DCA`          | Cancel plan           |

### Stader HBARX

| Command                        | Description              |
| ------------------------------ | ------------------------ |
| `HBARX strategy with 100 HBAR` | Full stake→supply→borrow |
| `stake 50 HBAR with Stader`    | Liquid staking only      |
| `show HBARX info`              | Rate + Pyth price        |

### Health + HCS + RAG

| Command                     | Description             |
| --------------------------- | ----------------------- |
| `monitor my positions`      | Health factor gauge     |
| `show audit log`            | All HCS entries         |
| `show only HARVEST actions` | Filtered audit          |
| `I want safe yield`         | Intent → recommendation |

---

## 🔌 API Reference

| Endpoint         | Method   | Description                           |
| ---------------- | -------- | ------------------------------------- |
| `/api/agent`     | POST     | AI agent chat (LangChain or Vercel)   |
| `/api/keeper`    | POST     | Run keeper cycle (dry-run or execute) |
| `/api/execute`   | POST     | Bonzo Lend operations                 |
| `/api/vaults`    | POST     | Real vault operations (mainnet)       |
| `/api/dca`       | GET/POST | DCA plan CRUD                         |
| `/api/stader`    | POST     | HBARX staking + strategy              |
| `/api/pyth`      | GET      | Pyth price feeds                      |
| `/api/rewards`   | GET/POST | VKS token + audit contract            |
| `/api/market`    | GET      | Market data + sentiment               |
| `/api/positions` | GET      | Bonzo positions                       |
| `/api/hcs`       | GET      | HCS audit reader                      |
| `/api/charts`    | GET      | Chart data endpoints                  |

---

## 🧪 Key Design Decisions (ADR)

### ADR-1: Why Multi-Agent over Monolithic?

**Decision:** Split the single keeper into 4 specialized agents.
**Context:** Bounty theme is "transparent, autonomous economies" with "coordination layers." A monolithic agent can't be audited step-by-step.
**Consequence:** Each agent has single responsibility. Auditor can block Executor. Every agent's contribution visible in HCS log.

### ADR-2: Why Pyth Network over SupraOracles?

**Decision:** Pyth as primary oracle instead of SupraOracles (mentioned in Bonzo docs).
**Context:** Pyth provides 400+ feeds, sub-second latency, confidence intervals, EMA prices, free Hermes REST API, live on-chain Hedera contract. SupraOracles has limited Hedera integration.
**Consequence:** Real-time HBAR/USD with confidence bounds. Every DCA execution records actual Pyth price. Trend detection via EMA vs spot spread.

### ADR-3: Why HCS Event Sourcing for DCA?

**Decision:** Store DCA state as HCS events, not database.
**Context:** Plans must survive server restarts. HCS already in stack.
**Consequence:** Immutable on-chain event log. State reconstructed from Mirror Node. 10s cache + optimistic updates.

### ADR-4: Why Deploy Our Own EVM Contract?

**Decision:** Deploy VaultMindAudit.sol alongside using Bonzo's contracts.
**Context:** Calling others' contracts is good. Deploying your own demonstrates EVM competency and broadens Hedera service usage.
**Consequence:** Dual audit trail: HCS (full JSON) + EVM (compact keccak256 hash). Auto-deploys via `ContractCreateFlow`.

### ADR-5: Why HTS Reputation Token?

**Decision:** Mint VKS fungible token per keeper cycle.
**Context:** Adds HTS to service coverage. Users get on-chain proof of keeper activity. Token is transferable and user-owned.
**Consequence:** `TokenCreateTransaction` once, `TokenMintTransaction` + `TransferTransaction` per cycle. Visible on HashScan.

### ADR-6: Why Dual AI Frameworks?

**Decision:** Both LangChain + Vercel AI SDK, user-toggleable.
**Context:** Bonzo bounty explicitly suggests both. Building one leaves points on the table.
**Consequence:** LangChain uses LangGraph + MemorySaver. Vercel uses `generateText()` + Zod. Same 6 tools, different engines.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+, Hedera testnet account, OpenAI API key

### Install & Run

```bash
git clone https://github.com/YOUR_USERNAME/vaultmind.git
cd vaultmind/frontend && npm install
cp .env.example .env.local  # Edit with your keys
npm run dev                  # http://localhost:3000
```

```env
HEDERA_ACCOUNT_ID=0.0.XXXXXX
HEDERA_PRIVATE_KEY=302e...
HEDERA_NETWORK=testnet
OPENAI_API_KEY=sk-...
# Auto-created on first keeper run:
# VKS_TOKEN_ID_TESTNET=0.0.XXXXX
# VAULTMIND_AUDIT_CONTRACT_TESTNET=0.0.XXXXX
```

---

## 📁 Project Structure

```
frontend/
├── app/api/              # 12 API routes
├── contracts/
│   └── VaultMindAudit.sol
├── lib/
│   ├── agents/           # 4-agent system + orchestrator
│   ├── evm-audit.ts      # VaultMindAudit.sol deploy + interact
│   ├── hts-rewards.ts    # VKS token create + mint
│   ├── pyth.ts           # Pyth price feeds
│   ├── vault-execute.ts  # ICHI + Beefy vault execution
│   ├── bonzo-execute.ts  # Bonzo Lend contracts
│   ├── dca.ts            # HCS event-sourced DCA
│   ├── keeper.ts         # Keeper cycle wrapper
│   └── ...               # sentiment, rag, hcs, stader, etc.
├── components/           # Charts, wallet, markdown
└── 50+ files · 12,000+ lines
```

---

## 🧪 Judge Verification Flow

|  #  | Command                         | Verify                     |
| :-: | ------------------------------- | -------------------------- |
|  1  | `connect wallet 0.0.5907362`    | Balance + tokens           |
|  2  | `how's the market sentiment?`   | 4-source gauge             |
|  3  | `run dry run`                   | Multi-agent decision       |
|  4  | `supply 100 HBAR to Bonzo`      | Real tx → HashScan         |
|  5  | `borrow 5 USDC`                 | HF impact → real tx        |
|  6  | `DCA 50 HBAR daily`             | Plan on HCS                |
|  7  | `start auto keeper every 1 min` | DCA executes, VKS minted   |
|  8  | `show audit log`                | HCS + multi-agent metadata |
|  9  | `I want safe yield`             | AI recommends vault        |
| 10  | `show backtest`                 | VaultMind vs HODL          |

---

## 💰 Bonzo Bounty Alignment

### All 3 Bonzo Ideas — Implemented

**1. "Volatility-Aware Rebalancer" ✅** — Sentinel + Pyth volatility. >80% → `EXIT_TO_STABLE`.
**2. "Sentiment-Based Harvester" ✅** — 4-source sentiment. <-30 → `HARVEST`. >+50 → `INCREASE_POSITION`.
**3. "Intent-Based UI" ✅** — "I want safe yield" → scans 20 vaults → recommends → real deposit.

### Hedera Service Breadth

| Service            | VaultMind                           |
| ------------------ | ----------------------------------- |
| HCS                | ✅ Audit + DCA event sourcing       |
| HTS                | ✅ VKS Keeper Score token           |
| EVM (own contract) | ✅ VaultMindAudit.sol               |
| DeFi Contracts     | ✅ 20+ vaults + Bonzo Lend + Stader |
| Pyth Oracle        | ✅ 4 feeds with confidence          |

---

<p align="center">
  <strong>🧠 VaultMind — Where DeFi Vaults Get a Brain</strong><br/>
  <em>Hedera Hello Future Apex Hackathon 2026 · AI & Agents · Bonzo Finance</em><br/>
  <code>50+ files · 12,000+ lines · 4 agents · 20 vaults · HCS + HTS + EVM</code>
</p>
