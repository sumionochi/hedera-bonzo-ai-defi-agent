"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Wallet,
  LogOut,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Unplug,
  Zap,
} from "lucide-react";

// ── Types ──

interface TokenBalance {
  tokenId: string;
  symbol: string;
  balance: number;
  decimals: number;
}

export interface WalletData {
  accountId: string;
  hbarBalance: number;
  hbarBalanceUSD: number;
  tokens: TokenBalance[];
  evmAddress: string;
  network: "testnet" | "mainnet";
}

// ── Known token map ──

const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
  "0.0.731861": { symbol: "SAUCE", decimals: 6 },
  "0.0.456858": { symbol: "USDC", decimals: 6 },
  "0.0.1460200": { symbol: "XSAUCE", decimals: 6 },
  "0.0.786931": { symbol: "HBARX", decimals: 8 },
  "0.0.1055483": { symbol: "PACK", decimals: 6 },
  "0.0.2099737": { symbol: "KARATE", decimals: 8 },
  "0.0.4711213": { symbol: "WHBAR", decimals: 8 },
  "0.0.6247396": { symbol: "bHBAR", decimals: 8 },
  "0.0.3408830": { symbol: "DOVU", decimals: 8 },
  "0.0.1159076": { symbol: "HST", decimals: 8 },
};

// ── Mirror Node ──

const MIRROR_MAINNET = "https://mainnet.mirrornode.hedera.com";
const MIRROR_TESTNET = "https://testnet.mirrornode.hedera.com";

async function fetchAccountBalance(
  accountId: string,
  network: "mainnet" | "testnet" = "testnet"
): Promise<WalletData> {
  const base = network === "mainnet" ? MIRROR_MAINNET : MIRROR_TESTNET;

  const accountRes = await fetch(`${base}/api/v1/accounts/${accountId}`);
  if (!accountRes.ok) throw new Error(`Account not found: ${accountId}`);
  const accountData = await accountRes.json();

  const hbarTinybar = parseInt(accountData.balance?.balance || "0");
  const hbarBalance = hbarTinybar / 1e8;

  let hbarPrice = 0;
  try {
    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd"
    );
    if (priceRes.ok) {
      const pd = await priceRes.json();
      hbarPrice = pd["hedera-hashgraph"]?.usd || 0;
    }
  } catch {}

  const tokensRes = await fetch(
    `${base}/api/v1/accounts/${accountId}/tokens?limit=25`
  );
  const tokensData = tokensRes.ok ? await tokensRes.json() : { tokens: [] };

  const tokens: TokenBalance[] = (tokensData.tokens || [])
    .filter((t: any) => parseInt(t.balance) > 0)
    .map((t: any) => {
      const known = KNOWN_TOKENS[t.token_id];
      return {
        tokenId: t.token_id,
        symbol: known?.symbol || t.token_id,
        balance: parseInt(t.balance) / Math.pow(10, known?.decimals || 8),
        decimals: known?.decimals || 8,
      };
    })
    .sort((a: TokenBalance, b: TokenBalance) => b.balance - a.balance);

  return {
    accountId,
    hbarBalance: Math.round(hbarBalance * 1000) / 1000,
    hbarBalanceUSD: Math.round(hbarBalance * hbarPrice * 100) / 100,
    tokens,
    evmAddress: accountData.evm_address || "",
    network,
  };
}

type ConnectionStatus = "disconnected" | "connecting" | "paired";

// ══════════════════════════════════════════════════
// WalletConnect Component — HashPack Popup + Manual
// ══════════════════════════════════════════════════

