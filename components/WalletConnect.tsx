"use client";

import { useState, useEffect } from "react";
import {
  Wallet,
  LogIn,
  LogOut,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
} from "lucide-react";

// ── Types ──

interface TokenBalance {
  tokenId: string;
  symbol: string;
  balance: number;
  decimals: number;
}

interface WalletData {
  accountId: string;
  hbarBalance: number;
  hbarBalanceUSD: number;
  tokens: TokenBalance[];
  evmAddress: string;
}

// ── Mirror Node Helpers ──

const MIRROR_NODE = "https://mainnet.mirrornode.hedera.com";
const MIRROR_NODE_TESTNET = "https://testnet.mirrornode.hedera.com";

async function fetchAccountBalance(
  accountId: string,
  network: "mainnet" | "testnet" = "testnet"
): Promise<WalletData> {
  const base = network === "mainnet" ? MIRROR_NODE : MIRROR_NODE_TESTNET;

  // Fetch account info (HBAR balance + EVM address)
  const accountRes = await fetch(`${base}/api/v1/accounts/${accountId}`);
  if (!accountRes.ok) throw new Error(`Account not found: ${accountId}`);
  const accountData = await accountRes.json();

  const hbarTinybar = parseInt(accountData.balance?.balance || "0");
  const hbarBalance = hbarTinybar / 1e8;

  // Get HBAR USD price from CoinGecko
  let hbarPrice = 0;
  try {
    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd",
      { next: { revalidate: 120 } }
    );
    if (priceRes.ok) {
      const priceData = await priceRes.json();
      hbarPrice = priceData["hedera-hashgraph"]?.usd || 0;
    }
  } catch {}

  // Fetch token balances
  const tokensRes = await fetch(
    `${base}/api/v1/accounts/${accountId}/tokens?limit=25`
  );
  const tokensData = tokensRes.ok ? await tokensRes.json() : { tokens: [] };

  // Map known token IDs to symbols
  const KNOWN_TOKENS: Record<string, { symbol: string; decimals: number }> = {
    "0.0.731861": { symbol: "SAUCE", decimals: 6 },
    "0.0.456858": { symbol: "USDC", decimals: 6 },
    "0.0.1460200": { symbol: "XSAUCE", decimals: 6 },
    "0.0.786931": { symbol: "HBARX", decimals: 8 },
    "0.0.1055483": { symbol: "PACK", decimals: 6 },
    "0.0.2099737": { symbol: "KARATE", decimals: 8 },
    "0.0.4711213": { symbol: "WHBAR", decimals: 8 },
    "0.0.6247396": { symbol: "bHBAR", decimals: 8 },
  };

  const tokens: TokenBalance[] = (tokensData.tokens || [])
    .filter((t: any) => parseInt(t.balance) > 0)
    .map((t: any) => {
      const known = KNOWN_TOKENS[t.token_id];
      return {
        tokenId: t.token_id,
        symbol: known?.symbol || t.token_id.split(".").pop() || "???",
        balance:
          parseInt(t.balance) / Math.pow(10, known?.decimals || 8),
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
  };
}

// ── Component ──

export default function WalletConnect({
  onConnect,
  onDisconnect,
  connectedAccount,
}: {
  onConnect: (accountId: string, walletData: WalletData) => void;
  onDisconnect: () => void;
  connectedAccount: string | null;
}) {
  const [inputId, setInputId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // On mount, check localStorage for saved connection
  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem("vaultmind_account");
    if (saved && !connectedAccount) {
      handleConnect(saved);
    }
  }, []);

  async function handleConnect(accountId?: string) {
    const id = accountId || inputId.trim();
    if (!id) return;

    // Validate format
    if (!/^0\.0\.\d+$/.test(id)) {
      setError("Invalid format. Use 0.0.XXXXX");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await fetchAccountBalance(id, "testnet");
      setWalletData(data);
      setInputId("");
      localStorage.setItem("vaultmind_account", id);
      onConnect(id, data);
    } catch (err: any) {
      setError(err.message || "Failed to connect");
      // Try mainnet if testnet fails
      try {
        const data = await fetchAccountBalance(id, "mainnet");
        setWalletData(data);
        setInputId("");
        localStorage.setItem("vaultmind_account", id);
        onConnect(id, data);
        setError(null);
      } catch {
        setError("Account not found on testnet or mainnet");
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    if (!connectedAccount) return;
    setLoading(true);
    try {
      const data = await fetchAccountBalance(connectedAccount, "testnet");
      setWalletData(data);
    } catch {
      try {
        const data = await fetchAccountBalance(connectedAccount, "mainnet");
        setWalletData(data);
      } catch {}
    } finally {
      setLoading(false);
    }
  }

  function handleDisconnect() {
    setWalletData(null);
    localStorage.removeItem("vaultmind_account");
    onDisconnect();
  }

  function copyAddress() {
    if (connectedAccount) {
      navigator.clipboard.writeText(connectedAccount);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  // ── Connected State ──
  if (connectedAccount && walletData) {
    return (
      <div className="rounded-xl border border-emerald-500/20 bg-gray-900/60 p-3 card-glow">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <Wallet className="w-4 h-4 text-emerald-400" />
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
              <p className="text-[10px] text-gray-500">
                {walletData.evmAddress
                  ? `EVM: ${walletData.evmAddress.slice(0, 8)}...${walletData.evmAddress.slice(-6)}`
                  : "Connected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="text-right mr-1">
              <div className="text-sm font-semibold text-gray-200">
                {walletData.hbarBalance.toLocaleString()} ℏ
              </div>
              <div className="text-[10px] text-gray-500">
                ${walletData.hbarBalanceUSD.toLocaleString()}
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-700/60 text-gray-500 hover:text-gray-300 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={handleDisconnect}
              className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Token balances row */}
        {walletData.tokens.length > 0 && (
          <div className="mt-2 pt-2 border-t border-gray-800/40">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-[10px] text-gray-500 hover:text-gray-400 transition-colors mb-1"
            >
              {walletData.tokens.length} tokens{" "}
              {expanded ? "▾" : "▸"}
            </button>
            {expanded && (
              <div className="grid grid-cols-3 gap-1 mt-1">
                {walletData.tokens.slice(0, 9).map((t) => (
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
      </div>
    );
  }

  // ── Disconnected State ──
  return (
    <div className="rounded-xl border border-gray-800/60 bg-gray-900/40 p-4 card-glow">
      <div className="flex items-center gap-2 mb-3">
        <Wallet className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-medium text-gray-400">
          Connect Wallet
        </h3>
      </div>
      <div className="flex gap-2">
        <input
          value={inputId}
          onChange={(e) => {
            setInputId(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => e.key === "Enter" && handleConnect()}
          placeholder="Enter Account ID (0.0.xxxxx)"
          className="flex-1 bg-gray-800/60 border border-gray-700/40 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder:text-gray-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20"
        />
        <button
          onClick={() => handleConnect()}
          disabled={loading || !inputId.trim()}
          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg text-sm font-medium transition-colors flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <LogIn className="w-4 h-4" />
          )}
          Connect
        </button>
      </div>
      {error && (
        <p className="text-[11px] text-red-400 mt-1.5">{error}</p>
      )}
      <p className="text-[10px] text-gray-600 mt-2">
        Reads balances from Mirror Node. No keys required.
      </p>
    </div>
  );
}

export type { WalletData };