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
// Positions Inline Component
// ============================================

function PositionsInline({ data }: { data?: any }) {
  const [positions, setPositions] = useState<any>(data || null);
  const [loading, setLoading] = useState(!data);

  useEffect(() => {
    if (data) { setPositions(data); return; }
    fetch("/api/positions").then(r => r.json()).then(j => {
      if (j.success) setPositions(j.data);
    }).finally(() => setLoading(false));
  }, [data]);

  if (loading) return <ChartLoader label="Fetching positions..." />;
  if (!positions) return <div className="text-xs text-gray-500 p-3">No position data available</div>;

  const p = positions;
  return (
    <div className="rounded-xl border border-gray-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
        <span>📊</span> Bonzo Lend Positions
        <span className="text-[10px] text-gray-500 ml-auto">{p.accountId}</span>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: "Supplied", value: `$${(p.totalSuppliedUSD || 0).toFixed(2)}`, color: "text-emerald-400" },
          { label: "Borrowed", value: `$${(p.totalBorrowedUSD || 0).toFixed(2)}`, color: "text-red-400" },
          { label: "Net Worth", value: `$${(p.netWorthUSD || 0).toFixed(2)}`, color: "text-blue-400" },
          { label: "Health Factor", value: !p.healthFactor || p.healthFactor > 1e10 ? "∞ Safe" : p.healthFactor.toFixed(2), color: !p.healthFactor || p.healthFactor > 1e10 || p.healthFactor >= 1.5 ? "text-emerald-400" : p.healthFactor < 1.2 ? "text-red-400" : "text-yellow-400" },
        ].map((item) => (
          <div key={item.label} className="bg-gray-800/40 rounded-lg p-2">
            <div className="text-[10px] text-gray-500">{item.label}</div>
            <div className={`text-sm font-semibold ${item.color}`}>{item.value}</div>
          </div>
        ))}
      </div>

      {/* Position Rows */}
      {p.positions && p.positions.length > 0 ? (
        <div className="space-y-1">
          {p.positions.map((pos: any, i: number) => (
            <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/30 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-200">{pos.symbol}</span>
                {pos.isCollateral && <span className="text-[9px] text-emerald-400/70 bg-emerald-500/10 rounded px-1">collateral</span>}
              </div>
              <div className="flex gap-4 text-right">
                <div>
                  <div className="text-emerald-400">${(pos.suppliedUSD || 0).toFixed(2)}</div>
                  <div className="text-[9px] text-gray-600">{pos.supplyAPY?.toFixed(2)}% APY</div>
                </div>
                {pos.borrowedUSD > 0 && (
                  <div>
                    <div className="text-red-400">-${pos.borrowedUSD.toFixed(2)}</div>
                    <div className="text-[9px] text-gray-600">{pos.borrowAPY?.toFixed(2)}% APY</div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-500 text-center py-2">No active Bonzo Lend positions</p>
      )}

      {p.averageNetAPY !== undefined && p.averageNetAPY !== 0 && (
        <div className="text-[10px] text-gray-500 text-center pt-1 border-t border-gray-800/50">
          Average Net APY: <span className="text-emerald-400">{p.averageNetAPY.toFixed(2)}%</span>
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
  if (!data) {
    return (
      <div className="rounded-xl border border-gray-800/40 bg-gray-900/60 p-4 text-center">
        <span className="text-xs text-gray-500">No wallet connected. Type: connect wallet 0.0.XXXXX</span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-emerald-800/40 bg-gray-900/60 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-400">
        <span>👛</span> Wallet Connected
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-gray-800/40 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">Account</div>
          <div className="text-xs font-medium text-gray-200">{data.accountId}</div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">HBAR</div>
          <div className="text-sm font-semibold text-emerald-400">{(data.hbarBalance || 0).toFixed(2)}</div>
        </div>
        <div className="bg-gray-800/40 rounded-lg p-2 text-center">
          <div className="text-[10px] text-gray-500">USD Value</div>
          <div className="text-sm font-semibold text-blue-400">${(data.hbarBalanceUSD || 0).toFixed(2)}</div>
        </div>
      </div>
      {data.tokens && data.tokens.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-gray-500">Token Balances</div>
          {data.tokens.slice(0, 5).map((t: any) => (
            <div key={t.tokenId} className="flex justify-between text-xs px-2 py-1 bg-gray-800/30 rounded">
              <span className="text-gray-300">{t.symbol}</span>
              <span className="text-gray-400">{t.balance.toFixed(4)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-gray-600 text-center">
        Network: {data.network || "testnet"} {data.evmAddress && `• EVM: ${data.evmAddress.substring(0, 10)}...`}
      </div>
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