"use client";

import { useState, useEffect } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
  LineChart,
  Line,
} from "recharts";
import { Loader2 } from "lucide-react";
import {
  Calendar,
  TrendingUp,
  Shield,
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Trash2,
  ChevronDown,
  ChevronUp,
  Activity,
  Droplets,
  Zap,
} from "lucide-react";
// ── Color Palette ──
const COLORS = [
  "#10b981", "#3b82f6", "#8b5cf6", "#f59e0b",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16",
  "#f97316", "#6366f1",
];

function ChartLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 py-4 justify-center">
      <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
      <span className="text-xs text-gray-500">Loading {label}...</span>
    </div>
  );
}

// ────────────────────────────────────────────
// DCA Card — Shows DCA plans + schedule
// ────────────────────────────────────────────

interface DCACardProps {
  data: any;
  onAction?: (action: string, payload?: any) => void;
}

export function DCACard({ data, onAction }: DCACardProps) {
  if (!data) return null;

  // Support both single plan and summary format
  const plans = data.plans || (data.plan ? [data.plan] : data.allPlans || []);
  const activePlans = plans.filter((p: any) => p.status === "active").length;

  const statusEmoji: Record<string, string> = {
    active: "🟢",
    paused: "⏸️",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  };

  const actionLabels: Record<string, string> = {
    bonzo_supply: "Bonzo Lend",
    stader_stake: "Stader HBARX",
    wallet_hold: "Wallet Hold",
  };

  return (
    <div
      className="rounded-xl border border-purple-700/30 overflow-hidden"
      style={{ background: "rgba(15, 12, 30, 0.8)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-purple-900/25"
        style={{ background: "rgba(139, 92, 246, 0.08)" }}
      >
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">
            DCA Schedule
          </span>
          <span className="text-[10px] text-purple-400/60 ml-1">
            {activePlans} active
          </span>
        </div>
      </div>

      {/* Plans */}
      <div className="p-3 space-y-2">
        {plans.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-2">
            No DCA plans configured
          </p>
        ) : (
          plans.map((plan: any, i: number) => (
            <div
              key={plan.id || i}
              className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-purple-900/20"
              style={{ background: "rgba(20, 16, 40, 0.5)" }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{statusEmoji[plan.status] || "⚪"}</span>
                  <span className="text-xs font-medium text-gray-200">
                    {plan.amount} {plan.asset}
                  </span>
                  <span className="text-[10px] text-gray-500">{plan.frequency}</span>
                  <span className="text-[10px] text-purple-400/70">
                    → {actionLabels[plan.action] || plan.action}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-500">
                  <span>{plan.executionCount ?? 0}x executed</span>
                  <span>•</span>
                  <span>
                    {(plan.totalDeposited ?? 0).toFixed(2)} {plan.asset} total
                  </span>
                  {plan.status === "active" && plan.nextExecutionAt && (
                    <>
                      <span>•</span>
                      <span className="text-purple-400/70">
                        Next: {new Date(plan.nextExecutionAt).toLocaleString()}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              {plan.status === "active" && onAction && (
                <div className="flex gap-1 ml-2">
                  <button
                    onClick={() =>
                      onAction("dca_action", {
                        action: "pause",
                        planId: plan.id,
                      })
                    }
                    className="p-1 rounded hover:bg-purple-500/10 text-gray-500 hover:text-yellow-400 transition-colors"
                    title="Pause"
                  >
                    <Pause className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() =>
                      onAction("dca_action", {
                        action: "cancel",
                        planId: plan.id,
                      })
                    }
                    className="p-1 rounded hover:bg-purple-500/10 text-gray-500 hover:text-red-400 transition-colors"
                    title="Cancel"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              {plan.status === "paused" && onAction && (
                <button
                  onClick={() =>
                    onAction("dca_action", {
                      action: "resume",
                      planId: plan.id,
                    })
                  }
                  className="p-1 rounded hover:bg-purple-500/10 text-gray-500 hover:text-green-400 transition-colors ml-2"
                  title="Resume"
                >
                  <Play className="w-3 h-3" />
                </button>
              )}
            </div>
          ))
        )}

        {/* Monthly estimate */}
        {data.estimatedMonthlyDeposit &&
          Object.keys(data.estimatedMonthlyDeposit).length > 0 && (
            <div className="mt-2 pt-2 border-t border-purple-900/20 flex items-center justify-between text-[10px] text-gray-500">
              <span>Est. monthly:</span>
              <span className="text-purple-400/80 font-medium">
                {Object.entries(data.estimatedMonthlyDeposit)
                  .map(
                    ([asset, amount]: [string, any]) =>
                      `${Math.round(amount)} ${asset}`
                  )
                  .join(", ")}
              </span>
            </div>
          )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Stader HBARX Card — Shows staking data + strategy
// ────────────────────────────────────────────

interface StaderCardProps {
  data: any;
}

export function StaderCard({ data }: StaderCardProps) {
  if (!data) return null;

  // Handle both info response and strategy result
  const staderData = data.staderData || data;
  const strategySteps = data.steps || null;
  const isStrategy = !!strategySteps;

  return (
    <div
      className="rounded-xl border border-blue-700/30 overflow-hidden"
      style={{ background: "rgba(15, 12, 30, 0.8)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-blue-900/25"
        style={{ background: "rgba(59, 130, 246, 0.08)" }}
      >
        <div className="flex items-center gap-2">
          <Droplets className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-gray-200">
            {isStrategy ? "HBARX Strategy" : "Stader Labs — HBARX"}
          </span>
          {staderData.isSimulated && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded text-yellow-400"
              style={{ background: "rgba(234, 179, 8, 0.1)" }}
            >
              Simulated
            </span>
          )}
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2">
          <div
            className="rounded-lg px-2.5 py-2 border border-blue-900/20"
            style={{ background: "rgba(20, 16, 40, 0.5)" }}
          >
            <span className="text-[10px] text-gray-500">Exchange Rate</span>
            <div className="text-xs text-blue-300 font-semibold">
              {staderData.exchangeRate?.toFixed(6) || "—"}
            </div>
            <span className="text-[9px] text-gray-600">HBARX/HBAR</span>
          </div>
          <div
            className="rounded-lg px-2.5 py-2 border border-blue-900/20"
            style={{ background: "rgba(20, 16, 40, 0.5)" }}
          >
            <span className="text-[10px] text-gray-500">Staking APY</span>
            <div className="text-xs text-emerald-400 font-semibold">
              ~{staderData.stakingAPY || 0}%
            </div>
            <span className="text-[9px] text-gray-600">Protocol rewards</span>
          </div>
          <div
            className="rounded-lg px-2.5 py-2 border border-blue-900/20"
            style={{ background: "rgba(20, 16, 40, 0.5)" }}
          >
            <span className="text-[10px] text-gray-500">Total Pooled</span>
            <div className="text-xs text-gray-200 font-semibold">
              {staderData.totalPooledHbar
                ? `${(staderData.totalPooledHbar / 1e9).toFixed(2)}B`
                : "—"}
            </div>
            <span className="text-[9px] text-gray-600">HBAR staked</span>
          </div>
        </div>

        {/* Strategy Steps (if executing strategy) */}
        {isStrategy && strategySteps && (
          <div className="space-y-1.5">
            <span className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">
              Strategy Execution
            </span>
            {strategySteps.map((step: any) => {
              const statusIcon =
                step.status === "success" || step.status === "simulated"
                  ? "✅"
                  : step.status === "failed"
                    ? "❌"
                    : "⏳";
              return (
                <div
                  key={step.step}
                  className="flex items-start gap-2 px-3 py-2 rounded-lg border border-purple-900/15"
                  style={{ background: "rgba(20, 16, 40, 0.3)" }}
                >
                  <span className="text-xs flex-shrink-0 mt-0.5">
                    {statusIcon}
                  </span>
                  <div className="min-w-0">
                    <div className="text-xs text-gray-300 font-medium">
                      Step {step.step}: {step.name}
                    </div>
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {step.description}
                    </div>
                    {step.txId && step.txId !== "simulated-stader-stake" && (
                      <div className="text-[9px] text-purple-400/70 mt-0.5">
                        TX: {step.txId}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Yield Breakdown */}
        {!isStrategy && (
          <div
            className="rounded-lg px-3 py-2.5 border border-blue-900/15"
            style={{ background: "rgba(20, 16, 40, 0.3)" }}
          >
            <div className="text-[10px] text-gray-500 font-medium mb-1.5">
              💡 Yield-on-Yield Strategy
            </div>
            <div className="space-y-1 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="text-blue-400">1.</span>
                <span className="text-gray-400">
                  Stake HBAR → HBARX (~{staderData.stakingAPY || 2.5}% APY)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">2.</span>
                <span className="text-gray-400">
                  Supply HBARX to Bonzo Lend (+ lending APY)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-blue-400">3.</span>
                <span className="text-gray-400">
                  Borrow USDC against collateral (optional)
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────
// Health Monitor Card — Live gauge + alerts
// ────────────────────────────────────────────

interface HealthMonitorCardProps {
  data: any;
}

export function HealthMonitorCard({ data }: HealthMonitorCardProps) {
  if (!data) return null;

  const hf = data.healthFactor;
  const level = data.level || "safe";
  const levelLabel = data.levelLabel || "Safe";
  const levelColor = data.levelColor || "#10b981";

  // Gauge calculation: map HF to 0-180 degrees
  // HF 1.0 = 0° (critical), HF 3.0+ = 180° (safe)
  const gaugeAngle = hf
    ? Math.min(180, Math.max(0, ((Math.min(hf, 3) - 1) / 2) * 180))
    : 180;

  const alertCount = data.alerts?.length || 0;

  return (
    <div
      className="rounded-xl border border-purple-700/30 overflow-hidden"
      style={{ background: "rgba(15, 12, 30, 0.8)" }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between border-b border-purple-900/25"
        style={{ background: "rgba(139, 92, 246, 0.08)" }}
      >
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-gray-200">
            Health Monitor
          </span>
          {data.isMonitoring && (
            <span
              className="text-[9px] px-1.5 py-0.5 rounded text-emerald-400"
              style={{ background: "rgba(16, 185, 129, 0.1)" }}
            >
              ● Live
            </span>
          )}
        </div>
        {alertCount > 0 && (
          <span
            className="text-[10px] px-2 py-0.5 rounded-full text-orange-400 font-medium"
            style={{ background: "rgba(249, 115, 22, 0.1)" }}
          >
            {alertCount} alert{alertCount > 1 ? "s" : ""}
          </span>
        )}
      </div>

      <div className="p-4">
        {/* Health Factor Gauge */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative w-40 h-20 overflow-hidden">
            {/* Gauge background arc */}
            <svg
              viewBox="0 0 200 100"
              className="w-full h-full"
            >
              {/* Background arc */}
              <path
                d="M 10 90 A 80 80 0 0 1 190 90"
                fill="none"
                stroke="rgba(139, 92, 246, 0.15)"
                strokeWidth="12"
                strokeLinecap="round"
              />
              {/* Colored arc */}
              <path
                d="M 10 90 A 80 80 0 0 1 190 90"
                fill="none"
                stroke={levelColor}
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${gaugeAngle * 1.4} 999`}
                style={{
                  transition: "stroke-dasharray 1s ease-out",
                }}
              />
              {/* Needle */}
              <line
                x1="100"
                y1="90"
                x2={100 + 60 * Math.cos(Math.PI - (gaugeAngle * Math.PI) / 180)}
                y2={90 - 60 * Math.sin(Math.PI - (gaugeAngle * Math.PI) / 180)}
                stroke={levelColor}
                strokeWidth="2"
                strokeLinecap="round"
                style={{ transition: "all 1s ease-out" }}
              />
              <circle cx="100" cy="90" r="4" fill={levelColor} />
            </svg>
          </div>
          <div className="text-center -mt-1">
            <div className="text-2xl font-bold" style={{ color: levelColor }}>
              {hf ? hf.toFixed(2) : "∞"}
            </div>
            <div className="text-xs text-gray-400">{levelLabel}</div>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div
            className="rounded-lg px-2.5 py-2 border border-purple-900/20 text-center"
            style={{ background: "rgba(20, 16, 40, 0.5)" }}
          >
            <span className="text-[10px] text-gray-500">Supplied</span>
            <div className="text-xs text-emerald-400 font-semibold">
              ${(data.totalSuppliedUSD || 0).toFixed(2)}
            </div>
          </div>
          <div
            className="rounded-lg px-2.5 py-2 border border-purple-900/20 text-center"
            style={{ background: "rgba(20, 16, 40, 0.5)" }}
          >
            <span className="text-[10px] text-gray-500">Borrowed</span>
            <div className="text-xs text-red-400 font-semibold">
              ${(data.totalBorrowedUSD || 0).toFixed(2)}
            </div>
          </div>
          <div
            className="rounded-lg px-2.5 py-2 border border-purple-900/20 text-center"
            style={{ background: "rgba(20, 16, 40, 0.5)" }}
          >
            <span className="text-[10px] text-gray-500">Net Worth</span>
            <div className="text-xs text-gray-200 font-semibold">
              ${(data.netWorthUSD || 0).toFixed(2)}
            </div>
          </div>
        </div>

        {/* Liquidation Distance */}
        {data.liquidation && data.totalBorrowedUSD > 0 && (
          <div
            className="rounded-lg px-3 py-2.5 border border-purple-900/15 mb-3"
            style={{ background: "rgba(20, 16, 40, 0.3)" }}
          >
            <div className="text-[10px] text-gray-500 font-medium mb-1">
              📏 Liquidation Distance
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-400">
                Collateral can drop
              </span>
              <span className="text-yellow-400 font-semibold">
                {data.liquidation.collateralDrop?.toFixed(1) || "—"}%
              </span>
            </div>
            {data.liquidation.distanceUSD && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-400">USD buffer</span>
                <span className="text-gray-200 font-medium">
                  ${data.liquidation.distanceUSD.toFixed(2)}
                </span>
              </div>
            )}
            {data.liquidation.hbarLiqPrice && (
              <div className="flex items-center justify-between text-xs mt-1">
                <span className="text-gray-400">HBAR liquidation price</span>
                <span className="text-red-400 font-medium">
                  ${data.liquidation.hbarLiqPrice.toFixed(4)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Asset Risk Breakdown */}
        {data.assetRisks && data.assetRisks.length > 0 && (
          <div className="mb-3">
            <div className="text-[10px] text-gray-500 font-medium mb-1.5">
              Position Breakdown
            </div>
            {data.assetRisks.map((asset: any) => (
              <div
                key={asset.symbol}
                className="flex items-center justify-between text-[11px] py-1 px-1"
              >
                <span className="text-gray-300 font-medium w-12">
                  {asset.symbol}
                </span>
                <div className="flex-1 mx-2">
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(20, 16, 40, 0.8)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, asset.riskContribution)}%`,
                        background: (asset.riskContribution || 0) > 60
                          ? "#ef4444"
                          : (asset.riskContribution || 0) > 30
                            ? "#eab308"
                            : "#10b981",
                      }}
                    />
                  </div>
                </div>
                <span className="text-gray-500 text-[10px] w-16 text-right">
                  {(asset.riskContribution ?? 0).toFixed(0)}% of debt
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Active Alerts */}
        {data.alerts && data.alerts.length > 0 && (
          <div className="space-y-1.5">
            <div className="text-[10px] text-gray-500 font-medium">
              🔔 Active Alerts
            </div>
            {data.alerts.slice(0, 3).map((alert: any) => {
              const alertColors: Record<string, string> = {
                critical: "border-red-500/30 text-red-400",
                danger: "border-orange-500/30 text-orange-400",
                at_risk: "border-yellow-500/30 text-yellow-400",
                moderate: "border-yellow-500/20 text-yellow-300",
                healthy: "border-emerald-500/20 text-emerald-400",
                safe: "border-emerald-500/20 text-emerald-400",
              };
              return (
                <div
                  key={alert.id}
                  className={`rounded-lg px-3 py-2 border text-[10px] ${alertColors[alert.level] || "border-gray-700 text-gray-400"}`}
                  style={{ background: "rgba(20, 16, 40, 0.4)" }}
                >
                  <div className="font-medium">{alert.title}</div>
                  <div className="text-gray-400 mt-0.5">{alert.message}</div>
                  {alert.suggestedAction && (
                    <div className="text-purple-400 mt-0.5">
                      💡 {alert.suggestedAction}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No positions state */}
        {(!data.totalSuppliedUSD || data.totalSuppliedUSD === 0) &&
          (!data.totalBorrowedUSD || data.totalBorrowedUSD === 0) && (
            <div className="text-center py-3">
              <Shield className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">
                No active positions to monitor
              </p>
              <p className="text-[10px] text-gray-600 mt-1">
                Deposit assets first, then I'll track your health in real-time
              </p>
            </div>
          )}

        {/* Last updated */}
        {data.lastUpdated && (
          <div className="mt-2 pt-2 border-t border-purple-900/15 text-[9px] text-gray-600 text-center">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Replace PortfolioPieChart in InlineCharts.tsx
// ═══════════════════════════════════════════
// ZERO prop changes needed in page.tsx or InlineChart dispatcher.
// This component is fully self-contained:
//   1. Reads connected account from localStorage
//   2. Fetches token balances from Mirror Node directly
//   3. Fetches HBAR price from Pyth
//   4. Fetches Bonzo Lend positions
//   5. Combines everything into one chart
//
// In InlineChart dispatcher, keep it simple:
//   case "portfolio":
//     return <PortfolioPieChart />;
// ═══════════════════════════════════════════

export function PortfolioPieChart() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [loading, setLoading] = useState(true);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ── Token metadata ──

  const TOKEN_NAMES: Record<string, string> = {
    // Testnet
    "0.0.1183558": "SAUCE", "0.0.3772909": "KARATE", "0.0.1418651": "XSAUCE",
    "0.0.5449": "USDC", "0.0.2233069": "HBARX", "0.0.2231533": "HBARX",
    "0.0.15058": "WHBAR",
    // Mainnet
    "0.0.731861": "SAUCE", "0.0.2283230": "KARATE", "0.0.1460200": "XSAUCE",
    "0.0.456858": "USDC", "0.0.834116": "HBARX", "0.0.1456986": "WHBAR",
    "0.0.3716059": "DOVU", "0.0.4794920": "PACK", "0.0.968069": "HST",
    "0.0.1159074": "GRELF", "0.0.8279134": "BONZO",
  };

  const TOKEN_DECIMALS: Record<string, number> = {
    // Testnet
    "0.0.1183558": 6, "0.0.3772909": 8, "0.0.1418651": 6,
    "0.0.5449": 6, "0.0.2233069": 8, "0.0.2231533": 8, "0.0.15058": 8,
    // Mainnet
    "0.0.731861": 6, "0.0.2283230": 8, "0.0.1460200": 8,
    "0.0.456858": 6, "0.0.834116": 8, "0.0.1456986": 8,
  };

  const TOKEN_COLORS: Record<string, string> = {
    HBAR: "#10B981", WHBAR: "#059669", USDC: "#3B82F6", SAUCE: "#F97316",
    KARATE: "#EF4444", XSAUCE: "#A855F7", HBARX: "#06B6D4", DOVU: "#84CC16",
    PACK: "#EC4899", HST: "#F59E0B", GRELF: "#6366F1", BONZO: "#8B5CF6",
  };

  const FALLBACK_COLORS = ["#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6", "#F43F5E", "#6366F1"];

  useEffect(() => {
    async function load() {
      try {
        // ── Step 1: Get connected account from localStorage ──
        const accountId =
          typeof window !== "undefined"
            ? localStorage.getItem("vaultmind_account")
            : null;

        if (!accountId) {
          setError("Connect a wallet first");
          setLoading(false);
          return;
        }

        // ── Step 2: Determine network ──
        const network = (process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet") as string;
        const mirrorBase =
          network === "mainnet"
            ? "https://mainnet.mirrornode.hedera.com"
            : "https://testnet.mirrornode.hedera.com";

        // ── Step 3: Fetch everything in parallel ──
        const [accountRes, tokensRes, pythRes, positionsRes] = await Promise.allSettled([
          fetch(`${mirrorBase}/api/v1/accounts/${accountId}`).then(r => r.json()),
          fetch(`${mirrorBase}/api/v1/accounts/${accountId}/tokens?limit=25`).then(r => r.json()),
          fetch("/api/pyth?action=hbar").then(r => r.json()),
          fetch("/api/positions").then(r => r.json()),
        ]);

        // ── Step 4: Parse HBAR price from Pyth ──
        let hbarPrice = 0.1;
        if (pythRes.status === "fulfilled" && pythRes.value?.success) {
          hbarPrice = pythRes.value.data?.price || 0.1;
        }

        // Token price estimates (HBAR from Pyth, rest estimated)
        const prices: Record<string, number> = {
          HBAR: hbarPrice, WHBAR: hbarPrice, USDC: 1.0,
          SAUCE: 0.022, KARATE: 0.001, XSAUCE: 0.025,
          HBARX: hbarPrice * 1.21, DOVU: 0.003, PACK: 0.005,
          HST: 0.002, GRELF: 0.001, BONZO: 0.01,
        };

        const holdingsMap = new Map<string, {
          symbol: string; balance: number; valueUsd: number;
          color: string; platform: string;
        }>();

        // ── Step 5: Parse HBAR balance ──
        if (accountRes.status === "fulfilled") {
          const hbarTinybar = parseInt(accountRes.value?.balance?.balance || "0");
          const hbarBalance = hbarTinybar / 1e8;
          if (hbarBalance > 0) {
            holdingsMap.set("HBAR", {
              symbol: "HBAR",
              balance: hbarBalance,
              valueUsd: hbarBalance * hbarPrice,
              color: TOKEN_COLORS.HBAR,
              platform: "Wallet",
            });
          }
        }

        // ── Step 6: Parse ALL wallet tokens ──
        if (tokensRes.status === "fulfilled") {
          const tokens = tokensRes.value?.tokens || [];
          for (const t of tokens) {
            const rawBalance = parseInt(t.balance || "0");
            if (rawBalance <= 0) continue;

            const tokenId = t.token_id;
            const symbol = TOKEN_NAMES[tokenId] || tokenId;
            const decimals = TOKEN_DECIMALS[tokenId] || 8;
            const balance = rawBalance / Math.pow(10, decimals);
            const price = prices[symbol] || 0;
            const valueUsd = balance * price;

            // WHBAR gets its own entry (don't merge with HBAR)
            const key = symbol;
            const existing = holdingsMap.get(key);
            if (existing && key !== "WHBAR") {
              existing.balance += balance;
              existing.valueUsd += valueUsd;
            } else {
              holdingsMap.set(key === "WHBAR" ? "WHBAR_wallet" : key, {
                symbol,
                balance,
                valueUsd,
                color: TOKEN_COLORS[symbol] || FALLBACK_COLORS[holdingsMap.size % FALLBACK_COLORS.length],
                platform: "Wallet",
              });
            }
          }
        }

        // ── Step 7: Parse Bonzo Lend supplied positions ──
        if (positionsRes.status === "fulfilled" && positionsRes.value?.success) {
          const positions = positionsRes.value.data?.positions || positionsRes.value.data || [];
          for (const pos of positions) {
            const sym = (pos.token || pos.symbol || "").toUpperCase();
            const supplied = parseFloat(pos.aTokenBalance || pos.supplied || "0");
            if (supplied <= 0) continue;

            const price = prices[sym] || (sym.includes("HBAR") ? hbarPrice : 0);
            const valueUsd = supplied * price;

            holdingsMap.set(`${sym}_bonzo`, {
              symbol: `${sym} (Supplied)`,
              balance: supplied,
              valueUsd,
              color: TOKEN_COLORS[sym] || "#6366F1",
              platform: "Bonzo Lend",
            });
          }
        }

        // ── Step 8: Build final sorted array with percentages ──
        const holdings = Array.from(holdingsMap.values())
          .filter(h => h.balance > 0)
          .sort((a, b) => b.valueUsd - a.valueUsd);

        const total = holdings.reduce((s, h) => s + h.valueUsd, 0);

        const final = holdings.map((h, i) => ({
          ...h,
          percentage: total > 0 ? ((h.valueUsd / total) * 100).toFixed(1) : "0",
          fill: h.color,
        }));

        setChartData(final);
        setTotalValue(total);
      } catch (err: any) {
        console.error("[PortfolioPie] Error:", err);
        setError("Failed to load portfolio data");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ── Render states ──

  if (loading) return <ChartLoader label="portfolio" />;

  if (error || !chartData.length) {
    return (
      <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 text-center">
        <span className="text-xs text-gray-500">{error || "No portfolio data. Connect a wallet first."}</span>
      </div>
    );
  }

  // ── Tooltip ──

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <div className="flex items-center gap-1.5 mb-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.fill }} />
          <span className="font-semibold text-gray-200">${d.symbol}</span>
        </div>
        <p className="text-gray-300">
          Balance:{" "}
          <span className="text-white">
            {d.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </p>
        <p className="text-gray-300">
          Value:{" "}
          <span className="text-emerald-400 font-medium">
            ${d.valueUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </span>
        </p>
        <p className="text-gray-500">{d.percentage}% • {d.platform}</p>
      </div>
    );
  };

  // ── Chart ──

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-200">Portfolio Breakdown</span>
        <span className="text-xs text-emerald-400 font-medium bg-emerald-500/10 px-2 py-0.5 rounded-full">
          Total: ${totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-56 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="valueUsd"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={85}
                paddingAngle={2}
                strokeWidth={1}
                stroke="#111827"
                onMouseEnter={(_, i) => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {chartData.map((h, i) => (
                  <Cell
                    key={h.symbol + i}
                    fill={h.fill}
                    opacity={hoveredIndex === null || hoveredIndex === i ? 1 : 0.35}
                    style={{ transition: "opacity 0.2s" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <text x="50%" y="48%" textAnchor="middle" fill="#9CA3AF" fontSize={10}>
                {chartData.length} assets
              </text>
              <text x="50%" y="58%" textAnchor="middle" fill="#E5E7EB" fontSize={14} fontWeight="bold">
                {hoveredIndex !== null
                  ? `${chartData[hoveredIndex]?.percentage}%`
                  : `$${totalValue >= 1000 ? (totalValue / 1000).toFixed(1) + "K" : totalValue.toFixed(0)}`}
              </text>
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5 min-w-0">
          {chartData.map((h, i) => (
            <div
              key={h.symbol + i}
              className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg transition-all cursor-pointer ${
                hoveredIndex === i
                  ? "bg-gray-700/60 ring-1 ring-gray-600"
                  : "bg-gray-800/30 hover:bg-gray-800/50"
              }`}
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: h.fill }}
              />
              <span className="text-gray-200 font-medium flex-1 truncate">${h.symbol}</span>
              <span className="text-gray-500 text-[10px] w-10 text-right">{h.percentage}%</span>
              <span className="text-gray-400 w-20 text-right tabular-nums">
                ${h.valueUsd >= 1000
                  ? (h.valueUsd / 1000).toFixed(1) + "K"
                  : h.valueUsd.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="text-[10px] text-gray-600 text-center pt-1">
            HBAR: Pyth Network • Tokens: estimated prices
          </div>
        </div>
      </div>
    </div>
  );
}
 

// ═══════════════════════════════════════════════════════════
// UPGRADED COMPONENTS — Replace in InlineCharts.tsx
// ═══════════════════════════════════════════════════════════


// ════════════════════════════════════════════
// 1. CORRELATION MATRIX — Redesigned
// ════════════════════════════════════════════

export function CorrelationMatrix() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

  useEffect(() => {
    fetch("/api/charts?type=correlation&days=30")
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="correlations" />;
  if (!data) return null;

  const { symbols, matrix } = data;

  // Smooth gradient from red → gray → green
  function corrBg(v: number): string {
    if (v >= 0.8) return "rgba(16, 185, 129, 0.5)";
    if (v >= 0.5) return "rgba(16, 185, 129, 0.3)";
    if (v >= 0.2) return "rgba(16, 185, 129, 0.15)";
    if (v >= -0.2) return "rgba(107, 114, 128, 0.15)";
    if (v >= -0.5) return "rgba(239, 68, 68, 0.15)";
    if (v >= -0.8) return "rgba(239, 68, 68, 0.3)";
    return "rgba(239, 68, 68, 0.5)";
  }

  function corrText(v: number): string {
    if (v >= 0.5) return "#6ee7b7";
    if (v >= 0.2) return "#a7f3d0";
    if (v >= -0.2) return "#9ca3af";
    if (v >= -0.5) return "#fca5a5";
    return "#f87171";
  }

  const isHighlighted = (row: number, col: number) =>
    hoveredCell !== null && (hoveredCell.row === row || hoveredCell.col === col);

  return (
    <div className="my-3 rounded-xl border border-gray-700/30 overflow-hidden" style={{ background: "rgba(17, 24, 39, 0.6)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(16,185,129,0.05))" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.15)" }}>
            <span className="text-sm">🔗</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-200">Asset Correlation Matrix</span>
            <span className="text-[10px] text-gray-500 ml-2">30-day rolling</span>
          </div>
        </div>
        <div className="flex items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(16,185,129,0.4)" }} /> Positive
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(107,114,128,0.2)" }} /> Neutral
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ background: "rgba(239,68,68,0.4)" }} /> Negative
          </span>
        </div>
      </div>

      {/* Matrix */}
      <div className="p-4 overflow-x-auto">
        <table className="w-full" style={{ borderSpacing: "3px", borderCollapse: "separate" }}>
          <thead>
            <tr>
              <th className="w-16" />
              {symbols.map((s: string, ci: number) => (
                <th key={s} className="px-1 py-2 text-center">
                  <span className={`text-[11px] font-semibold transition-colors duration-200 ${
                    hoveredCell?.col === ci ? "text-emerald-400" : "text-gray-400"
                  }`}>
                    {s}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((row: string, ri: number) => (
              <tr key={row}>
                <td className="pr-2 py-0.5">
                  <span className={`text-[11px] font-semibold transition-colors duration-200 ${
                    hoveredCell?.row === ri ? "text-emerald-400" : "text-gray-400"
                  }`}>
                    {row}
                  </span>
                </td>
                {matrix[ri].map((v: number, ci: number) => {
                  const isDiag = ri === ci;
                  const isHovered = hoveredCell?.row === ri && hoveredCell?.col === ci;
                  return (
                    <td
                      key={ci}
                      className="text-center"
                      onMouseEnter={() => setHoveredCell({ row: ri, col: ci })}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div
                        className="rounded-lg py-2 px-1 cursor-default transition-all duration-200"
                        style={{
                          background: isDiag
                            ? "rgba(139, 92, 246, 0.12)"
                            : corrBg(v),
                          transform: isHovered ? "scale(1.1)" : "scale(1)",
                          boxShadow: isHovered
                            ? `0 0 12px ${v >= 0 ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`
                            : "none",
                          opacity: hoveredCell !== null && !isHighlighted(ri, ci) && !isHovered ? 0.4 : 1,
                          minWidth: "3rem",
                        }}
                      >
                        <span
                          className="text-xs font-mono font-medium"
                          style={{ color: isDiag ? "#a78bfa" : corrText(v) }}
                        >
                          {isDiag ? "1.00" : v.toFixed(2)}
                        </span>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hover info */}
      {hoveredCell && hoveredCell.row !== hoveredCell.col && (
        <div className="px-4 pb-3 flex items-center gap-2 text-[11px]">
          <span className="text-gray-500">
            {symbols[hoveredCell.row]} × {symbols[hoveredCell.col]}:
          </span>
          <span className="font-mono font-semibold" style={{
            color: matrix[hoveredCell.row][hoveredCell.col] >= 0 ? "#6ee7b7" : "#fca5a5"
          }}>
            {matrix[hoveredCell.row][hoveredCell.col].toFixed(3)}
          </span>
          <span className="text-gray-600">
            {matrix[hoveredCell.row][hoveredCell.col] >= 0.7 ? "— strongly correlated, move together" :
             matrix[hoveredCell.row][hoveredCell.col] >= 0.3 ? "— moderately correlated" :
             matrix[hoveredCell.row][hoveredCell.col] >= -0.3 ? "— weak/no correlation (good for diversification)" :
             matrix[hoveredCell.row][hoveredCell.col] >= -0.7 ? "— inversely correlated (natural hedge)" :
             "— strongly inverse (strong hedge)"}
          </span>
        </div>
      )}
    </div>
  );
}


// ════════════════════════════════════════════
// 2. RISK / RETURN SCATTER — Redesigned
// ════════════════════════════════════════════

export function RiskReturnScatter() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/charts?type=riskreturn&days=30")
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="risk analysis" />;
  if (!data.length) return null;

  // Color by Sharpe tier
  function dotColor(sharpe: number): string {
    if (sharpe >= 1.0) return "#10b981";  // excellent
    if (sharpe >= 0.5) return "#3b82f6";  // good
    if (sharpe >= 0) return "#f59e0b";    // mediocre
    return "#ef4444";                      // negative
  }

  function dotGlow(sharpe: number): string {
    if (sharpe >= 1.0) return "0 0 10px rgba(16,185,129,0.4)";
    if (sharpe >= 0.5) return "0 0 10px rgba(59,130,246,0.3)";
    if (sharpe >= 0) return "0 0 10px rgba(245,158,11,0.3)";
    return "0 0 10px rgba(239,68,68,0.3)";
  }

  function sharpeLabel(sharpe: number): { label: string; color: string } {
    if (sharpe >= 1.0) return { label: "Excellent", color: "#10b981" };
    if (sharpe >= 0.5) return { label: "Good", color: "#3b82f6" };
    if (sharpe >= 0) return { label: "Mediocre", color: "#f59e0b" };
    return { label: "Poor", color: "#ef4444" };
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const tier = sharpeLabel(d.sharpe);
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-xs shadow-2xl min-w-[160px]">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dotColor(d.sharpe), boxShadow: dotGlow(d.sharpe) }} />
          <span className="font-bold text-gray-100 text-sm">{d.symbol}</span>
        </div>
        <div className="space-y-1.5">
          <div className="flex justify-between">
            <span className="text-gray-500">Return</span>
            <span className={d.avgReturn >= 0 ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
              {d.avgReturn >= 0 ? "+" : ""}{d.avgReturn.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Volatility</span>
            <span className="text-gray-300 font-medium">{d.volatility.toFixed(1)}%</span>
          </div>
          <div className="flex justify-between items-center pt-1 border-t border-gray-800">
            <span className="text-gray-500">Sharpe Ratio</span>
            <div className="flex items-center gap-1.5">
              <span className="font-bold" style={{ color: tier.color }}>{d.sharpe.toFixed(2)}</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{
                color: tier.color,
                background: `${tier.color}18`,
              }}>{tier.label}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="my-3 rounded-xl border border-gray-700/30 overflow-hidden" style={{ background: "rgba(17, 24, 39, 0.6)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(59,130,246,0.08), rgba(16,185,129,0.05))" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(59,130,246,0.15)" }}>
            <span className="text-sm">📊</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-200">Risk vs Return Analysis</span>
            <span className="text-[10px] text-gray-500 ml-2">30d annualized</span>
          </div>
        </div>
        {/* Sharpe legend */}
        <div className="flex items-center gap-2 text-[10px]">
          {[
            { label: "Excellent", color: "#10b981" },
            { label: "Good", color: "#3b82f6" },
            { label: "Mediocre", color: "#f59e0b" },
            { label: "Poor", color: "#ef4444" },
          ].map(t => (
            <span key={t.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
              <span className="text-gray-500">{t.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 15, bottom: 25, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
              <XAxis
                dataKey="volatility" name="Volatility"
                tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false}
                axisLine={{ stroke: "#374151" }}
                label={{ value: "Volatility % →", position: "bottom", fontSize: 10, fill: "#6b7280", offset: -5 }}
              />
              <YAxis
                dataKey="avgReturn" name="Return"
                tick={{ fontSize: 10, fill: "#6b7280" }} tickLine={false} axisLine={false}
                label={{ value: "↑ Return %", angle: -90, position: "insideLeft", fontSize: 10, fill: "#6b7280" }}
              />
              <ZAxis dataKey="sharpe" range={[80, 250]} />
              <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3", stroke: "#374151" }} />
              <Scatter data={data} onMouseEnter={(_, i) => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)}>
                {data.map((d: any, i: number) => (
                  <Cell
                    key={i}
                    fill={dotColor(d.sharpe)}
                    opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.3}
                    stroke={hoveredIdx === i ? "#fff" : "transparent"}
                    strokeWidth={hoveredIdx === i ? 2 : 0}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>

        {/* Asset pills */}
        <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-gray-800/50">
        {[...data].sort((a: any, b: any) => b.sharpe - a.sharpe).map((d: any, i: number) => {
            const tier = sharpeLabel(d.sharpe);
            return (
              <div
                key={d.symbol}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg cursor-default transition-all duration-200 hover:scale-105"
                style={{
                  background: hoveredIdx === i ? `${tier.color}18` : "rgba(31,41,55,0.5)",
                  border: `1px solid ${hoveredIdx === i ? `${tier.color}40` : "rgba(55,65,81,0.3)"}`,
                }}
                onMouseEnter={() => setHoveredIdx(data.indexOf(d))}
                onMouseLeave={() => setHoveredIdx(null)}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dotColor(d.sharpe) }} />
                <span className="text-[11px] font-medium text-gray-300">{d.symbol}</span>
                <span className="text-[10px] font-mono" style={{ color: tier.color }}>
                  {d.avgReturn >= 0 ? "+" : ""}{d.avgReturn.toFixed(0)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}


// ════════════════════════════════════════════
// 3. POSITIONS — Redesigned
// ════════════════════════════════════════════

function PositionsInline({ data }: { data?: any }) {
  const [positions, setPositions] = useState<any>(data || null);
  const [loading, setLoading] = useState(!data);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  useEffect(() => {
    if (data) { setPositions(data); return; }
    fetch("/api/positions").then(r => r.json()).then(j => {
      if (j.success) setPositions(j.data);
    }).finally(() => setLoading(false));
  }, [data]);

  if (loading) return <ChartLoader label="Fetching positions..." />;
  if (!positions) return <div className="text-xs text-gray-500 p-3">No position data available</div>;

  const p = positions;
  const totalSupplied = p.totalSuppliedUSD || 0;
  const totalBorrowed = p.totalBorrowedUSD || 0;
  const netWorth = p.netWorthUSD || totalSupplied - totalBorrowed;
  const hf = p.healthFactor;
  const isSafe = !hf || hf > 1e10 || hf >= 1.5;

  // Health factor color + label
  function hfStyle(): { color: string; bg: string; label: string } {
    if (!hf || hf > 1e10) return { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: "∞ No debt" };
    if (hf >= 2.0) return { color: "#10b981", bg: "rgba(16,185,129,0.1)", label: `${hf.toFixed(2)} Safe` };
    if (hf >= 1.5) return { color: "#3b82f6", bg: "rgba(59,130,246,0.1)", label: `${hf.toFixed(2)} Moderate` };
    if (hf >= 1.2) return { color: "#f59e0b", bg: "rgba(245,158,11,0.1)", label: `${hf.toFixed(2)} Warning` };
    return { color: "#ef4444", bg: "rgba(239,68,68,0.1)", label: `${hf.toFixed(2)} DANGER` };
  }

  const hfs = hfStyle();

  // Supply vs borrow bar ratio
  const total = totalSupplied + totalBorrowed;
  const supplyPct = total > 0 ? (totalSupplied / total) * 100 : 100;

  return (
    <div className="my-3 rounded-xl border border-gray-700/30 overflow-hidden" style={{ background: "rgba(17, 24, 39, 0.6)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between"
        style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.06), rgba(59,130,246,0.04))" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "rgba(16,185,129,0.15)" }}>
            <span className="text-sm">🏦</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-200">Bonzo Lend Positions</span>
            {p.accountId && <span className="text-[10px] text-gray-600 ml-2">{p.accountId}</span>}
          </div>
        </div>
        {/* Health badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold"
          style={{ color: hfs.color, background: hfs.bg, border: `1px solid ${hfs.color}30` }}>
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: hfs.color, boxShadow: `0 0 6px ${hfs.color}` }} />
          HF: {hfs.label}
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Supply vs Borrow visual bar */}
        <div>
          <div className="flex justify-between text-[10px] text-gray-500 mb-1.5">
            <span>Supplied</span>
            <span>Borrowed</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden flex" style={{ background: "rgba(31,41,55,0.6)" }}>
            <div
              className="h-full rounded-l-full transition-all duration-700"
              style={{
                width: `${supplyPct}%`,
                background: "linear-gradient(90deg, #10b981, #059669)",
                boxShadow: "0 0 8px rgba(16,185,129,0.3)",
              }}
            />
            {totalBorrowed > 0 && (
              <div
                className="h-full rounded-r-full transition-all duration-700"
                style={{
                  width: `${100 - supplyPct}%`,
                  background: "linear-gradient(90deg, #dc2626, #ef4444)",
                  boxShadow: "0 0 8px rgba(239,68,68,0.3)",
                }}
              />
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: "Supplied",
              value: `$${totalSupplied.toFixed(2)}`,
              color: "#10b981",
              bg: "rgba(16,185,129,0.08)",
              border: "rgba(16,185,129,0.15)",
            },
            {
              label: "Borrowed",
              value: `$${totalBorrowed.toFixed(2)}`,
              color: "#ef4444",
              bg: "rgba(239,68,68,0.08)",
              border: "rgba(239,68,68,0.15)",
            },
            {
              label: "Net Worth",
              value: `$${netWorth.toFixed(2)}`,
              color: netWorth >= 0 ? "#3b82f6" : "#ef4444",
              bg: netWorth >= 0 ? "rgba(59,130,246,0.08)" : "rgba(239,68,68,0.08)",
              border: netWorth >= 0 ? "rgba(59,130,246,0.15)" : "rgba(239,68,68,0.15)",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-xl p-3 text-center"
              style={{ background: card.bg, border: `1px solid ${card.border}` }}
            >
              <div className="text-[10px] text-gray-500 mb-0.5">{card.label}</div>
              <div className="text-base font-bold" style={{ color: card.color }}>{card.value}</div>
            </div>
          ))}
        </div>

        {/* Position rows */}
        {p.positions && p.positions.length > 0 ? (
          <div className="space-y-1.5">
            <div className="text-[10px] text-gray-500 font-medium uppercase tracking-wider px-1">Active Positions</div>
            {p.positions.map((pos: any, i: number) => {
              const isExpanded = expandedRow === i;
              const supplyVal = pos.suppliedUSD || 0;
              const borrowVal = pos.borrowedUSD || 0;
              const netVal = supplyVal - borrowVal;

              return (
                <div
                  key={i}
                  className="rounded-xl overflow-hidden cursor-pointer transition-all duration-200"
                  style={{
                    background: isExpanded ? "rgba(31,41,55,0.5)" : "rgba(31,41,55,0.25)",
                    border: `1px solid ${isExpanded ? "rgba(107,114,128,0.3)" : "rgba(55,65,81,0.2)"}`,
                  }}
                  onClick={() => setExpandedRow(isExpanded ? null : i)}
                >
                  {/* Main row */}
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold"
                        style={{ background: "rgba(139,92,246,0.12)", color: "#a78bfa" }}>
                        {pos.symbol?.charAt(0) || "?"}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-semibold text-gray-200">{pos.symbol}</span>
                          {pos.isCollateral && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full font-medium"
                              style={{ color: "#10b981", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)" }}>
                              COLLATERAL
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-gray-600">
                          Net: <span className={netVal >= 0 ? "text-emerald-400" : "text-red-400"}>
                            ${netVal.toFixed(2)}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {supplyVal > 0 && (
                        <div className="text-right">
                          <div className="text-sm font-semibold text-emerald-400">${supplyVal.toFixed(2)}</div>
                          <div className="text-[9px] text-gray-600">{pos.supplyAPY?.toFixed(2)}% APY</div>
                        </div>
                      )}
                      {borrowVal > 0 && (
                        <div className="text-right">
                          <div className="text-sm font-semibold text-red-400">-${borrowVal.toFixed(2)}</div>
                          <div className="text-[9px] text-gray-600">{pos.borrowAPY?.toFixed(2)}% APY</div>
                        </div>
                      )}
                      <span className={`text-gray-600 text-xs transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1 border-t border-gray-800/30 grid grid-cols-2 gap-2">
                      <div className="rounded-lg p-2" style={{ background: "rgba(16,185,129,0.06)" }}>
                        <div className="text-[9px] text-gray-500">Supplied Amount</div>
                        <div className="text-xs text-emerald-400 font-medium">{pos.supplied?.toFixed(4) || "0"} {pos.symbol}</div>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: "rgba(239,68,68,0.06)" }}>
                        <div className="text-[9px] text-gray-500">Borrowed Amount</div>
                        <div className="text-xs text-red-400 font-medium">{pos.borrowed?.toFixed(4) || "0"} {pos.symbol}</div>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: "rgba(59,130,246,0.06)" }}>
                        <div className="text-[9px] text-gray-500">Supply APY</div>
                        <div className="text-xs text-blue-400 font-medium">{pos.supplyAPY?.toFixed(2) || "0"}%</div>
                      </div>
                      <div className="rounded-lg p-2" style={{ background: "rgba(245,158,11,0.06)" }}>
                        <div className="text-[9px] text-gray-500">Borrow APY</div>
                        <div className="text-xs text-yellow-400 font-medium">{pos.borrowAPY?.toFixed(2) || "0"}%</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-6 space-y-2">
            <div className="text-2xl">🏦</div>
            <p className="text-xs text-gray-500">No active Bonzo Lend positions</p>
            <p className="text-[10px] text-gray-600">Try: "Supply 100 HBAR to Bonzo"</p>
          </div>
        )}

        {/* Footer */}
        {p.averageNetAPY !== undefined && p.averageNetAPY !== 0 && (
          <div className="flex items-center justify-center gap-2 pt-2 border-t border-gray-800/40">
            <span className="text-[10px] text-gray-500">Average Net APY:</span>
            <span className="text-xs font-semibold text-emerald-400">{p.averageNetAPY.toFixed(2)}%</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 4. APY COMPARISON BAR CHART
// ════════════════════════════════════════════

export function APYCompareChart() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charts?type=apycompare")
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="APY data" />;
  if (!data.length) return null;

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <span className="text-sm font-semibold text-gray-200 block mb-3">
        APY Comparison: Bonzo Lending vs SaucerSwap LP
      </span>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data.slice(0, 8)} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="symbol"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              labelStyle={{ color: "#9ca3af" }}
            />
            <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
            <Bar
              dataKey="bonzoSupplyAPY"
              name="Bonzo Supply"
              fill="#10b981"
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            />
            <Bar
              dataKey="saucerSwapAPY"
              name="SaucerSwap LP"
              fill="#3b82f6"
              radius={[2, 2, 0, 0]}
              maxBarSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 5. DEFI HEAT MAP
// ════════════════════════════════════════════

export function DeFiHeatMap() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charts?type=heatmap")
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="opportunities" />;
  if (!data.length) return null;

  function apyColor(apy: number): string {
    if (apy >= 20) return "bg-emerald-500/50 text-emerald-200";
    if (apy >= 10) return "bg-emerald-500/30 text-emerald-300";
    if (apy >= 5) return "bg-blue-500/30 text-blue-300";
    return "bg-gray-600/30 text-gray-400";
  }

  function riskBadge(risk: string): string {
    if (risk === "Low") return "text-emerald-400 bg-emerald-400/10";
    if (risk === "Medium") return "text-yellow-400 bg-yellow-400/10";
    return "text-red-400 bg-red-400/10";
  }

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <span className="text-sm font-semibold text-gray-200 block mb-3">
        DeFi Opportunities Heat Map
      </span>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {data.slice(0, 12).map((opp: any, i: number) => (
          <div
            key={i}
            className={`rounded-lg p-3 text-center ${apyColor(opp.apy)} cursor-default transition-transform hover:scale-105`}
            title={`${opp.pair} on ${opp.platform}\nAPY: ${opp.apy.toFixed(1)}%\nTVL: $${(opp.tvl / 1000).toFixed(0)}K\nRisk: ${opp.risk}`}
          >
            <div className="text-[11px] font-medium truncate">{opp.pair}</div>
            <div className="text-lg font-bold">{opp.apy.toFixed(1)}%</div>
            <div className="text-[10px] opacity-60">{opp.platform}</div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-emerald-500/50" /> &gt;20% APY
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-blue-500/30" /> 5-10%
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-gray-600/30" /> &lt;5%
        </span>
        <span className="ml-auto text-gray-500">
          Bonzo + SaucerSwap
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 6. OHLCV PRICE CHART (simplified line)
// ════════════════════════════════════════════

export function OHLCVChart({ poolId = 2 }: { poolId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [source, setSource] = useState<string>("SaucerSwap");

  useEffect(() => {
    // Try SaucerSwap first via charts API
    fetch(`/api/charts?type=ohlcv&poolId=${poolId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        const bars = j.data?.bars || (Array.isArray(j.data) ? j.data : []);
        if (bars.length > 0) {
          setData(bars);
          setSource("SaucerSwap");
          setLoading(false);
          return;
        }
        // Fallback: CoinGecko OHLC for HBAR
        return fetch("https://api.coingecko.com/api/v3/coins/hedera-hashgraph/ohlc?vs_currency=usd&days=30")
          .then((r) => r.json())
          .then((ohlc: number[][]) => {
            if (Array.isArray(ohlc) && ohlc.length > 0) {
              // CoinGecko OHLC format: [timestamp, open, high, low, close]
              // Aggregate to daily bars
              const dailyMap = new Map<string, any>();
              for (const [ts, open, high, low, close] of ohlc) {
                const day = new Date(ts).toISOString().split("T")[0];
                const existing = dailyMap.get(day);
                if (existing) {
                  existing.high = Math.max(existing.high, high);
                  existing.low = Math.min(existing.low, low);
                  existing.close = close; // last close of the day
                } else {
                  dailyMap.set(day, { timestamp: ts, open, high, low, close, volumeUsd: 0 });
                }
              }
              setData(Array.from(dailyMap.values()));
              setSource("CoinGecko");
            }
          });
      })
      .catch(() => {
        // Final fallback: CoinGecko directly
        fetch("https://api.coingecko.com/api/v3/coins/hedera-hashgraph/ohlc?vs_currency=usd&days=30")
          .then((r) => r.json())
          .then((ohlc: number[][]) => {
            if (Array.isArray(ohlc) && ohlc.length > 0) {
              const dailyMap = new Map<string, any>();
              for (const [ts, open, high, low, close] of ohlc) {
                const day = new Date(ts).toISOString().split("T")[0];
                const existing = dailyMap.get(day);
                if (existing) {
                  existing.high = Math.max(existing.high, high);
                  existing.low = Math.min(existing.low, low);
                  existing.close = close;
                } else {
                  dailyMap.set(day, { timestamp: ts, open, high, low, close, volumeUsd: 0 });
                }
              }
              setData(Array.from(dailyMap.values()));
              setSource("CoinGecko");
            }
          })
          .catch(() => {});
      })
      .finally(() => setLoading(false));
  }, [poolId]);

  if (loading) return <ChartLoader label="price data" />;
  if (!data.length) return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <span className="text-sm font-semibold text-gray-200 block mb-2">Price Chart (30 Day)</span>
      <p className="text-xs text-gray-500">Chart data temporarily unavailable. SaucerSwap OHLCV API may be rate-limited. Try again in a moment.</p>
    </div>
  );

  const chartData = data.map((bar: any) => ({
    date: new Date(bar.timestamp).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
    volume: bar.volumeUsd,
  }));

  const minPrice = Math.min(...chartData.map((d: any) => d.low).filter((v: number) => v > 0));
  const maxPrice = Math.max(...chartData.map((d: any) => d.high));

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-200">
          📈 HBAR Price Chart (30 Day)
        </span>
        <span className="text-[9px] text-gray-600">via {source}</span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 9, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              domain={[minPrice * 0.95, maxPrice * 1.05]}
              tickFormatter={(v) => `$${v.toFixed(4)}`}
              width={55}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#111827",
                border: "1px solid #374151",
                borderRadius: "8px",
                fontSize: "11px",
              }}
            />
            <Line
              type="monotone"
              dataKey="close"
              name="Close"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="high"
              name="High"
              stroke="#10b981"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              dot={false}
              opacity={0.4}
            />
            <Line
              type="monotone"
              dataKey="low"
              name="Low"
              stroke="#ef4444"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              dot={false}
              opacity={0.4}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 7. SENTIMENT GAUGE (radial)
// ════════════════════════════════════════════

export function SentimentGauge({
  score = 0,
  signal = "NEUTRAL",
  confidence = 50,
}: {
  score?: number;
  signal?: string;
  confidence?: number;
}) {
  const normalizedScore = Math.max(-100, Math.min(100, score));
  // Map -100..100 to 0..180 degrees
  const angle = ((normalizedScore + 100) / 200) * 180;

  const signalColors: Record<string, string> = {
    BULLISH: "#10b981",
    BEARISH: "#ef4444",
    NEUTRAL: "#eab308",
  };

  const color = signalColors[signal] || "#6b7280";

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <span className="text-sm font-semibold text-gray-200 block mb-3">
        Market Sentiment
      </span>
      <div className="flex items-center gap-6 justify-center">
        {/* Gauge SVG */}
        <svg width="160" height="90" viewBox="0 0 120 70" className="flex-shrink-0">
          {/* Background arc */}
          <path
            d="M 10 65 A 50 50 0 0 1 110 65"
            fill="none"
            stroke="#1f2937"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Colored segments */}
          <path
            d="M 10 65 A 50 50 0 0 1 35 20"
            fill="none"
            stroke="#ef4444"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M 35 20 A 50 50 0 0 1 85 20"
            fill="none"
            stroke="#eab308"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />
          <path
            d="M 85 20 A 50 50 0 0 1 110 65"
            fill="none"
            stroke="#10b981"
            strokeWidth="8"
            strokeLinecap="round"
            opacity="0.4"
          />
          {/* Needle */}
          <line
            x1="60"
            y1="65"
            x2={60 + 40 * Math.cos(((180 - angle) * Math.PI) / 180)}
            y2={65 - 40 * Math.sin(((180 - angle) * Math.PI) / 180)}
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <circle cx="60" cy="65" r="4" fill={color} />
          {/* Labels */}
          <text x="8" y="68" fontSize="7" fill="#6b7280">-100</text>
          <text x="55" y="10" fontSize="7" fill="#6b7280" textAnchor="middle">0</text>
          <text x="105" y="68" fontSize="7" fill="#6b7280">+100</text>
        </svg>

        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span
              className="text-2xl font-bold"
              style={{ color }}
            >
              {normalizedScore > 0 ? "+" : ""}
              {normalizedScore}
            </span>
            <span
              className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{
                color,
                backgroundColor: `${color}20`,
              }}
            >
              {signal}
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Confidence: {confidence > 1 ? confidence.toFixed(0) : (confidence * 100).toFixed(0)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 8. BONZO VAULT COMPARE CHART
// Bar chart comparing vault APYs with risk levels
// ════════════════════════════════════════════

function VaultCompareChart() {
  const [vaults, setVaults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vaults?action=list")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setVaults(d.data.vaults);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-4 text-gray-400 text-sm">Loading vault data...</div>;

  const riskColor: Record<string, string> = {
    low: "#10b981",
    medium: "#f59e0b",
    high: "#ef4444",
  };

  const strategyLabel: Record<string, string> = {
    "single-asset-dex": "CLM",
    "dual-asset-dex": "Dual",
    "leveraged-lst": "Leveraged",
  };

  const chartData = vaults.map((v: any) => ({
    name: v.name.replace("Bonzo ", ""),
    apy: v.apy || 0,
    tvl: (v.tvl || 0) / 1e6,
    risk: v.riskLevel || "medium",
    strategy: strategyLabel[v.strategy] || v.strategy,
    fill: riskColor[v.riskLevel] || "#6b7280",
  }));

  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-xl p-4 my-3">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-200">
          Bonzo Vault Comparison
        </h3>
        <span className="text-xs text-gray-500">APY % by vault</span>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 100, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis type="number" tick={{ fill: "#9ca3af", fontSize: 11 }} domain={[0, "auto"]} />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fill: "#d1d5db", fontSize: 10 }}
            width={95}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1f2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: any, name: any) => {
              if (name === "apy") return [`${Number(value).toFixed(1)}%`, "APY"];
              if (name === "tvl") return [`$${Number(value).toFixed(2)}M`, "TVL"];
              return [value, name];
            }}
          />
          <Bar
            dataKey="apy"
            radius={[0, 6, 6, 0]}
            label={{ position: "right", fill: "#9ca3af", fontSize: 11, formatter: (v: any) => `${Number(v).toFixed(1)}%` }}
          >
            {chartData.map((entry: any, i: number) => (
              <Cell key={i} fill={entry.fill} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 mt-2 justify-center">
        {Object.entries(riskColor).map(([risk, color]) => (
          <div key={risk} className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-gray-400 capitalize">{risk} risk</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// CHART WIDGET DISPATCHER
// Detects chart type from agent message and renders
// ════════════════════════════════════════════

export type ChartType =
  | "portfolio"
  | "correlation"
  | "riskreturn"
  | "apycompare"
  | "heatmap"
  | "ohlcv"
  | "sentiment"
  | "vaultcompare"
  | "dca"
  | "stader"
  | "healthmonitor"
  | "recommendation"
  // Action-based inline components (Jarvis mode)
  | "keeper"
  | "positions"
  | "hcs"
  | "performance"
  | "market"
  | "history"
  | "walletinfo"
  // Jarvis Phase 2: Full control
  | "strategyconfig"
  | "vaultaction"
  | "lendingaction"
  | "confirm"
  | "inlineerror";

/**
 * Detect which chart(s) to render based on message content.
 * Returns array of chart type strings.
 */
/**
 * Detect which charts to show based on USER QUERY ONLY.
 * Keywords are intentionally specific to avoid false positives.
 * We do NOT scan agent responses — they mention "risk", "vault", "portfolio"
 * in almost every answer, which causes unrelated charts to appear.
 */
export function detectCharts(message: string): ChartType[] {
  const lower = message.toLowerCase();
  const charts: ChartType[] = [];

  // Portfolio pie chart — explicit portfolio/holdings requests
  if (
    lower.includes("my portfolio") ||
    lower.includes("portfolio breakdown") ||
    lower.includes("portfolio chart") ||
    lower.includes("show portfolio") ||
    lower.includes("pie chart") ||
    lower.includes("my holdings") ||
    lower.includes("what do i own") ||
    lower.includes("what am i holding")
  ) {
    charts.push("portfolio");
  }

  // DCA detection
  if (lower.includes("dca") || lower.includes("dollar cost") || lower.includes("recurring deposit")) {
    charts.push("dca");
  }
  // Stader / HBARX detection
  if (lower.includes("hbarx") || lower.includes("stader") || lower.includes("liquid stak")) {
    charts.push("stader");
  }
  // Health monitor detection
  if (lower.includes("monitor") || lower.includes("health monitor") || lower.includes("liquidation risk")) {
    charts.push("healthmonitor");
  }

  // Correlation matrix — explicit correlation requests
  if (
    lower.includes("correlation") ||
    lower.includes("correlated") ||
    lower.includes("correlation matrix") ||
    lower.includes("relationship between")
  ) {
    charts.push("correlation");
  }

  // Risk/return scatter — must explicitly ask for risk+return analysis
  if (
    lower.includes("risk vs return") ||
    lower.includes("risk/return") ||
    lower.includes("risk and return") ||
    lower.includes("scatter plot") ||
    lower.includes("sharpe ratio") ||
    lower.includes("volatility analysis")
  ) {
    charts.push("riskreturn");
  }

  // APY comparison — explicit yield/APY comparison requests (Bonzo Lend vs SaucerSwap)
  if (
    lower.includes("compare apy") ||
    lower.includes("compare apys") ||
    lower.includes("compare yield") ||
    lower.includes("compare rates") ||
    lower.includes("apy comparison") ||
    lower.includes("yield comparison") ||
    lower.includes("best yield") ||
    lower.includes("where should i earn") ||
    lower.includes("apys across")
  ) {
    charts.push("apycompare");
  }

  // DeFi heat map — explicit heat map or DeFi landscape requests
  if (
    lower.includes("heat map") ||
    lower.includes("heatmap") ||
    lower.includes("defi landscape") ||
    lower.includes("defi opportunities") ||
    lower.includes("what's available") ||
    lower.includes("where can i invest")
  ) {
    charts.push("heatmap");
  }

  // OHLCV / price chart
  if (
    lower.includes("price chart") ||
    lower.includes("candlestick") ||
    lower.includes("ohlcv") ||
    lower.includes("price history") ||
    lower.includes("price action")
  ) {
    charts.push("ohlcv");
  }

  // Sentiment gauge — explicit sentiment or market mood
  if (
    lower.includes("market sentiment") ||
    lower.includes("fear and greed") ||
    lower.includes("fear & greed") ||
    lower.includes("market mood") ||
    lower.includes("how's the market") ||
    lower.includes("how is the market") ||
    lower.includes("bullish or bearish") ||
    lower.includes("show sentiment") ||
    lower.includes("check sentiment")
  ) {
    charts.push("sentiment");
  }

  // Vault comparison — explicit vault comparison requests
  if (
    lower.includes("vault comparison") ||
    lower.includes("compare vault") ||
    lower.includes("compare bonzo vault") ||
    lower.includes("vault apy") ||
    lower.includes("which vault") ||
    lower.includes("vault strategy") ||
    lower.includes("bonzo vault")
  ) {
    charts.push("vaultcompare");
  }

  // ── Jarvis Mode: Action/Feature Commands ──

// ── Intent-Based Recommendations ──
if (
  lower.includes("i want") ||
  lower.includes("safe yield") ||
  lower.includes("low risk yield") ||
  lower.includes("maximize return") ||
  lower.includes("maximum yield") ||
  lower.includes("best strategy") ||
  lower.includes("what should i do with") ||
  lower.includes("where should i put") ||
  lower.includes("how can i earn") ||
  lower.includes("earn yield") ||
  lower.includes("i'm aggressive") ||
  lower.includes("im aggressive") ||
  lower.includes("conservative strategy") ||
  lower.includes("aggressive strategy") ||
  lower.includes("suggest a vault") ||
  lower.includes("recommend") ||
  lower.includes("safest option") ||
  lower.includes("highest apy") ||
  lower.includes("what's the best")
) {
  charts.push("recommendation");
}

  // Keeper — run/execute/dry run
  if (
    lower.includes("run keeper") ||
    lower.includes("run dry run") ||
    lower.includes("dry run") ||
    lower.includes("execute keeper") ||
    lower.includes("keeper cycle") ||
    lower.includes("trigger keeper") ||
    lower.includes("start keeper")
  ) {
    charts.push("keeper");
  }

  // Positions — show my positions, health factor
  if (
    lower.includes("my positions") ||
    lower.includes("show positions") ||
    lower.includes("health factor") ||
    lower.includes("bonzo positions") ||
    lower.includes("lending positions") ||
    lower.includes("what did i deposit") ||
    lower.includes("what did i borrow")
  ) {
    charts.push("positions");
  }

  // HCS Audit Trail
  if (
    lower.includes("audit log") ||
    lower.includes("audit trail") ||
    lower.includes("hcs log") ||
    lower.includes("hcs history") ||
    lower.includes("show hcs") ||
    lower.includes("decision log") ||
    lower.includes("on-chain log") ||
    lower.includes("show audit")
  ) {
    charts.push("hcs");
  }

  // Performance / Backtest
  if (
    lower.includes("backtest") ||
    lower.includes("show performance") ||
    lower.includes("strategy performance") ||
    lower.includes("vaultmind vs hodl") ||
    lower.includes("how would") ||
    lower.includes("historical performance") ||
    lower.includes("run backtest")
  ) {
    charts.push("performance");
  }

  // Market Overview
  if (
    lower.includes("bonzo market") ||
    lower.includes("bonzo lend market") ||
    lower.includes("show market") ||
    lower.includes("lending market") ||
    lower.includes("market overview") ||
    lower.includes("all reserves") ||
    lower.includes("supply and borrow rates")
  ) {
    charts.push("market");
  }

  // Decision History
  if (
    lower.includes("decision history") ||
    lower.includes("keeper history") ||
    lower.includes("past decisions") ||
    lower.includes("show history") ||
    lower.includes("what did the keeper do") ||
    lower.includes("previous decisions")
  ) {
    charts.push("history");
  }

  // Wallet Info
  if (
    lower.includes("wallet info") ||
    lower.includes("my wallet") ||
    lower.includes("wallet details") ||
    lower.includes("show wallet") ||
    lower.includes("wallet balance") ||
    lower.includes("connected wallet") ||
    lower.includes("show my account")
  ) {
    charts.push("walletinfo");
  }

  // ── Jarvis Phase 2 Commands ──
  const isQuestion = lower.startsWith("when") || lower.startsWith("how") || lower.startsWith("should") || lower.startsWith("why") || lower.startsWith("what") || lower.startsWith("can") || lower.includes("?");

  // Strategy Config
  if (
    lower.includes("strategy config") ||
    lower.includes("show config") ||
    lower.includes("current strategy") ||
    lower.includes("show strategy") ||
    lower.includes("my strategy") ||
    lower.includes("keeper settings") ||
    lower.includes("reset strategy") ||
    lower.includes("set bearish") ||
    lower.includes("set bullish") ||
    lower.includes("set confidence") ||
    lower.includes("set volatility") ||
    lower.includes("set health factor") ||
    lower.includes("set yield")
  ) {
    charts.push("strategyconfig");
  }

  // Vault actions (deposit/withdraw/harvest) — only for imperative commands, not questions
  if (!isQuestion) {
    if (
      (lower.includes("deposit") && lower.includes("vault")) ||
      (lower.includes("withdraw") && lower.includes("vault")) ||
      (lower.includes("harvest") && (lower.includes("vault") || lower.includes("now") || lower.includes("rewards"))) ||
      lower.includes("switch vault")
    ) {
      charts.push("vaultaction");
    }

    // Lending actions (supply/borrow/repay/withdraw from Bonzo Lend)
    if (
      (lower.includes("supply") && (lower.includes("bonzo") || lower.includes("hbar") || lower.includes("usdc"))) ||
      (lower.includes("borrow") && (lower.includes("bonzo") || lower.includes("usdc") || lower.includes("hbar"))) ||
      (lower.includes("repay") && (lower.includes("loan") || lower.includes("debt") || lower.includes("usdc") || lower.includes("bonzo"))) ||
      (lower.includes("withdraw") && lower.includes("supplied"))
    ) {
      charts.push("lendingaction");
    }
  }

  return charts;
}

// ============================================
// Keeper Result Inline Component
// ============================================

function KeeperResultInline({ data }: { data?: any }) {
  if (!data) return <ChartLoader label="Running keeper..." />;

  const actionColors: Record<string, string> = {
    HOLD: "text-yellow-400 bg-yellow-900/30 border-yellow-500/30",
    HARVEST: "text-orange-400 bg-orange-900/30 border-orange-500/30",
    REPAY_DEBT: "text-red-400 bg-red-900/30 border-red-500/30",
    EXIT_TO_STABLE: "text-red-400 bg-red-900/30 border-red-500/30",
    REBALANCE: "text-blue-400 bg-blue-900/30 border-blue-500/30",
    INCREASE_POSITION: "text-emerald-400 bg-emerald-900/30 border-emerald-500/30",
    DEPOSIT: "text-emerald-400 bg-emerald-900/30 border-emerald-500/30",
    SWITCH_VAULT: "text-blue-400 bg-blue-900/30 border-blue-500/30",
    WITHDRAW: "text-red-400 bg-red-900/30 border-red-500/30",
  };

  const lend = data.decision;
  const vault = data.vaultDecision;

  return (
    <div className="rounded-xl border border-emerald-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
        <span>⚡</span> Keeper Cycle Complete
        <span className="text-[10px] text-gray-500 ml-auto">{data.durationMs}ms</span>
      </div>

      {/* Lending Decision */}
      {lend && (
        <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700/40">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-gray-400">Bonzo Lend</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${actionColors[lend.action] || "text-gray-400"}`}>
              {lend.action}
            </span>
            <span className="text-[10px] text-gray-500 ml-auto">
              Confidence: {(lend.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{lend.reason}</p>
          {lend.targetMarket && (
            <p className="text-[10px] text-gray-500 mt-1">Target: {lend.targetMarket} • Amount: {lend.amount || "calculated"}</p>
          )}
        </div>
      )}

      {/* Vault Decision */}
      {vault && (
        <div className="p-3 rounded-lg bg-purple-900/20 border border-purple-700/30">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-purple-300">Bonzo Vaults</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${actionColors[vault.action] || "text-gray-400"}`}>
              {vault.action}
            </span>
            <span className="text-[10px] text-gray-500 ml-auto">
              Confidence: {vault.confidence > 1 ? vault.confidence.toFixed(0) : (vault.confidence * 100).toFixed(0)}%
            </span>
          </div>
          <p className="text-xs text-gray-400 leading-relaxed">{vault.reason}</p>
        </div>
      )}

      {/* Sentiment Context */}
      {data.sentiment && (
        <div className="flex items-center gap-3 text-[10px] text-gray-500 pt-1 border-t border-gray-800/60">
          <span>Sentiment: {data.sentiment.score > 0 ? "+" : ""}{data.sentiment.score}</span>
          <span>•</span>
          <span>Signal: {data.sentiment.signal}</span>
          {data.hcsLog?.logged && (
            <>
              <span>•</span>
              <span className="text-emerald-400">✓ HCS Logged</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// HCS Audit Timeline Inline Component
// ============================================

function parseHCSEntry(entry: any): { action: string; reason: string; seqNum: number; ts: string } {
  let action = entry.action || "";
  let reason = entry.reason || "";
  if (!action) {
    try {
      const raw = entry.message || "";
      const parsed = JSON.parse(raw.startsWith("{") ? raw : atob(raw));
      action = parsed.action || "LOGGED";
      reason = parsed.reason || "";
    } catch { action = "LOGGED"; }
  }
  return {
    action,
    reason,
    seqNum: entry.sequenceNumber || entry.sequence_number || 0,
    ts: entry.consensusTimestamp || entry.consensus_timestamp || "",
  };
}

function actionMatchesFilter(action: string, filter: string): boolean {
  const a = action.toUpperCase();
  const f = filter.toUpperCase();
  // Exact match
  if (a === f) return true;
  // Partial match: "HARVEST" matches "EXECUTE_VAULT_HARVEST"
  if (a.includes(f)) return true;
  // Also match without EXECUTE_ prefix: "VAULT_SWITCH" matches "EXECUTE_VAULT_SWITCH"
  if (a.replace("EXECUTE_", "").includes(f)) return true;
  // Match just the last segment: "HARVEST" matches "EXECUTE_VAULT_HARVEST"
  const segments = a.split("_");
  if (segments.includes(f)) return true;
  return false;
}

function getActionColor(action: string): string {
  const a = action.toUpperCase();
  if (a.includes("HOLD")) return "text-yellow-400 bg-yellow-400/10";
  if (a.includes("HARVEST")) return "text-orange-400 bg-orange-400/10";
  if (a.includes("DEPOSIT") || a.includes("INCREASE")) return "text-emerald-400 bg-emerald-400/10";
  if (a.includes("WITHDRAW") || a.includes("EXIT")) return "text-red-400 bg-red-400/10";
  if (a.includes("BORROW")) return "text-blue-400 bg-blue-400/10";
  if (a.includes("REPAY")) return "text-purple-400 bg-purple-400/10";
  if (a.includes("SWITCH") || a.includes("REBALANCE")) return "text-cyan-400 bg-cyan-400/10";
  if (a.includes("FAIL")) return "text-red-400 bg-red-400/10";
  return "text-emerald-400 bg-emerald-400/10";
}

function HCSInline({ data }: { data?: any }) {
  const [allEntries, setAllEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [topicId, setTopicId] = useState<string | null>(null);

  const filterAction = data?.filterAction || null; // e.g. "HARVEST", "BORROW"
  const filterCount = data?.filterCount || null;   // e.g. 5, 10 — null means show all
  const filterOrder = data?.filterOrder || "desc";  // "asc" for first N, "desc" for last N

  useEffect(() => {
    const storedTopic = typeof window !== "undefined"
      ? localStorage.getItem("vaultmind_hcs_topic")
      : null;

    // Always fetch max entries — we filter client-side
    const url = storedTopic
      ? `/api/hcs?topicId=${storedTopic}&limit=100`
      : `/api/hcs?limit=100`;

    fetch(url).then(r => r.json()).then(j => {
      if (j.success) {
        const msgs = j.data?.messages || j.data?.decisions || [];
        setAllEntries(msgs);
        setTopicId(j.data?.topicId || storedTopic || null);
      }
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="Fetching HCS audit log..." />;

  // Apply filters
  let displayEntries = [...allEntries];

  // Filter by action type (partial match)
  if (filterAction) {
    displayEntries = displayEntries.filter((entry) => {
      const { action } = parseHCSEntry(entry);
      return actionMatchesFilter(action, filterAction);
    });
  }

  // Apply ordering: entries from API are desc (newest first)
  if (filterOrder === "asc") {
    displayEntries = displayEntries.reverse();
  }

  // Apply count limit
  if (filterCount && filterCount > 0) {
    displayEntries = displayEntries.slice(0, filterCount);
  }

  // Build description
  let filterDesc = "";
  if (filterAction && filterCount) {
    filterDesc = `Showing ${filterOrder === "asc" ? "first" : "last"} ${filterCount} ${filterAction} entries`;
  } else if (filterAction) {
    filterDesc = `Filtered: ${filterAction} actions (${displayEntries.length} found)`;
  } else if (filterCount) {
    filterDesc = `Showing ${filterOrder === "asc" ? "first" : "last"} ${filterCount} of ${allEntries.length} entries`;
  } else {
    filterDesc = `${displayEntries.length} entries on-chain`;
  }

  return (
    <div className="rounded-xl border border-cyan-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-cyan-400">
        <span>📋</span> HCS Audit Trail
        {topicId && <span className="text-[10px] text-gray-500 ml-auto">Audit Topic: {topicId}</span>}
      </div>

      {displayEntries.length === 0 ? (
        <p className="text-xs text-gray-500 text-center py-3">
          {filterAction
            ? `No ${filterAction} actions found in ${allEntries.length} audit entries.`
            : "No audit entries yet. Run the keeper to create entries."}
        </p>
      ) : (
        <>
          <p className="text-[10px] text-gray-500">{filterDesc}</p>
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
            {displayEntries.map((entry: any, i: number) => {
              const { action, reason, seqNum, ts } = parseHCSEntry(entry);
              return (
                <div key={`${seqNum}-${i}`} className="p-2.5 rounded-lg bg-gray-800/40 border border-gray-700/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${getActionColor(action)}`}>
                      {action}
                    </span>
                    <span className="text-[9px] text-gray-600">
                      seq #{seqNum}{ts ? ` • ${new Date(Number(String(ts).split(".")[0]) * 1000).toLocaleTimeString()}` : ""}
                    </span>
                  </div>
                  {reason && (
                    <p className="text-[10px] text-gray-400 leading-relaxed">
                      {reason.substring(0, 150)}{reason.length > 150 ? "..." : ""}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {topicId && (
        <div className="text-[10px] text-center">
          <a href={`https://hashscan.io/testnet/topic/${topicId}`} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">
            View on HashScan →
          </a>
        </div>
      )}
    </div>
  );
}

// ============================================
// Performance / Backtest Inline Component
// ============================================

function PerformanceInline() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance?days=30&investment=1000").then(r => r.json()).then(j => {
      if (j.success) setData(j.data);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="Running backtest..." />;
  if (!data) return <div className="text-xs text-gray-500 p-3">Backtest data unavailable</div>;

  // API returns { dataPoints: [...], summary: { vaultmindReturn, passiveReturn, outperformance, totalDecisions, ... } }
  const s = data.summary || {};
  const strategyReturn = s.vaultmindReturn ?? 0;
  const hodlReturn = s.passiveReturn ?? 0;
  const alpha = s.outperformance ?? (strategyReturn - hodlReturn);
  const totalDecisions = s.totalDecisions ?? 0;
  const winRate = totalDecisions > 0 ? ((s.harvests || 0) + (s.increases || 0)) / totalDecisions * 100 : 0;
  const dailyData = (data.dataPoints || []).map((p: any) => ({
    date: p.date,
    strategy: p.vaultmindValue,
    hodl: p.passiveValue,
  }));

  return (
    <div className="rounded-xl border border-amber-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
        <span>📈</span> Backtest: VaultMind vs HODL (30 Days)
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "VaultMind Return", value: `${strategyReturn > 0 ? "+" : ""}${strategyReturn.toFixed(2)}%`, color: strategyReturn > 0 ? "text-emerald-400" : "text-red-400" },
          { label: "HODL Return", value: `${hodlReturn > 0 ? "+" : ""}${hodlReturn.toFixed(2)}%`, color: hodlReturn > 0 ? "text-emerald-400" : "text-red-400" },
          { label: "Alpha", value: `${alpha > 0 ? "+" : ""}${alpha.toFixed(2)}%`, color: alpha > 0 ? "text-emerald-400" : "text-red-400" },
        ].map((stat) => (
          <div key={stat.label} className="bg-gray-800/40 rounded-lg p-2 text-center">
            <div className="text-[10px] text-gray-500">{stat.label}</div>
            <div className={`text-sm font-semibold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Mini Chart */}
      {dailyData.length > 0 && (
        <ResponsiveContainer width="100%" height={150}>
          <LineChart data={dailyData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#6b7280" }} tickFormatter={(v: string) => v?.substring(5) || ""} />
            <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
            <Tooltip contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: "8px", fontSize: "11px" }} />
            <Line dataKey="strategy" name="VaultMind" stroke="#10b981" strokeWidth={2} dot={false} />
            <Line dataKey="hodl" name="HODL" stroke="#6b7280" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            <Legend wrapperStyle={{ fontSize: "10px" }} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div className="flex justify-between text-[10px] text-gray-500 pt-1 border-t border-gray-800/50">
        <span>Decisions: {totalDecisions}</span>
        <span>Win Rate: {winRate.toFixed(0)}%</span>
        <span>Harvests: {s.harvests || 0} | Holds: {s.holds || 0}</span>
      </div>
    </div>
  );
}

// ============================================
// Market Overview Inline Component
// ============================================

function MarketInline({ data }: { data?: any }) {
  const [markets, setMarkets] = useState<any[]>(data?.markets || []);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data?.markets) { setMarkets(data.markets); return; }
    fetch("/api/market").then(r => r.json()).then(j => {
      if (j.success) setMarkets(j.data?.markets || []);
    }).finally(() => setLoading(false));
  }, [data]);

  if (loading) return <ChartLoader label="Fetching Bonzo Lend markets..." />;

  const sorted = [...markets].filter((m: any) => m.isActive !== false).sort((a: any, b: any) => (b.supplyAPY || 0) - (a.supplyAPY || 0));

  return (
    <div className="rounded-xl border border-gray-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <span>🏦</span> Bonzo Lend Markets
        <span className="text-[10px] text-gray-500 ml-auto">{sorted.length} active reserves</span>
      </div>
      <div className="space-y-1">
        {sorted.slice(0, 10).map((m: any) => (
          <div key={m.symbol} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-200 w-16">{m.symbol}</span>
              <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500/50 rounded-full" style={{ width: `${Math.min(m.utilizationRate || 0, 100)}%` }} />
              </div>
              <span className="text-[9px] text-gray-500">{(m.utilizationRate || 0).toFixed(0)}% util</span>
            </div>
            <div className="flex gap-4 text-xs text-right">
              <div>
                <span className="text-emerald-400">{(m.supplyAPY || 0).toFixed(2)}%</span>
                <span className="text-[9px] text-gray-600 ml-1">supply</span>
              </div>
              <div>
                <span className="text-red-400">{(m.borrowAPY || 0).toFixed(2)}%</span>
                <span className="text-[9px] text-gray-600 ml-1">borrow</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Decision History Inline Component
// ============================================

function DecisionHistoryInline({ data }: { data?: any }) {
  if (!data?.history || data.history.length === 0) {
    return (
      <div className="rounded-xl border border-gray-800/40 bg-gray-900/60 p-4 text-center">
        <span className="text-xs text-gray-500">No keeper decisions this session. Run the keeper first.</span>
      </div>
    );
  }

  const actionEmojis: Record<string, string> = {
    HOLD: "⏸️", HARVEST: "🌾", REPAY_DEBT: "💸", EXIT_TO_STABLE: "🛡️",
    REBALANCE: "⚖️", INCREASE_POSITION: "📈", DEPOSIT: "💰", SWITCH_VAULT: "🔄", WITHDRAW: "📤",
  };

  return (
    <div className="rounded-xl border border-gray-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <span>📜</span> Decision History
        <span className="text-[10px] text-gray-500 ml-auto">{data.history.length} decisions</span>
      </div>
      <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
        {data.history.slice(0, 10).map((h: any, i: number) => (
          <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-gray-800/40 border border-gray-700/30">
            <span className="text-sm mt-0.5">{actionEmojis[h.decision?.action] || "⚡"}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-xs font-medium text-gray-200">{h.decision?.action}</span>
                <span className="text-[9px] text-gray-600">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
              <p className="text-[10px] text-gray-400 leading-relaxed truncate">{h.decision?.reason}</p>
            </div>
            <span className="text-[9px] text-gray-600 flex-shrink-0">{h.durationMs}ms</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================
// Wallet Info Inline Component
// ============================================

function WalletInfoInline({ data }: { data?: any }) {
  const [hoveredToken, setHoveredToken] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Token name mapping
  const TOKEN_NAMES: Record<string, { symbol: string; color: string }> = {
    "0.0.1183558": { symbol: "SAUCE", color: "#F97316" },
    "0.0.3772909": { symbol: "KARATE", color: "#EF4444" },
    "0.0.1418651": { symbol: "XSAUCE", color: "#A855F7" },
    "0.0.5449":    { symbol: "USDC", color: "#3B82F6" },
    "0.0.2231533": { symbol: "HBARX", color: "#06B6D4" },
    "0.0.2233069": { symbol: "HBARX", color: "#06B6D4" },
    "0.0.15058":   { symbol: "WHBAR", color: "#10B981" },
    "0.0.731861":  { symbol: "SAUCE", color: "#F97316" },
    "0.0.834116":  { symbol: "HBARX", color: "#06B6D4" },
    "0.0.456858":  { symbol: "USDC", color: "#3B82F6" },
    "0.0.1456986": { symbol: "WHBAR", color: "#10B981" },
    "0.0.1460200": { symbol: "XSAUCE", color: "#A855F7" },
    "0.0.2283230": { symbol: "KARATE", color: "#EF4444" },
  };

  const FALLBACK_COLORS = ["#F59E0B", "#EC4899", "#8B5CF6", "#14B8A6", "#F43F5E", "#6366F1"];

  if (!data) {
    return (
      <div className="rounded-xl border border-gray-800/40 bg-gray-900/60 p-4 text-center">
        <span className="text-xs text-gray-500">No wallet connected. Type: connect wallet 0.0.XXXXX</span>
      </div>
    );
  }

  // Build token list with resolved names
  const hbarBalance = data.hbarBalance || 0;
  const hbarUSD = data.hbarBalanceUSD || 0;
  const hbarPrice = hbarBalance > 0 ? hbarUSD / hbarBalance : 0;

  const resolvedTokens = (data.tokens || []).map((t: any, i: number) => {
    const mapped = TOKEN_NAMES[t.tokenId];
    return {
      id: t.tokenId,
      symbol: mapped?.symbol || t.symbol || `TOKEN`,
      balance: t.balance || 0,
      color: mapped?.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
    };
  }).filter((t: any) => t.balance > 0);

  // Build chart data: HBAR + tokens
  // For the donut we need some kind of "value" — use balance as relative weight
  // since we don't have USD values for all tokens
  const chartItems = [
    { symbol: "HBAR", balance: hbarBalance, color: "#10B981", usd: hbarUSD },
    ...resolvedTokens.map((t: any) => ({ ...t, usd: 0 })),
  ].filter(item => item.balance > 0);

  const totalBalance = chartItems.reduce((s, t) => s + t.balance, 0);

  // SVG donut chart
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 68;
  const innerR = 44;

  let cumulativeAngle = -90; // start from top
  const arcs = chartItems.map((item) => {
    const pct = totalBalance > 0 ? (item.balance / totalBalance) * 100 : 0;
    const angle = (pct / 100) * 360;
    const startAngle = cumulativeAngle;
    cumulativeAngle += angle;
    const endAngle = cumulativeAngle;

    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    const x1Outer = cx + outerR * Math.cos(startRad);
    const y1Outer = cy + outerR * Math.sin(startRad);
    const x2Outer = cx + outerR * Math.cos(endRad);
    const y2Outer = cy + outerR * Math.sin(endRad);
    const x1Inner = cx + innerR * Math.cos(endRad);
    const y1Inner = cy + innerR * Math.sin(endRad);
    const x2Inner = cx + innerR * Math.cos(startRad);
    const y2Inner = cy + innerR * Math.sin(startRad);

    const largeArc = angle > 180 ? 1 : 0;

    // For very small slices or single item
    if (pct >= 99.9) {
      return {
        ...item, pct,
        path: `M ${cx} ${cy - outerR} A ${outerR} ${outerR} 0 1 1 ${cx - 0.01} ${cy - outerR} Z M ${cx} ${cy - innerR} A ${innerR} ${innerR} 0 1 0 ${cx - 0.01} ${cy - innerR} Z`,
      };
    }

    const path = [
      `M ${x1Outer} ${y1Outer}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2Outer} ${y2Outer}`,
      `L ${x1Inner} ${y1Inner}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2Inner} ${y2Inner}`,
      `Z`,
    ].join(" ");

    return { ...item, pct, path };
  });

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="rounded-xl border border-emerald-800/40 bg-gray-900/60 p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
          <span>👛</span> Wallet Connected
        </div>
        <span className="text-[10px] text-gray-600 bg-gray-800/60 px-2 py-0.5 rounded-full">
          {data.network || "testnet"}
        </span>
      </div>

      {/* Account + Balance row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800/40 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">Account</div>
          <div className="text-xs font-medium text-gray-200">{data.accountId}</div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">HBAR Balance</div>
          <div className="text-sm font-semibold text-emerald-400">{hbarBalance.toFixed(2)}</div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">USD Value</div>
          <div className="text-sm font-semibold text-blue-400">${hbarUSD.toFixed(2)}</div>
        </div>
      </div>

      {/* Donut Chart + Legend */}
      {chartItems.length > 0 && (
        <div className="flex items-center gap-4 pt-1">
          {/* Donut */}
          <div
            className="relative flex-shrink-0"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredToken(null)}
          >
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
              {/* Background ring */}
              <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="#1F2937" strokeWidth={outerR - innerR} opacity={0.3} />

              {arcs.map((arc, i) => (
                <path
                  key={arc.symbol + i}
                  d={arc.path}
                  fill={arc.color}
                  stroke="#111827"
                  strokeWidth={1}
                  opacity={hoveredToken === null || hoveredToken === arc.symbol ? 1 : 0.3}
                  style={{
                    cursor: "pointer",
                    transition: "opacity 0.2s, transform 0.2s",
                    transformOrigin: `${cx}px ${cy}px`,
                    transform: hoveredToken === arc.symbol ? "scale(1.04)" : "scale(1)",
                  }}
                  onMouseEnter={() => setHoveredToken(arc.symbol)}
                />
              ))}

              {/* Center text */}
              <text x={cx} y={cy - 6} textAnchor="middle" fill="#9CA3AF" fontSize="9" fontFamily="Arial">
                {chartItems.length} tokens
              </text>
              <text x={cx} y={cy + 10} textAnchor="middle" fill="#E5E7EB" fontSize="12" fontWeight="bold" fontFamily="Arial">
                {hoveredToken
                  ? `${arcs.find(a => a.symbol === hoveredToken)?.pct.toFixed(1)}%`
                  : `$${hbarUSD.toFixed(0)}`
                }
              </text>
            </svg>

            {/* Tooltip */}
            {hoveredToken && (
              <div
                className="absolute z-50 pointer-events-none bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 shadow-xl"
                style={{
                  left: Math.min(mousePos.x + 12, size - 100),
                  top: mousePos.y - 60,
                }}
              >
                {(() => {
                  const t = arcs.find(a => a.symbol === hoveredToken);
                  if (!t) return null;
                  return (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                        <span className="text-xs font-semibold text-white">${t.symbol}</span>
                      </div>
                      <div className="text-[11px] text-gray-300">
                        Balance: <span className="text-white font-medium">{t.balance.toLocaleString(undefined, { maximumFractionDigits: 4 })}</span>
                      </div>
                      <div className="text-[11px] text-gray-300">
                        Share: <span className="text-white font-medium">{t.pct.toFixed(1)}%</span>
                      </div>
                      {t.usd > 0 && (
                        <div className="text-[11px] text-gray-300">
                          Value: <span className="text-emerald-400 font-medium">${t.usd.toFixed(2)}</span>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {arcs.map((arc, i) => (
              <div
                key={arc.symbol + i}
                className={`flex items-center justify-between text-xs px-2 py-1.5 rounded-lg cursor-pointer transition-all ${
                  hoveredToken === arc.symbol
                    ? "bg-gray-700/60 ring-1 ring-gray-600"
                    : "bg-gray-800/30 hover:bg-gray-800/50"
                }`}
                onMouseEnter={() => setHoveredToken(arc.symbol)}
                onMouseLeave={() => setHoveredToken(null)}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: arc.color }} />
                  <span className="text-gray-200 font-medium truncate">${arc.symbol}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-gray-400 tabular-nums">
                    {arc.balance >= 1000
                      ? `${(arc.balance / 1000).toFixed(1)}K`
                      : arc.balance.toFixed(arc.balance < 1 ? 4 : 2)}
                  </span>
                  <span className="text-gray-600 text-[10px] w-10 text-right">{arc.pct.toFixed(1)}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* EVM Address */}
      {data.evmAddress && (
        <div className="text-[10px] text-gray-600 text-center pt-1 border-t border-gray-800/40">
          EVM: {data.evmAddress}
        </div>
      )}
    </div>
  );
}

/** Render a chart/component by type */
export function InlineChart({
  type,
  sentiment,
  data,
  onAction,
}: {
  type: ChartType;
  sentiment?: { score: number; signal: string; confidence: number };
  data?: any;
  onAction?: (action: string, payload?: any) => void;
}) {
  switch (type) {
    case "portfolio":
      return <PortfolioPieChart />;
    case "correlation":
      return <CorrelationMatrix />;
    case "riskreturn":
      return <RiskReturnScatter />;
    case "apycompare":
      return <APYCompareChart />;
    case "heatmap":
      return <DeFiHeatMap />;
    case "ohlcv":
      return <OHLCVChart />;
    case "sentiment":
      return (
        <SentimentGauge
          score={sentiment?.score || 0}
          signal={sentiment?.signal || "NEUTRAL"}
          confidence={sentiment?.confidence || 50}
        />
      );
    case "vaultcompare":
      return <VaultCompareChart />;
    case "dca":
      return <DCACard data={data} onAction={onAction} />;
    case "stader":
      return <StaderCard data={data} />;
    case "healthmonitor":
      return <HealthMonitorCard data={data} />;  
    // ── Jarvis Mode Components ──
    case "keeper":
      return <KeeperResultInline data={data} />;
    case "positions":
      return <PositionsInline data={data} />;
    case "hcs":
      return <HCSInline data={data} />;
    case "performance":
      return <PerformanceInline />;
    case "market":
      return <MarketInline data={data} />;
    case "history":
      return <DecisionHistoryInline data={data} />;
    case "walletinfo":
      return <WalletInfoInline data={data} />;
    // ── Jarvis Phase 2: Full Control ──
    case "strategyconfig":
      return <StrategyConfigInline data={data} />;
    case "vaultaction":
      return <VaultActionInline data={data} onAction={onAction} />;
    case "lendingaction":
      return <LendingActionInline data={data} onAction={onAction} />;
    case "confirm":
      return <ConfirmActionInline data={data} onAction={onAction} />;
    case "inlineerror":
      return <ErrorInline data={data} />;
      case "recommendation":
        return <RecommendationInline data={data} onAction={onAction} />;  
    default:
      return null;
  }
}

// ============================================
// Jarvis Phase 2: Strategy Config Inline
// ============================================

function StrategyConfigInline({ data }: { data?: any }) {
  if (!data) return null;
  const { config, changes, action: configAction } = data;

  return (
    <div className="rounded-xl border border-indigo-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-indigo-400">
        <span>⚙️</span>
        {configAction === "show" ? "Current Strategy Config" :
         configAction === "reset" ? "Strategy Reset to Defaults" :
         "Strategy Config Updated"}
      </div>

      {/* Show changes if any */}
      {changes && changes.length > 0 && (
        <div className="space-y-1.5">
          {changes.map((c: any, i: number) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-900/20 border border-indigo-700/20">
              <span className="text-xs text-gray-400 w-36">{c.label}</span>
              <span className="text-xs text-red-400 line-through">{c.old}</span>
              <span className="text-xs text-gray-500">→</span>
              <span className="text-xs text-emerald-400 font-medium">{c.new}</span>
            </div>
          ))}
        </div>
      )}

      {/* Show full config */}
      {config && (
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: "Bearish Threshold", value: config.bearishThreshold, color: "text-red-400" },
            { label: "Bullish Threshold", value: config.bullishThreshold, color: "text-emerald-400" },
            { label: "Confidence Min", value: `${(config.confidenceMinimum * 100).toFixed(0)}%`, color: "text-blue-400" },
            { label: "HF Danger", value: config.healthFactorDanger, color: "text-red-400" },
            { label: "HF Target", value: config.healthFactorTarget, color: "text-emerald-400" },
            { label: "High Vol Threshold", value: `${config.highVolatilityThreshold}%`, color: "text-orange-400" },
            { label: "Min Yield Diff", value: `${config.minYieldDifferential}%`, color: "text-blue-400" },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-800/30 text-xs">
              <span className="text-gray-500">{item.label}</span>
              <span className={`font-medium ${item.color}`}>{item.value}</span>
            </div>
          ))}
        </div>
      )}

      <div className="text-[10px] text-gray-600 text-center pt-1 border-t border-gray-800/50">
        Keeper will use these parameters on next cycle
      </div>
    </div>
  );
}

function RecommendationInline({ data, onAction }: { data?: any; onAction?: (a: string, p?: any) => void }) {
  const [vaults, setVaults] = useState<any[]>([]);
  const [markets, setMarkets] = useState<any[]>([]);
  const [sentiment, setSentiment] = useState<any>(null);
  const [hbarPrice, setHbarPrice] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
 
  // Detect user intent from agent response
  const isAggressive = data?.intent === "aggressive" ||
    data?.response?.toLowerCase()?.includes("aggressive") ||
    data?.response?.toLowerCase()?.includes("maximum");
  const isSafe = !isAggressive;
 
  useEffect(() => {
    async function load() {
      try {
        const [vaultRes, marketRes, sentRes, pythRes] = await Promise.allSettled([
          fetch("/api/vaults?action=compare&goal=" + (isSafe ? "safe-yield" : "max-yield")).then(r => r.json()),
          fetch("/api/market").then(r => r.json()),
          fetch("/api/market").then(r => r.json()), // sentiment comes with market
          fetch("/api/pyth?action=hbar").then(r => r.json()),
        ]);
 
        if (vaultRes.status === "fulfilled" && vaultRes.value?.success) {
          setVaults((vaultRes.value.data?.comparisons || []).slice(0, 5));
        }
        if (marketRes.status === "fulfilled" && marketRes.value?.success) {
          const mkts = marketRes.value.data?.markets || [];
          setMarkets(mkts.filter((m: any) => m.supplyAPY > 0).sort((a: any, b: any) => b.supplyAPY - a.supplyAPY).slice(0, 5));
        }
        if (pythRes.status === "fulfilled" && pythRes.value?.success) {
          setHbarPrice(pythRes.value.data?.price || 0);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);
 
  if (loading) return <ChartLoader label="Scanning opportunities..." />;
 
  const riskColors: Record<string, { color: string; bg: string; label: string }> = {
    low: { color: "#10b981", bg: "rgba(16,185,129,0.08)", label: "Low Risk" },
    medium: { color: "#f59e0b", bg: "rgba(245,158,11,0.08)", label: "Medium Risk" },
    high: { color: "#ef4444", bg: "rgba(239,68,68,0.08)", label: "High Risk" },
  };
 
  // Build unified recommendations: top vaults + top lending
  interface Option {
    type: "vault" | "lending" | "stader";
    name: string;
    apy: number;
    risk: string;
    protocol: string;
    score: number;
    action: string;
    params: any;
    description: string;
  }
 
  const options: Option[] = [];
 
  // Vault options
  for (const v of vaults) {
    options.push({
      type: "vault",
      name: v.name,
      apy: v.apy || 0,
      risk: v.risk || "medium",
      protocol: "Bonzo Vault",
      score: v.score || 50,
      action: "vault_deposit",
      params: { vaultId: v.id, vault: v.name },
      description: v.strategy === "single-asset-dex"
        ? "Single-sided concentrated liquidity on SaucerSwap V2"
        : v.strategy === "dual-asset-dex"
        ? "Dual-asset LP with LARI rewards, auto-compounding"
        : "Leveraged HBARX staking via Bonzo Lend + Stader",
    });
  }
 
  // Lending options
  for (const m of markets) {
    options.push({
      type: "lending",
      name: `Supply ${m.symbol}`,
      apy: m.supplyAPY,
      risk: m.symbol === "USDC" ? "low" : m.supplyAPY > 8 ? "high" : "medium",
      protocol: "Bonzo Lend",
      score: m.symbol === "USDC" && isSafe ? 85 : 60,
      action: "lending_deposit",
      params: { asset: m.symbol, amount: 100 },
      description: `Supply to Bonzo Lend at ${m.supplyAPY.toFixed(2)}% APY, ${(m.utilizationRate || 0).toFixed(0)}% utilized`,
    });
  }
 
  // Stader option
  options.push({
    type: "stader",
    name: "HBARX Yield-on-Yield",
    apy: 6.5,
    risk: isSafe ? "medium" : "medium",
    protocol: "Stader + Bonzo",
    score: isSafe ? 70 : 80,
    action: "stader_strategy",
    params: { amount: 100 },
    description: "Stake HBAR → HBARX (~2.5% staking) → Supply to Bonzo (+ lending APY)",
  });
 
  // Sort by score (risk-adjusted for safe, raw APY for aggressive)
  if (isSafe) {
    options.sort((a, b) => {
      const riskScore = { low: 30, medium: 0, high: -20 };
      const aScore = (a.score || 0) + (riskScore[a.risk as keyof typeof riskScore] || 0);
      const bScore = (b.score || 0) + (riskScore[b.risk as keyof typeof riskScore] || 0);
      return bScore - aScore;
    });
  } else {
    options.sort((a, b) => b.apy - a.apy);
  }
 
  const topOptions = options.slice(0, 5);
 
  return (
    <div className="my-3 rounded-xl border border-gray-700/30 overflow-hidden" style={{ background: "rgba(17, 24, 39, 0.6)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800/50 flex items-center justify-between"
        style={{ background: isSafe
          ? "linear-gradient(135deg, rgba(16,185,129,0.1), rgba(59,130,246,0.06))"
          : "linear-gradient(135deg, rgba(245,158,11,0.1), rgba(239,68,68,0.06))"
        }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: isSafe ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)" }}>
            <span className="text-base">{isSafe ? "🛡️" : "🚀"}</span>
          </div>
          <div>
            <span className="text-sm font-semibold text-gray-200">
              {isSafe ? "Safe Yield Recommendations" : "Max Yield Opportunities"}
            </span>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-[10px] text-gray-500">
                {isSafe ? "Sorted by risk-adjusted score" : "Sorted by highest APY"}
              </span>
              {hbarPrice > 0 && (
                <span className="text-[10px] text-gray-600">
                  • HBAR: ${hbarPrice.toFixed(4)} (Pyth)
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="text-[10px] px-2 py-1 rounded-full font-medium"
          style={{
            color: isSafe ? "#10b981" : "#f59e0b",
            background: isSafe ? "rgba(16,185,129,0.1)" : "rgba(245,158,11,0.1)",
            border: `1px solid ${isSafe ? "rgba(16,185,129,0.2)" : "rgba(245,158,11,0.2)"}`,
          }}>
          {topOptions.length} options found
        </div>
      </div>
 
      {/* Options */}
      <div className="p-3 space-y-2">
        {topOptions.map((opt, i) => {
          const risk = riskColors[opt.risk] || riskColors.medium;
          const isSelected = selectedOption === i;
          const isTop = i === 0;
 
          return (
            <div
              key={opt.name + i}
              className="rounded-xl overflow-hidden transition-all duration-200 cursor-pointer"
              style={{
                background: isSelected
                  ? "rgba(16,185,129,0.08)"
                  : isTop
                  ? "rgba(139,92,246,0.05)"
                  : "rgba(31,41,55,0.3)",
                border: `1px solid ${
                  isSelected ? "rgba(16,185,129,0.3)"
                  : isTop ? "rgba(139,92,246,0.2)"
                  : "rgba(55,65,81,0.2)"
                }`,
              }}
              onClick={() => setSelectedOption(isSelected ? null : i)}
            >
              <div className="flex items-center justify-between px-3 py-2.5">
                <div className="flex items-center gap-3">
                  {/* Rank badge */}
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-xs font-bold"
                    style={{
                      background: isTop ? "rgba(139,92,246,0.2)" : "rgba(55,65,81,0.3)",
                      color: isTop ? "#a78bfa" : "#9ca3af",
                    }}>
                    #{i + 1}
                  </div>
 
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-200">{opt.name}</span>
                      {isTop && (
                        <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                          style={{ color: "#a78bfa", background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.3)" }}>
                          TOP PICK
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-gray-500">{opt.protocol}</span>
                      <span className="text-[10px] px-1.5 py-px rounded-full font-medium"
                        style={{ color: risk.color, background: risk.bg, border: `1px solid ${risk.color}20` }}>
                        {risk.label}
                      </span>
                    </div>
                  </div>
                </div>
 
                <div className="text-right flex-shrink-0">
                  <div className="text-lg font-bold text-emerald-400">{opt.apy.toFixed(1)}%</div>
                  <div className="text-[9px] text-gray-500">APY</div>
                </div>
              </div>
 
              {/* Expanded details + action button */}
              {isSelected && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-800/30 space-y-2">
                  <p className="text-[11px] text-gray-400 leading-relaxed">{opt.description}</p>
 
                  <div className="flex gap-2">
                  {opt.type === "vault" && onAction && (() => {
  const network = process.env.NEXT_PUBLIC_HEDERA_NETWORK || "testnet";
  const isMainnet = network === "mainnet";
  return (
    <>
      {isMainnet ? (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAction("confirm_vault", {
              action: "deposit",
              vault: opt.name,
              vaultId: opt.params.vaultId,
              expectedApy: opt.apy.toFixed(1),
              status: "preview",
            });
          }}
          className="flex-1 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          style={{
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            color: "#10b981",
          }}
        >
          <span>⚡</span> Deposit into Vault
        </button>
      ) : (
        <button
          onClick={(e) => {
            e.stopPropagation();
            const wantToken = opt.name.split(" ")[0].replace("(paired", "").trim();
            const asset = ["USDC", "HBAR", "SAUCE", "KARATE", "HBARX"].includes(wantToken) ? wantToken : "HBAR";
            onAction("confirm_lending", {
              action: "supply",
              asset,
              amount: 100,
              currentApy: opt.apy.toFixed(2),
              status: "preview",
            });
          }}
          className="flex-1 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
          style={{
            background: "rgba(59,130,246,0.15)",
            border: "1px solid rgba(59,130,246,0.3)",
            color: "#3b82f6",
          }}
        >
          <span>🏦</span> Supply to Bonzo Lend
        </button>
      )}
      {!isMainnet && (
        <div className="w-full text-[9px] text-gray-600 text-center mt-1">
          Vault contracts are mainnet-only. On testnet this supplies to Bonzo Lend instead.
        </div>
      )}
    </>
  );
})()}
 
                    {opt.type === "lending" && onAction && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction("confirm_lending", {
                            action: "supply",
                            asset: opt.params.asset,
                            amount: opt.params.amount,
                            currentApy: opt.apy.toFixed(2),
                            status: "preview",
                          });
                        }}
                        className="flex-1 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        style={{
                          background: "rgba(59,130,246,0.15)",
                          border: "1px solid rgba(59,130,246,0.3)",
                          color: "#3b82f6",
                        }}
                      >
                        <span>🏦</span> Supply to Bonzo Lend
                      </button>
                    )}
 
                    {opt.type === "stader" && onAction && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onAction("send_message", { message: "HBARX strategy with 100 HBAR" });
                        }}
                        className="flex-1 text-xs font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
                        style={{
                          background: "rgba(6,182,212,0.15)",
                          border: "1px solid rgba(6,182,212,0.3)",
                          color: "#06b6d4",
                        }}
                      >
                        <span>🔷</span> Execute HBARX Strategy
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
 
      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-600">
        <span>Click an option to see details and execute</span>
        <span>Scanned {vaults.length} vaults + {markets.length} lending markets</span>
      </div>
    </div>
  );
}

// ============================================
// Jarvis Phase 2: Vault Action Preview
// ============================================

function VaultActionInline({ data, onAction }: { data?: any; onAction?: (a: string, p?: any) => void }) {
  if (!data) return null;

  const actionColors: Record<string, string> = {
    deposit: "text-emerald-400 border-emerald-500/30 bg-emerald-900/20",
    withdraw: "text-red-400 border-red-500/30 bg-red-900/20",
    harvest: "text-orange-400 border-orange-500/30 bg-orange-900/20",
    switch: "text-blue-400 border-blue-500/30 bg-blue-900/20",
  };

  const status = data.status || "preview"; // preview | executed | failed

  return (
    <div className={`rounded-xl border ${actionColors[data.action]?.split(" ").slice(1).join(" ") || "border-gray-700/40 bg-gray-900/60"} p-4 space-y-3`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <span>{data.action === "deposit" ? "💰" : data.action === "withdraw" ? "📤" : data.action === "harvest" ? "🌾" : "🔄"}</span>
        <span className={actionColors[data.action]?.split(" ")[0] || "text-gray-300"}>
          Vault {data.action.charAt(0).toUpperCase() + data.action.slice(1)} {status === "preview" ? "Preview" : status === "executed" ? "" : "Failed"}
        </span>
        {status === "executed" && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full ml-auto">✓ On-Chain</span>}
        {status === "failed" && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full ml-auto">✗ Failed</span>}
      </div>

      <div className="space-y-1.5">
        {data.vault && (
          <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
            <span className="text-gray-500">Vault</span>
            <span className="text-gray-200">{data.vault}</span>
          </div>
        )}
        {data.amount && (
          <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
            <span className="text-gray-500">Amount</span>
            <span className="text-gray-200">{data.amount}</span>
          </div>
        )}
        {data.expectedApy && (
          <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
            <span className="text-gray-500">Expected APY</span>
            <span className="text-emerald-400">{data.expectedApy}%</span>
          </div>
        )}
        {data.estimatedGas && status === "preview" && (
          <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
            <span className="text-gray-500">Est. Gas</span>
            <span className="text-gray-400">{data.estimatedGas}</span>
          </div>
        )}
        {data.riskWarning && (
          <div className="text-[10px] text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg px-2 py-1.5">
            ⚠️ {data.riskWarning}
          </div>
        )}
      </div>

      {/* ── Real Transaction Proof ── */}
      {status === "executed" && data.txIds?.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-700/30 pt-2">
          {data.txIds.map((txId: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="text-gray-500">Tx {i + 1}:</span>
              <code className="text-emerald-400 font-mono flex-1 truncate">{txId}</code>
              {data.hashScanLinks?.[i] && (
                <a href={data.hashScanLinks[i]} target="_blank" rel="noopener noreferrer"
                  className="text-emerald-400/60 hover:text-emerald-400 flex-shrink-0">
                  HashScan ↗
                </a>
              )}
            </div>
          ))}
          {data.durationMs && (
            <div className="text-[9px] text-gray-600">
              Executed in {(data.durationMs / 1000).toFixed(1)}s
              {data.toolCalls?.length > 0 && ` • ${data.toolCalls.length} tool calls: ${data.toolCalls.map((t: any) => t.tool).join(", ")}`}
            </div>
          )}
          {data.hcsLog && (
            <div className="text-[9px] text-gray-600">
              ✓ Logged to HCS audit topic {data.hcsLog.topicId} (seq #{data.hcsLog.sequenceNumber})
            </div>
          )}
        </div>
      )}

      {status === "preview" && onAction && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction("confirm_vault", data)}
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 transition-colors"
          >
            ✓ Confirm {data.action}
          </button>
          <button
            onClick={() => onAction("cancel_vault", data)}
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-400 border border-gray-600/30 transition-colors"
          >
            ✗ Cancel
          </button>
        </div>
      )}
      {data.error && (
        <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
          {data.error}
        </div>
      )}
    </div>
  );
}

// ============================================
// Jarvis Phase 2: Lending Action Preview
// ============================================

function LendingActionInline({ data, onAction }: { data?: any; onAction?: (a: string, p?: any) => void }) {
  if (!data) return null;

  const actionLabels: Record<string, string> = {
    supply: "Supply to Bonzo Lend",
    borrow: "Borrow from Bonzo Lend",
    repay: "Repay Bonzo Loan",
    withdraw: "Withdraw from Bonzo Lend",
  };

  const status = data.status || "preview";

  return (
    <div className="rounded-xl border border-blue-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
        <span>🏦</span>
        {actionLabels[data.action] || "Lending Action"} {status === "preview" ? "Preview" : ""}
        {status === "executed" && <span className="text-[10px] text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded-full ml-auto">✓ On-Chain</span>}
        {status === "failed" && <span className="text-[10px] text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded-full ml-auto">✗ Failed</span>}
      </div>

      <div className="space-y-1.5">
        <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
          <span className="text-gray-500">Asset</span>
          <span className="text-gray-200">{data.asset || "HBAR"}</span>
        </div>
        <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
          <span className="text-gray-500">Amount</span>
          <span className="text-gray-200">{data.amount}</span>
        </div>
        {data.currentApy && (
          <div className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
            <span className="text-gray-500">Current APY</span>
            <span className={data.action === "borrow" ? "text-red-400" : "text-emerald-400"}>{data.currentApy}%</span>
          </div>
        )}

        {/* Health Factor Impact */}
        {data.healthFactorBefore !== undefined && (
          <div className="flex items-center gap-2 px-2 py-2 rounded bg-gray-800/40">
            <span className="text-[10px] text-gray-500 w-20">Health Factor</span>
            <span className={`text-xs font-medium ${!data.healthFactorBefore || data.healthFactorBefore > 1e10 || data.healthFactorBefore >= 1.5 ? "text-emerald-400" : "text-red-400"}`}>
              {!data.healthFactorBefore || data.healthFactorBefore > 1e10 ? "∞" : data.healthFactorBefore.toFixed(2)}
            </span>
            <span className="text-xs text-gray-500">→</span>
            <span className={`text-xs font-medium ${!data.healthFactorAfter || data.healthFactorAfter > 1e10 || data.healthFactorAfter >= 1.5 ? "text-emerald-400" : "text-red-400"}`}>
              {!data.healthFactorAfter || data.healthFactorAfter > 1e10 ? "∞" : data.healthFactorAfter.toFixed(2)}
            </span>
            {data.healthFactorAfter && data.healthFactorAfter < 1e10 && data.healthFactorAfter < 1.3 && (
              <span className="text-[9px] text-red-500 font-medium ml-1">⚠ DANGER</span>
            )}
          </div>
        )}

        {data.liquidationRisk && (
          <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5 font-medium">
            🚨 {data.liquidationRisk}
          </div>
        )}
      </div>

      {/* ── Real Transaction Proof ── */}
      {status === "executed" && data.txIds?.length > 0 && (
        <div className="space-y-1.5 border-t border-gray-700/30 pt-2">
          {data.txIds.map((txId: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[10px]">
              <span className="text-gray-500">Tx {i + 1}:</span>
              <code className="text-blue-400 font-mono flex-1 truncate">{txId}</code>
              {data.hashScanLinks?.[i] && (
                <a href={data.hashScanLinks[i]} target="_blank" rel="noopener noreferrer"
                  className="text-blue-400/60 hover:text-blue-400 flex-shrink-0">
                  HashScan ↗
                </a>
              )}
            </div>
          ))}
          {data.durationMs && (
            <div className="text-[9px] text-gray-600">
              Executed in {(data.durationMs / 1000).toFixed(1)}s
              {data.toolCalls?.length > 0 && ` • ${data.toolCalls.length} tool calls: ${data.toolCalls.map((t: any) => t.tool).join(", ")}`}
            </div>
          )}
          {data.hcsLog && (
            <div className="text-[9px] text-gray-600">
              ✓ Logged to HCS audit topic {data.hcsLog.topicId} (seq #{data.hcsLog.sequenceNumber})
            </div>
          )}
        </div>
      )}

      {status === "preview" && onAction && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction("confirm_lending", data)}
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 transition-colors"
          >
            ✓ Confirm {data.action}
          </button>
          <button
            onClick={() => onAction("cancel_lending", data)}
            className="flex-1 text-xs font-medium py-2 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-400 border border-gray-600/30 transition-colors"
          >
            ✗ Cancel
          </button>
        </div>
      )}
      {data.error && (
        <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
          {data.error}
        </div>
      )}
    </div>
  );
}

// ============================================
// Jarvis Phase 2: Confirm Action (Two-Step)
// ============================================

function ConfirmActionInline({ data, onAction }: { data?: any; onAction?: (a: string, p?: any) => void }) {
  if (!data) return null;

  return (
    <div className="rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-400">
        <span>⚠️</span> Confirmation Required
      </div>

      <div className="text-xs text-gray-300 leading-relaxed">
        {data.description || "You are about to perform a sensitive action."}
      </div>

      <div className="space-y-1.5">
        {data.details && data.details.map((d: any, i: number) => (
          <div key={i} className="flex justify-between text-xs px-2 py-1.5 bg-gray-800/30 rounded">
            <span className="text-gray-500">{d.label}</span>
            <span className="text-gray-200">{d.value}</span>
          </div>
        ))}
      </div>

      {data.warning && (
        <div className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-2 py-1.5">
          {data.warning}
        </div>
      )}

      {onAction && (
        <div className="flex gap-2 pt-1">
          <button
            onClick={() => onAction("confirm_execute", data)}
            className="flex-1 text-xs font-medium py-2.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 border border-amber-500/40 transition-colors"
          >
            ✓ Yes, Execute
          </button>
          <button
            onClick={() => onAction("cancel_execute", data)}
            className="flex-1 text-xs font-medium py-2.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 text-gray-400 border border-gray-600/30 transition-colors"
          >
            ✗ Cancel
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================
// Jarvis Phase 2: Error Inline
// ============================================

function ErrorInline({ data }: { data?: any }) {
  if (!data) return null;

  const errorTypes: Record<string, { icon: string; color: string; title: string }> = {
    wallet_not_connected: { icon: "🔌", color: "text-orange-400 border-orange-500/30 bg-orange-900/20", title: "Wallet Not Connected" },
    insufficient_balance: { icon: "💸", color: "text-red-400 border-red-500/30 bg-red-900/20", title: "Insufficient Balance" },
    execution_failed: { icon: "❌", color: "text-red-400 border-red-500/30 bg-red-900/20", title: "Execution Failed" },
    network_error: { icon: "🌐", color: "text-yellow-400 border-yellow-500/30 bg-yellow-900/20", title: "Network Error" },
    rejected: { icon: "🚫", color: "text-gray-400 border-gray-500/30 bg-gray-800/40", title: "Transaction Rejected" },
    default: { icon: "⚡", color: "text-red-400 border-red-500/30 bg-red-900/20", title: "Error" },
  };

  const style = errorTypes[data.type] || errorTypes.default;

  return (
    <div className={`rounded-xl border ${style.color.split(" ").slice(1).join(" ")} p-4 space-y-2`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${style.color.split(" ")[0]}`}>
        <span>{style.icon}</span> {style.title}
      </div>
      <p className="text-xs text-gray-400 leading-relaxed">{data.message}</p>
      {data.suggestion && (
        <div className="text-[10px] text-gray-500 bg-gray-800/30 rounded-lg px-2.5 py-1.5 border border-gray-700/30">
          💡 {data.suggestion}
        </div>
      )}
    </div>
  );
}