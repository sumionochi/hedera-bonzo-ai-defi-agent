"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Brain,
  Send,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  Activity,
  Zap,
  Loader2,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Bot,
  User,
  ExternalLink,
  Play,
  Wallet,
  Clock,
  FileText,
  Pause,
  Timer,
} from "lucide-react";

// Recharts uses browser APIs — dynamic import with ssr: false
const Performancechart = dynamic(
  () => import("@/components/Performancechart"),
  { ssr: false }
);
const HCSTimeline = dynamic(
  () => import("@/components/HCSTimeline"),
  { ssr: false }
);

// Import chart detection (pure logic, no SSR issue)
import { detectCharts, type ChartType } from "@/components/InlineCharts";
// Dynamic import for chart rendering components
const InlineChartRenderer = dynamic(
  () => import("@/components/InlineCharts").then((mod) => ({
    default: mod.InlineChart,
  })),
  { ssr: false }
);
// Markdown renderer for beautiful agent messages
const MarkdownMessage = dynamic(
  () => import("@/components/MarkdownMessage"),
  { ssr: false }
);
// Gap closers: Wallet Connect, Transaction Modal, Thinking Steps, Strategy Config
const WalletConnect = dynamic(
  () => import("@/components/WalletConnect"),
  { ssr: false }
);
const TransactionModal = dynamic(
  () => import("@/components/TransactionModal"),
  { ssr: false }
);
const AgentThinking = dynamic(
  () => import("@/components/AgentThinking"),
  { ssr: false }
);
const StrategyConfigPanel = dynamic(
  () => import("@/components/StrategyConfig"),
  { ssr: false }
);
import type { PendingTransaction, TransactionResult } from "@/components/TransactionModal";
import type { PriceAlert } from "@/components/StrategyConfig";

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
    volatility?: number;
    volatilityTrend?: string;
  };
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: { tool: string; output: string }[];
  charts?: ChartType[];
  sentiment?: { score: number; signal: string; confidence: number };
  timestamp: Date;
}

interface UserPosition {
  symbol: string;
  supplied: number;
  suppliedUSD: number;
  borrowed: number;
  borrowedUSD: number;
  supplyAPY: number;
  borrowAPY: number;
  isCollateral: boolean;
}

interface PortfolioData {
  positions: UserPosition[];
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  netWorthUSD: number;
  healthFactor: number;
  averageNetAPY: number;
  note?: string;
}

interface KeeperDecision {
  action: string;
  reason: string;
  confidence: number;
  params?: Record<string, unknown>;
  timestamp: string;
}

interface KeeperResult {
  decision: KeeperDecision;
  vaultDecision?: {
    vaultId: string;
    action: string;
    reason: string;
    confidence: number;
    targetVaultId?: string;
  } | null;
  sentiment: { score: number; signal: string; reasoning: string };
  portfolio: PortfolioData | null;
  execution: { executed: boolean; agentResponse?: string; error?: string };
  hcsLog: {
    logged: boolean;
    topicId?: string;
    sequenceNumber?: number;
    error?: string;
  };
  durationMs: number;
  timestamp: string;
}

// ============================================
// Main Page
// ============================================

