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

// ════════════════════════════════════════════
// 1. PORTFOLIO PIE CHART
// ════════════════════════════════════════════

export function PortfolioPieChart() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charts?type=portfolio")
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="portfolio" />;
  if (!data) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="font-medium text-gray-200">{d.symbol}</p>
        <p className="text-gray-400">${d.valueUsd.toLocaleString()}</p>
        <p className="text-gray-500">{d.percentage}% • {d.platform}</p>
      </div>
    );
  };

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-semibold text-gray-200">Portfolio Breakdown</span>
        <span className="text-xs text-gray-500">
          Total: ${data.totalValue.toLocaleString()}
        </span>
      </div>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        <div className="w-full sm:w-56 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data.holdings}
                dataKey="valueUsd"
                nameKey="symbol"
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={85}
                paddingAngle={2}
                strokeWidth={0}
              >
                {data.holdings.map((_: any, i: number) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {data.holdings.slice(0, 6).map((h: any, i: number) => (
            <div key={h.symbol} className="flex items-center gap-2 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: COLORS[i % COLORS.length] }}
              />
              <span className="text-gray-300 flex-1">{h.symbol}</span>
              <span className="text-gray-500">{h.percentage}%</span>
              <span className="text-gray-400 w-16 text-right">
                ${h.valueUsd.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 2. CORRELATION MATRIX
// ════════════════════════════════════════════

export function CorrelationMatrix() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

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

  function corrColor(v: number): string {
    if (v >= 0.7) return "bg-emerald-500/60";
    if (v >= 0.3) return "bg-emerald-500/30";
    if (v >= -0.3) return "bg-gray-600/30";
    if (v >= -0.7) return "bg-red-500/30";
    return "bg-red-500/60";
  }

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <span className="text-sm font-semibold text-gray-200 block mb-3">
        Asset Correlation Matrix (30d)
      </span>
      <div className="overflow-x-auto">
        <table className="text-xs w-full">
          <thead>
            <tr>
              <th className="px-3 py-1.5 text-gray-500" />
              {symbols.map((s: string) => (
                <th key={s} className="px-3 py-1.5 text-gray-400 font-medium text-center">
                  {s}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {symbols.map((row: string, i: number) => (
              <tr key={row}>
                <td className="px-3 py-1.5 text-gray-400 font-medium">{row}</td>
                {matrix[i].map((v: number, j: number) => (
                  <td key={j} className="px-1.5 py-1.5 text-center">
                    <span
                      className={`inline-block w-full min-w-[3rem] py-1 rounded text-xs font-mono ${corrColor(v)} ${
                        i === j ? "text-gray-500" : "text-gray-200"
                      }`}
                    >
                      {v.toFixed(2)}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-emerald-500/60" /> Strong +
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-gray-600/30" /> Neutral
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-2 rounded bg-red-500/60" /> Strong -
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════
// 3. RISK / RETURN SCATTER PLOT
// ════════════════════════════════════════════

export function RiskReturnScatter() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/charts?type=riskreturn&days=30")
      .then((r) => r.json())
      .then((j) => { if (j.success) setData(j.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <ChartLoader label="risk analysis" />;
  if (!data.length) return null;

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-xs shadow-xl">
        <p className="font-medium text-gray-200">{d.symbol}</p>
        <p className="text-gray-400">Return: {d.avgReturn.toFixed(1)}%</p>
        <p className="text-gray-400">Volatility: {d.volatility.toFixed(1)}%</p>
        <p className="text-gray-500">Sharpe: {d.sharpe.toFixed(2)}</p>
      </div>
    );
  };

  return (
    <div className="my-3 p-4 bg-gray-800/30 rounded-xl border border-gray-700/30 w-full">
      <span className="text-sm font-semibold text-gray-200 block mb-3">
        Risk vs Return (30d Annualized)
      </span>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="volatility"
              name="Volatility"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={{ stroke: "#374151" }}
              label={{
                value: "Volatility %",
                position: "bottom",
                fontSize: 10,
                fill: "#6b7280",
                offset: -2,
              }}
            />
            <YAxis
              dataKey="avgReturn"
              name="Return"
              tick={{ fontSize: 10, fill: "#6b7280" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Return %",
                angle: -90,
                position: "insideLeft",
                fontSize: 10,
                fill: "#6b7280",
              }}
            />
            <ZAxis dataKey="sharpe" range={[60, 200]} />
            <Tooltip content={<CustomTooltip />} />
            <Scatter data={data} fill="#10b981">
              {data.map((d: any, i: number) => (
                <Cell
                  key={i}
                  fill={d.sharpe > 0 ? "#10b981" : "#ef4444"}
                />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-2 mt-1">
        {data.map((d: any, i: number) => (
          <span
            key={d.symbol}
            className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800/60 text-gray-400"
          >
            {d.symbol}: {d.sharpe > 0 ? "+" : ""}{d.avgReturn.toFixed(0)}%
          </span>
        ))}
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

export function OHLCVChart({ poolId = 1 }: { poolId?: number }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/charts?type=ohlcv&poolId=${poolId}&days=30`)
      .then((r) => r.json())
      .then((j) => {
        if (j.success) setData(j.data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [poolId]);

  if (loading) return <ChartLoader label="price data" />;
  if (!data.length) return null;

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
      <span className="text-sm font-semibold text-gray-200 block mb-3">
        Price Chart (30 Day)
      </span>
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
  | "vaultcompare";

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

  return charts;
}

/** Render a chart by type */
export function InlineChart({
  type,
  sentiment,
}: {
  type: ChartType;
  sentiment?: { score: number; signal: string; confidence: number };
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
    default:
      return null;
  }
}