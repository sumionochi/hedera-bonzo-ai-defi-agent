import { NextRequest, NextResponse } from "next/server";
import {
  chat as chatLangChain,
  getToolNames,
  type MarketContext,
} from "@/lib/agent";
import { chatVercel, getVercelProviderInfo } from "@/lib/agent-vercel";
import { analyzeSentiment } from "@/lib/sentiment";
import { getBonzoMarkets } from "@/lib/bonzo";
import { buildRAGContext } from "@/lib/rag";
import { getVaultsWithLiveData, getVaultsSummary } from "@/lib/bonzo-vaults";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ── AI Provider selection ──
// Set AI_PROVIDER=vercel or AI_PROVIDER=langchain in .env.local
// Can also be overridden per-request via body.provider

type AIProvider = "langchain" | "vercel";

function getProvider(requestOverride?: string): AIProvider {
  const override = requestOverride?.toLowerCase();
  if (override === "vercel" || override === "langchain") return override;
  const env = (process.env.AI_PROVIDER || "langchain").toLowerCase();
  return env === "vercel" ? "vercel" : "langchain";
}

/**
 * Gather live market context to inject into agent conversations.
 * Both providers use the same context format.
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
    const {
      message,
      threadId,
      connectedAccount,
      strategyConfig,
      provider: providerOverride,
    } = body;

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

    // Select AI provider
    const activeProvider = getProvider(providerOverride);
    console.log(`[API/agent] Provider: ${activeProvider}`);

    // Gather live context
    const context = await gatherContext();

    // Inject wallet + RAG + vault + strategy context
    const userAccountId = connectedAccount || process.env.HEDERA_ACCOUNT_ID;
    const walletContext = `\n\n[USER WALLET]\nThe user's connected wallet is ${userAccountId}. When analyzing portfolio, positions, balances, or account data, ALWAYS use account ${userAccountId} — NOT the operator account.`;

    const ragContext = buildRAGContext(message);

    let vaultContext = "";
    try {
      const vaults = await getVaultsWithLiveData();
      vaultContext = "\n\n[BONZO VAULT LIVE DATA]\n" + getVaultsSummary(vaults);
    } catch {}

    let strategyContext = "";
    if (strategyConfig) {
      strategyContext =
        `\n\n[ACTIVE STRATEGY CONFIG]\nKeeper parameters:\n` +
        `• Bearish threshold: ${strategyConfig.bearishThreshold}\n` +
        `• Bullish threshold: ${strategyConfig.bullishThreshold}\n` +
        `• Confidence minimum: ${(
          strategyConfig.confidenceMinimum * 100
        ).toFixed(0)}%\n` +
        `• HF danger: ${strategyConfig.healthFactorDanger}\n` +
        `• HF target: ${strategyConfig.healthFactorTarget}\n` +
        `• High volatility threshold: ${strategyConfig.highVolatilityThreshold}%\n` +
        `• Min yield differential: ${strategyConfig.minYieldDifferential}%\n` +
        `Reference these thresholds when explaining decisions.`;
    }

    const enrichedMessage = [
      message,
      walletContext,
      ragContext,
      vaultContext,
      strategyContext,
    ]
      .filter(Boolean)
      .join("\n");

    // ── Route to selected provider ──
    let result;
    if (activeProvider === "vercel") {
      result = await chatVercel(
        enrichedMessage,
        threadId || "default",
        context
      );
    } else {
      result = await chatLangChain(
        enrichedMessage,
        threadId || "default",
        context
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        action: result.action,
        params: result.params,
        suggestions: result.suggestions,
        charts: result.charts,
        toolCalls: result.toolCalls,
        threadId: threadId || "default",
        provider: activeProvider,
        tools:
          activeProvider === "vercel"
            ? getVercelProviderInfo().tools
            : getToolNames(),
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
      { success: false, error: error.message || "Agent error" },
      { status: 500 }
    );
  }
}

// GET — shows status for active provider
export async function GET() {
  try {
    const activeProvider = getProvider();

    if (activeProvider === "vercel") {
      const info = getVercelProviderInfo();
      return NextResponse.json({
        success: true,
        data: {
          status: "ready",
          provider: "vercel-ai-sdk",
          model: info.model,
          sdkVersion: info.version,
          toolCount: info.tools.length,
          tools: info.tools,
          features: info.features,
          network: process.env.HEDERA_NETWORK || "testnet",
          operator: process.env.HEDERA_ACCOUNT_ID || "not set",
          hasOpenAI: !!process.env.OPENAI_API_KEY,
        },
      });
    }

    const tools = getToolNames();
    return NextResponse.json({
      success: true,
      data: {
        status: tools.length > 0 ? "ready" : "not_initialized",
        provider: "langchain",
        model: "gpt-4o",
        toolCount: tools.length,
        tools,
        network: process.env.HEDERA_NETWORK || "testnet",
        operator: process.env.HEDERA_ACCOUNT_ID || "not set",
        hasOpenAI: !!process.env.OPENAI_API_KEY,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
