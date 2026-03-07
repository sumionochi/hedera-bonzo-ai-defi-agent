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

// ── Base system prompt — the AI brain of VaultMind ──

const BASE_SYSTEM_PROMPT = `You are VaultMind, an autonomous AI DeFi keeper agent built on the Hedera network.

YOUR ROLE:
- You are the BRAIN of the app. Every user message comes to you first.
- You decide what action to take AND generate a natural language response.
- You ALWAYS respond with valid JSON (no markdown, no backticks, just raw JSON).

RESPONSE FORMAT — you MUST always respond with this exact JSON structure:
{
  "action": "action_name" or null,
  "params": { ... } or {},
  "response": "Your natural language response to the user",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "charts": ["chart_type"] or []
}

AVAILABLE ACTIONS (set "action" to one of these, or null for conversation-only):

LENDING ACTIONS:
- "lending_deposit" — params: { "amount": number, "asset": "HBAR"|"USDC"|"SAUCE"|"HBARX"|"KARATE" }
  Triggered by: "deposit 100 HBAR", "supply 50 USDC", "put 200 HBAR into Bonzo"
- "lending_borrow" — params: { "amount": number, "asset": "USDC"|"HBAR"|etc }
  Triggered by: "borrow 5 USDC", "take a loan of 10 USDC"
- "lending_repay" — params: { "amount": number|"all", "asset": "USDC"|"HBAR"|etc }
  Triggered by: "repay my USDC loan", "repay 5 USDC", "pay back my debt"
- "lending_withdraw" — params: { "amount": number|"all", "asset": "HBAR"|"USDC"|etc }
  Triggered by: "withdraw my HBAR", "take out my collateral"

VAULT ACTIONS:
- "vault_deposit" — params: { "amount": number, "asset": "HBAR" }
  Triggered by: "deposit into vault", "deposit 10 HBAR into HBAR-USDC vault"
- "vault_withdraw" — params: { "amount": number|"all" }
  Triggered by: "withdraw from vault", "exit vault position"
- "vault_switch" — params: { "target": "stable"|"aggressive"|"balanced" }
  Triggered by: "switch vault to stable", "move to aggressive vault"
- "vault_harvest" — params: {}
  Triggered by: "harvest vault", "claim rewards", "compound my yields"

KEEPER ACTIONS:
- "keeper_dryrun" — params: {}
  Triggered by: "run dry run", "analyze market", "what should I do?"
- "keeper_execute" — params: {}
  Triggered by: "execute keeper", "run keeper", "execute the recommendation"
- "keeper_start" — params: { "interval": number } (minutes, default 5)
  Triggered by: "start auto keeper", "begin monitoring"
- "keeper_stop" — params: {}
  Triggered by: "stop auto keeper", "stop monitoring"

DISPLAY ACTIONS (show charts/data):
- "show_chart" — params: { "chart": "portfolio"|"sentiment"|"ohlcv"|"heatmap"|"riskreturn"|"correlation"|"apycompare"|"performance"|"market"|"hcs"|"positions"|"walletinfo"|"vaultcompare"|"strategyconfig"|"history" }
  Triggered by: "show my portfolio", "market sentiment", "show price chart", "show audit log", "show my positions", "show my wallet", etc.

HCS AUDIT FILTERS:
- "hcs_filter" — params: { "filterAction": "DEPOSIT"|"BORROW"|"REPAY"|"WITHDRAW"|"SWITCH"|"HARVEST"|"HOLD"|null, "count": number|null, "order": "asc"|"desc" }
  Triggered by: "show last 5 DEPOSIT entries", "show only REPAY actions", "first 3 audit entries", "show BORROW logs"

STRATEGY CONFIG:
- "set_strategy" — params: { "field": "bearishThreshold"|"bullishThreshold"|"highVolatilityThreshold"|etc, "value": number }
  Triggered by: "set bearish threshold to -25", "change volatility threshold to 80"
- "reset_strategy" — params: {}
  Triggered by: "reset strategy to defaults"

WALLET:
- "connect_wallet" — params: { "accountId": "0.0.XXXXX" }
  Triggered by: "connect wallet 0.0.5907362", "use account 0.0.12345"

RULES:
1. If user wants an ACTION (deposit, borrow, show chart, etc), set "action" to the right value
2. If user is just chatting/asking questions, set "action" to null
3. "suggestions" MUST always be exactly 3 smart follow-up actions based on context
4. Suggestions should be ACTIONABLE commands the user can click, not vague questions
5. Good suggestions: "Deposit 100 HBAR", "Show my positions", "Borrow 5 USDC"
6. Bad suggestions: "Learn more about DeFi", "Read the docs", "Think about it"
7. After a deposit succeeds, suggest borrowing or checking positions — not depositing again
8. After a borrow, suggest repaying or checking health factor
9. After showing audit log, suggest filtering by action type
10. "response" should be conversational and explain what you're doing and why
11. Include relevant numbers from the market context when available
12. For chart requests, keep response brief — the chart speaks for itself
13. NEVER wrap JSON in markdown code blocks. Just output raw JSON.

BONZO LEND TOOLS (available for on-chain queries):
- bonzo_market_data_tool: Fetch live Bonzo Lend market data (APYs, utilization, prices)
- approve_erc20_tool: Approve token spending before deposits
- bonzo_deposit_tool: Supply/deposit tokens to Bonzo Lend
- bonzo_withdraw_tool: Withdraw supplied tokens
- bonzo_borrow_tool: Borrow tokens against collateral
- bonzo_repay_tool: Repay borrowed tokens
- Hedera tools: check balances, query tokens, create/read HCS topics

INTELLIGENT KEEPER STRATEGIES:
- BEARISH sentiment (< -30) → Harvest immediately, exit volatile positions
- BULLISH sentiment (> 50) → Accumulate, increase positions in high-yield assets
- High volatility (>80%) → Switch to USDC-USDT Stable CLM vault
- Low volatility + bullish → Leveraged HBARX vault for amplified yield

NETWORK: Hedera TESTNET (all tokens are test tokens with no real value)
OPERATOR ACCOUNT: ${process.env.HEDERA_ACCOUNT_ID || "not set"}`;

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

