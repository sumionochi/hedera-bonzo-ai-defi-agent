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
  // DCA event fields
  _isDCA?: boolean;
  _dcaEvent?: string;
  _dcaData?: Record<string, any>;
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
  // DCA action styles
  DCA_CREATE: {
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/30",
    icon: "📅",
  },
  DCA_CANCEL: {
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/30",
    icon: "🚫",
  },
  DCA_PAUSE: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    icon: "⏸️",
  },
  DCA_RESUME: {
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/30",
    icon: "▶️",
  },
  DCA_EXECUTE: {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    icon: "🔄",
  },
  DCA_COMPLETE: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    icon: "✅",
  },
  // Execute action styles (from tx execution logging)
  EXECUTE_VAULT_DEPOSIT: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    icon: "💰",
  },
  EXECUTE_VAULT_HARVEST: {
    color: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/30",
    icon: "🌾",
  },
  EXECUTE_VAULT_SWITCH: {
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/30",
    icon: "🔄",
  },
  EXECUTE_SUPPLY: {
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/30",
    icon: "📥",
  },
  EXECUTE_BORROW: {
    color: "text-orange-400",
    bg: "bg-orange-400/10",
    border: "border-orange-400/30",
    icon: "💳",
  },
  EXECUTE_REPAY: {
    color: "text-green-400",
    bg: "bg-green-400/10",
    border: "border-green-400/30",
    icon: "💸",
  },
};

function getActionStyle(action: string) {
  // Direct match first
  if (ACTION_STYLES[action]) return ACTION_STYLES[action];
  // Partial match for EXECUTE_ prefix
  for (const key of Object.keys(ACTION_STYLES)) {
    if (action.includes(key) || key.includes(action)) return ACTION_STYLES[key];
  }
  return {
    color: "text-gray-400",
    bg: "bg-gray-400/10",
    border: "border-gray-400/30",
    icon: "⚪",
  };
}

function formatConsensusTimestamp(ts: string): string {
  try {
    const seconds = parseFloat(ts.split(".")[0]);
    return new Date(seconds * 1000).toLocaleString();
  } catch {
    return ts;
  }
}

/**
 * Parse raw HCS JSON into an HCSDecision, handling both keeper and DCA events.
 */
function parseHCSMessage(raw: any, consensusTimestamp?: string, sequenceNumber?: number): HCSDecision | null {
  if (!raw) return null;

  // ── DCA Events ──
  if (raw.type === "DCA_EVENT") {
    const eventName = raw.event || "DCA";
    const d = raw.data || {};
    let reason = "";

    if (eventName === "DCA_CREATE") {
      reason = `Created DCA plan: ${d.amount ?? "?"} ${d.asset ?? "?"} ${d.frequency ?? "?"} → ${d.action === "bonzo_supply" ? "Bonzo Supply" : d.action || "supply"}`;
    } else if (eventName === "DCA_EXECUTE") {
      reason = `Executed DCA: ${d.amount ?? "?"} ${d.asset ?? "?"} — ${d.execStatus || "?"}${d.txId ? ` (tx: ${String(d.txId).substring(0, 30)}...)` : ""}`;
    } else if (eventName === "DCA_CANCEL") {
      reason = `Cancelled DCA plan`;
    } else if (eventName === "DCA_PAUSE") {
      reason = `Paused DCA plan`;
    } else if (eventName === "DCA_RESUME") {
      reason = `Resumed DCA plan`;
    } else if (eventName === "DCA_COMPLETE") {
      reason = `DCA plan completed: ${d.reason || "budget/execution limit reached"}`;
    } else {
      reason = `DCA event: ${eventName}`;
    }

    return {
      timestamp: raw.timestamp || "",
      agent: raw.agent || "vaultmind",
      version: raw.version || "1.0",
      action: eventName,
      reason,
      confidence: -1, // Special marker: no confidence for DCA events
      context: {},
      params: d,
      consensusTimestamp,
      sequenceNumber,
      _isDCA: true,
      _dcaEvent: eventName,
      _dcaData: d,
    };
  }

  // ── Standard Keeper / Execution Events ──
  const action = raw.action || raw.decision?.action || "UNKNOWN";
  const confidence = raw.confidence ?? raw.decision?.confidence ?? -1;
  const reason = raw.reason || raw.decision?.reason || raw.details || "";

  return {
    timestamp: raw.timestamp || "",
    agent: raw.agent || "VaultMind",
    version: raw.version || "1.0",
    action,
    reason,
    confidence: typeof confidence === "number" ? confidence : -1,
    context: raw.context || raw.sentiment || {},
    params: raw.params || raw.execution || undefined,
    consensusTimestamp,
    sequenceNumber,
  };
}

