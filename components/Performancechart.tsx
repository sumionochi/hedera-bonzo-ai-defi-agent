"use client";

import { useState, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceDot,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  TrendingUp,
  Loader2,
  AlertTriangle,
  RefreshCw,
  BarChart3,
} from "lucide-react";

interface BacktestDataPoint {
  timestamp: number;
  date: string;
  hbarPrice: number;
  passiveValue: number;
  vaultmindValue: number;
  decision?: {
    action: string;
    reason: string;
    confidence: number;
  };
}

interface BacktestSummary {
  startDate: string;
  endDate: string;
  initialInvestment: number;
  passiveFinalValue: number;
  vaultmindFinalValue: number;
  passiveReturn: number;
  vaultmindReturn: number;
  outperformance: number;
  totalDecisions: number;
  harvests: number;
  holds: number;
  increases: number;
  rebalances: number;
}

interface BacktestResult {
  dataPoints: BacktestDataPoint[];
  summary: BacktestSummary;
}

// Custom tooltip
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload as BacktestDataPoint;
  if (!point) return null;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 mb-1">{point.date}</p>
      <p className="text-gray-300">
        HBAR: <span className="font-medium">${point.hbarPrice.toFixed(4)}</span>
      </p>
      <p className="text-blue-400">
        Passive: <span className="font-medium">${point.passiveValue.toFixed(2)}</span>
      </p>
      <p className="text-emerald-400">
        VaultMind: <span className="font-medium">${point.vaultmindValue.toFixed(2)}</span>
      </p>
      {point.decision && (
        <div className="mt-1.5 pt-1.5 border-t border-gray-700">
          <p className="font-medium text-yellow-400">{point.decision.action}</p>
          <p className="text-gray-500 text-[10px] max-w-48">
            {point.decision.reason}
          </p>
        </div>
      )}
    </div>
  );
}

export default function PerformanceChart() {
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function fetchBacktest() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/performance?days=${days}&investment=1000`);
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.error || "Failed to run backtest");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchBacktest();
  }, [days]);

  // Decision marker dots
  const decisionPoints =
    data?.dataPoints.filter((p) => p.decision) || [];

  const actionColors: Record<string, string> = {
    HARVEST: "#ef4444",
    INCREASE_POSITION: "#10b981",
    REBALANCE: "#3b82f6",
    HOLD: "#eab308",
  };

  if (loading && !data) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-medium text-gray-400">
            Running backtest...
          </h3>
        </div>
        <div className="h-48 flex items-center justify-center">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h3 className="text-sm text-red-400">Backtest Error</h3>
        </div>
        <p className="text-xs text-gray-500 mt-1">{error}</p>
        <button
          onClick={fetchBacktest}
          className="mt-2 text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const { summary } = data;
  const outperformColor =
    summary.outperformance >= 0 ? "text-emerald-400" : "text-red-400";

  // Format chart data — show short date labels
  const chartData = data.dataPoints.map((p) => ({
    ...p,
    label: p.date.slice(5), // MM-DD
  }));

  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            Performance: VaultMind vs Passive
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-[11px] bg-gray-800 border border-gray-700/40 rounded-md px-2 py-1 text-gray-300 focus:outline-none"
          >
            <option value={7}>7 days</option>
            <option value={14}>14 days</option>
            <option value={30}>30 days</option>
            <option value={60}>60 days</option>
            <option value={90}>90 days</option>
          </select>
          <button
            onClick={fetchBacktest}
            disabled={loading}
            className="text-gray-500 hover:text-gray-300 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-2 mb-4 text-xs">
        <div className="bg-gray-800/40 rounded-lg px-2.5 py-2 text-center">
          <span className="text-gray-500 text-[10px]">Invested</span>
          <div className="text-gray-200 font-medium">
            ${summary.initialInvestment}
          </div>
        </div>
        <div className="bg-gray-800/40 rounded-lg px-2.5 py-2 text-center">
          <span className="text-gray-500 text-[10px]">Passive</span>
          <div
            className={
              summary.passiveReturn >= 0 ? "text-emerald-400" : "text-red-400"
            }
          >
            {summary.passiveReturn >= 0 ? "+" : ""}
            {summary.passiveReturn.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800/40 rounded-lg px-2.5 py-2 text-center">
          <span className="text-gray-500 text-[10px]">VaultMind</span>
          <div
            className={
              summary.vaultmindReturn >= 0
                ? "text-emerald-400"
                : "text-red-400"
            }
          >
            {summary.vaultmindReturn >= 0 ? "+" : ""}
            {summary.vaultmindReturn.toFixed(1)}%
          </div>
        </div>
        <div className="bg-gray-800/40 rounded-lg px-2.5 py-2 text-center">
          <span className="text-gray-500 text-[10px]">Edge</span>
          <div className={`font-medium ${outperformColor}`}>
            {summary.outperformance >= 0 ? "+" : ""}
            {summary.outperformance.toFixed(1)}pp
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1f2937"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}`}
              width={50}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ fontSize: "11px" }}
              iconSize={8}
            />

            {/* Passive line */}
            <Line
              type="monotone"
              dataKey="passiveValue"
              name="Passive HODL"
              stroke="#3b82f6"
              strokeWidth={1.5}
              dot={false}
              strokeDasharray="4 2"
            />

            {/* VaultMind line */}
            <Line
              type="monotone"
              dataKey="vaultmindValue"
              name="VaultMind"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
            />

            {/* Decision markers */}
            {decisionPoints.map((p, i) => (
              <ReferenceDot
                key={i}
                x={p.date.slice(5)}
                y={p.vaultmindValue}
                r={4}
                fill={actionColors[p.decision!.action] || "#eab308"}
                stroke="#111827"
                strokeWidth={1.5}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Decision legend */}
      <div className="flex items-center gap-4 mt-3 text-[10px] text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
          Harvest ({summary.harvests})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
          Increase ({summary.increases})
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
          Rebalance ({summary.rebalances})
        </span>
        <span className="ml-auto text-gray-600">
          {summary.totalDecisions} decisions over {days} days
        </span>
      </div>
    </div>
  );
}