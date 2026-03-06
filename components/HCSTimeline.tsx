"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  Hash,
} from "lucide-react";

interface HCSDecision {
  timestamp: string;
  agent: string;
  version: string;
  action: string;
  reason: string;
  confidence: number;
  context: {
    sentimentScore?: number;
    sentimentSignal?: string;
    volatility?: number;
    fearGreedIndex?: number;
    hbarPrice?: number;
    hbarChange24h?: number;
  };
  params?: Record<string, unknown>;
  consensusTimestamp?: string;
  sequenceNumber?: number;
}

const ACTION_STYLES: Record<
  string,
  { color: string; bg: string; border: string; icon: string }
> = {
  HOLD: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    icon: "🟡",
  },
  HARVEST: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    icon: "🔴",
  },
  REPAY_DEBT: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    icon: "🔴",
  },
  EXIT_TO_STABLE: {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
    icon: "🟠",
  },
  REBALANCE: {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    icon: "🔵",
  },
  INCREASE_POSITION: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    icon: "🟢",
  },
};

function getActionStyle(action: string) {
  return (
    ACTION_STYLES[action] || {
      color: "text-gray-400",
      bg: "bg-gray-400/10",
      border: "border-gray-400/30",
      icon: "⚪",
    }
  );
}

function formatConsensusTimestamp(ts: string): string {
  // Hedera consensus timestamps are "seconds.nanoseconds"
  try {
    const seconds = parseFloat(ts.split(".")[0]);
    return new Date(seconds * 1000).toLocaleString();
  } catch {
    return ts;
  }
}

