import { NextRequest, NextResponse } from "next/server";
import { chat, getToolNames, type MarketContext } from "@/lib/agent";
import { analyzeSentiment } from "@/lib/sentiment";
import { getBonzoMarkets } from "@/lib/bonzo";
import { buildRAGContext } from "@/lib/rag";
import { getVaultsWithLiveData, getVaultsSummary } from "@/lib/bonzo-vaults";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Gather live market context to inject into agent conversations.
 * This makes the agent aware of current conditions without extra tool calls.
 */
async function gatherContext(): Promise<MarketContext> {
  const ctx: MarketContext = {};

  try {
    const [sentimentResult, marketsResult] = await Promise.allSettled([
      analyzeSentiment(),
      getBonzoMarkets(),
    ]);

    if (sentimentResult.status === "fulfilled") {
      const s = sentimentResult.value;
      ctx.sentiment = {
        score: s.score,
        signal: s.signal,
        confidence: s.confidence,
        reasoning: s.reasoning,
      };
      ctx.hbarPrice = s.dataPoints.hbarPrice;
      ctx.hbarChange24h = s.dataPoints.hbarChange24h;
      ctx.fearGreedIndex = s.dataPoints.fearGreedIndex;
      ctx.fearGreedLabel = s.dataPoints.fearGreedLabel;
      ctx.volatility = s.dataPoints.volatility;
    }

    if (marketsResult.status === "fulfilled") {
      const reserves = marketsResult.value.reserves || [];
      ctx.topYields = reserves
        .filter((r: any) => r.active && !r.frozen && r.supplyAPY > 0)
        .sort((a: any, b: any) => b.supplyAPY - a.supplyAPY)
        .slice(0, 5)
        .map((r: any) => ({ symbol: r.symbol, supplyAPY: r.supplyAPY }));
    }
  } catch (err: any) {
    console.warn("[API/agent] Context gathering partial failure:", err.message);
  }

  return ctx;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, threadId, connectedAccount } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hedera credentials not configured. Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env.local",
        },
        { status: 500 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OpenAI API key not configured. Set OPENAI_API_KEY in .env.local",
        },
        { status: 500 }
      );
    }

    // Gather live context in parallel with nothing (fast, cached)
    const context = await gatherContext();

    // Inject the user's connected wallet so the agent analyzes the right account
    // The operator (HEDERA_ACCOUNT_ID) is for signing transactions
    // The connectedAccount is the user's actual wallet to analyze
    const userAccountId = connectedAccount || process.env.HEDERA_ACCOUNT_ID;
    const walletContext = `\n\n[USER WALLET]\nThe user's connected wallet is ${userAccountId}. When analyzing portfolio, positions, balances, or account data, ALWAYS use account ${userAccountId} — NOT the operator account. The operator account is only for signing transactions.`;

    // Inject RAG knowledge base context for DeFi strategy questions
    const ragContext = buildRAGContext(message);

    // Inject Bonzo Vault data for vault-related queries
    let vaultContext = "";
    try {
      const vaults = await getVaultsWithLiveData();
      vaultContext = "\n\n[BONZO VAULT LIVE DATA]\n" + getVaultsSummary(vaults);
    } catch {}

    // Enhance message with wallet identity + RAG + vault context
    const enrichedMessage = [message, walletContext, ragContext, vaultContext]
      .filter(Boolean)
      .join("\n");

    const result = await chat(enrichedMessage, threadId || "default", context);

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        toolCalls: result.toolCalls,
        threadId: threadId || "default",
        tools: getToolNames(),
        sentiment: context.sentiment
          ? {
              score: context.sentiment.score,
              signal: context.sentiment.signal,
              confidence: context.sentiment.confidence,
            }
          : undefined,
      },
    });
  } catch (error: any) {
    console.error("[API/agent] Error:", error.message);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Agent error",
      },
      { status: 500 }
    );
  }
}

// GET endpoint to check agent status and list tools
export async function GET() {
  try {
    const tools = getToolNames();

    return NextResponse.json({
      success: true,
      data: {
        status: tools.length > 0 ? "ready" : "not_initialized",
        toolCount: tools.length,
        tools,
        network: process.env.HEDERA_NETWORK || "testnet",
        operator: process.env.HEDERA_ACCOUNT_ID || "not set",
        hasOpenAI: !!process.env.OPENAI_API_KEY,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
      },
      { status: 500 }
    );
  }
}
