"use client";

import { useState, useEffect, useRef } from "react";
import {
  Brain,
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Activity,
  Zap,
  ChevronRight,
  Loader2,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Bot,
  User,
  ExternalLink,
} from "lucide-react";

// ============================================
// Types
// ============================================

interface MarketReserve {
  symbol: string;
  supplyAPY: number;
  borrowAPY: number;
  utilizationRate: number;
  priceUSD: number;
  totalSupply: string;
  isActive: boolean;
}

interface SentimentData {
  score: number;
  signal: "HARVEST_NOW" | "HOLD" | "ACCUMULATE";
  confidence: number;
  reasoning: string;
  dataPoints: {
    hbarPrice: number;
    hbarChange24h: number;
    fearGreedIndex: number;
    fearGreedLabel: string;
    newsCount: number;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; output: string }[];
  timestamp: Date;
}

// ============================================
// Main Page
// ============================================

export default function Home() {
  const [markets, setMarkets] = useState<MarketReserve[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to VaultMind! I'm your AI DeFi keeper agent on Hedera. I can monitor Bonzo Finance markets, analyze sentiment, and manage vault positions autonomously. Try asking me:\n\n• \"What are the current Bonzo market rates?\"\n• \"What's the market sentiment right now?\"\n• \"Should I deposit HBAR into Bonzo?\"\n• \"Check my HBAR balance\"",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch real market data on load
  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(fetchMarketData, 60_000); // refresh every 60s
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function fetchMarketData() {
    try {
      setMarketError(null);
      const res = await fetch("/api/market");
      const json = await res.json();
      if (json.success) {
        setMarkets(json.data.markets || []);
        setSentiment(json.data.sentiment || null);
      } else {
        setMarketError(json.error || "Failed to fetch market data");
      }
    } catch (err: any) {
      setMarketError(err.message || "Network error");
    } finally {
      setMarketLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          threadId: "vaultmind-session",
        }),
      });

      const json = await res.json();

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: json.success
          ? json.data.response
          : `Error: ${json.error}`,
        toolCalls: json.data?.toolCalls,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `Connection error: ${err.message}. Make sure you've set up your .env.local with HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY.`,
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  // ============================================
  // Render
  // ============================================

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800/60 bg-gray-950/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">
                Vault<span className="text-emerald-400">Mind</span>
              </h1>
              <p className="text-[11px] text-gray-500 -mt-0.5">
                AI Keeper Agent • Hedera Testnet
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-900 rounded-full px-3 py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-dot" />
              Live
            </div>
            <a
              href="https://testnet.bonzo.finance"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
            >
              Bonzo Testnet <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left: Dashboard Panels */}
          <div className="lg:col-span-1 space-y-4">
            {/* Sentiment Card */}
            <SentimentCard sentiment={sentiment} loading={marketLoading} />

            {/* Market Overview */}
            <MarketCard
              markets={markets}
              loading={marketLoading}
              error={marketError}
            />

            {/* Agent Status */}
            <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-medium text-gray-300">
                  Agent Status
                </h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Mode</span>
                  <span className="text-emerald-400 font-medium">
                    Autonomous
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Network</span>
                  <span className="text-gray-300">Hedera Testnet</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Protocol</span>
                  <span className="text-gray-300">Bonzo Finance</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Audit</span>
                  <span className="text-gray-300">HCS On-Chain</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Chat Interface */}
          <div className="lg:col-span-2 flex flex-col rounded-xl border border-gray-800/60 bg-gray-900/20 overflow-hidden min-h-[600px]">
            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-800/40 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-300">
                Chat with VaultMind
              </span>
              <span className="ml-auto text-[10px] text-gray-600">
                Powered by Hedera Agent Kit + Bonzo Plugin
              </span>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Brain className="w-4 h-4 text-emerald-400" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-emerald-600/20 text-gray-200 border border-emerald-500/20"
                        : "bg-gray-800/50 text-gray-300 border border-gray-700/30"
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-700/30">
                        <p className="text-[10px] text-gray-500 mb-1">
                          Tools used:
                        </p>
                        {msg.toolCalls.map((tc, i) => (
                          <span
                            key={i}
                            className="inline-block text-[10px] bg-gray-700/40 text-gray-400 rounded px-1.5 py-0.5 mr-1 mb-1"
                          >
                            {tc.tool}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-7 h-7 rounded-lg bg-gray-700/50 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <User className="w-4 h-4 text-gray-400" />
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                    <Brain className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="bg-gray-800/50 border border-gray-700/30 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Analyzing markets & executing...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-4 py-3 border-t border-gray-800/40">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask VaultMind anything about your vaults..."
                  className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
                  disabled={isLoading}
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <div className="flex gap-2 mt-2">
                {[
                  "Check market rates",
                  "Analyze sentiment",
                  "Check my balance",
                  "Deposit 100 HBAR",
                ].map((q) => (
                  <button
                    key={q}
                    onClick={() => {
                      setInput(q);
                    }}
                    className="text-[11px] text-gray-500 hover:text-gray-300 bg-gray-800/40 hover:bg-gray-800/60 rounded-full px-3 py-1 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ============================================
// Sentiment Card Component
// ============================================

function SentimentCard({
  sentiment,
  loading,
}: {
  sentiment: SentimentData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-400">
            Loading sentiment...
          </h3>
        </div>
        <div className="h-16 animate-pulse bg-gray-800/40 rounded-lg" />
      </div>
    );
  }

  if (!sentiment) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <h3 className="text-sm text-yellow-400">Sentiment unavailable</h3>
        </div>
      </div>
    );
  }

  const signalColor =
    sentiment.signal === "HARVEST_NOW"
      ? "text-red-400"
      : sentiment.signal === "ACCUMULATE"
        ? "text-emerald-400"
        : "text-yellow-400";

  const SignalIcon =
    sentiment.signal === "HARVEST_NOW"
      ? TrendingDown
      : sentiment.signal === "ACCUMULATE"
        ? TrendingUp
        : Minus;

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            Market Sentiment
          </h3>
        </div>
        <div className={`flex items-center gap-1 text-xs font-medium ${signalColor}`}>
          <SignalIcon className="w-3.5 h-3.5" />
          {sentiment.signal.replace("_", " ")}
        </div>
      </div>

      {/* Score bar */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-gray-600 mb-1">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${((sentiment.score + 100) / 200) * 100}%`,
              background:
                sentiment.score < -25
                  ? "#ef4444"
                  : sentiment.score > 25
                    ? "#10b981"
                    : "#eab308",
            }}
          />
        </div>
        <div className="text-center text-xs text-gray-400 mt-1">
          Score: {sentiment.score} / Confidence: {(sentiment.confidence * 100).toFixed(0)}%
        </div>
      </div>

      {/* Data Points */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="bg-gray-800/40 rounded-lg px-3 py-2">
          <span className="text-gray-500">HBAR</span>
          <div className="text-gray-200 font-medium">
            ${sentiment.dataPoints.hbarPrice.toFixed(4)}
          </div>
          <span
            className={
              sentiment.dataPoints.hbarChange24h >= 0
                ? "text-emerald-400"
                : "text-red-400"
            }
          >
            {sentiment.dataPoints.hbarChange24h >= 0 ? "+" : ""}
            {sentiment.dataPoints.hbarChange24h.toFixed(2)}%
          </span>
        </div>
        <div className="bg-gray-800/40 rounded-lg px-3 py-2">
          <span className="text-gray-500">Fear & Greed</span>
          <div className="text-gray-200 font-medium">
            {sentiment.dataPoints.fearGreedIndex}
          </div>
          <span className="text-gray-400">
            {sentiment.dataPoints.fearGreedLabel}
          </span>
        </div>
      </div>

      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        {sentiment.reasoning}
      </p>
    </div>
  );
}

// ============================================
// Market Card Component
// ============================================

function MarketCard({
  markets,
  loading,
  error,
}: {
  markets: MarketReserve[];
  loading: boolean;
  error: string | null;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-400">
            Loading Bonzo markets...
          </h3>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-8 animate-pulse bg-gray-800/40 rounded"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-sm text-red-400">Market Error</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
      </div>
    );
  }

  const activeMarkets = markets.filter((m) => m.isActive);

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            Bonzo Markets
          </h3>
        </div>
        <span className="text-[10px] text-gray-500">
          {activeMarkets.length} active
        </span>
      </div>

      <div className="space-y-1">
        {/* Header */}
        <div className="grid grid-cols-4 text-[10px] text-gray-600 px-2 py-1">
          <span>Asset</span>
          <span className="text-right">Supply APY</span>
          <span className="text-right">Borrow APY</span>
          <span className="text-right">Util.</span>
        </div>

        {activeMarkets.slice(0, 8).map((m) => (
          <div
            key={m.symbol}
            className="grid grid-cols-4 text-xs px-2 py-1.5 hover:bg-gray-800/30 rounded transition-colors"
          >
            <span className="text-gray-300 font-medium">{m.symbol}</span>
            <span className="text-right text-emerald-400">
              {m.supplyAPY.toFixed(2)}%
            </span>
            <span className="text-right text-red-400">
              {m.borrowAPY.toFixed(2)}%
            </span>
            <span className="text-right text-gray-400">
              {m.utilizationRate.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