// ── Expandable Decision Entry ──
function DecisionEntry({ decision }: { decision: HCSDecision }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(decision.action);
  const network = "testnet";

  const mirrorNodeUrl = decision.consensusTimestamp
    ? `https://hashscan.io/${network}/transaction/${decision.consensusTimestamp}`
    : null;

  // Display confidence only for non-DCA events with valid values
  const showConfidence =
    !decision._isDCA &&
    decision.confidence >= 0 &&
    !isNaN(decision.confidence);

  const confidenceDisplay = showConfidence
    ? decision.confidence > 1
      ? decision.confidence.toFixed(0)
      : (decision.confidence * 100).toFixed(0)
    : null;

  // Clean action label
  const displayAction = decision._isDCA
    ? decision.action.replace("DCA_", "DCA ")
    : decision.action.replace("EXECUTE_", "");

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
            <span className="text-xs">{style.icon}</span>
            <span className={`text-xs font-semibold ${style.color}`}>
              {displayAction}
            </span>
            {confidenceDisplay && (
              <span className="text-[10px] text-gray-600">
                {confidenceDisplay}% confidence
              </span>
            )}
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
        {expanded && (
          <div className="mt-2 p-2.5 bg-gray-800/40 rounded-lg border border-gray-700/30 text-[11px] space-y-1">
            {/* Keeper market context */}
            {!decision._isDCA && decision.context && Object.keys(decision.context).length > 0 && (
              <>
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
              </>
            )}

            {/* DCA event details */}
            {decision._isDCA && decision._dcaData && (
              <>
                <p className="text-gray-500 font-medium text-[10px] uppercase tracking-wider mb-1.5">
                  DCA Event Details
                </p>
                {Object.entries(decision._dcaData).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-gray-500">{k}</span>
                    <span className="text-gray-300 truncate ml-4 max-w-[200px]">{String(v)}</span>
                  </div>
                ))}
              </>
            )}

            {/* Keeper action params */}
            {!decision._isDCA && decision.params && Object.keys(decision.params).length > 0 && (
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

// ── Main Component ──
export default function HCSTimeline({ refreshTrigger }: { refreshTrigger?: number }) {
  const [topicId, setTopicId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<HCSDecision[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const stored = typeof window !== "undefined"
      ? localStorage.getItem("vaultmind_hcs_topic")
      : null;
    if (stored) {
      setTopicId(stored);
      fetchDecisions(stored);
    } else {
      fetch("/api/hcs?limit=50").then(r => r.json()).then(j => {
        if (j.success && j.data?.topicId) {
          setTopicId(j.data.topicId);
          parseAndSetDecisions(j.data.decisions || [], j.data.rawMessages);
          if (typeof window !== "undefined") {
            localStorage.setItem("vaultmind_hcs_topic", j.data.topicId);
          }
        }
      }).catch(() => {});
    }
  }, [refreshTrigger]);

  /**
   * Parse decisions from API. Handles both pre-parsed and raw Mirror Node messages.
   */
  function parseAndSetDecisions(decisions: any[], rawMessages?: any[]) {
    // If we have raw Mirror Node messages, parse them ourselves for DCA support
    if (rawMessages && rawMessages.length > 0) {
      const parsed: HCSDecision[] = [];
      for (const msg of rawMessages) {
        try {
          const text = typeof msg.message === "string"
            ? (msg.message.startsWith("{") ? msg.message : atob(msg.message))
            : "";
          const json = JSON.parse(text);
          const decision = parseHCSMessage(
            json,
            msg.consensus_timestamp,
            msg.sequence_number
          );
          if (decision) parsed.push(decision);
        } catch {
          // Skip unparseable
        }
      }
      setDecisions(parsed);
      return;
    }

    // Fallback: use pre-parsed decisions from API but guard against NaN
    const safe = decisions.map((d: any) => ({
      ...d,
      confidence: typeof d.confidence === "number" && !isNaN(d.confidence) ? d.confidence : -1,
      action: d.action || "UNKNOWN",
      reason: d.reason || "",
      context: d.context || {},
    }));
    setDecisions(safe);
  }

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
      // Fetch directly from Mirror Node for full DCA event support
      const mirrorRes = await fetch(
        `https://testnet.mirrornode.hedera.com/api/v1/topics/${tid}/messages?limit=100&order=desc`
      );
      if (mirrorRes.ok) {
        const mirrorData = await mirrorRes.json();
        const messages = mirrorData.messages || [];
        const parsed: HCSDecision[] = [];
        for (const msg of messages) {
          try {
            const text = atob(msg.message);
            const json = JSON.parse(text);
            const decision = parseHCSMessage(json, msg.consensus_timestamp, msg.sequence_number);
            if (decision) parsed.push(decision);
          } catch {
            // Skip
          }
        }
        setDecisions(parsed);
      } else {
        // Fallback to our API
        const res = await fetch(`/api/hcs?topicId=${tid}&limit=50`);
        const json = await res.json();
        if (json.success) {
          parseAndSetDecisions(json.data.decisions || [], json.data.rawMessages);
        } else {
          setError(json.error);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
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
          Keeper decisions + DCA events logged immutably on Hedera. Each entry is verifiable on HashScan.
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
            <DecisionEntry key={`${d.sequenceNumber || i}`} decision={d} />
          ))}
        </div>
      )}

      {/* Summary */}
      {decisions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-800/40 flex items-center justify-between text-[10px] text-gray-600">
          <span>
            {decisions.length} events on-chain
            {decisions.some(d => d._isDCA) && (
              <span className="ml-1">
                ({decisions.filter(d => d._isDCA).length} DCA, {decisions.filter(d => !d._isDCA).length} keeper)
              </span>
            )}
          </span>
          <span>Immutable • Timestamped • Verifiable</span>
        </div>
      )}
    </div>
  );
}