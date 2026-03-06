"use client";

import { useState, useEffect } from "react";
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  X,
  ArrowRight,
  Loader2,
  ExternalLink,
} from "lucide-react";

// ── Types ──

export interface PendingTransaction {
  id: string;
  action: string; // "DEPOSIT" | "WITHDRAW" | "BORROW" | "REPAY" | "HARVEST" | "REBALANCE"
  description: string;
  details: {
    token?: string;
    amount?: string;
    from?: string;
    to?: string;
    estimatedGas?: string;
    reason?: string;
    confidence?: number;
  };
  source: "keeper" | "agent" | "user";
  onApprove: () => Promise<{ success: boolean; txId?: string; error?: string }>;
  onReject: () => void;
}

export interface TransactionResult {
  success: boolean;
  txId?: string;
  error?: string;
  action: string;
}

// ── Action Colors ──

function actionStyle(action: string): { color: string; bg: string; icon: string } {
  const upper = action.toUpperCase();
  if (upper.includes("DEPOSIT") || upper.includes("INCREASE"))
    return { color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: "↑" };
  if (upper.includes("WITHDRAW") || upper.includes("HARVEST") || upper.includes("EXIT"))
    return { color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: "↓" };
  if (upper.includes("BORROW"))
    return { color: "text-orange-400", bg: "bg-orange-500/10 border-orange-500/20", icon: "←" };
  if (upper.includes("REPAY"))
    return { color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20", icon: "→" };
  if (upper.includes("REBALANCE"))
    return { color: "text-purple-400", bg: "bg-purple-500/10 border-purple-500/20", icon: "⇄" };
  return { color: "text-gray-400", bg: "bg-gray-500/10 border-gray-500/20", icon: "•" };
}

// ── Component ──

export default function TransactionModal({
  transaction,
  onClose,
  onResult,
}: {
  transaction: PendingTransaction;
  onClose: () => void;
  onResult: (result: TransactionResult) => void;
}) {
  const [status, setStatus] = useState<"pending" | "executing" | "success" | "error">("pending");
  const [result, setResult] = useState<{ txId?: string; error?: string }>({});
  const style = actionStyle(transaction.action);

  async function handleApprove() {
    setStatus("executing");
    try {
      const res = await transaction.onApprove();
      if (res.success) {
        setStatus("success");
        setResult({ txId: res.txId });
        onResult({ success: true, txId: res.txId, action: transaction.action });
      } else {
        setStatus("error");
        setResult({ error: res.error || "Transaction failed" });
        onResult({ success: false, error: res.error, action: transaction.action });
      }
    } catch (err: any) {
      setStatus("error");
      setResult({ error: err.message });
      onResult({ success: false, error: err.message, action: transaction.action });
    }
  }

  function handleReject() {
    transaction.onReject();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={status === "pending" ? handleReject : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 rounded-2xl bg-gray-900 border border-gray-700/50 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`px-5 py-4 border-b border-gray-800/60 ${style.bg}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl ${style.bg} border flex items-center justify-center`}>
                <span className="text-xl">{style.icon}</span>
              </div>
              <div>
                <h3 className={`text-base font-semibold ${style.color}`}>
                  {transaction.action.replace(/_/g, " ")}
                </h3>
                <p className="text-xs text-gray-500">
                  {transaction.source === "keeper"
                    ? "Keeper Engine Decision"
                    : transaction.source === "agent"
                    ? "Agent Recommendation"
                    : "User Request"}
                </p>
              </div>
            </div>
            {status === "pending" && (
              <button
                onClick={handleReject}
                className="p-1.5 rounded-lg hover:bg-gray-800/60 text-gray-500 hover:text-gray-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-3">
          {/* Description */}
          <p className="text-sm text-gray-300 leading-relaxed">
            {transaction.description}
          </p>

          {/* Details grid */}
          <div className="bg-gray-800/40 rounded-xl p-3 space-y-2">
            {transaction.details.token && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Token</span>
                <span className="text-gray-200 font-medium">{transaction.details.token}</span>
              </div>
            )}
            {transaction.details.amount && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Amount</span>
                <span className="text-gray-200 font-medium">{transaction.details.amount}</span>
              </div>
            )}
            {transaction.details.from && transaction.details.to && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500">Route</span>
                <span className="text-gray-200 flex items-center gap-1">
                  {transaction.details.from}
                  <ArrowRight className="w-3 h-3 text-gray-600" />
                  {transaction.details.to}
                </span>
              </div>
            )}
            {transaction.details.estimatedGas && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Est. Fee</span>
                <span className="text-gray-200">{transaction.details.estimatedGas}</span>
              </div>
            )}
            {transaction.details.confidence !== undefined && (
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">AI Confidence</span>
                <span className={`font-medium ${
                  transaction.details.confidence > 0.7
                    ? "text-emerald-400"
                    : transaction.details.confidence > 0.4
                    ? "text-yellow-400"
                    : "text-red-400"
                }`}>
                  {(transaction.details.confidence * 100).toFixed(0)}%
                </span>
              </div>
            )}
          </div>

          {/* Reason */}
          {transaction.details.reason && (
            <div className="bg-gray-800/20 rounded-lg p-2.5 border-l-2 border-emerald-500/30">
              <p className="text-[11px] text-gray-400 leading-relaxed">
                <span className="text-emerald-400 font-medium">Reasoning: </span>
                {transaction.details.reason}
              </p>
            </div>
          )}

          {/* Status messages */}
          {status === "executing" && (
            <div className="flex items-center gap-2 text-sm text-yellow-400 bg-yellow-500/10 rounded-lg p-3">
              <Loader2 className="w-4 h-4 animate-spin" />
              Executing transaction...
            </div>
          )}
          {status === "success" && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-emerald-400 bg-emerald-500/10 rounded-lg p-3">
                <CheckCircle className="w-4 h-4" />
                Transaction executed successfully
              </div>
              {result.txId && (
                <a
                  href={`https://hashscan.io/testnet/transaction/${result.txId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300"
                >
                  View on HashScan <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}
          {status === "error" && (
            <div className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4" />
              {result.error || "Transaction failed"}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-gray-800/60 flex gap-3">
          {status === "pending" && (
            <>
              <button
                onClick={handleReject}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-300 transition-colors"
              >
                Reject
              </button>
              <button
                onClick={handleApprove}
                className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  style.color.includes("red")
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                <Shield className="w-4 h-4" />
                Approve & Execute
              </button>
            </>
          )}
          {(status === "success" || status === "error") && (
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-xl text-sm font-medium text-gray-300 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}