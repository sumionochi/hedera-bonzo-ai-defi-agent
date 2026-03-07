// ============================================
// VaultMind Agent — Vercel AI SDK v6 Implementation
// Alternative to LangChain agent (lib/agent.ts)
// Uses: ai v6 + @ai-sdk/openai + tools + structured output
// Switch via AI_PROVIDER=vercel in .env.local
// ============================================

import { generateText, stepCountIs } from "ai";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { analyzeSentiment } from "./sentiment";
import { getBonzoMarkets } from "./bonzo";
import { getVaultsWithLiveData, getVaultsSummary } from "./bonzo-vaults";
import { buildRAGContext } from "./rag";
import type { AgentResponse, MarketContext } from "./agent";

// ── Conversation memory (in-memory per session) ──

const conversationHistory: Map<
  string,
  Array<{ role: "user" | "assistant"; content: string }>
> = new Map();

function getHistory(
  threadId: string
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!conversationHistory.has(threadId)) {
    conversationHistory.set(threadId, []);
  }
  return conversationHistory.get(threadId)!;
}

// ── System prompt ──

const SYSTEM_PROMPT = `You are VaultMind, an autonomous AI DeFi keeper agent built on the Hedera network.
You are powered by the Vercel AI SDK with tool-calling capabilities.

YOUR ROLE:
- You are the BRAIN of the app. Every user message comes to you first.
- You decide what action to take AND generate a natural language response.
- You have access to tools that fetch live data from the Hedera network and DeFi protocols.
- You ALWAYS respond with valid JSON (no markdown, no backticks, just raw JSON).

RESPONSE FORMAT — you MUST always respond with this exact JSON structure:
{
  "action": "action_name" or null,
  "params": { ... } or {},
  "response": "Your natural language response to the user",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "charts": ["chart_type"] or []
}

AVAILABLE ACTIONS:

LENDING: "lending_deposit", "lending_borrow", "lending_repay", "lending_withdraw"
  params: { "amount": number, "asset": "HBAR"|"USDC"|"SAUCE"|"HBARX"|"KARATE" }

VAULT: "vault_deposit", "vault_withdraw", "vault_switch", "vault_harvest"
  params vary — amount, asset, target ("stable"|"aggressive"|"balanced")

KEEPER: "keeper_dryrun", "keeper_execute", "keeper_start", "keeper_stop"

DISPLAY: "show_chart" — params: { "chart": "portfolio"|"sentiment"|"ohlcv"|"heatmap"|"riskreturn"|"correlation"|"apycompare"|"performance"|"market"|"hcs"|"positions"|"walletinfo"|"vaultcompare"|"strategyconfig"|"history" }

HCS AUDIT: "hcs_filter" — params: { "filterAction": string|null, "count": number|null, "order": "asc"|"desc" }

STRATEGY: "set_strategy" — params: { "field": string, "value": number }
WALLET: "connect_wallet" — params: { "accountId": "0.0.XXXXX" }

RULES:
1. Use your tools to fetch live data when answering market/sentiment/position questions
2. "suggestions" MUST always be exactly 3 smart actionable follow-up commands
3. Good: "Deposit 100 HBAR", "Show my positions" — Bad: "Learn more about DeFi"
4. After deposit -> suggest borrow. After borrow -> suggest repay. After audit -> suggest filter.
5. Include specific numbers from tool results in your response
6. NEVER wrap JSON in markdown code blocks. Just output raw JSON.

INTELLIGENT KEEPER STRATEGIES:
- BEARISH sentiment (< -30) -> Harvest immediately, exit volatile positions
- BULLISH sentiment (> 50) -> Accumulate, increase positions in high-yield assets
- High volatility (>80%) -> Switch to USDC-USDT Stable CLM vault
- Low volatility + bullish -> Leveraged HBARX vault for amplified yield

NETWORK: Hedera TESTNET
OPERATOR ACCOUNT: ${process.env.HEDERA_ACCOUNT_ID || "not set"}`;

// ── Tool executor functions ──

async function execAnalyzeSentiment(): Promise<string> {
  try {
    const result = await analyzeSentiment();
    return JSON.stringify({
      score: result.score,
      signal: result.signal,
      confidence: result.confidence,
      reasoning: result.reasoning,
      hbarPrice: result.dataPoints.hbarPrice,
      hbarChange24h: result.dataPoints.hbarChange24h,
      volatility: result.dataPoints.volatility,
      fearGreedIndex: result.dataPoints.fearGreedIndex,
      fearGreedLabel: result.dataPoints.fearGreedLabel,
    });
  } catch (e: any) {
    return JSON.stringify({ error: e.message, score: 0, signal: "HOLD" });
  }
}

