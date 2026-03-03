# 🧠 VaultMind — AI DeFi Keeper Agent on Hedera

> AI agent that autonomously manages Bonzo Finance vault positions — harvesting rewards when sentiment turns bearish, rebalancing when volatility spikes, explaining every decision in plain English, and logging everything immutably on HCS.

**Built for:** Hedera Hello Future Apex Hackathon 2026
**Track:** AI & Agents | **Bounty:** Bonzo Finance

## 🚀 Quick Start

```bash
cd frontend
cp .env.example .env.local    # Fill in your keys
npm install
npm run dev                    # http://localhost:3000
```

**Required keys:** Hedera testnet (portal.hedera.com), OpenAI API key, NewsAPI key (optional)

## 🔧 Tech Stack

- **AI:** Hedera Agent Kit JS + LangChain + LangGraph + GPT-4o
- **DeFi:** Bonzo Finance (Aave v2 on Hedera) via bonzoPlugin
- **On-Chain:** HCS audit logs, HTS tokens, Mirror Node queries
- **Sentiment:** CoinGecko prices, Fear & Greed Index, NewsAPI
- **Frontend:** Next.js 14, Tailwind CSS, Recharts

## License
MIT
