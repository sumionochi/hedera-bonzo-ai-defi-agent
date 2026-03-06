// ============================================
// VaultMind Agent - Core Configuration
// Hedera Agent Kit + Bonzo Plugin + LangChain/LangGraph
// Enhanced: injects live market context into every call
// ============================================

import {
  HederaLangchainToolkit,
  AgentMode,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusPlugin,
  coreConsensusQueryPlugin,
} from "hedera-agent-kit";
import { bonzoPlugin } from "@bonzofinancelabs/hak-bonzo-plugin";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { getHederaClient } from "./hedera";

// ── Base system prompt ──

const BASE_SYSTEM_PROMPT = `You are VaultMind, an autonomous AI DeFi keeper agent built on the Hedera network.

YOUR ROLE:
- Manage users' positions across BOTH Bonzo Lend (lending/borrowing) AND Bonzo Vaults (automated yield strategies)
- Monitor market conditions, sentiment, and volatility to make intelligent keeper decisions
- Execute vault operations: deposit, withdraw, harvest rewards, switch between vaults
- Execute lending operations: supply, borrow, repay on Bonzo Lend
- Log every decision to Hedera Consensus Service (HCS) for immutable audit trails
- Explain your reasoning in plain English so users understand every action

BONZO LEND TOOLS:
- bonzo_market_data_tool: Fetch live Bonzo Lend market data (APYs, utilization, prices)
- approve_erc20_tool: Approve token spending before deposits
- bonzo_deposit_tool: Supply/deposit tokens to Bonzo Lend (params: tokenSymbol, amount)
- bonzo_withdraw_tool: Withdraw supplied tokens (params: tokenSymbol, amount, withdrawAll)
- bonzo_borrow_tool: Borrow tokens against collateral (params: tokenSymbol, amount, rateMode)
- bonzo_repay_tool: Repay borrowed tokens (params: tokenSymbol, amount, rateMode, repayAll)
- Hedera tools: check balances, query tokens, create/read HCS topics

BONZO VAULT OPERATIONS:
Bonzo Vaults are Beefy-based automated yield strategy vaults on Hedera. They auto-compound rewards.
Available Vault Strategies:
1. Single Asset DEX (CLM): Deposits single asset → routes to SaucerSwap V2 concentrated liquidity → auto-manages ranges → harvests and compounds fees
2. Dual Asset DEX: Deposits pair → balanced 50/50 position → auto-rebalances
3. Leveraged LST: Deposits HBARX → supplies to Bonzo Lend as collateral → borrows HBAR → stakes for more HBARX → re-supplies (leveraged loop)

Vault Contract Functions (Beefy standard):
- deposit(amount): Deposit want tokens into vault, receive mooTokens (vault shares)
- withdraw(shares): Burn mooTokens, receive want tokens proportionally
- harvest(): Compound accumulated rewards (anyone can call, caller gets 0.05-0.5% fee)
- getPricePerFullShare(): Current value of 1 vault share in want tokens
- balance(): Total vault balance (vault + strategy)

INTELLIGENT KEEPER STRATEGIES:
Vault Harvest Timing:
- BEARISH sentiment (< -30) → Harvest IMMEDIATELY, don't let reward tokens devalue
- BULLISH sentiment (> 50) → Delay harvest, let rewards accumulate price appreciation  
- Neutral → Standard 4-hour harvest cycle

Vault Selection:
- High volatility (>80%) → Switch to USDC-USDT Stable CLM vault (near-zero IL)
- Low volatility + bullish → Leverage: HBARX Leveraged LST vault for amplified yield
- Balanced conditions → HBAR-USDC CLM for best risk-adjusted yield
- Risk-averse user → USDC-USDT Stable CLM or Bonzo Lend supply

Cross-Protocol Intelligence:
- Compare Bonzo Vault APYs vs Bonzo Lend supply APYs vs SaucerSwap LP yields
- Recommend the best risk-adjusted opportunity across ALL Bonzo products
- Factor in gas costs, withdrawal fees, and harvest-on-deposit mechanics

TRANSACTION RULES:
1. Before any deposit: ALWAYS approve the token first using approve_erc20_tool
2. For HBAR deposits: use tokenSymbol "WHBAR" (HBAR is wrapped automatically)
3. NEVER execute without first explaining what you're about to do and why
4. After executing, report: transaction details, status, and what changed
5. When recommending vault switches, explain the APY difference AND the risk tradeoff

COMMUNICATION STYLE:
- Lead with the key insight or action
- Include specific numbers (APYs, prices, sentiment scores, vault TVL)
- When recommending actions, explain the risk/reward tradeoff
- Compare vault yields vs lending yields when relevant
- Reference current market conditions to support your reasoning

NETWORK: Hedera TESTNET (all tokens are test tokens with no real value)
OPERATOR ACCOUNT (for signing txns only): ${
  process.env.HEDERA_ACCOUNT_ID || "not set"
}
IMPORTANT: The operator account is NOT the user's wallet. When the user asks about "my portfolio", "my balance", or "my positions", use the account ID from the [USER WALLET] context injected in the message — NOT the operator account.`;