async function execGetBonzoMarkets(): Promise<string> {
  try {
    const data = await getBonzoMarkets();
    const reserves = (data.reserves || [])
      .filter((r: any) => r.active && !r.frozen)
      .map((r: any) => ({
        symbol: r.symbol,
        supplyAPY: r.supplyAPY?.toFixed(2) + "%",
        borrowAPY: r.borrowAPY?.toFixed(2) + "%",
        utilization: r.utilization?.toFixed(1) + "%",
        priceUSD: "$" + (r.priceUSD || 0).toFixed(4),
        totalLiquidity: "$" + (r.totalLiquidityUSD || 0).toFixed(0),
      }));
    return JSON.stringify({ markets: reserves, count: reserves.length });
  } catch (e: any) {
    return JSON.stringify({ error: e.message, markets: [] });
  }
}

async function execGetVaultData(): Promise<string> {
  try {
    const vaults = await getVaultsWithLiveData();
    return JSON.stringify({
      summary: getVaultsSummary(vaults),
      vaultCount: vaults.length,
    });
  } catch (e: any) {
    return JSON.stringify({
      error: e.message,
      summary: "Vault data unavailable",
    });
  }
}

async function execGetDefiKnowledge(query: string): Promise<string> {
  const context = buildRAGContext(query);
  return JSON.stringify({
    knowledge: context || "No specific knowledge found.",
  });
}