export default function WalletConnect({
  onConnect,
  onDisconnect,
  connectedAccount,
  externalWalletData,
}: {
  onConnect: (accountId: string, walletData: WalletData) => void;
  onDisconnect: () => void;
  connectedAccount: string | null;
  externalWalletData?: WalletData | null;
}) {
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualId, setManualId] = useState("");

  const hashconnectRef = useRef<any>(null);
  const initRef = useRef(false);

  // ── Compute active wallet data from EITHER internal state or external prop ──
  // This ensures the connected UI shows IMMEDIATELY when chat connects externally,
  // without waiting for a useEffect cycle.
  const activeData = walletData || externalWalletData || null;

  // Suppress WalletConnect WebSocket errors that fire asynchronously
  // These happen when the project ID is invalid/missing — not user-facing
  useEffect(() => {
    const handler = (event: ErrorEvent) => {
      if (
        event.message?.includes("WebSocket") ||
        event.message?.includes("3000") ||
        event.message?.includes("Project not found") ||
        event.message?.includes("walletconnect")
      ) {
        event.preventDefault();
        console.warn("[WalletConnect] Suppressed WebSocket error — using manual mode");
        setManualMode(true);
      }
    };
    const rejectionHandler = (event: PromiseRejectionEvent) => {
      const msg = event.reason?.message || String(event.reason || "");
      if (
        msg.includes("WebSocket") ||
        msg.includes("3000") ||
        msg.includes("Project not found") ||
        msg.includes("walletconnect")
      ) {
        event.preventDefault();
        console.warn("[WalletConnect] Suppressed unhandled rejection — using manual mode");
        setManualMode(true);
      }
    };
    window.addEventListener("error", handler);
    window.addEventListener("unhandledrejection", rejectionHandler);
    return () => {
      window.removeEventListener("error", handler);
      window.removeEventListener("unhandledrejection", rejectionHandler);
    };
  }, []);

  // ── Fetch balance and propagate ──
  const fetchAndConnect = useCallback(
    async (accountId: string) => {
      setLoading(true);
      try {
        let data: WalletData;
        try {
          data = await fetchAccountBalance(accountId, "testnet");
        } catch {
          data = await fetchAccountBalance(accountId, "mainnet");
        }
        setWalletData(data);
        onConnect(accountId, data);
      } catch (err: any) {
        // Still connect even if balance fetch fails
        const fallback: WalletData = {
          accountId,
          hbarBalance: 0,
          hbarBalanceUSD: 0,
          tokens: [],
          evmAddress: "",
          network: "testnet",
        };
        setWalletData(fallback);
        onConnect(accountId, fallback);
      } finally {
        setLoading(false);
      }
    },
    [onConnect]
  );

  // ── Init HashConnect v3 ──
  const initHashConnect = useCallback(async () => {
    if (initRef.current || typeof window === "undefined") return null;

    try {
      const { HashConnect } = await import("hashconnect");
      const { LedgerId } = await import("@hashgraph/sdk");

      // WalletConnect project ID — get yours at https://cloud.walletconnect.com
      // Set NEXT_PUBLIC_WC_PROJECT_ID in .env.local
      const PROJECT_ID =
        (typeof process !== "undefined" &&
          process.env?.NEXT_PUBLIC_WC_PROJECT_ID) ||
        "";

      if (!PROJECT_ID) {
        console.warn("[HashConnect] No WalletConnect project ID set. Using manual mode.");
        console.warn("[HashConnect] Get a free project ID at https://cloud.walletconnect.com");
        console.warn("[HashConnect] Then set NEXT_PUBLIC_WC_PROJECT_ID in .env.local");
        setManualMode(true);
        return null;
      }

      const metadata = {
        name: "VaultMind",
        description: "AI DeFi Keeper Agent on Hedera",
        icons: ["https://vaultmind.app/icon.png"],
        url: typeof window !== "undefined" ? window.location.origin : "https://vaultmind.app",
      };

      const hc = new HashConnect(LedgerId.TESTNET, PROJECT_ID, metadata, false);

      // Pairing success → fetch wallet data
      hc.pairingEvent.on(async (data: any) => {
        const accountIds: string[] = data.accountIds || [];
        if (accountIds.length > 0) {
          const acctId = accountIds[0];
          setStatus("paired");
          setError(null);
          localStorage.setItem("vaultmind_account", acctId);
          localStorage.setItem("vaultmind_wallet_mode", "hashpack");
          await fetchAndConnect(acctId);
        }
      });

      hc.connectionStatusChangeEvent.on((state: string) => {
        if (state === "Disconnected") setStatus("disconnected");
        else if (state === "Connected" || state === "Paired") setStatus("paired");
        else if (state === "Connecting") setStatus("connecting");
      });

      hc.disconnectionEvent.on(() => {
        setStatus("disconnected");
        setWalletData(null);
        localStorage.removeItem("vaultmind_account");
        localStorage.removeItem("vaultmind_wallet_mode");
        onDisconnect();
      });

      // Wrap init in a timeout — WalletConnect relay can hang with bad project IDs
      const initPromise = hc.init();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("HashConnect init timed out — check your WalletConnect project ID")), 8000)
      );

      await Promise.race([initPromise, timeoutPromise]);

      hashconnectRef.current = hc;
      initRef.current = true;

      // Restore existing session
      const existing = hc.connectedAccountIds;
      if (existing && existing.length > 0) {
        const acctId = existing[0].toString();
        setStatus("paired");
        await fetchAndConnect(acctId);
      }

      return hc;
    } catch (err: any) {
      console.error("[HashConnect] Init error:", err.message);
      // Don't crash the app — just fall back to manual mode
      setManualMode(true);
      setError(null); // Don't show WC internal errors to user
      return null;
    }
  }, [fetchAndConnect, onDisconnect]);

  // ── On mount: restore session ──
  // Always restore via manual balance fetch — never auto-init HashConnect
  // (WalletConnect WebSocket errors crash the app if project ID is stale)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("vaultmind_account");

    if (saved && !connectedAccount) {
      // Regardless of how they originally connected, restore via balance fetch
      // This avoids WalletConnect WebSocket initialization entirely on page load
      setManualMode(true);
      setStatus("paired");
      fetchAndConnect(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Connect via HashPack popup ──
  async function connectHashPack() {
    setError(null);
    setStatus("connecting");

    // Check if WC project ID exists before attempting connection
    const hasProjectId = typeof process !== "undefined" && process.env?.NEXT_PUBLIC_WC_PROJECT_ID;
    if (!hasProjectId) {
      setError("WalletConnect project ID not configured. Use manual entry below, or set NEXT_PUBLIC_WC_PROJECT_ID in .env.local (free at cloud.walletconnect.com)");
      setStatus("disconnected");
      setManualMode(true);
      return;
    }

    try {
      let hc = hashconnectRef.current;
      if (!hc) hc = await initHashConnect();
      if (!hc) throw new Error("HashConnect not available — use manual entry below");

      // Opens the WalletConnect modal → HashPack extension responds
      await hc.openPairingModal("dark", "#030712", "#10b981", "#ffffff", "12px");
    } catch (err: any) {
      console.error("[HashPack] Connect error:", err.message);
      setError(err.message);
      setStatus("disconnected");
      setManualMode(true);
    }
  }

  // ── Manual account connect ──
  async function connectManual() {
    const id = manualId.trim();
    if (!id || !/^0\.0\.\d+$/.test(id)) {
      setError("Use format 0.0.XXXXX");
      return;
    }
    setStatus("connecting");
    setError(null);
    localStorage.setItem("vaultmind_account", id);
    localStorage.setItem("vaultmind_wallet_mode", "manual");
    await fetchAndConnect(id);
    setStatus("paired");
    setManualId("");
  }

  // ── Refresh balance ──
  async function handleRefresh() {
    if (!connectedAccount) return;
    setLoading(true);
    try {
      let data: WalletData;
      try {
        data = await fetchAccountBalance(connectedAccount, "testnet");
      } catch {
        data = await fetchAccountBalance(connectedAccount, "mainnet");
      }
      setWalletData(data);
    } catch {}
    setLoading(false);
  }

  // ── Disconnect ──
  async function handleDisconnect() {
    try {
      if (hashconnectRef.current) await hashconnectRef.current.disconnect();
    } catch {}
    setWalletData(null);
    setStatus("disconnected");
    setError(null);
    localStorage.removeItem("vaultmind_account");
    localStorage.removeItem("vaultmind_wallet_mode");
    onDisconnect();
  }

  function copyAddress() {
    if (connectedAccount) {
      navigator.clipboard.writeText(connectedAccount);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ══════════════ CONNECTED STATE ══════════════
  if (connectedAccount && activeData) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-gray-900/60 p-3 card-glow">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center relative">
              <Wallet className="w-4 h-4 text-emerald-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-pulse-dot" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-gray-200">
                  {connectedAccount}
                </span>
                <button
                  onClick={copyAddress}
                  className="text-gray-600 hover:text-gray-400 transition-colors"
                >
                  {copied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-emerald-400/70 bg-emerald-500/10 rounded px-1 py-px">
                  {activeData.network === "mainnet" ? "Mainnet" : "Testnet"}
                </span>
                {activeData.evmAddress && (
                  <span className="text-[10px] text-gray-500">
                    EVM: {activeData.evmAddress.slice(0, 6)}...
                    {activeData.evmAddress.slice(-4)}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <div className="text-sm font-semibold text-gray-200">
                {activeData.hbarBalance.toLocaleString()} ℏ
              </div>
              <div className="text-[10px] text-gray-500">
                ${activeData.hbarBalanceUSD.toLocaleString()}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
            <button
              onClick={handleDisconnect}
              className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {activeData.tokens.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-800/40">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-gray-500 hover:text-gray-400 transition-colors mb-1"
            >
              {activeData.tokens.length} tokens {expanded ? "▾" : "▸"}
            </button>
            {expanded && (
              <div className="grid grid-cols-3 gap-1 mt-1">
                {activeData.tokens.slice(0, 9).map((t) => (
                  <div
                    key={t.tokenId}
                    className="text-[11px] bg-gray-800/40 rounded px-2 py-1 flex justify-between"
                  >
                    <span className="text-gray-400">{t.symbol}</span>
                    <span className="text-gray-300">
                      {t.balance < 1000
                        ? t.balance.toFixed(2)
                        : `${(t.balance / 1000).toFixed(1)}K`}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-2 pt-2 border-t border-gray-800/40">
          <a
            href={`https://hashscan.io/${activeData.network}/account/${connectedAccount}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] text-emerald-400/70 hover:text-emerald-400 flex items-center gap-1"
          >
            View on HashScan <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    );
  }

  // ══════════════ DISCONNECTED STATE ══════════════
  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-400">Connect Wallet</h3>
      </div>

      {/* HashPack popup button */}
      {!manualMode && (
        <button
          onClick={connectHashPack}
          disabled={status === "connecting"}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-gradient-to-r from-purple-600/80 to-emerald-600/80 hover:from-purple-500/80 hover:to-emerald-500/80 disabled:from-gray-700 disabled:to-gray-700 rounded-xl text-sm font-medium transition-all duration-200 mb-2 group"
        >
          {status === "connecting" ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Connecting to HashPack...
            </>
          ) : (
            <>
              <div className="w-5 h-5 rounded bg-white/10 flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <Zap className="w-3 h-3" />
              </div>
              Connect HashPack
            </>
          )}
        </button>
      )}

      {!manualMode && (
        <button
          onClick={() => setManualMode(true)}
          className="w-full text-[10px] text-gray-600 hover:text-gray-400 transition-colors py-1"
        >
          or enter Account ID manually
        </button>
      )}

      {manualMode && (
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              value={manualId}
              onChange={(e) => {
                setManualId(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && connectManual()}
              placeholder="0.0.xxxxx"
              className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
            />
            <button
              onClick={connectManual}
              disabled={loading || !manualId.trim()}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Go"}
            </button>
          </div>
          <button
            onClick={() => {
              setManualMode(false);
              setError(null);
            }}
            className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
          >
            <Unplug className="w-2.5 h-2.5" /> Back to HashPack
          </button>
        </div>
      )}

      {error && <p className="text-[11px] text-red-400 mt-2">{error}</p>}
      <p className="text-[10px] text-gray-600 mt-2">
        Connect HashPack wallet or enter any Hedera Account ID to view live
        balances.
      </p>
    </div>
  );
}