// Expandable decision entry
function DecisionEntry({ decision }: { decision: HCSDecision }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(decision.action);
  const network = "testnet"; // Could be made dynamic

  const mirrorNodeUrl = decision.consensusTimestamp
    ? `https://hashscan.io/${network}/transaction/${decision.consensusTimestamp}`
    : null;

  return (
    <div
      className={`relative pl-6 pb-4 border-l-2 ${style.border} last:pb-0`}
    >
      {/* Timeline dot */}
      <div
        className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full ${style.bg} border-2 ${style.border} flex items-center justify-center`}
      >
        <div className={`w-1.5 h-1.5 rounded-full ${style.bg}`} />
      </div>

      {/* Content */}
      <div className="ml-3">
        {/* Header */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left group"
        >
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-semibold ${style.color}`}>
              {decision.action}
            </span>
            <span className="text-[10px] text-gray-600">
              {(decision.confidence * 100).toFixed(0)}% confidence
            </span>
            {decision.sequenceNumber && (
              <span className="text-[10px] text-gray-700 flex items-center gap-0.5">
                <Hash className="w-2.5 h-2.5" />
                {decision.sequenceNumber}
              </span>
            )}
            {expanded ? (
              <ChevronUp className="w-3 h-3 text-gray-600 ml-auto" />
            ) : (
              <ChevronDown className="w-3 h-3 text-gray-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </div>
          <p className="text-[11px] text-gray-400 leading-relaxed">
            {decision.reason}
          </p>
        </button>

        {/* Timestamp */}
        <div className="flex items-center gap-2 mt-1.5">
          <Clock className="w-3 h-3 text-gray-600" />
          <span className="text-[10px] text-gray-600">
            {decision.consensusTimestamp
              ? formatConsensusTimestamp(decision.consensusTimestamp)
              : new Date(decision.timestamp).toLocaleString()}
          </span>
          {mirrorNodeUrl && (
            <a
              href={mirrorNodeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-emerald-400/60 hover:text-emerald-400 flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              HashScan <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>

        {/* Expanded context */}
        {expanded && decision.context && (
          <div className="mt-2 p-2.5 bg-gray-800/40 rounded-lg border border-gray-700/30 text-[11px] space-y-1">
            <p className="text-gray-500 font-medium text-[10px] uppercase tracking-wider mb-1.5">
              Market Context at Decision Time
            </p>
            {decision.context.hbarPrice !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">HBAR Price</span>
                <span className="text-gray-300">
                  ${decision.context.hbarPrice.toFixed(4)}
                  {decision.context.hbarChange24h !== undefined && (
                    <span
                      className={
                        decision.context.hbarChange24h >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }
                    >
                      {" "}
                      ({decision.context.hbarChange24h >= 0 ? "+" : ""}
                      {decision.context.hbarChange24h.toFixed(2)}%)
                    </span>
                  )}
                </span>
              </div>
            )}
            {decision.context.sentimentScore !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Sentiment</span>
                <span className="text-gray-300">
                  {decision.context.sentimentScore} (
                  {decision.context.sentimentSignal})
                </span>
              </div>
            )}
            {decision.context.fearGreedIndex !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Fear & Greed</span>
                <span className="text-gray-300">
                  {decision.context.fearGreedIndex}
                </span>
              </div>
            )}
            {decision.context.volatility !== undefined && (
              <div className="flex justify-between">
                <span className="text-gray-500">Volatility</span>
                <span className="text-gray-300">
                  {decision.context.volatility.toFixed(0)}%
                </span>
              </div>
            )}
            {decision.params && Object.keys(decision.params).length > 0 && (
              <>
                <p className="text-gray-500 font-medium text-[10px] uppercase tracking-wider mt-2 mb-1">
                  Action Parameters
                </p>
                {Object.entries(decision.params).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-300">{String(v)}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Main component
export default function HCSTimeline({ refreshTrigger }: { refreshTrigger?: number }) {
  const [topicId, setTopicId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<HCSDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Try to load topic from env (passed via keeper results) — refetch on refreshTrigger change
  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("vaultmind_hcs_topic")
      : null;
    if (stored) {
      setTopicId(stored);
      fetchDecisions(stored);
    } else {
      // Try the API which can auto-detect from env
      fetch("/api/hcs?limit=50").then(r => r.json()).then(j => {
        if (j.success && j.data?.topicId) {
          setTopicId(j.data.topicId);
          setDecisions(j.data.decisions || []);
          if (typeof window !== "undefined") {
            localStorage.setItem("vaultmind_hcs_topic", j.data.topicId);
          }
        }
      }).catch(() => {});
    }
  }, [refreshTrigger]);

  async function createTopic() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/hcs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create-topic" }),
      });
      const json = await res.json();
      if (json.success) {
        setTopicId(json.data.topicId);
        if (typeof window !== "undefined") {
          localStorage.setItem("vaultmind_hcs_topic", json.data.topicId);
        }
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function fetchDecisions(tid: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/hcs?topicId=${tid}&limit=50`);
      const json = await res.json();
      if (json.success) {
        setDecisions(json.data.decisions || []);
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSetTopic(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const tid = (form.get("topicId") as string)?.trim();
    if (tid) {
      setTopicId(tid);
      if (typeof window !== "undefined") {
        localStorage.setItem("vaultmind_hcs_topic", tid);
      }
      fetchDecisions(tid);
    }
  }

  // No topic yet
  if (!topicId) {
    return (
      <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            HCS Audit Trail
          </h3>
        </div>

        <p className="text-xs text-gray-400 mb-4 leading-relaxed">
          Every keeper decision is logged immutably on Hedera Consensus Service.
          Create a new audit topic or enter an existing topic ID to view the
          on-chain decision history.
        </p>

        <div className="space-y-3">
          <button
            onClick={createTopic}
            disabled={creating}
            className="w-full flex items-center justify-center gap-2 text-xs font-medium px-4 py-2.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/20 transition-colors disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Shield className="w-3.5 h-3.5" />
            )}
            Create New Audit Topic
          </button>

          <div className="text-[10px] text-gray-600 text-center">or</div>

          <div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Enter topic ID (e.g. 0.0.12345)"
                className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2 text-xs text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      setTopicId(val);
                      if (typeof window !== "undefined") {
                        localStorage.setItem("vaultmind_hcs_topic", val);
                      }
                      fetchDecisions(val);
                    }
                  }
                }}
              />
            </div>
            {error && (
              <p className="text-[10px] text-red-400 mt-1">{error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Has topic — show timeline
  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-emerald-400" />
          <h3 className="text-sm font-medium text-gray-300">
            HCS Audit Trail
          </h3>
        </div>
        <button
          onClick={() => fetchDecisions(topicId)}
          disabled={loading}
          className="text-gray-500 hover:text-gray-300 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Topic info */}
      <div className="mb-4 p-2.5 bg-gray-800/40 rounded-lg space-y-1.5">
        <div className="flex items-center gap-2 text-[11px]">
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="text-gray-500">Audit Topic:</span>
          <span className="text-gray-200 font-mono">{topicId}</span>
          <a
            href={`https://hashscan.io/testnet/topic/${topicId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-emerald-400/60 hover:text-emerald-400 flex items-center gap-0.5"
          >
            HashScan <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <p className="text-[10px] text-gray-600 pl-5">
          This is the HCS topic where keeper decisions are logged immutably on Hedera. Each entry is verifiable on HashScan.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 mb-3 text-xs text-red-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && decisions.length === 0 && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loading && decisions.length === 0 && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-500">No decisions logged yet</p>
          <p className="text-[10px] text-gray-600 mt-1">
            Run the Keeper Engine to start logging decisions on-chain
          </p>
        </div>
      )}

      {/* Timeline */}
      {decisions.length > 0 && (
        <div className="space-y-0 max-h-[500px] overflow-y-auto pr-1">
          {decisions.map((d, i) => (
            <DecisionEntry key={i} decision={d} />
          ))}
        </div>
      )}

      {/* Summary */}
      {decisions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-600">
          <span>{decisions.length} decisions on-chain</span>
          <span>Immutable • Timestamped • Verifiable</span>
        </div>
      )}
    </div>
  );
}