async function execCheckPortfolio(accountId: string): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/positions?accountId=${accountId}`);
    const json = await res.json();
    if (json.success) {
      return JSON.stringify({
        totalSuppliedUSD: json.data.totalSuppliedUSD,
        totalBorrowedUSD: json.data.totalBorrowedUSD,
        healthFactor: json.data.healthFactor,
        positions: json.data.positions,
      });
    }
    return JSON.stringify({
      error: "Could not fetch positions",
      positions: [],
    });
  } catch (e: any) {
    return JSON.stringify({ error: e.message, positions: [] });
  }
}

async function execKeeperDecision(): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const res = await fetch(`${baseUrl}/api/keeper`);
    const json = await res.json();
    if (json.success) {
      return JSON.stringify({
        action: json.data.decision?.action,
        reason: json.data.decision?.reason,
        sentiment: json.data.sentiment,
        shouldExecute: json.data.decision?.action !== "HOLD",
      });
    }
    return JSON.stringify({ error: "Keeper engine failed", action: "HOLD" });
  } catch (e: any) {
    return JSON.stringify({ error: e.message, action: "HOLD" });
  }
}

// ── Build tools object (using AI SDK v6 tool format) ──

function buildTools() {
  // Use type assertion for AI SDK v6 / zod 4 compatibility
  const toolDef = (opts: {
    description: string;
    inputSchema: any;
    execute: any;
  }) => opts as any;

  return {
    analyze_sentiment: toolDef({
      description:
        "Analyze current crypto market sentiment using HBAR price, Fear & Greed Index, volatility, and news. Returns score from -100 (bearish) to +100 (bullish).",
      inputSchema: z.object({ trigger: z.string().optional() }),
      execute: async () => execAnalyzeSentiment(),
    }),

    get_bonzo_markets: toolDef({
      description:
        "Fetch live Bonzo Finance lending market data — asset APYs, utilization, prices, liquidity.",
      inputSchema: z.object({ trigger: z.string().optional() }),
      execute: async () => execGetBonzoMarkets(),
    }),

    get_vault_data: toolDef({
      description:
        "Fetch live Bonzo Vault data — APYs, TVLs, strategies, price per share.",
      inputSchema: z.object({ trigger: z.string().optional() }),
      execute: async () => execGetVaultData(),
    }),

    get_defi_knowledge: toolDef({
      description:
        "Retrieve DeFi strategy knowledge from RAG base — lending loops, health factors, vault strategies, risk management.",
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }: { query: string }) =>
        execGetDefiKnowledge(query),
    }),

    check_portfolio: toolDef({
      description:
        "Check a user's Bonzo Finance portfolio — supplied, borrowed, health factor.",
      inputSchema: z.object({ accountId: z.string() }),
      execute: async ({ accountId }: { accountId: string }) =>
        execCheckPortfolio(accountId),
    }),

    make_keeper_decision: toolDef({
      description:
        "Run VaultMind keeper decision engine. Analyzes sentiment + volatility + portfolio to recommend HOLD/HARVEST/EXIT_TO_STABLE/INCREASE_POSITION. Dry run only.",
      inputSchema: z.object({ trigger: z.string().optional() }),
      execute: async () => execKeeperDecision(),
    }),
  };
}

const TOOL_NAMES = [
  "analyze_sentiment",
  "get_bonzo_markets",
  "get_vault_data",
  "get_defi_knowledge",
  "check_portfolio",
  "make_keeper_decision",
];

// ── Chat function — Vercel AI SDK v6 ──

export async function chatVercel(
  message: string,
  threadId: string = "default",
  context?: MarketContext
): Promise<AgentResponse> {
  const history = getHistory(threadId);

  // Build context string
  let contextStr = "";
  if (context) {
    const parts: string[] = ["\n--- LIVE MARKET CONTEXT ---"];
    if (context.hbarPrice)
      parts.push(
        `HBAR: $${context.hbarPrice.toFixed(4)} (${
          context.hbarChange24h
            ? (context.hbarChange24h >= 0 ? "+" : "") +
              context.hbarChange24h.toFixed(2) +
              "%"
            : ""
        })`
      );
    if (context.sentiment)
      parts.push(
        `Sentiment: ${context.sentiment.score} (${context.sentiment.signal}) — ${context.sentiment.reasoning}`
      );
    if (context.fearGreedIndex !== undefined)
      parts.push(
        `Fear & Greed: ${context.fearGreedIndex} (${
          context.fearGreedLabel || ""
        })`
      );
    if (context.volatility !== undefined)
      parts.push(`Volatility: ${context.volatility.toFixed(0)}% annualized`);
    if (context.topYields?.length)
      parts.push(
        `Top Yields: ${context.topYields
          .slice(0, 5)
          .map((y) => `${y.symbol}: ${y.supplyAPY.toFixed(2)}%`)
          .join(", ")}`
      );
    if (context.portfolio)
      parts.push(
        `Portfolio: $${context.portfolio.totalSuppliedUSD.toFixed(
          2
        )} supplied, $${context.portfolio.totalBorrowedUSD.toFixed(
          2
        )} borrowed, HF: ${context.portfolio.healthFactor.toFixed(2)}`
      );
    parts.push("---");
    contextStr = parts.join("\n");
  }

  const fullMessage = message + contextStr;

  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    ...history.slice(-10),
    { role: "user" as const, content: fullMessage },
  ];

  console.log(
    `[Vercel AI] Processing: "${message.substring(0, 80)}" (history: ${
      history.length
    } msgs)`
  );

  const startTime = Date.now();
  const tools = buildTools();

  try {
    const result = await generateText({
      model: openai("gpt-4o"),
      system: SYSTEM_PROMPT,
      messages,
      tools: tools as any,
      stopWhen: stepCountIs(5),
      temperature: 0.1,
    });

    const elapsed = Date.now() - startTime;
    const rawText = result.text;

    // Track tool calls from steps
    const toolCalls: Array<{ tool: string; input: string; output: string }> =
      [];
    for (const step of result.steps || []) {
      if (step.toolCalls) {
        for (const tc of step.toolCalls as any[]) {
          toolCalls.push({
            tool: tc.toolName,
            input: JSON.stringify(tc.input ?? tc.args ?? {}).substring(0, 300),
            output: "",
          });
        }
      }
      if (step.toolResults) {
        for (const tr of step.toolResults as any[]) {
          const existing = toolCalls.find(
            (tc) => tc.tool === tr.toolName && tc.output === ""
          );
          if (existing) {
            existing.output = JSON.stringify(
              tr.output ?? tr.result ?? ""
            ).substring(0, 500);
          }
        }
      }
    }

    // Parse structured JSON from response
    let parsed: any = null;
    try {
      let jsonStr = rawText.trim();
      if (jsonStr.startsWith("```")) {
        jsonStr = jsonStr
          .replace(/^```(?:json)?\n?/, "")
          .replace(/\n?```$/, "");
      }
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start !== -1 && end !== -1 && end > start) {
        parsed = JSON.parse(jsonStr.substring(start, end + 1));
      }
    } catch {
      console.warn(
        "[Vercel AI] Could not parse structured JSON, using raw text"
      );
    }

    const agentResponse: AgentResponse = {
      response: parsed?.response || rawText,
      action: parsed?.action || null,
      params: parsed?.params || {},
      suggestions: Array.isArray(parsed?.suggestions)
        ? parsed.suggestions.slice(0, 3)
        : [],
      charts: Array.isArray(parsed?.charts) ? parsed.charts : [],
      toolCalls,
    };

    // Update conversation history
    history.push({ role: "user", content: message });
    history.push({ role: "assistant", content: agentResponse.response });
    if (history.length > 30) history.splice(0, history.length - 20);

    console.log(
      `[Vercel AI] Done in ${elapsed}ms | action: ${
        agentResponse.action || "none"
      } | tools: ${
        toolCalls.length
      } | suggestions: [${agentResponse.suggestions.join(", ")}]`
    );

    return agentResponse;
  } catch (error: any) {
    const elapsed = Date.now() - startTime;
    console.error(`[Vercel AI] Error after ${elapsed}ms:`, error.message);
    if (error.message?.includes("API key"))
      throw new Error("OpenAI API key invalid. Check OPENAI_API_KEY.");
    if (error.message?.includes("rate limit"))
      throw new Error("Rate limited by OpenAI. Wait and retry.");
    throw error;
  }
}

// ── Provider info ──

export function getVercelProviderInfo() {
  return {
    provider: "vercel-ai-sdk",
    model: "gpt-4o",
    version: "6.x",
    tools: TOOL_NAMES,
    features: [
      "generateText with multi-step tool calling",
      "stepCountIs(5) agentic loop control",
      "Conversation memory (in-memory per session)",
      "Structured JSON output parsing",
      "Real-time sentiment analysis tool",
      "Bonzo market data tool",
      "Vault data tool",
      "RAG knowledge base tool",
      "Portfolio checking tool",
      "Keeper decision engine tool",
    ],
  };
}
