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
  actionData?: Record<string, any>; // Data for inline action components
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
      content:
        "Welcome to **VaultMind** — your AI DeFi Keeper on Hedera. Every feature is controllable from this chat.\n\n" +
        "**📊 Analytics**\n• \"Show my portfolio\" — pie chart\n• \"How's the market sentiment?\" — Fear & Greed\n• \"Compare APYs across platforms\" — Bonzo vs SaucerSwap\n• \"Show Bonzo Vault APYs\" — vault comparison\n• \"Show my positions\" — Bonzo Lend health factor\n• \"Show Bonzo markets\" — all reserves + rates\n• \"Show risk vs return\" / \"Show DeFi opportunities\" / \"Show correlation matrix\"\n\n" +
        "**⚡ Keeper Engine**\n• \"Run dry run\" — analyze without executing\n• \"Execute keeper\" — confirm + execute\n• \"Start auto keeper\" / \"Stop auto keeper\"\n• \"Show decision history\" — past actions\n• \"Show audit log\" — HCS on-chain trail\n• \"Show last 5 DEPOSIT actions\" — filtered audit\n• \"Show first 3 entries\" — oldest first\n• \"Show only BORROW actions\" — type filter\n\n" +
        "**⚙️ Strategy Config**\n• \"Show strategy config\" — current parameters\n• \"Set bearish threshold to -25\" — adjust risk\n• \"Set confidence minimum to 70\" — require higher confidence\n• \"Set volatility exit to 75\" — tighten exit\n• \"Reset strategy to defaults\"\n\n" +
        "**💰 Vault Actions**\n• \"Deposit 100 HBAR into HBAR-USDC vault\"\n• \"Withdraw from USDC-USDT vault\"\n• \"Harvest SAUCE-HBAR vault now\"\n• \"Switch vault to stable\"\n\n" +
        "**🏦 Lending Actions**\n• \"Supply 500 HBAR to Bonzo\"\n• \"Borrow 200 USDC\"\n• \"Repay my USDC loan\"\n\n" +
        "**👛 Wallet**\n• \"Connect wallet 0.0.XXXXX\" / \"Disconnect wallet\"\n• \"Show my wallet\" — balance & tokens\n\n" +
        "**📈 Research**\n• \"Show backtest\" — VaultMind vs HODL\n• \"Show price chart\" — OHLCV candlestick",
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

  // ── Jarvis: Visual pulse when sidebar cards update from chat ──
  const [sidebarPulse, setSidebarPulse] = useState<Set<string>>(new Set());
  const pulseCard = (cardName: string) => {
    setSidebarPulse((prev) => new Set(prev).add(cardName));
    setTimeout(() => {
      setSidebarPulse((prev) => {
        const next = new Set(prev);
        next.delete(cardName);
        return next;
      });
    }, 3500); // 3.5s — visible enough to notice
  };

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

  // Auto-loop keeper — use ref to avoid interval reset on re-renders
  const keeperRunningRef = useRef(false);
  const strategyConfigRef = useRef(strategyConfig);
  strategyConfigRef.current = strategyConfig; // Always current

  const runKeeperForLoop = useCallback(async () => {
    if (keeperRunningRef.current) return;
    keeperRunningRef.current = true;
    setKeeperRunning(true);
    try {
      const res = await fetch("/api/keeper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: strategyConfigRef.current,
          execute: false,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setKeeperResult(json.data);
        setKeeperHistory((prev) => [json.data, ...prev].slice(0, 20));
        if (json.data.hcsLog?.topicId && typeof window !== "undefined") {
          localStorage.setItem("vaultmind_hcs_topic", json.data.hcsLog.topicId);
        }
        // Jarvis pulse
        pulseCard("keeper");
        pulseCard("history");
        if (json.data.sentiment) pulseCard("sentiment");
      }
    } catch (err: any) {
      console.error("Auto-keeper error:", err);
    } finally {
      keeperRunningRef.current = false;
      setKeeperRunning(false);
    }
  }, []); // Empty deps — function identity never changes

  useEffect(() => {
    if (!autoLoop) {
      if (loopTimerRef.current) clearInterval(loopTimerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setCountdown(0);
      return;
    }

    // Run immediately on enable
    console.log(`[Auto-Keeper] Started: interval=${loopInterval}min`);
    runKeeperForLoop();
    setCountdown(loopInterval * 60);

    // Set up loop — this interval is STABLE (runKeeperForLoop ref never changes)
    loopTimerRef.current = setInterval(
      () => {
        console.log(`[Auto-Keeper] ⏰ Interval fired — running keeper cycle`);
        runKeeperForLoop();
        setCountdown(loopInterval * 60);
      },
      loopInterval * 60 * 1000
    );

    // Countdown ticker (every second)
    let tickCounter = 0;
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
      tickCounter++;
      // Log every 60s so user can see it's alive
      if (tickCounter % 60 === 0) {
        console.log(`[Auto-Keeper] ⏳ Next cycle in ~${Math.ceil((loopInterval * 60 - tickCounter) / 60)}min`);
      }
    }, 1000);

    return () => {
      console.log("[Auto-Keeper] Stopped / interval changed");
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

  // ── Jarvis: Handle inline component button actions ──
  async function handleInlineAction(action: string, payload?: any) {
    const id = (Date.now() + 2).toString();

    if (action === "confirm_execute" && payload?.pendingKeeper) {
      // Execute the pending keeper decision
      setIsLoading(true);
      try {
        const res = await fetch("/api/keeper?execute=true");
        const json = await res.json();
        if (json.success) {
          setKeeperResult(json.data);
          setKeeperHistory((prev) => [json.data, ...prev]);
          pulseCard("keeper");
          pulseCard("history");
          setMessages((prev) => [...prev, {
            id, role: "assistant",
            content: `⚡ **Executed!** ${json.data.decision?.action} — ${json.data.decision?.reason?.substring(0, 120)}`,
            charts: ["keeper"],
            actionData: { keeper: json.data },
            timestamp: new Date(),
          }]);
        }
      } catch (err: any) {
        setMessages((prev) => [...prev, {
          id, role: "assistant",
          content: `❌ Execution failed.`,
          charts: ["inlineerror"],
          actionData: { inlineerror: { type: "execution_failed", message: err.message, suggestion: "Try running a dry run first to check connectivity." } },
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);

    } else if (action === "confirm_vault" && payload) {
      // ── REAL EXECUTION: Route through /api/execute → agent → Bonzo tools ──
      setIsLoading(true);
      const vaultAction = payload.action || payload.pendingAction?.vaultAction || "deposit";
      const execParams = {
        token: payload.pendingAction?.token || payload.vault?.split(" ")[0] || "HBAR",
        amount: parseFloat(payload.pendingAction?.amount) || parseFloat(payload.amount) || 100,
        vault: payload.vault,
        vaultAddress: payload.pendingAction?.vaultAddress,
        target: payload.pendingAction?.target || payload.target, // For vault_switch
      };

      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: `vault_${vaultAction}`,
            params: execParams,
            account: connectedAccount,
          }),
        });
        const json = await res.json();

        if (json.success && json.data.status === "success") {
          const txIds = json.data.txIds || [];
          const hashScanLinks = json.data.hashScanLinks || [];
          setMessages((prev) => [...prev, {
            id, role: "assistant",
            content: `⚡ **Vault ${vaultAction} executed on Hedera Testnet!**${txIds.length > 0 ? `\n\n🔗 Transaction: \`${txIds[0]}\`` : ""}\n\n${json.data.agentResponse?.substring(0, 300) || "Transaction submitted successfully."}`,
            charts: ["vaultaction"],
            actionData: {
              vaultaction: {
                ...payload,
                status: "executed",
                txIds,
                hashScanLinks,
                toolCalls: json.data.toolCalls,
                hcsLog: json.data.hcsLog,
                durationMs: json.data.durationMs,
              },
            },
            timestamp: new Date(),
          }]);
          pulseCard("positions");
          if (connectedAccount) fetchPositions(connectedAccount);
        } else {
          setMessages((prev) => [...prev, {
            id, role: "assistant",
            content: `❌ **Vault ${vaultAction} failed:** ${json.error || json.data?.agentResponse?.substring(0, 200) || "Unknown error"}\n\nCheck the console for details.`,
            charts: ["vaultaction"],
            actionData: {
              vaultaction: { ...payload, status: "failed", error: json.error || "Execution failed" },
            },
            timestamp: new Date(),
          }]);
        }
      } catch (err: any) {
        setMessages((prev) => [...prev, {
          id, role: "assistant",
          content: `❌ **Execution error:** ${err.message}`,
          charts: ["inlineerror"],
          actionData: { inlineerror: { type: "execution_failed", message: err.message, suggestion: "Check your HBAR balance and try again." } },
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);

    } else if (action === "confirm_lending" && payload) {
      // ── REAL EXECUTION: Lending actions through /api/execute → Bonzo contracts ──
      setIsLoading(true);
      const lendAction = payload.action || payload.pendingAction?.lendAction || "supply";
      // Detect "all" amounts properly
      const rawAmount = payload.pendingAction?.amount;
      const isAll = rawAmount === "all" || String(rawAmount).toLowerCase().startsWith("all");
      const parsedAmount = isAll ? 0 : (parseFloat(rawAmount) || parseFloat(payload.amount) || 100);
      const execParams = {
        token: payload.pendingAction?.asset || payload.asset || "HBAR",
        amount: parsedAmount,
        rateMode: payload.pendingAction?.rateMode || "variable",
      };

      try {
        const res = await fetch("/api/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: lendAction,
            params: execParams,
            account: connectedAccount,
          }),
        });
        const json = await res.json();

        if (json.success && json.data.status === "success") {
          const txIds = json.data.txIds || [];
          const hashScanLinks = json.data.hashScanLinks || [];
          setMessages((prev) => [...prev, {
            id, role: "assistant",
            content: `⚡ **Lending ${lendAction} executed on Hedera Testnet!**${txIds.length > 0 ? `\n\n🔗 Transaction: \`${txIds[0]}\`` : ""}\n\n${json.data.agentResponse?.substring(0, 300) || "Transaction submitted successfully."}`,
            charts: ["lendingaction"],
            actionData: {
              lendingaction: {
                ...payload,
                status: "executed",
                txIds,
                hashScanLinks,
                toolCalls: json.data.toolCalls,
                hcsLog: json.data.hcsLog,
                durationMs: json.data.durationMs,
              },
            },
            timestamp: new Date(),
          }]);
          pulseCard("positions");
          if (connectedAccount) fetchPositions(connectedAccount);
        } else {
          setMessages((prev) => [...prev, {
            id, role: "assistant",
            content: `❌ **Lending ${lendAction} failed:** ${json.error || json.data?.agentResponse?.substring(0, 200) || "Unknown error"}`,
            charts: ["lendingaction"],
            actionData: {
              lendingaction: { ...payload, status: "failed", error: json.error || "Execution failed" },
            },
            timestamp: new Date(),
          }]);
        }
      } catch (err: any) {
        setMessages((prev) => [...prev, {
          id, role: "assistant",
          content: `❌ **Execution error:** ${err.message}`,
          charts: ["inlineerror"],
          actionData: { inlineerror: { type: "execution_failed", message: err.message, suggestion: "Check your HBAR balance and try again." } },
          timestamp: new Date(),
        }]);
      }
      setIsLoading(false);
      if (connectedAccount) fetchPositions(connectedAccount);

    } else if (action.startsWith("cancel_")) {
      setMessages((prev) => [...prev, {
        id, role: "assistant",
        content: `✓ **Cancelled.** No action was taken. Your positions are unchanged.`,
        timestamp: new Date(),
      }]);
    }
  }

  // ── Jarvis Mode: detect action commands that need execution ──
  function detectActionCommand(msg: string): {
    action: string;
    execute?: boolean;
    walletId?: string;
    params?: Record<string, any>;
  } | null {
    const lower = msg.toLowerCase().trim();

    // Keeper commands
    if (lower.includes("run keeper") || lower.includes("dry run") || lower.includes("keeper cycle") || lower.includes("trigger keeper") || lower.includes("run a keeper") || lower.includes("analyze market")) {
      return { action: "keeper", execute: false };
    }
    if (lower.includes("execute keeper") || lower === "execute" || lower.includes("execute the") || lower.includes("execute now")) {
      return { action: "keeper_confirm" }; // Now goes through confirmation
    }

    // Auto-loop commands
    if (lower.includes("start auto") || lower.includes("enable auto") || lower.includes("auto keeper on") || lower.includes("go autonomous") || lower.includes("autonomous mode")) {
      // Parse optional interval: "start auto keeper every 2 min" / "start auto 1 minute"
      const intervalMatch = lower.match(/(\d+)\s*(?:min|minute)/);
      const interval = intervalMatch ? Math.max(1, Math.min(15, parseInt(intervalMatch[1]))) : undefined;
      return { action: "start_auto", params: { interval } };
    }
    if (lower.includes("stop auto") || lower.includes("disable auto") || lower.includes("auto keeper off") || lower.includes("stop keeper") || lower.includes("pause keeper") || lower.includes("stop autonomous")) {
      return { action: "stop_auto" };
    }

    // Wallet connect
    const walletMatch = lower.match(/connect\s+(?:wallet\s+)?(\d+\.\d+\.\d+)/);
    if (walletMatch) {
      return { action: "connect_wallet", walletId: walletMatch[1] };
    }

    // Wallet disconnect
    if (lower.includes("disconnect wallet") || lower.includes("disconnect account") || lower.includes("remove wallet") || lower.includes("logout")) {
      return { action: "disconnect_wallet" };
    }

    // ── Display-only chart commands (handle locally to give proper response) ──
    if (lower.includes("price chart") || lower.includes("candlestick") || lower.includes("ohlcv") || lower.includes("show hbar chart")) {
      return { action: "show_chart", params: { chart: "ohlcv" } };
    }
    if (lower.includes("show backtest") || lower.includes("backtest") || lower.includes("vaultmind vs hodl")) {
      return { action: "show_chart", params: { chart: "performance" } };
    }
    if (lower.includes("show audit") || lower.includes("audit log") || lower.includes("hcs log") || lower.includes("on-chain trail")) {
      return { action: "show_chart", params: { chart: "hcs" } };
    }
    if (lower.includes("show decision history") || lower.includes("decision log") || lower.includes("past decisions") || lower.includes("keeper history")) {
      return { action: "show_chart", params: { chart: "history" } };
    }

    // ── Strategy Config Commands ──
    if (lower.includes("show strategy") || lower.includes("show config") || lower.includes("current strategy") || lower.includes("strategy config") || lower.includes("my strategy") || lower.includes("keeper settings")) {
      return { action: "strategy_show" };
    }
    if (lower.includes("reset strategy") || lower.includes("reset config") || lower.includes("default strategy")) {
      return { action: "strategy_reset" };
    }
    // "set bearish threshold to -25" / "set bearish -25"
    const bearishMatch = lower.match(/set\s+bearish\s+(?:threshold\s+)?(?:to\s+)?(-?\d+)/);
    if (bearishMatch) return { action: "strategy_set", params: { key: "bearishThreshold", value: parseInt(bearishMatch[1]), label: "Bearish Threshold" } };
    const bullishMatch = lower.match(/set\s+bullish\s+(?:threshold\s+)?(?:to\s+)?(-?\d+)/);
    if (bullishMatch) return { action: "strategy_set", params: { key: "bullishThreshold", value: parseInt(bullishMatch[1]), label: "Bullish Threshold" } };
    const confMatch = lower.match(/set\s+confidence\s+(?:minimum\s+)?(?:to\s+)?(\d+)/);
    if (confMatch) return { action: "strategy_set", params: { key: "confidenceMinimum", value: parseInt(confMatch[1]) / 100, label: "Confidence Minimum" } };
    const volMatch = lower.match(/set\s+(?:high\s+)?volatility\s+(?:threshold\s+|exit\s+)?(?:to\s+)?(\d+)/);
    if (volMatch) return { action: "strategy_set", params: { key: "highVolatilityThreshold", value: parseInt(volMatch[1]), label: "High Volatility Threshold" } };
    const hfDangerMatch = lower.match(/set\s+(?:health\s+factor\s+)?danger\s+(?:to\s+)?(\d+\.?\d*)/);
    if (hfDangerMatch) return { action: "strategy_set", params: { key: "healthFactorDanger", value: parseFloat(hfDangerMatch[1]), label: "HF Danger Level" } };
    const yieldMatch = lower.match(/set\s+(?:min\s+)?yield\s+(?:differential?\s+)?(?:to\s+)?(\d+\.?\d*)/);
    if (yieldMatch) return { action: "strategy_set", params: { key: "minYieldDifferential", value: parseFloat(yieldMatch[1]), label: "Min Yield Differential" } };

    // ── Vault Action Commands ──
    // Only match imperative commands, not questions
    const isQuestion = lower.startsWith("when") || lower.startsWith("how") || lower.startsWith("should") || lower.startsWith("why") || lower.startsWith("what") || lower.startsWith("can") || lower.includes("?");

    // "deposit 100 HBAR into HBAR-USDC vault"
    const vaultDepositMatch = lower.match(/deposit\s+(\d+\.?\d*)\s*(\w+)\s+(?:into|to)\s+(.+?)(?:\s+vault)?$/);
    if (vaultDepositMatch && !isQuestion) return { action: "vault_deposit", params: { amount: parseFloat(vaultDepositMatch[1]), token: vaultDepositMatch[2].toUpperCase(), vault: vaultDepositMatch[3].trim() } };
    // "withdraw from USDC-USDT vault"
    const vaultWithdrawMatch = lower.match(/withdraw\s+(?:from\s+)?(.+?)(?:\s+vault)?$/);
    if (vaultWithdrawMatch && lower.includes("vault") && !isQuestion) return { action: "vault_withdraw", params: { vault: vaultWithdrawMatch[1].trim() } };
    // "harvest SAUCE-HBAR vault" or "harvest now" or "harvest rewards"
    // But NOT "when should I harvest" or "how to harvest" (questions go to agent)
    if (lower.includes("harvest") && (lower.includes("vault") || lower.includes("now") || lower.includes("rewards"))) {
      if (!isQuestion) {
        const harvestVault = lower.match(/harvest\s+(.+?)(?:\s+vault|\s+now)?$/);
        return { action: "vault_harvest", params: { vault: harvestVault?.[1]?.replace(/now|rewards|vault/g, "").trim() || "best" } };
      }
    }
    if ((lower.includes("switch vault") || lower.includes("switch to stable")) && !isQuestion) {
      return { action: "vault_switch", params: { target: "USDC-USDT Stable CLM" } };
    }

    // ── HCS filter commands (BEFORE lending — "show REPAY entries" must not trigger lending_repay) ──
    const auditContextWords = ["entries", "actions", "decisions", "audit", "hcs", "log", "trail", "on-chain", "keeper action", "keeper decision"];
    const hasAuditContext = auditContextWords.some(w => lower.includes(w));

    if (hasAuditContext) {
      let hcsFilterAction: string | null = null;
      const actionWords = ["harvest", "borrow", "repay", "deposit", "withdraw", "switch", "hold", "rebalance", "exit", "increase"];
      for (const aw of actionWords) {
        if (lower.includes(aw)) { hcsFilterAction = aw.toUpperCase(); break; }
      }
      const execMatch = lower.match(/execute[_\s](\w+)/);
      if (execMatch) hcsFilterAction = execMatch[1].toUpperCase();

      let hcsCount: number | null = null;
      let hcsOrder: "asc" | "desc" = "desc";
      const countMatch = lower.match(/(\d+)\s*(?:keeper\s+)?(?:actions?|decisions?|entries?|audits?|logs?)/);
      if (countMatch) hcsCount = parseInt(countMatch[1]);
      const lastNMatch = lower.match(/(?:last|recent|latest)\s+(\d+)/);
      if (lastNMatch) { hcsCount = parseInt(lastNMatch[1]); hcsOrder = "desc"; }
      const firstNMatch = lower.match(/(?:first|oldest|earliest)\s+(\d+)/);
      if (firstNMatch) { hcsCount = parseInt(firstNMatch[1]); hcsOrder = "asc"; }
      const anyNMatch = lower.match(/(?:any|show|display)\s+(\d+)/);
      if (anyNMatch && !hcsCount) { hcsCount = parseInt(anyNMatch[1]); }

      if (hcsFilterAction || hcsCount) {
        return {
          action: "hcs_filter",
          params: {
            ...(hcsFilterAction ? { filterAction: hcsFilterAction } : {}),
            ...(hcsCount ? { count: hcsCount } : {}),
            order: hcsOrder,
          },
        };
      }
    }

    // ── Lending Action Commands ──
    // "supply 500 HBAR to Bonzo" / "supply 200 USDC"
    const supplyMatch = lower.match(/supply\s+(\d+\.?\d*)\s*(\w+)/);
    if (supplyMatch && !isQuestion) return { action: "lending_supply", params: { amount: parseFloat(supplyMatch[1]), asset: supplyMatch[2].toUpperCase() } };
    // "borrow 200 USDC"
    const borrowMatch = lower.match(/borrow\s+(\d+\.?\d*)\s*(\w+)/);
    if (borrowMatch && !isQuestion) return { action: "lending_borrow", params: { amount: parseFloat(borrowMatch[1]), asset: borrowMatch[2].toUpperCase() } };
    // "repay my USDC loan" / "repay 100 USDC"
    const repayMatch = lower.match(/repay\s+(?:my\s+)?(?:(\d+\.?\d*)\s*)?(\w+)/);
    if (repayMatch && (lower.includes("loan") || lower.includes("debt") || lower.includes("repay"))) {
      return { action: "lending_repay", params: { amount: repayMatch[1] ? parseFloat(repayMatch[1]) : "all", asset: repayMatch[2].toUpperCase() } };
    }

    return null;
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
      const detectedCharts = detectCharts(userMessage.content);
      const actionCmd = detectActionCommand(userMessage.content);

      // ── Handle action commands locally ──
      if (actionCmd) {
        let responseContent = "";
        let actionData: Record<string, any> = {};

        if (actionCmd.action === "keeper") {
          // ── JARVIS: Mirror sidebar behavior exactly ──
          setKeeperRunning(true); // Show spinner in sidebar
          pulseCard("keeper");    // Immediate glow = "I'm working on it"

          // Use POST with strategyConfig (same as sidebar manual run)
          const res = await fetch("/api/keeper", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              config: strategyConfig,
              execute: actionCmd.execute || false,
            }),
          });
          const json = await res.json();
          setKeeperRunning(false); // Stop spinner

          if (json.success) {
            const d = json.data;
            // ── JARVIS: Update ALL related sidebar state ──
            setKeeperResult(d);
            setKeeperHistory((prev) => [d, ...prev]);

            // Update sidebar sentiment card with keeper's fresh sentiment
            if (d.sentiment) {
              setSentiment((prev) => prev ? {
                ...prev,
                score: d.sentiment.score,
                signal: d.sentiment.signal,
                confidence: d.sentiment.confidence,
              } : prev);
            }

            // Update sidebar positions card if keeper returned portfolio
            if (d.portfolio) {
              setPortfolio(d.portfolio);
            }

            // Save HCS topic ID so Audit tab can find it
            if (d.hcsLog?.topicId && typeof window !== "undefined") {
              localStorage.setItem("vaultmind_hcs_topic", d.hcsLog.topicId);
            }

            // ── JARVIS: Pulse ALL affected sidebar cards ──
            pulseCard("keeper");
            pulseCard("history");
            if (d.sentiment) pulseCard("sentiment");
            if (d.portfolio) pulseCard("positions");

            const lendAction = d.decision?.action || "N/A";
            const vaultAction = d.vaultDecision?.action || "N/A";
            responseContent = actionCmd.execute
              ? `⚡ **Keeper executed.** Lending: **${lendAction}** — ${d.decision?.reason || "No reason"}\n\nVault: **${vaultAction}** — ${d.vaultDecision?.reason || "No vault decision"}`
              : `🔍 **Keeper dry run complete.** Lending recommends **${lendAction}** — ${d.decision?.reason || "No reason"}\n\nVault recommends **${vaultAction}** — ${d.vaultDecision?.reason || "No vault decision"}`;
            actionData.keeper = d;
          } else {
            responseContent = `Keeper error: ${json.error}`;
            actionData.inlineerror = { type: "execution_failed", message: json.error || "Keeper cycle failed", suggestion: "Check your .env.local credentials and try again." };
            if (!detectedCharts.includes("inlineerror")) detectedCharts.push("inlineerror");
          }
          // Always show keeper inline
          if (!detectedCharts.includes("keeper")) detectedCharts.push("keeper");

        } else if (actionCmd.action === "start_auto") {
          // Set interval if specified: "start auto keeper every 2 min"
          const requestedInterval = actionCmd.params?.interval;
          if (requestedInterval) {
            setLoopInterval(requestedInterval);
          }
          setAutoLoop(true);
          pulseCard("keeper");
          const finalInterval = requestedInterval || loopInterval;
          responseContent = `✅ **Auto-keeper started.** Running every **${finalInterval} minute(s)**. I'll continuously monitor markets and log decisions to HCS. Say "stop auto keeper" to pause.`;

        } else if (actionCmd.action === "stop_auto") {
          setAutoLoop(false);
          pulseCard("keeper");
          responseContent = `⏸️ **Auto-keeper stopped.** I've paused autonomous monitoring. Run "dry run" anytime for a one-shot analysis, or "start auto keeper" to resume.`;

        } else if (actionCmd.action === "connect_wallet" && actionCmd.walletId) {
          const wId = actionCmd.walletId;
          try {
            // Fetch account data from Mirror Node
            const res = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${wId}`);
            if (res.ok) {
              const accData = await res.json();
              const hbarBalance = parseInt(accData.balance?.balance || "0") / 1e8;

              // Fetch HBAR price for USD value
              let hbarPrice = 0;
              try {
                const pr = await fetch("https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd");
                if (pr.ok) { const pd = await pr.json(); hbarPrice = pd["hedera-hashgraph"]?.usd || 0; }
              } catch {}

              // Fetch token balances
              let tokens: any[] = [];
              try {
                const tr = await fetch(`https://testnet.mirrornode.hedera.com/api/v1/accounts/${wId}/tokens?limit=25`);
                if (tr.ok) {
                  const td = await tr.json();
                  tokens = (td.tokens || [])
                    .filter((t: any) => parseInt(t.balance) > 0)
                    .map((t: any) => ({
                      tokenId: t.token_id,
                      symbol: t.token_id, // Could map known tokens
                      balance: parseInt(t.balance) / 1e8,
                      decimals: 8,
                    }));
                }
              } catch {}

              const hbarBalanceUSD = Math.round(hbarBalance * hbarPrice * 100) / 100;
              const wd = {
                accountId: wId,
                hbarBalance: Math.round(hbarBalance * 10000) / 10000,
                hbarBalanceUSD,
                tokens,
                evmAddress: accData.evm_address || "",
                network: "testnet" as const,
              };
              setConnectedAccount(wId);
              setWalletData(wd);
              fetchPositions(wId);
              pulseCard("wallet");
              pulseCard("positions");
              localStorage.setItem("vaultmind_account", wId);
              localStorage.setItem("vaultmind_wallet_mode", "manual");
              // Background: pre-associate required tokens for DeFi operations
              fetch("/api/associate", { method: "POST" }).then(r => r.json()).then(d => {
                console.log("[Wallet] Token associations:", d.results?.map((r: any) => `${r.symbol}:${r.status}`).join(", "));
              }).catch(() => {});
              responseContent = `👛 **Wallet connected: ${wId}**\nHBAR Balance: **${wd.hbarBalance.toLocaleString()} HBAR** (~$${hbarBalanceUSD.toFixed(2)})\n${tokens.length > 0 ? `Tokens: ${tokens.length} found` : "No additional tokens"}\nAll portfolio and position queries will now use this account.`;
              actionData.walletinfo = wd;
              if (!detectedCharts.includes("walletinfo")) detectedCharts.push("walletinfo");
            } else {
              responseContent = `❌ Account ${wId} not found on Hedera Testnet. Check the account ID format (0.0.XXXXX).`;
            }
          } catch (err: any) {
            responseContent = `❌ Failed to connect: ${err.message}`;
          }

        } else if (actionCmd.action === "disconnect_wallet") {
          setConnectedAccount(null);
          setWalletData(null);
          setPortfolio(null);
          pulseCard("wallet");
          localStorage.removeItem("vaultmind_account");
          localStorage.removeItem("vaultmind_wallet_mode");
          responseContent = `🔌 **Wallet disconnected.** Sidebar wallet card cleared. Say "connect wallet 0.0.XXXXX" to reconnect.`;

        // ── Strategy Config Commands ──
        } else if (actionCmd.action === "strategy_show") {
          actionData.strategyconfig = { config: strategyConfig, action: "show" };
          if (!detectedCharts.includes("strategyconfig")) detectedCharts.push("strategyconfig");
          responseContent = `⚙️ Here's your current keeper strategy configuration. You can modify any parameter by saying:\n• "Set bearish threshold to -25"\n• "Set confidence minimum to 70"\n• "Set volatility exit to 75"\n• "Reset strategy to defaults"`;

        } else if (actionCmd.action === "strategy_reset") {
          const oldConfig = { ...strategyConfig };
          const defaults = { bearishThreshold: -30, bullishThreshold: 50, confidenceMinimum: 0.6, healthFactorDanger: 1.3, healthFactorTarget: 1.8, highVolatilityThreshold: 80, minYieldDifferential: 2.0 };
          setStrategyConfig(defaults);
          pulseCard("strategyconfig");
          const changes = Object.entries(defaults)
            .filter(([k, v]) => (oldConfig as any)[k] !== v)
            .map(([k, v]) => ({ label: k, old: (oldConfig as any)[k], new: v }));
          actionData.strategyconfig = { config: defaults, changes, action: "reset" };
          if (!detectedCharts.includes("strategyconfig")) detectedCharts.push("strategyconfig");
          responseContent = changes.length > 0
            ? `🔄 **Strategy reset to defaults.** ${changes.length} parameter(s) changed. The keeper will use these on the next cycle.`
            : `⚙️ Strategy was already at defaults. No changes needed.`;

        } else if (actionCmd.action === "strategy_set" && actionCmd.params) {
          const { key, value, label } = actionCmd.params;
          const oldVal = (strategyConfig as any)[key];
          // Validate
          let valid = true;
          let validationMsg = "";
          if (key === "bearishThreshold" && (value < -100 || value > 0)) { valid = false; validationMsg = "Bearish threshold must be between -100 and 0"; }
          if (key === "bullishThreshold" && (value < 0 || value > 100)) { valid = false; validationMsg = "Bullish threshold must be between 0 and 100"; }
          if (key === "confidenceMinimum" && (value < 0 || value > 1)) { valid = false; validationMsg = "Confidence must be between 0% and 100%"; }
          if (key === "healthFactorDanger" && (value < 1 || value > 3)) { valid = false; validationMsg = "HF danger must be between 1.0 and 3.0"; }
          if (key === "highVolatilityThreshold" && (value < 10 || value > 100)) { valid = false; validationMsg = "Volatility threshold must be between 10% and 100%"; }

          if (!valid) {
            actionData.inlineerror = { type: "default", message: validationMsg, suggestion: `Try a value in the valid range for ${label}.` };
            if (!detectedCharts.includes("inlineerror")) detectedCharts.push("inlineerror");
            responseContent = `❌ Invalid value for **${label}**: ${validationMsg}`;
          } else {
            setStrategyConfig(prev => ({ ...prev, [key]: value }));
            pulseCard("strategyconfig");
            const changes = [{ label, old: oldVal, new: value }];
            actionData.strategyconfig = { config: { ...strategyConfig, [key]: value }, changes, action: "update" };
            if (!detectedCharts.includes("strategyconfig")) detectedCharts.push("strategyconfig");
            responseContent = `✅ **${label}** updated: ${oldVal} → **${value}**. The keeper will use this on its next cycle.`;
          }

        // ── Keeper Execute with Confirmation ──
        } else if (actionCmd.action === "keeper_confirm") {
          // First do a dry run to show what will happen
          const res = await fetch("/api/keeper");
          const json = await res.json();
          if (json.success) {
            const d = json.data;
            const action = d.decision?.action || "HOLD";
            actionData.confirm = {
              description: `Execute keeper decision: **${action}**`,
              details: [
                { label: "Lending Action", value: d.decision?.action || "N/A" },
                { label: "Vault Action", value: d.vaultDecision?.action || "N/A" },
                { label: "Confidence", value: `${((d.decision?.confidence || 0) * 100).toFixed(0)}%` },
                { label: "Sentiment", value: `${d.sentiment?.score > 0 ? "+" : ""}${d.sentiment?.score || 0}` },
              ],
              warning: action !== "HOLD" ? "This will execute a real transaction on Hedera Testnet." : undefined,
              pendingKeeper: d,
            };
            if (!detectedCharts.includes("confirm")) detectedCharts.push("confirm");
            responseContent = `🔒 **Confirmation required.** I've analyzed the market. Review the details below and confirm to execute.`;
          } else {
            actionData.inlineerror = { type: "execution_failed", message: json.error || "Keeper analysis failed", suggestion: "Check your .env.local credentials and try again." };
            if (!detectedCharts.includes("inlineerror")) detectedCharts.push("inlineerror");
            responseContent = `❌ Keeper analysis failed: ${json.error}`;
          }

        // ── Vault Action Commands ──
        } else if (actionCmd.action?.startsWith("vault_")) {
          if (!connectedAccount) {
            actionData.inlineerror = { type: "wallet_not_connected", message: "You need to connect a wallet before performing vault actions.", suggestion: 'Say "connect wallet 0.0.XXXXX" to connect.' };
            if (!detectedCharts.includes("inlineerror")) detectedCharts.push("inlineerror");
            responseContent = `🔌 **Wallet not connected.** Please connect first with "connect wallet 0.0.XXXXX".`;
          } else {
            const p = actionCmd.params || {};
            const vaultAction = actionCmd.action.replace("vault_", "");
            // Find matching vault for APY
            const vaults = vaultData?.vaults || [];
            const matchedVault = vaults.find((v: any) => v.name?.toLowerCase().includes(p.vault?.toLowerCase())) || vaults[0];

            actionData.vaultaction = {
              action: vaultAction,
              vault: vaultAction === "switch" ? (p.target || "USDC-USDT Stable CLM") : (matchedVault?.name || p.vault || "Best Available"),
              amount: p.amount ? `${p.amount} ${p.token || ""}` : "Full position",
              expectedApy: matchedVault?.apy?.toFixed(1) || "~8",
              estimatedGas: "~0.02 HBAR",
              riskWarning: vaultAction === "deposit" && matchedVault?.risk === "high" ? "This is a high-risk leveraged vault. Consider USDC-USDT Stable for lower risk." : undefined,
              status: "preview",
              pendingAction: { ...p, vaultAction, vaultAddress: matchedVault?.address, target: p.target },
            };
            if (!detectedCharts.includes("vaultaction")) detectedCharts.push("vaultaction");
            responseContent = `${vaultAction === "deposit" ? "💰" : vaultAction === "withdraw" ? "📤" : vaultAction === "harvest" ? "🌾" : "🔄"} **Vault ${vaultAction} preview ready.** Review the details below and confirm to proceed.`;
          }

        // ── Lending Action Commands ──
        } else if (actionCmd.action?.startsWith("lending_")) {
          if (!connectedAccount) {
            actionData.inlineerror = { type: "wallet_not_connected", message: "You need to connect a wallet before performing lending actions.", suggestion: 'Say "connect wallet 0.0.XXXXX" to connect.' };
            if (!detectedCharts.includes("inlineerror")) detectedCharts.push("inlineerror");
            responseContent = `🔌 **Wallet not connected.** Please connect first.`;
          } else {
            const p = actionCmd.params || {};
            const lendAction = actionCmd.action.replace("lending_", "");
            // Find current APY for asset
            const market = markets.find((m: any) => m.symbol?.toUpperCase() === p.asset?.toUpperCase());
            const currentHf = portfolio?.healthFactor || 999;
            // Estimate HF impact
            let hfAfter = currentHf;
            if (lendAction === "borrow") hfAfter = Math.max(currentHf * 0.7, 1.0);
            if (lendAction === "supply") hfAfter = currentHf * 1.3;
            if (lendAction === "repay") hfAfter = Math.min(currentHf * 1.5, 999);
            if (lendAction === "withdraw") hfAfter = Math.max(currentHf * 0.8, 1.0);

            actionData.lendingaction = {
              action: lendAction,
              asset: p.asset,
              amount: p.amount === "all" ? `All ${p.asset}` : `${p.amount} ${p.asset}`,
              currentApy: lendAction === "borrow" ? market?.borrowAPY?.toFixed(2) : market?.supplyAPY?.toFixed(2),
              healthFactorBefore: currentHf < 100 ? currentHf : undefined,
              healthFactorAfter: hfAfter < 100 ? hfAfter : undefined,
              liquidationRisk: hfAfter < 1.3 ? `Health factor will drop to ${hfAfter.toFixed(2)} — LIQUIDATION RISK. Consider a smaller amount.` : undefined,
              status: "preview",
              pendingAction: { ...p, lendAction },
            };
            if (!detectedCharts.includes("lendingaction")) detectedCharts.push("lendingaction");
            responseContent = `🏦 **${lendAction.charAt(0).toUpperCase() + lendAction.slice(1)} preview ready.** Review details including health factor impact below.`;
          }

        // ── Display-only chart commands (local response + inline component) ──
        } else if (actionCmd.action === "show_chart") {
          const chart = actionCmd.params?.chart;
          if (chart === "ohlcv") {
            if (!detectedCharts.includes("ohlcv")) detectedCharts.push("ohlcv");
            responseContent = "📈 Here's the **30-day HBAR price chart** with daily close prices, highs, and lows:";
          } else if (chart === "performance") {
            if (!detectedCharts.includes("performance")) detectedCharts.push("performance");
            responseContent = "📈 Running **VaultMind vs HODL backtest** over the last 30 days. This simulates keeper decisions against real HBAR price data:";
          } else if (chart === "hcs") {
            if (!detectedCharts.includes("hcs")) detectedCharts.push("hcs");
            actionData.hcs = { filterAction: null, filterCount: null, filterOrder: "desc" };
            responseContent = "📋 Here's your **HCS on-chain audit trail** — every keeper decision logged immutably on Hedera:";
          } else if (chart === "history") {
            if (!detectedCharts.includes("history")) detectedCharts.push("history");
            actionData.history = { history: keeperHistory };
            responseContent = keeperHistory.length > 0
              ? `📋 Showing **${keeperHistory.length} keeper decisions** from this session:`
              : "📋 No keeper decisions yet this session. Try **\"run dry run\"** to analyze the market first.";
          }

        // ── HCS Filtered Query ──
        } else if (actionCmd.action === "hcs_filter") {
          const p = actionCmd.params || {};
          actionData.hcs = {
            filterAction: p.filterAction || null,
            filterCount: p.count || null,
            filterOrder: p.order || "desc",
          };
          if (!detectedCharts.includes("hcs")) detectedCharts.push("hcs");
          // Build natural response
          const parts: string[] = [];
          if (p.order === "asc") parts.push("first");
          else if (p.count) parts.push("last");
          if (p.count) parts.push(`**${p.count}**`);
          if (p.filterAction) parts.push(`**${p.filterAction}**`);
          parts.push(p.count === 1 ? "entry" : "entries");
          responseContent = `📋 Showing ${parts.join(" ")} from the HCS audit trail:`;
        }

        // Inject state data for display-only components
        if (detectedCharts.includes("history")) {
          actionData.history = { history: keeperHistory };
        }
        if (detectedCharts.includes("walletinfo") && !actionData.walletinfo) {
          actionData.walletinfo = walletData ? { ...walletData, accountId: connectedAccount } : null;
        }
        if (detectedCharts.includes("positions") && portfolio) {
          actionData.positions = { ...portfolio, accountId: connectedAccount };
        }

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseContent,
          charts: detectedCharts.length > 0 ? detectedCharts : undefined,
          actionData: Object.keys(actionData).length > 0 ? actionData : undefined,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // ── Build actionData for display-only commands ──
      let actionData: Record<string, any> = {};
      if (detectedCharts.includes("history")) {
        actionData.history = { history: keeperHistory };
      }
      if (detectedCharts.includes("walletinfo")) {
        actionData.walletinfo = walletData ? { ...walletData, accountId: connectedAccount } : null;
      }
      if (detectedCharts.includes("positions") && portfolio) {
        actionData.positions = { ...portfolio, accountId: connectedAccount };
      }
      if (detectedCharts.includes("market") && markets.length > 0) {
        actionData.market = { markets };
      }

      // ── LOCAL DISPLAY HANDLER ──
      // Chart-only commands are handled locally. The agent doesn't know about
      // our inline components and says "I can't display charts" — so we intercept
      // these and render them ourselves with a brief intro message.
      // Charts NOT in this list go to the agent (portfolio, sentiment, apy, positions, walletinfo)
      // because the agent has tools that add valuable context for those.
      const LOCAL_CHART_MESSAGES: Record<string, string> = {
        ohlcv: "📈 Here's the **30-day HBAR price chart** from SaucerSwap OHLCV data:",
        correlation: "🔗 Here's the **asset correlation matrix** (30-day rolling window). Values near +1 move together, near -1 move opposite:",
        riskreturn: "📊 Here's the **risk vs return scatter** for Hedera DeFi assets (30-day annualized). Bubble size = Sharpe ratio:",
        heatmap: "🗺️ Here's the **DeFi opportunities heat map** across all Bonzo Lend markets, sorted by supply APY:",
        performance: "📈 Here's the **VaultMind vs HODL backtest** — 30 days, $1,000 initial investment. VaultMind uses the keeper's strategies while HODL just holds HBAR:",
        market: "🏦 Here's the **Bonzo Lend market overview** with all active reserves, supply/borrow APYs, and utilization rates:",
        hcs: "📋 Here's the **HCS Audit Trail** — every keeper decision logged immutably on Hedera Consensus Service. Verify any entry on HashScan:",
        history: "📜 Here's the **keeper decision history** from this session:",
        vaultcompare: "🏦 Here's the **Bonzo Vault comparison** — CLM vaults auto-manage concentrated liquidity ranges on SaucerSwap V2:",
        positions: "📊 Here's your **Bonzo Lend positions** — live data from the Bonzo Finance protocol:",
        walletinfo: "👛 Here's your **wallet info** — live from Hedera Mirror Node:",
        apycompare: "📊 Here's the **APY comparison** across Bonzo Lend supply, borrow, and vault strategies:",
      };

      // Check if ALL detected charts can be handled locally
      const localCharts = detectedCharts.filter(c => c in LOCAL_CHART_MESSAGES);
      if (localCharts.length > 0 && localCharts.length === detectedCharts.length) {
        // Pure display command — handle locally, don't send to agent
        const responseContent = localCharts.map(c => LOCAL_CHART_MESSAGES[c]).join("\n\n");

        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: responseContent,
          charts: detectedCharts,
          actionData: Object.keys(actionData).length > 0 ? actionData : undefined,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
        setIsLoading(false);
        return;
      }

      // ── Send to agent for AI response ──
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          threadId: "vaultmind-session",
          connectedAccount: connectedAccount || undefined,
          strategyConfig: strategyConfig,
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
        charts: detectedCharts.length > 0 ? detectedCharts : undefined,
        sentiment: json.data?.sentiment,
        actionData: Object.keys(actionData).length > 0 ? actionData : undefined,
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
            <div style={{ 
              transition: "box-shadow 0.5s ease-in-out, border-color 0.5s ease-in-out, transform 0.3s ease-in-out",
              boxShadow: sidebarPulse.has("wallet") ? "0 0 30px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.2), inset 0 0 15px rgba(16,185,129,0.05)" : "none",
              transform: sidebarPulse.has("wallet") ? "scale(1.01)" : "scale(1)",
              borderRadius: "0.75rem",
            }}>
              <WalletConnect
                connectedAccount={connectedAccount}
                externalWalletData={walletData}
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
            </div>

            {/* Keeper Controls */}
            <div style={{ 
              transition: "box-shadow 0.5s ease-in-out, transform 0.3s ease-in-out",
              boxShadow: sidebarPulse.has("keeper") ? "0 0 30px rgba(16,185,129,0.5), 0 0 60px rgba(16,185,129,0.2), inset 0 0 15px rgba(16,185,129,0.05)" : "none",
              transform: sidebarPulse.has("keeper") ? "scale(1.01)" : "scale(1)",
              borderRadius: "0.75rem",
            }}>
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
            </div>

            {/* Positions */}
            <div style={{ 
              transition: "box-shadow 0.5s ease-in-out, transform 0.3s ease-in-out",
              boxShadow: sidebarPulse.has("positions") ? "0 0 30px rgba(59,130,246,0.5), 0 0 60px rgba(59,130,246,0.2), inset 0 0 15px rgba(59,130,246,0.05)" : "none",
              transform: sidebarPulse.has("positions") ? "scale(1.01)" : "scale(1)",
              borderRadius: "0.75rem",
            }}>
              <PositionsCard portfolio={portfolio} loading={positionsLoading} />
            </div>

            {/* Sentiment Card */}
            <div style={{ 
              transition: "box-shadow 0.5s ease-in-out, transform 0.3s ease-in-out",
              boxShadow: sidebarPulse.has("sentiment") ? "0 0 30px rgba(251,191,36,0.5), 0 0 60px rgba(251,191,36,0.2), inset 0 0 15px rgba(251,191,36,0.05)" : "none",
              transform: sidebarPulse.has("sentiment") ? "scale(1.01)" : "scale(1)",
              borderRadius: "0.75rem",
            }}>
              <SentimentCard sentiment={sentiment} loading={marketLoading} />
            </div>

            {/* Bonzo Vaults */}
            <div style={{ 
              transition: "box-shadow 0.5s ease-in-out, transform 0.3s ease-in-out",
              boxShadow: sidebarPulse.has("vaults") ? "0 0 30px rgba(168,85,247,0.5), 0 0 60px rgba(168,85,247,0.2), inset 0 0 15px rgba(168,85,247,0.05)" : "none",
              transform: sidebarPulse.has("vaults") ? "scale(1.01)" : "scale(1)",
              borderRadius: "0.75rem",
            }}>
              <VaultCard data={vaultData} loading={vaultLoading} />
            </div>

            {/* Market Overview */}
            <MarketCard
              markets={markets}
              loading={marketLoading}
              error={marketError}
            />

            {/* Decision History */}
            {keeperHistory.length > 0 && (
              <div style={{ 
                transition: "box-shadow 0.5s ease-in-out, transform 0.3s ease-in-out",
                boxShadow: sidebarPulse.has("history") ? "0 0 30px rgba(168,85,247,0.5), 0 0 60px rgba(168,85,247,0.2), inset 0 0 15px rgba(168,85,247,0.05)" : "none",
                transform: sidebarPulse.has("history") ? "scale(1.01)" : "scale(1)",
                borderRadius: "0.75rem",
              }}>
                <DecisionHistoryCard history={keeperHistory} />
              </div>
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
                <div className="flex flex-col min-h-[550px] h-full">
            {/* Chat Header */}
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
                            data={msg.actionData?.[chartType] || msg.actionData}
                            onAction={handleInlineAction}
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
                  <HCSTimeline refreshTrigger={keeperHistory.length} />
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

/** Dynamic context-aware suggestions — analyzes actual chat content, action results + app state */
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
  const lastContent = (lastAssistant?.content || "").toLowerCase();
  const lastCharts = lastAssistant?.charts || [];
  const msgCount = messages.length;

  // ── If no wallet connected, suggest connecting ──
  if (!connectedAccount && msgCount <= 2) {
    return [
      "Show me the best yields on Hedera",
      "How's the market sentiment?",
      "What DeFi strategies work on Hedera?",
    ];
  }

  // ═══ SMART ACTION-RESULT SUGGESTIONS ═══
  // Detect what just happened and suggest intelligent next steps

  // After successful deposit/supply
  if (lastContent.includes("deposited") && lastContent.includes("success")) {
    return ["Borrow 5 USDC", "Show my positions", "Show audit log"];
  }
  if ((lastContent.includes("supplied") || lastContent.includes("deposit")) && lastCharts.includes("lendingaction")) {
    const succeeded = lastContent.includes("✓") || lastContent.includes("success") || lastContent.includes("executed");
    if (succeeded) return ["Borrow against my collateral", "Show my positions", "Check my health factor"];
    return ["Try deposit 50 HBAR", "Show my wallet", "Show Bonzo markets"];
  }

  // After successful borrow
  if (lastContent.includes("borrowed") && (lastContent.includes("success") || lastContent.includes("✓"))) {
    return ["Repay my USDC loan", "Check my health factor", "Show my positions"];
  }

  // After successful repay
  if (lastContent.includes("repaid") && (lastContent.includes("success") || lastContent.includes("✓"))) {
    return ["Withdraw my collateral", "Show my positions", "Show audit log"];
  }
  // After failed repay
  if (lastContent.includes("repay") && (lastContent.includes("failed") || lastContent.includes("reverted") || lastContent.includes("no outstanding"))) {
    return ["Show my positions", "Deposit 100 HBAR", "Show audit log"];
  }

  // After successful withdraw
  if (lastContent.includes("withdrew") && (lastContent.includes("success") || lastContent.includes("✓"))) {
    return ["Deposit into higher yield", "Show Bonzo Vault APYs", "Show audit log"];
  }

  // After vault switch
  if (lastContent.includes("switch") && lastCharts.includes("vaultaction")) {
    const succeeded = lastContent.includes("✓") || lastContent.includes("success") || lastContent.includes("rebalanced");
    if (succeeded) return ["Show my positions", "Show audit log", "Compare Bonzo Vault APYs"];
    return ["Repay my loan first", "Show my positions", "Show audit log"];
  }

  // After harvest check
  if (lastContent.includes("auto-compounding") || lastContent.includes("no harvest needed")) {
    return ["Show my positions", "Deposit more HBAR", "Show audit log"];
  }

  // After HCS audit shown
  if (lastCharts.includes("hcs")) {
    return ["Show only DEPOSIT entries", "Show last 3 actions", "Show only BORROW entries"];
  }

  // After keeper run
  if (lastCharts.includes("keeper")) {
    return ["Execute keeper", "Show audit log", "Show decision history"];
  }

  // After chart displays
  if (lastCharts.includes("positions")) {
    const hasDebt = lastContent.includes("borrow") || lastContent.includes("debt");
    if (hasDebt) return ["Repay my loan", "Check health factor", "Show audit log"];
    return ["Deposit 100 HBAR", "Borrow 5 USDC", "Run dry run"];
  }
  if (lastCharts.includes("portfolio")) {
    return ["Show risk/return scatter", "Run dry run", "Show correlation matrix"];
  }
  if (lastCharts.includes("sentiment")) {
    return ["Run dry run", "Show DeFi heat map", "What should I do?"];
  }
  if (lastCharts.includes("apycompare")) {
    return ["Deposit into highest yield", "Show DeFi heat map", "Explain the risks"];
  }
  if (lastCharts.includes("market")) {
    return ["Deposit 100 HBAR", "Compare Bonzo Vault APYs", "Show DeFi heat map"];
  }
  if (lastCharts.includes("walletinfo")) {
    return ["Show my positions", "Deposit 100 HBAR", "Run dry run"];
  }
  if (lastCharts.includes("strategyconfig")) {
    return ["Run dry run", "Set bearish threshold to -25", "Reset strategy"];
  }
  if (lastCharts.includes("performance")) {
    return ["Run dry run", "Show strategy config", "Compare Bonzo Vault APYs"];
  }
  if (lastCharts.includes("ohlcv")) {
    return ["Show market sentiment", "Run dry run", "What's the trend?"];
  }
  if (lastCharts.includes("heatmap")) {
    return ["Deposit into best opportunity", "Compare APYs", "Show risk/return scatter"];
  }
  if (lastCharts.includes("correlation") || lastCharts.includes("riskreturn")) {
    return ["Show my portfolio", "Run dry run", "Compare Bonzo Vault APYs"];
  }
  if (lastCharts.includes("vaultaction")) {
    return ["Show my positions", "Show audit log", "Compare Bonzo Vault APYs"];
  }
  if (lastCharts.includes("lendingaction")) {
    return ["Show my positions", "Show audit log", "Run dry run"];
  }
  if (lastCharts.includes("confirm")) {
    return ["Show audit log", "Show my positions", "Run dry run"];
  }
  if (lastCharts.includes("inlineerror")) {
    return ["Connect wallet 0.0.5907362", "Show my wallet", "Run dry run"];
  }

  // ═══ CONTENT-BASED FALLBACKS ═══
  if (lastContent.includes("deposit") || lastContent.includes("supply")) {
    return ["Check my health factor", "Borrow against collateral", "Show audit log"];
  }
  if (lastContent.includes("borrow") || lastContent.includes("loan")) {
    return ["Repay my loan", "Check health factor", "Show my positions"];
  }
  if (lastContent.includes("yield") || lastContent.includes("apy")) {
    return ["Deposit into highest yield", "Compare all yields", "Show heat map"];
  }
  if (lastContent.includes("risk") || lastContent.includes("liquidat")) {
    return ["How do I reduce risk?", "Run keeper safety check", "Show health factor"];
  }
  if (lastContent.includes("keeper") || lastContent.includes("autonomous")) {
    return ["Start auto-keeper", "Show decision history", "Show audit log"];
  }
  if (lastContent.includes("vault") || lastContent.includes("clm")) {
    return ["Compare Bonzo Vault APYs", "Switch vault to stable", "Show my positions"];
  }
  if (lastContent.includes("staking")) {
    return ["SAUCE vs HBARX staking?", "Show staking yields", "Compare all APYs"];
  }

  // ═══ KEEPER & PORTFOLIO STATE ═══
  if (keeperResult) {
    const action = keeperResult.decision.action;
    if (action === "HOLD") return ["Why is keeper holding?", "Show market sentiment", "What would trigger action?"];
    if (action === "HARVEST" || action === "EXIT_TO_STABLE") return ["Execute keeper", "Show market outlook", "Show my positions"];
    if (action === "INCREASE_POSITION") return ["Execute the deposit", "Show risk analysis", "Show allocation"];
    if (action === "REPAY_DEBT") return ["Execute repayment", "Show health factor", "How much to repay?"];
  }

  if (sentiment) {
    if (sentiment.score < -30) return ["Should I exit positions?", "Run keeper safety check", "Show protective strategies"];
    if (sentiment.score > 50) return ["Best yield opportunities now", "Should I increase positions?", "Deposit 100 HBAR"];
  }

  if (portfolio && portfolio.positions.length > 0) {
    if (portfolio.healthFactor < 1.5) return ["Repay some debt", "Show health factor", "Run keeper safety check"];
    return ["Show my portfolio", "Compare yields", "Run keeper analysis"];
  }

  // ═══ CONVERSATION DEPTH ═══
  if (msgCount <= 2) return ["Run dry run", "Show my portfolio", "How's the market sentiment?"];
  if (msgCount <= 5) return ["Deposit 100 HBAR", "Show strategy config", "Compare Bonzo Vault APYs"];
  if (msgCount <= 8) return ["Execute keeper", "Show audit log", "Show backtest"];
  return ["Run dry run", "Show audit log", "Compare yields"];
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
  const [justUpdated, setJustUpdated] = useState(false);
  const prevResultRef = useRef<string | null>(null);

  // Flash "just updated" when result changes (including from chat commands)
  useEffect(() => {
    const resultKey = result ? `${result.decision?.action}-${result.timestamp}` : null;
    if (resultKey && resultKey !== prevResultRef.current) {
      prevResultRef.current = resultKey;
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [result]);

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
    <div className={`rounded-xl border ${justUpdated ? "border-emerald-500/40" : "border-gray-800/60"} bg-gray-900/40 p-4 card-glow transition-colors duration-500`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">Keeper Engine</h3>
          {justUpdated && (
            <span className="text-[9px] text-emerald-400 bg-emerald-400/10 rounded-full px-2 py-0.5 animate-pulse font-medium">
              ⚡ Updated from chat
            </span>
          )}
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
  // Handle infinity or very large HF (no borrows)
  if (!value || value > 1e10) {
    return (
      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-emerald-400 bg-emerald-400/10">
        HF: ∞ • Safe
      </span>
    );
  }

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
  const [justUpdated, setJustUpdated] = useState(false);
  const prevCountRef = useRef(0);

  useEffect(() => {
    if (history.length > prevCountRef.current && prevCountRef.current > 0) {
      setJustUpdated(true);
      const timer = setTimeout(() => setJustUpdated(false), 3000);
      return () => clearTimeout(timer);
    }
    prevCountRef.current = history.length;
  }, [history.length]);

  const actionIcons: Record<string, string> = {
    HOLD: "🟡",
    HARVEST: "🔴",
    REPAY_DEBT: "🔴",
    EXIT_TO_STABLE: "🔴",
    REBALANCE: "🔵",
    INCREASE_POSITION: "🟢",
  };

  return (
    <div className={`rounded-xl border ${justUpdated ? "border-purple-500/40" : "border-gray-800/60"} bg-gray-900/40 p-4 card-glow transition-colors duration-500`}>
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-emerald-400" />
        <h3 className="text-sm font-medium text-gray-300">Decision Log</h3>
        {justUpdated && (
          <span className="text-[9px] text-purple-400 bg-purple-400/10 rounded-full px-2 py-0.5 animate-pulse font-medium">
            + new entry
          </span>
        )}
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
                {entry.hcsLog.topicId && <> • Audit: {entry.hcsLog.topicId}</>}
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