// ── Dynamic context builder ──

export interface MarketContext {
  sentiment?: {
    score: number;
    signal: string;
    confidence: number;
    reasoning: string;
  };
  hbarPrice?: number;
  hbarChange24h?: number;
  fearGreedIndex?: number;
  fearGreedLabel?: string;
  volatility?: number;
  topYields?: Array<{ symbol: string; supplyAPY: number }>;
  portfolio?: {
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    healthFactor: number;
    positions: Array<{ symbol: string; supplied: number; borrowed: number }>;
  };
}

function buildContextBlock(ctx: MarketContext): string {
  const parts: string[] = [];

  parts.push("\n\n--- LIVE MARKET CONTEXT (use to inform answers) ---");

  if (ctx.hbarPrice) {
    const changeStr = ctx.hbarChange24h
      ? ` (${ctx.hbarChange24h >= 0 ? "+" : ""}${ctx.hbarChange24h.toFixed(
          2
        )}% 24h)`
      : "";
    parts.push(`HBAR Price: $${ctx.hbarPrice.toFixed(4)}${changeStr}`);
  }

  if (ctx.sentiment) {
    parts.push(
      `Sentiment: ${ctx.sentiment.score} (${
        ctx.sentiment.signal
      }) — Confidence: ${(ctx.sentiment.confidence * 100).toFixed(0)}%`
    );
    parts.push(`Analysis: ${ctx.sentiment.reasoning}`);
  }

  if (ctx.fearGreedIndex !== undefined) {
    parts.push(
      `Fear & Greed Index: ${ctx.fearGreedIndex} (${ctx.fearGreedLabel || ""})`
    );
  }

  if (ctx.volatility !== undefined) {
    parts.push(`Volatility: ${ctx.volatility.toFixed(0)}% annualized`);
  }

  if (ctx.topYields && ctx.topYields.length > 0) {
    const yieldsStr = ctx.topYields
      .slice(0, 5)
      .map((y) => `${y.symbol}: ${y.supplyAPY.toFixed(2)}%`)
      .join(", ");
    parts.push(`Top Bonzo Yields: ${yieldsStr}`);
  }

  if (ctx.portfolio) {
    parts.push(
      `User Portfolio: $${ctx.portfolio.totalSuppliedUSD.toFixed(
        2
      )} supplied, $${ctx.portfolio.totalBorrowedUSD.toFixed(2)} borrowed`
    );
    if (ctx.portfolio.healthFactor > 0) {
      parts.push(`Health Factor: ${ctx.portfolio.healthFactor.toFixed(2)}`);
    }
    if (ctx.portfolio.positions.length > 0) {
      const posStr = ctx.portfolio.positions
        .map((p) => {
          const bits = [];
          if (p.supplied > 0) bits.push(`+${p.supplied.toFixed(2)} supplied`);
          if (p.borrowed > 0) bits.push(`-${p.borrowed.toFixed(2)} borrowed`);
          return `${p.symbol}: ${bits.join(", ")}`;
        })
        .join(" | ");
      parts.push(`Positions: ${posStr}`);
    } else {
      parts.push("Positions: None (no active Bonzo positions)");
    }
  }

  parts.push("---");

  return parts.join("\n");
}

// ── Agent initialization ──

let agentInstance: any = null;
let toolNames: string[] = [];