export default function Home() {
  const [markets, setMarkets] = useState<MarketReserve[]>([]);
  const [sentiment, setSentiment] = useState<SentimentData | null>(null);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [keeperResult, setKeeperResult] = useState<KeeperResult | null>(null);
  const [keeperHistory, setKeeperHistory] = useState<KeeperResult[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `### 👋 Welcome to **VaultMind**
  
  I'm your **AI DeFi Keeper Agent on Hedera**.  
  I continuously monitor **Bonzo Finance** and **SaucerSwap** markets, analyze sentiment, and manage vault positions autonomously.
  
  ---
  
  ### 🚀 Try asking me:
  
  - **“Show my portfolio breakdown”**  
    _Interactive pie chart_
  
  - **“How’s the market sentiment?”**  
    _Live Fear & Greed gauge_
  
  - **“Compare APYs across platforms”**  
    _Bonzo vs SaucerSwap_
  
  - **“Show correlation matrix”**  
    _Asset correlation heat map_
  
  - **“Show risk vs return”**  
    _Scatter plot analysis_
  
  - **“Show DeFi opportunities”**  
    _Yield heat map_`,
      timestamp: new Date(),
    },
  ]);  
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [marketLoading, setMarketLoading] = useState(true);
  const [marketError, setMarketError] = useState<string | null>(null);
  const [keeperRunning, setKeeperRunning] = useState(false);
  const [positionsLoading, setPositionsLoading] = useState(true);

  // Auto-loop state
  const [autoLoop, setAutoLoop] = useState(false);
  const [loopInterval, setLoopInterval] = useState(5); // minutes
  const [countdown, setCountdown] = useState(0); // seconds remaining
  const loopTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<"chat" | "chart" | "audit">("chat");

  // Wallet connection state (Gap 1)
  const [connectedAccount, setConnectedAccount] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<any>(null);

  // Transaction confirmation state (Gap 2)
  const [pendingTx, setPendingTx] = useState<PendingTransaction | null>(null);
  const [lastTxResult, setLastTxResult] = useState<TransactionResult | null>(null);

  // Strategy config state (Gap 5)
  const [strategyConfig, setStrategyConfig] = useState({
    bearishThreshold: -30,
    bullishThreshold: 50,
    confidenceMinimum: 0.6,
    healthFactorDanger: 1.3,
    healthFactorTarget: 1.8,
    highVolatilityThreshold: 80,
    minYieldDifferential: 2.0,
  });
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);

  // Bonzo Vault state
  const [vaultData, setVaultData] = useState<any>(null);
  const [vaultLoading, setVaultLoading] = useState(true);

  // Fetch market data on load
  useEffect(() => {
    fetchMarketData();
    fetchPositions();
    fetchVaultData();
    const interval = setInterval(fetchMarketData, 60_000);
    const vaultInterval = setInterval(fetchVaultData, 120_000);
    return () => { clearInterval(interval); clearInterval(vaultInterval); };
  }, []);

  // Auto-scroll chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Auto-loop keeper
  const runKeeperForLoop = useCallback(async () => {
    if (keeperRunning) return;
    setKeeperRunning(true);
    try {
      const res = await fetch("/api/keeper?execute=false");
      const json = await res.json();
      if (json.success) {
        setKeeperResult(json.data);
        setKeeperHistory((prev) => [json.data, ...prev].slice(0, 20));
        // Propagate HCS topic ID
        if (json.data.hcsLog?.topicId && typeof window !== "undefined") {
          localStorage.setItem("vaultmind_hcs_topic", json.data.hcsLog.topicId);
        }
      }
    } catch (err: any) {
      console.error("Auto-keeper error:", err);
    } finally {
      setKeeperRunning(false);
    }
  }, [keeperRunning]);

  useEffect(() => {
    if (autoLoop) {
      // Run immediately on enable
      runKeeperForLoop();
      setCountdown(loopInterval * 60);

      // Set up loop
      loopTimerRef.current = setInterval(
        () => {
          runKeeperForLoop();
          setCountdown(loopInterval * 60);
        },
        loopInterval * 60 * 1000
      );

      // Countdown ticker
      countdownRef.current = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    } else {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
    }

    return () => {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [autoLoop, loopInterval, runKeeperForLoop]);

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

  async function fetchPositions(overrideAccountId?: string) {
    try {
      const acct = overrideAccountId || connectedAccount || "";
      const url = acct
        ? `/api/positions?accountId=${acct}`
        : "/api/positions";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setPortfolio(json.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch positions:", err);
    } finally {
      setPositionsLoading(false);
    }
  }

  async function fetchVaultData() {
    try {
      const res = await fetch("/api/vaults?action=list");
      const json = await res.json();
      if (json.success) {
        setVaultData(json.data);
      }
    } catch (err: any) {
      console.error("Failed to fetch vault data:", err);
    } finally {
      setVaultLoading(false);
    }
  }

  async function runKeeper(execute: boolean = false) {
    setKeeperRunning(true);
    try {
      // Use POST with custom strategy config
      const res = await fetch("/api/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: strategyConfig,
          execute: false, // Always dry-run first
        }),
      });
      const json = await res.json();
      if (json.success) {
        setKeeperResult(json.data);
        setKeeperHistory((prev) => [json.data, ...prev].slice(0, 20));

        // If user wanted execution AND action is not HOLD, show confirmation modal
        if (execute && json.data.decision.action !== "HOLD") {
          setPendingTx({
            id: Date.now().toString(),
            action: json.data.decision.action,
            description: json.data.decision.reason,
            details: {
              token: json.data.decision.params?.tokenSymbol || "HBAR",
              amount: json.data.decision.params?.amount || "auto",
              reason: json.data.decision.reason,
              confidence: json.data.decision.confidence,
              estimatedGas: "~$0.001",
            },
            source: "keeper",
            onApprove: async () => {
              // Actually execute now
              const execRes = await fetch("/api/keeper", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  config: strategyConfig,
                  execute: true,
                }),
              });
              const execJson = await execRes.json();
              if (execJson.success && execJson.data.execution?.executed) {
                fetchPositions();
                return { success: true, txId: execJson.data.execution?.txId };
              }
              return { success: false, error: execJson.data.execution?.error || "Execution failed" };
            },
            onReject: () => {},
          });
        } else if (execute && json.data.decision.action === "HOLD") {
          // HOLD action — no confirmation needed, just log
        }

        // Propagate HCS topic ID to localStorage for HCS Audit tab
        if (json.data.hcsLog?.topicId && typeof window !== "undefined") {
          localStorage.setItem("vaultmind_hcs_topic", json.data.hcsLog.topicId);
        }
      }
    } catch (err: any) {
      console.error("Keeper error:", err);
    } finally {
      setKeeperRunning(false);
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
          connectedAccount: connectedAccount || undefined,
        }),
      });

      const json = await res.json();

      // Only detect charts from USER QUERY — not the agent response
      // The agent response mentions "risk", "vault", "portfolio" in almost every
      // answer, causing unrelated charts to appear
      const detectedCharts = detectCharts(userMessage.content);

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: json.success
          ? json.data.response
          : `Error: ${json.error}`,
        toolCalls: json.data?.toolCalls,
        charts: detectedCharts.length > 0 ? detectedCharts : undefined,
        sentiment: json.data?.sentiment,
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
          <div className="flex items-center gap-3">
            {connectedAccount && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 rounded-full px-3 py-1.5">
                <Wallet className="w-3 h-3" />
                {connectedAccount}
              </div>
            )}
            {autoLoop && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 rounded-full px-3 py-1.5">
                <Timer className="w-3 h-3" />
                Next: {formatCountdown(countdown)}
              </div>
            )}
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
              Bonzo <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
          {/* Left: Dashboard Panels */}
          <div className="lg:col-span-1 space-y-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            {/* Wallet Connection (Gap 1) */}
            <WalletConnect
              connectedAccount={connectedAccount}
              onConnect={(id, data) => {
                setConnectedAccount(id);
                setWalletData(data);
                fetchPositions(id);
              }}
              onDisconnect={() => {
                setConnectedAccount(null);
                setWalletData(null);
              }}
            />

            {/* Keeper Controls */}
            <KeeperPanel
              result={keeperResult}
              running={keeperRunning}
              onRun={runKeeper}
              autoLoop={autoLoop}
              onToggleLoop={() => setAutoLoop(!autoLoop)}
              loopInterval={loopInterval}
              onSetInterval={setLoopInterval}
              countdown={countdown}
              historyCount={keeperHistory.length}
            />

            {/* Positions */}
            <PositionsCard portfolio={portfolio} loading={positionsLoading} />

            {/* Sentiment Card */}
            <SentimentCard sentiment={sentiment} loading={marketLoading} />

            {/* Bonzo Vaults */}
            <VaultCard data={vaultData} loading={vaultLoading} />

            {/* Market Overview */}
            <MarketCard
              markets={markets}
              loading={marketLoading}
              error={marketError}
            />

            {/* Decision History */}
            {keeperHistory.length > 0 && (
              <DecisionHistoryCard history={keeperHistory} />
            )}

            {/* Strategy Config (Gap 5 + Gap 4 Price Alerts) */}
            <StrategyConfigPanel
              config={strategyConfig}
              onConfigChange={setStrategyConfig}
              priceAlerts={priceAlerts}
              onAddAlert={(alert) => setPriceAlerts((prev) => [...prev, alert])}
              onRemoveAlert={(id) =>
                setPriceAlerts((prev) => prev.filter((a) => a.id !== id))
              }
              onToggleAlert={(id) =>
                setPriceAlerts((prev) =>
                  prev.map((a) =>
                    a.id === id ? { ...a, active: !a.active } : a
                  )
                )
              }
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
                    {autoLoop ? "Auto-Keeper" : "Manual"}
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
                <div className="flex justify-between">
                  <span className="text-gray-500">Decisions logged</span>
                  <span className="text-gray-300">{keeperHistory.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Tabbed Content */}
          <div className="lg:col-span-2 flex flex-col gap-0">
            {/* Tab Bar */}
            <div className="flex items-center gap-1 bg-gray-900/60 rounded-t-xl border border-b-0 border-gray-800/60 px-2 pt-2">
              {([
                { id: "chat", label: "Chat", icon: "💬" },
                { id: "chart", label: "Performance", icon: "📈" },
                { id: "audit", label: "HCS Audit", icon: "🔗" },
              ] as const).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-4 py-2 rounded-t-lg transition-colors ${
                    activeTab === tab.id
                      ? "bg-gray-800/80 text-emerald-400 border border-b-0 border-gray-700/50"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  <span className="text-sm">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="rounded-b-xl rounded-tr-xl border border-gray-800/60 bg-gray-900/20 overflow-hidden flex-1">
              {/* Chat Tab */}
              {activeTab === "chat" && (
                <div className="flex flex-col h-[calc(100vh-140px)]">            {/* Chat Header */}
            <div className="px-4 py-3 border-b border-gray-800/40 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-400" />
              <span className="text-sm font-medium text-gray-300">
                Chat with VaultMind
              </span>
              <span className="ml-auto text-[10px] text-gray-600">
                Context-aware • Hedera Agent Kit + Bonzo Plugin
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
                    className={`rounded-xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "max-w-[75%] bg-emerald-600/20 text-gray-200 border border-emerald-500/20"
                        : `${msg.charts?.length ? "max-w-[95%] w-full" : "max-w-[85%]"} bg-gray-800/50 text-gray-300 border border-gray-700/30`
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <MarkdownMessage content={msg.content} />
                    ) : (
                      <div className="whitespace-pre-wrap">{msg.content}</div>
                    )}
                    {/* Inline Charts — full width */}
                    {msg.charts && msg.charts.length > 0 && (
                      <div className="mt-3 -mx-1 space-y-3">
                        {msg.charts.map((chartType) => (
                          <InlineChartRenderer
                            key={chartType}
                            type={chartType}
                            sentiment={msg.sentiment}
                          />
                        ))}
                      </div>
                    )}
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

              {isLoading && <AgentThinking />}

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
              <div className="flex gap-2 mt-2 flex-wrap">
                {getDynamicSuggestions(messages, portfolio, keeperResult, connectedAccount, sentiment).map((q) => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="text-[11px] text-gray-500 hover:text-gray-300 bg-gray-800/40 hover:bg-gray-800/60 rounded-full px-3 py-1 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
              </div>
              )}

              {/* Chart Tab */}
              {activeTab === "chart" && (
                <div className="p-4">
                  <Performancechart />
                </div>
              )}

              {/* Audit Tab */}
              {activeTab === "audit" && (
                <div className="p-4">
                  <HCSTimeline />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Transaction Confirmation Modal (Gap 2) */}
      {pendingTx && (
        <TransactionModal
          transaction={pendingTx}
          onClose={() => setPendingTx(null)}
          onResult={(result) => {
            setLastTxResult(result);
            setPendingTx(null);
            // Auto-clear toast after 8 seconds
            setTimeout(() => setLastTxResult(null), 8000);
          }}
        />
      )}

      {/* Transaction Result Toast */}
      {lastTxResult && (
        <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
          <div
            className={`rounded-xl border px-4 py-3 shadow-2xl backdrop-blur-sm flex items-center gap-3 ${
              lastTxResult.success
                ? "bg-emerald-900/90 border-emerald-500/30 text-emerald-300"
                : "bg-red-900/90 border-red-500/30 text-red-300"
            }`}
          >
            {lastTxResult.success ? (
              <CheckCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            )}
            <div className="text-xs">
              <p className="font-medium">
                {lastTxResult.action.replace(/_/g, " ")}{" "}
                {lastTxResult.success ? "Executed" : "Failed"}
              </p>
              {lastTxResult.txId && (
                <a
                  href={`https://hashscan.io/testnet/transaction/${lastTxResult.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 mt-0.5"
                >
                  View on HashScan <ExternalLink className="w-3 h-3" />
                </a>
              )}
              {lastTxResult.error && (
                <p className="text-red-400 mt-0.5">{lastTxResult.error}</p>
              )}
            </div>
            <button
              onClick={() => setLastTxResult(null)}
              className="text-gray-500 hover:text-gray-300 ml-2"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ──

/** Dynamic context-aware suggestions — analyzes actual chat content + app state */
function getDynamicSuggestions(
  messages: ChatMessage[],
  portfolio?: PortfolioData | null,
  keeperResult?: KeeperResult | null,
  connectedAccount?: string | null,
  sentiment?: SentimentData | null
): string[] {
  const lastAssistant = [...messages]
    .reverse()
    .find((m) => m.role === "assistant");
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastContent = (lastAssistant?.content || "").toLowerCase();
  const lastUserContent = (lastUser?.content || "").toLowerCase();
  const lastCharts = lastAssistant?.charts || [];
  const msgCount = messages.length;

  const suggestions: string[] = [];

  // ── If no wallet connected, always suggest connecting first ──
  if (!connectedAccount && msgCount <= 2) {
    return [
      "Show me the best yields on Hedera",
      "How's the market sentiment?",
      "What DeFi strategies work on Hedera?",
    ];
  }

  // ── React to what charts were just shown ──
  if (lastCharts.includes("portfolio")) {
    suggestions.push(
      "Show correlation between these assets",
      "What's my risk/return profile?",
      "How can I optimize this allocation?"
    );
  }
  if (lastCharts.includes("sentiment")) {
    suggestions.push(
      "Should I adjust my positions based on this?",
      "Show the DeFi heat map",
      "What would the keeper recommend?"
    );
  }
  if (lastCharts.includes("apycompare")) {
    suggestions.push(
      "Deposit into the highest yield",
      "Explain the risk differences",
      "Show DeFi opportunities heat map"
    );
  }
  if (lastCharts.includes("correlation")) {
    suggestions.push(
      "Which assets should I diversify into?",
      "Show risk vs return scatter",
      "How does impermanent loss affect my LP?"
    );
  }
  if (lastCharts.includes("heatmap")) {
    suggestions.push(
      "What's the safest opportunity?",
      "Compare the top 3 yields",
      "Deposit into the best option"
    );
  }
  if (lastCharts.includes("riskreturn")) {
    suggestions.push(
      "Which asset has the best Sharpe ratio?",
      "How do I reduce my portfolio risk?",
      "Set up a balanced portfolio"
    );
  }
  if (lastCharts.includes("ohlcv")) {
    suggestions.push(
      "Set a price alert for HBAR",
      "What's the support/resistance?",
      "Show market sentiment"
    );
  }
  if (suggestions.length > 0) return suggestions.slice(0, 3);

  // ── React to assistant response topics ──
  if (lastContent.includes("deposit") || lastContent.includes("supplied")) {
    suggestions.push("Check my health factor", "Run keeper to monitor", "What are the risks?");
  } else if (lastContent.includes("borrow") || lastContent.includes("loan")) {
    suggestions.push("What's my liquidation price?", "Should I repay some debt?", "Show health factor");
  } else if (lastContent.includes("swap") || lastContent.includes("exchange")) {
    suggestions.push("Show price chart", "Best time to swap?", "Compare rates across DEXs");
  } else if (lastContent.includes("yield") || lastContent.includes("apy") || lastContent.includes("earn")) {
    suggestions.push("Compare all yields", "What's the lending loop strategy?", "Show heat map");
  } else if (lastContent.includes("risk") || lastContent.includes("danger") || lastContent.includes("liquidat")) {
    suggestions.push("How do I reduce risk?", "Set up price alerts", "Run keeper for safety check");
  } else if (lastContent.includes("strategy") || lastContent.includes("recommend")) {
    suggestions.push("Execute this strategy", "Show risk/return trade-off", "Compare alternatives");
  } else if (lastContent.includes("keeper") || lastContent.includes("autonomous")) {
    suggestions.push("Start auto-keeper loop", "Show decision history", "Adjust strategy thresholds");
  } else if (lastContent.includes("staking") || lastContent.includes("infinity")) {
    suggestions.push("How much can I earn staking?", "SAUCE vs HBARX staking?", "Show staking yields");
  } else if (lastContent.includes("impermanent loss") || lastContent.includes("concentrated")) {
    suggestions.push("Calculate my IL exposure", "When should I exit LP?", "Show correlation matrix");
  } else if (lastContent.includes("vault") || lastContent.includes("beefy") || lastContent.includes("clm")) {
    suggestions.push("Compare all Bonzo Vault APYs", "Which vault is best for me?", "Explain the leveraged HBARX vault");
  } else if (lastContent.includes("harvest") || lastContent.includes("compound")) {
    suggestions.push("Should I harvest now or wait?", "What's the optimal harvest timing?", "Show vault comparison");
  } else if (lastContent.includes("leverag") || lastContent.includes("hbarx vault") || lastContent.includes("lst")) {
    suggestions.push("Show leveraged LST vault risks", "What if HBAR borrow rate rises?", "Compare vault vs direct lending");
  }
  if (suggestions.length > 0) return suggestions.slice(0, 3);

  // ── React to keeper state ──
  if (keeperResult) {
    const action = keeperResult.decision.action;
    if (action === "HOLD") {
      suggestions.push("Why is the keeper holding?", "Show market sentiment", "What would trigger action?");
    } else if (action === "HARVEST" || action === "EXIT_TO_STABLE") {
      suggestions.push("Execute the harvest now", "What's the market outlook?", "Show my positions");
    } else if (action === "INCREASE_POSITION") {
      suggestions.push("Execute the deposit", "What's the target allocation?", "Show risk analysis");
    } else if (action === "REPAY_DEBT") {
      suggestions.push("Execute repayment now", "Show health factor history", "How much to repay?");
    }
    if (suggestions.length > 0) return suggestions.slice(0, 3);
  }

  // ── React to sentiment ──
  if (sentiment) {
    const score = sentiment.score;
    if (score < -30) {
      suggestions.push("Should I exit positions?", "What's driving bearish sentiment?", "Set up protective alerts");
    } else if (score > 50) {
      suggestions.push("Best yield opportunities now", "Should I increase positions?", "Show bullish strategies");
    }
    if (suggestions.length > 0) return suggestions.slice(0, 3);
  }

  // ── React to portfolio state ──
  if (portfolio && portfolio.positions.length > 0) {
    if (portfolio.healthFactor < 1.5) {
      suggestions.push("How do I improve my health factor?", "Should I repay some debt?", "Run keeper safety check");
    } else {
      suggestions.push("Show my portfolio breakdown", "Compare yield opportunities", "Run keeper analysis");
    }
    return suggestions.slice(0, 3);
  }

  // ── Conversation depth phases ──
  if (msgCount <= 2) {
    return ["Show my portfolio breakdown", "Compare Bonzo Vault APYs", "How's the market sentiment?"];
  }
  if (msgCount <= 5) {
    return ["Which vault is best for safe yield?", "Compare APYs across platforms", "Show DeFi heat map"];
  }
  if (msgCount <= 8) {
    return ["Show vault vs lending comparison", "What's the leveraged HBARX strategy?", "Run keeper dry run"];
  }
  if (msgCount <= 12) {
    return ["Deposit 100 HBAR into Bonzo", "Should I harvest vaults now?", "Start auto-keeper"];
  }
  return ["Compare vault harvest timing", "Where can I earn more?", "Show market sentiment"];
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ============================================
// Keeper Panel Component
// ============================================

function KeeperPanel({
  result,
  running,
  onRun,
  autoLoop,
  onToggleLoop,
  loopInterval,
  onSetInterval,
  countdown,
  historyCount,
}: {
  result: KeeperResult | null;
  running: boolean;
  onRun: (execute: boolean) => void;
  autoLoop: boolean;
  onToggleLoop: () => void;
  loopInterval: number;
  onSetInterval: (n: number) => void;
  countdown: number;
  historyCount: number;
}) {
  const actionColors: Record<string, string> = {
    HOLD: "text-yellow-400 bg-yellow-400/10 border-yellow-400/20",
    HARVEST: "text-red-400 bg-red-400/10 border-red-400/20",
    REPAY_DEBT: "text-red-400 bg-red-400/10 border-red-400/20",
    EXIT_TO_STABLE: "text-red-400 bg-red-400/10 border-red-400/20",
    REBALANCE: "text-blue-400 bg-blue-400/10 border-blue-400/20",
    INCREASE_POSITION:
      "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
  };

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">Keeper Engine</h3>
        </div>
        {running && (
          <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
        )}
      </div>

      {/* Auto-loop controls */}
      <div className="flex items-center gap-2 mb-3 p-2 bg-gray-800/40 rounded-lg">
        <button
          onClick={onToggleLoop}
          className={`flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1.5 rounded-md transition-colors ${
            autoLoop
              ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30"
              : "bg-gray-700/50 text-gray-400 border border-gray-600/30 hover:text-gray-300"
          }`}
        >
          {autoLoop ? (
            <Pause className="w-3 h-3" />
          ) : (
            <Timer className="w-3 h-3" />
          )}
          {autoLoop ? "Stop" : "Auto"}
        </button>
        <select
          value={loopInterval}
          onChange={(e) => onSetInterval(Number(e.target.value))}
          className="text-[11px] bg-gray-800 border border-gray-700/40 rounded-md px-2 py-1.5 text-gray-300 focus:outline-none"
        >
          <option value={1}>1 min</option>
          <option value={2}>2 min</option>
          <option value={5}>5 min</option>
          <option value={10}>10 min</option>
          <option value={15}>15 min</option>
        </select>
        {autoLoop && countdown > 0 && (
          <span className="text-[10px] text-gray-500 ml-auto">
            Next: {formatCountdown(countdown)}
          </span>
        )}
      </div>

      {/* Manual action buttons */}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => onRun(false)}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700/50 transition-colors disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          Dry Run
        </button>
        <button
          onClick={() => onRun(true)}
          disabled={running}
          className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 transition-colors disabled:opacity-50"
        >
          {running ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Zap className="w-3.5 h-3.5" />
          )}
          Execute
        </button>
      </div>

      {/* Last decision */}
      {result ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div
              className={`text-xs font-medium px-2.5 py-1.5 rounded-lg border inline-block ${
                actionColors[result.decision.action] ||
                "text-gray-400 bg-gray-800 border-gray-700"
              }`}
            >
              {result.decision.action}
            </div>
            <span className="text-[10px] text-gray-600">
              {new Date(result.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            {result.decision.reason}
          </p>
          <div className="flex items-center gap-3 text-[10px] text-gray-500">
            <span>
              Confidence: {(result.decision.confidence * 100).toFixed(0)}%
            </span>
            <span>•</span>
            <span>{result.durationMs}ms</span>
            {result.hcsLog.logged && (
              <>
                <span>•</span>
                <span className="text-emerald-400 flex items-center gap-0.5">
                  <CheckCircle className="w-3 h-3" />
                  HCS
                </span>
              </>
            )}
          </div>
          {result.execution.executed && result.execution.agentResponse && (
            <div className="mt-2 p-2 bg-gray-800/40 rounded-lg text-[11px] text-gray-400 border border-gray-700/30">
              <span className="text-emerald-400 font-medium">Agent: </span>
              {result.execution.agentResponse.substring(0, 200)}
              {result.execution.agentResponse.length > 200 ? "..." : ""}
            </div>
          )}
          {/* Vault Keeper Decision */}
          {result.vaultDecision && (
            <div className="mt-2 p-2.5 bg-purple-900/15 rounded-lg border border-purple-700/25">
              <div className="flex items-center gap-1.5 mb-1">
                <span className="text-xs">🏦</span>
                <span className="text-[10px] font-medium text-purple-400">Vault Keeper</span>
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                  result.vaultDecision.action === "HOLD"
                    ? "text-yellow-400 bg-yellow-400/10"
                    : result.vaultDecision.action === "HARVEST"
                    ? "text-orange-400 bg-orange-400/10"
                    : result.vaultDecision.action === "DEPOSIT"
                    ? "text-emerald-400 bg-emerald-400/10"
                    : result.vaultDecision.action === "SWITCH_VAULT"
                    ? "text-blue-400 bg-blue-400/10"
                    : "text-gray-400 bg-gray-400/10"
                }`}>
                  {result.vaultDecision.action}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed">
                {result.vaultDecision.reason.substring(0, 150)}
                {result.vaultDecision.reason.length > 150 ? "..." : ""}
              </p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-gray-600">
          Run the keeper to analyze markets and decide on actions. Enable Auto
          to run continuously.
        </p>
      )}
    </div>
  );
}

// ============================================
// Positions Card Component
// ============================================

function PositionsCard({
  portfolio,
  loading,
}: {
  portfolio: PortfolioData | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-400">
            Loading positions...
          </h3>
        </div>
        <div className="h-12 animate-pulse bg-gray-800/40 rounded-lg" />
      </div>
    );
  }

  const hasPositions =
    portfolio &&
    portfolio.positions.length > 0 &&
    (portfolio.totalSuppliedUSD > 0 || portfolio.totalBorrowedUSD > 0);

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            Bonzo Positions
          </h3>
        </div>
        {hasPositions && portfolio.healthFactor > 0 && (
          <HealthBadge value={portfolio.healthFactor} />
        )}
      </div>

      {!hasPositions ? (
        <div className="text-center py-3">
          <p className="text-xs text-gray-500">No active positions</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Deposit assets via chat or at{" "}
            <a
              href="https://testnet.bonzo.finance"
              className="text-emerald-400 hover:underline"
              target="_blank"
            >
              testnet.bonzo.finance
            </a>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="bg-gray-800/40 rounded-lg px-2.5 py-2">
              <span className="text-gray-500 text-[10px]">Supplied</span>
              <div className="text-emerald-400 font-medium">
                ${portfolio.totalSuppliedUSD.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-lg px-2.5 py-2">
              <span className="text-gray-500 text-[10px]">Borrowed</span>
              <div className="text-red-400 font-medium">
                ${portfolio.totalBorrowedUSD.toFixed(2)}
              </div>
            </div>
            <div className="bg-gray-800/40 rounded-lg px-2.5 py-2">
              <span className="text-gray-500 text-[10px]">Net APY</span>
              <div className="text-gray-200 font-medium">
                {portfolio.averageNetAPY.toFixed(2)}%
              </div>
            </div>
          </div>

          {portfolio.positions.map((pos) => (
            <div
              key={pos.symbol}
              className="flex items-center justify-between text-xs px-2 py-1.5 hover:bg-gray-800/30 rounded transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-gray-300 font-medium w-16">
                  {pos.symbol}
                </span>
                {pos.isCollateral && (
                  <span className="text-[9px] bg-emerald-500/10 text-emerald-400 rounded px-1 py-0.5">
                    collateral
                  </span>
                )}
              </div>
              <div className="text-right">
                {pos.supplied > 0 && (
                  <span className="text-emerald-400">
                    +{pos.supplied.toFixed(4)}
                  </span>
                )}
                {pos.borrowed > 0 && (
                  <span className="text-red-400 ml-2">
                    -{pos.borrowed.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HealthBadge({ value }: { value: number }) {
  let color = "text-emerald-400 bg-emerald-400/10";
  let label = "Healthy";

  if (value < 1.1) {
    color = "text-red-400 bg-red-400/10";
    label = "DANGER";
  } else if (value < 1.3) {
    color = "text-orange-400 bg-orange-400/10";
    label = "At Risk";
  } else if (value < 1.8) {
    color = "text-yellow-400 bg-yellow-400/10";
    label = "Moderate";
  }

  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${color}`}
    >
      HF: {value.toFixed(2)} • {label}
    </span>
  );
}

// ============================================
// Decision History Card
// ============================================

function DecisionHistoryCard({ history }: { history: KeeperResult[] }) {
  const actionIcons: Record<string, string> = {
    HOLD: "🟡",
    HARVEST: "🔴",
    REPAY_DEBT: "🔴",
    EXIT_TO_STABLE: "🔴",
    REBALANCE: "🔵",
    INCREASE_POSITION: "🟢",
  };

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-gray-300">Decision Log</h3>
        <span className="text-[10px] text-gray-500 ml-auto">
          {history.length} entries
        </span>
      </div>

      <div className="space-y-2 max-h-48 overflow-y-auto">
        {history.map((entry, i) => (
          <div
            key={i}
            className="flex gap-2 text-[11px] py-1.5 border-b border-gray-800/30 last:border-0"
          >
            <span className="flex-shrink-0 mt-0.5">
              {actionIcons[entry.decision.action] || "⚪"}
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-300">
                  {entry.decision.action}
                </span>
                <span className="text-gray-600">
                  {(entry.decision.confidence * 100).toFixed(0)}%
                </span>
                {entry.hcsLog.logged && (
                  <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                )}
              </div>
              <p className="text-gray-500 truncate">{entry.decision.reason}</p>
              <span className="text-gray-600 text-[10px]">
                {new Date(entry.timestamp).toLocaleTimeString()}
                {entry.hcsLog.topicId && <> • HCS: {entry.hcsLog.topicId}</>}
              </span>
            </div>
          </div>
        ))}
      </div>
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
        <div
          className={`flex items-center gap-1 text-xs font-medium ${signalColor}`}
        >
          <SignalIcon className="w-3.5 h-3.5" />
          {sentiment.signal.replace("_", " ")}
        </div>
      </div>

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
          Score: {sentiment.score} / Confidence:{" "}
          {(sentiment.confidence * 100).toFixed(0)}%
        </div>
      </div>

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

      {sentiment.dataPoints.volatility !== undefined && (
        <div className="mt-2 bg-gray-800/40 rounded-lg px-3 py-2 text-xs">
          <span className="text-gray-500">Volatility</span>
          <span className="text-gray-200 font-medium ml-2">
            {sentiment.dataPoints.volatility.toFixed(0)}% annualized
          </span>
          {sentiment.dataPoints.volatilityTrend && (
            <span className="text-gray-500 ml-1">
              ({sentiment.dataPoints.volatilityTrend})
            </span>
          )}
        </div>
      )}

      <p className="text-[11px] text-gray-500 mt-2 leading-relaxed">
        {sentiment.reasoning}
      </p>
    </div>
  );
}

// ============================================
// Bonzo Vaults Card Component
// ============================================

function VaultCard({
  data,
  loading,
}: {
  data: any;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="animate-pulse space-y-2">
          <div className="h-4 bg-gray-700/50 rounded w-1/2" />
          <div className="h-3 bg-gray-700/30 rounded w-full" />
          <div className="h-3 bg-gray-700/30 rounded w-3/4" />
        </div>
      </div>
    );
  }

  if (!data?.vaults) return null;

  const vaults = data.vaults;
  const totalTVL = data.totalTVL || 0;
  const avgAPY = data.avgAPY || 0;

  const riskColors: Record<string, string> = {
    low: "text-green-400 bg-green-400/10",
    medium: "text-yellow-400 bg-yellow-400/10",
    high: "text-red-400 bg-red-400/10",
  };

  const strategyIcons: Record<string, string> = {
    "single-asset-dex": "🎯",
    "dual-asset-dex": "⚖️",
    "leveraged-lst": "🔄",
  };

  return (
    <div className="rounded-xl border border-purple-800/40 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏦</span>
          <h3 className="text-sm font-medium text-gray-300">Bonzo Vaults</h3>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Total TVL</div>
          <div className="text-sm font-semibold text-purple-400">
            ${(totalTVL / 1e6).toFixed(2)}M
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {vaults.map((vault: any) => (
          <div
            key={vault.id}
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/40 border border-gray-700/30 hover:border-purple-600/40 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm flex-shrink-0">
                {strategyIcons[vault.strategy] || "📦"}
              </span>
              <div className="min-w-0">
                <div className="text-xs font-medium text-gray-200 truncate">
                  {vault.name}
                </div>
                <div className="text-[10px] text-gray-500">
                  {vault.underlyingProtocol}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${riskColors[vault.riskLevel] || "text-gray-400"}`}
              >
                {vault.riskLevel}
              </span>
              <div className="text-right">
                <div className="text-sm font-semibold text-emerald-400">
                  {vault.apy?.toFixed(1)}%
                </div>
                <div className="text-[10px] text-gray-500">APY</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-800/60 flex justify-between text-xs text-gray-500">
        <span>Avg APY: {avgAPY.toFixed(1)}%</span>
        <span>{vaults.length} active vaults</span>
      </div>
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
          <h3 className="text-sm font-medium text-gray-300">Bonzo Markets</h3>
        </div>
        <span className="text-[10px] text-gray-500">
          {activeMarkets.length} active
        </span>
      </div>

      <div className="space-y-1">
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