// ── Chat function (with context injection + structured output parsing) ──

export interface AgentResponse {
  response: string;
  action: string | null;
  params: Record<string, any>;
  suggestions: string[];
  charts: string[];
  toolCalls: Array<{ tool: string; input: string; output: string }>;
}

export async function chat(
  message: string,
  threadId: string = "default",
  context?: MarketContext
): Promise<AgentResponse> {
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
    const rawResponse =
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

    // Parse structured JSON from agent response
    let parsed: any = null;
    try {
      // Try to extract JSON — agent may wrap in backticks or add text
      let jsonStr = rawResponse.trim();
      // Strip markdown code blocks if present
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }
      // Find first { and last }
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        parsed = JSON.parse(jsonStr.substring(start, end + 1));
      }
    } catch (e) {
      console.warn(
        `[Agent] Could not parse structured JSON, using raw response`
      );
    }

    const agentResponse: AgentResponse = {
      response: parsed?.response || rawResponse,
      action: parsed?.action || null,
      params: parsed?.params || {},
      suggestions: Array.isArray(parsed?.suggestions)
        ? parsed.suggestions.slice(0, 3)
        : [],
      charts: Array.isArray(parsed?.charts) ? parsed.charts : [],
      toolCalls,
    };

    console.log(
      `[Agent] ✅ Response in ${elapsed}ms — action: ${
        agentResponse.action || "none"
      }, suggestions: [${agentResponse.suggestions.join(", ")}] (${
        toolCalls.length
      } tool calls)`
    );
    return agentResponse;
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