async function initAgent() {
  const client = getHederaClient();

  console.log("[Agent] Initializing with Hedera Agent Kit...");
  console.log(`[Agent] Network: ${client.ledgerId?.toString()}`);
  console.log(`[Agent] Operator: ${client.operatorAccountId?.toString()}`);

  const toolkit = new HederaLangchainToolkit({
    client: client as any,
    configuration: {
      plugins: [
        bonzoPlugin,
        coreAccountQueryPlugin,
        coreTokenQueryPlugin,
        coreConsensusPlugin,
        coreConsensusQueryPlugin,
      ],
      context: {
        mode: AgentMode.AUTONOMOUS,
        accountId: process.env.HEDERA_ACCOUNT_ID,
      },
    },
  });

  const tools = toolkit.getTools();
  toolNames = tools.map((t: any) => t.name);
  console.log(`[Agent] Loaded ${tools.length} tools: ${toolNames.join(", ")}`);

  const llm = new ChatOpenAI({
    model: "gpt-4o",
    temperature: 0.1,
    apiKey: process.env.OPENAI_API_KEY,
  });

  const checkpointer = new MemorySaver();

  // @ts-expect-error - LangGraph deep type inference
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: checkpointer,
    messageModifier: new SystemMessage(BASE_SYSTEM_PROMPT),
  });

  console.log("[Agent] ✅ Agent initialized successfully");
  return agent;
}

export async function getAgent() {
  if (agentInstance) return agentInstance;
  agentInstance = await initAgent();
  return agentInstance;
}

export function getToolNames(): string[] {
  return toolNames;
}

// ── Chat function (with context injection) ──

export async function chat(
  message: string,
  threadId: string = "default",
  context?: MarketContext
): Promise<{
  response: string;
  toolCalls: Array<{ tool: string; input: string; output: string }>;
}> {
  const agent = await getAgent();

  // Inject context so agent gives informed answers without extra tool calls
  let fullMessage = message;
  if (context) {
    const contextBlock = buildContextBlock(context);
    fullMessage = `${message}\n${contextBlock}`;
  }

  console.log(`[Agent] Processing: "${message.substring(0, 100)}"`);
  if (context) {
    console.log(
      `[Agent] Context: sentiment=${context.sentiment?.score}, HBAR=$${context.hbarPrice}`
    );
  }

  const startTime = Date.now();

  try {
    const result = await agent.invoke(
      { messages: [new HumanMessage(fullMessage)] },
      { configurable: { thread_id: threadId } }
    );

    const elapsed = Date.now() - startTime;
    const messages = result.messages;

    // Extract the final AI message
    const lastMessage = messages[messages.length - 1];
    const response =
      typeof lastMessage.content === "string"
        ? lastMessage.content
        : Array.isArray(lastMessage.content)
        ? lastMessage.content
            .map((c: any) => (c.type === "text" ? c.text : ""))
            .join("")
        : JSON.stringify(lastMessage.content);

    // Extract tool calls for transparency
    const toolCalls: Array<{ tool: string; input: string; output: string }> =
      [];

    for (const msg of messages) {
      const type = msg._getType?.();

      if (type === "ai" && msg.tool_calls?.length > 0) {
        for (const tc of msg.tool_calls) {
          toolCalls.push({
            tool: tc.name || "unknown",
            input: JSON.stringify(tc.args || {}).substring(0, 300),
            output: "",
          });
        }
      }

      if (type === "tool") {
        const existing = toolCalls.find(
          (tc) => tc.tool === (msg.name || "") && tc.output === ""
        );
        if (existing) {
          existing.output =
            typeof msg.content === "string"
              ? msg.content.substring(0, 500)
              : JSON.stringify(msg.content).substring(0, 500);
        } else {
          toolCalls.push({
            tool: msg.name || "unknown",
            input: "",
            output:
              typeof msg.content === "string"
                ? msg.content.substring(0, 500)
                : JSON.stringify(msg.content).substring(0, 500),
          });
        }
      }
    }

    console.log(
      `[Agent] ✅ Response in ${elapsed}ms (${toolCalls.length} tool calls)`
    );
    return { response, toolCalls };
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Agent] ❌ Error after ${elapsed}ms:`, error.message);

    if (error.message?.includes("API key")) {
      throw new Error(
        "OpenAI API key is invalid. Check OPENAI_API_KEY in .env.local"
      );
    }
    if (error.message?.includes("rate limit")) {
      throw new Error("Rate limited by OpenAI. Wait a moment and try again.");
    }
    if (error.message?.includes("insufficient funds")) {
      throw new Error(
        "Insufficient HBAR for this transaction. Fund at portal.hedera.com"
      );
    }
    throw error;
  }
}
