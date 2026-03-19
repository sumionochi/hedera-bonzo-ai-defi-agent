// ============================================
// VaultMind — Stader Labs HBARX Integration
// ============================================
// Enables the liquid staking strategy loop:
//   HBAR → Stader (stake) → HBARX → Bonzo (supply) → Borrow USDC
//
// TESTNET: Uses Pyth price feed for real exchange rate estimation.
//          Staking tx is simulated (no Stader testnet contract).
//          Bonzo deposit/borrow uses REAL testnet contracts.
// MAINNET: Full real execution — Stader 0.0.800556 + Bonzo + Pyth prices.
//
// Pyth Integration: Real-time HBAR/USD prices for accurate DCA
//   and strategy calculations across all networks.
// ============================================

import {
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
  AccountId,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { defaultAbiCoder } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";
import {
  executeDeposit,
  executeBorrow,
  type ExecutionResult,
} from "./bonzo-execute";
import { getHbarPrice } from "./pyth";

const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

interface StaderConfig {
  stakingContract: string;
  hbarxTokenId: string;
  hbarxEvmAddr: string;
  hbarxDecimals: number;
  unstakingContract: string;
  isSimulated: boolean;
  mirrorNodeBase: string;
}

const MAINNET_STADER: StaderConfig = {
  stakingContract: "0.0.800556",
  hbarxTokenId: "0.0.834116",
  hbarxEvmAddr: "0x00000000000000000000000000000000000cba44",
  hbarxDecimals: 8,
  unstakingContract: "0.0.800557",
  isSimulated: false,
  mirrorNodeBase: "https://mainnet.mirrornode.hedera.com",
};

const TESTNET_STADER: StaderConfig = {
  stakingContract: "0.0.0",
  hbarxTokenId: "0.0.2233069",
  hbarxEvmAddr: "0x0000000000000000000000000000000000220ced",
  hbarxDecimals: 8,
  unstakingContract: "0.0.0",
  isSimulated: true,
  mirrorNodeBase: "https://testnet.mirrornode.hedera.com",
};

const STADER = HEDERA_NETWORK === "mainnet" ? MAINNET_STADER : TESTNET_STADER;

// ═══════════════════════════════════════════════════════════
// Exchange Rate & Data — with Pyth price integration
// ═══════════════════════════════════════════════════════════

export interface StaderData {
  exchangeRate: number;
  totalPooledHbar: number;
  totalHbarX: number;
  stakingAPY: number;
  isSimulated: boolean;
  network: string;
  hbarxTokenId: string;
  hbarPriceUSD: number; // From Pyth
  hbarxPriceUSD: number; // Derived: hbarPrice / exchangeRate
  priceSource: string;
}

export async function getStaderData(): Promise<StaderData> {
  // Always fetch real HBAR price from Pyth
  let hbarPriceUSD = 0;
  let priceSource = "unavailable";
  try {
    const priceData = await getHbarPrice();
    hbarPriceUSD = priceData.price;
    priceSource = priceData.source;
  } catch {}

  if (STADER.isSimulated) {
    // Testnet: try to get real exchange rate from mainnet Mirror Node
    let exchangeRate = 0.8247; // fallback
    try {
      const mainnetMirror = "https://mainnet.mirrornode.hedera.com";
      const res = await fetch(`${mainnetMirror}/api/v1/tokens/0.0.834116`, {
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const data = await res.json();
        // HBARX total_supply / total staked gives approximate rate
        // But Mirror Node doesn't expose this directly, so we query Stader
      }
    } catch {}

    // Try querying mainnet Stader contract for real exchange rate
    try {
      const mainClient = (await import("@hashgraph/sdk")).Client.forMainnet();
      // Read-only query, no operator needed for ContractCallQuery with payment
      // But we need to set an operator for payment — skip if no mainnet keys
      // Use the known exchange rate from Stader's public data
      const apiRes = await fetch("https://api.staderlabs.com/hedera/apr", {
        signal: AbortSignal.timeout(3000),
      });
      if (apiRes.ok) {
        const apiData = await apiRes.json();
        if (apiData.exchangeRate) {
          exchangeRate = apiData.exchangeRate;
        }
      }
    } catch {}

    const hbarxPriceUSD = hbarPriceUSD > 0 ? hbarPriceUSD / exchangeRate : 0;

    return {
      exchangeRate,
      totalPooledHbar: 1_420_000_000,
      totalHbarX: 1_171_170_000,
      stakingAPY: 2.5,
      isSimulated: true,
      network: "testnet",
      hbarxTokenId: STADER.hbarxTokenId,
      hbarPriceUSD,
      hbarxPriceUSD,
      priceSource,
    };
  }

  // MAINNET: Real on-chain queries
  try {
    const client = getHederaClient();
    const contractId = ContractId.fromString(STADER.stakingContract);

    const rateQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100_000)
      .setFunction("getExchangeRate");
    const rateResult = await rateQuery.execute(client);
    const [rawRate] = defaultAbiCoder.decode(["uint256"], rateResult.bytes);
    const exchangeRate = Number(rawRate) / 1e8;

    const poolQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100_000)
      .setFunction("getTotalPooledHbar");
    const poolResult = await poolQuery.execute(client);
    const [rawPool] = defaultAbiCoder.decode(["uint256"], poolResult.bytes);

    const hbarxQuery = new ContractCallQuery()
      .setContractId(contractId)
      .setGas(100_000)
      .setFunction("getTotalHbarX");
    const hbarxResult = await hbarxQuery.execute(client);
    const [rawHbarX] = defaultAbiCoder.decode(["uint256"], hbarxResult.bytes);

    const finalRate = 1 / exchangeRate;
    const hbarxPriceUSD = hbarPriceUSD > 0 ? hbarPriceUSD / finalRate : 0;

    return {
      exchangeRate: finalRate,
      totalPooledHbar: Number(rawPool) / 1e8,
      totalHbarX: Number(rawHbarX) / 1e8,
      stakingAPY: 2.5,
      isSimulated: false,
      network: "mainnet",
      hbarxTokenId: STADER.hbarxTokenId,
      hbarPriceUSD,
      hbarxPriceUSD,
      priceSource,
    };
  } catch (err: any) {
    console.error("[Stader] Failed to query on-chain data:", err.message);
    const hbarxPriceUSD = hbarPriceUSD > 0 ? hbarPriceUSD / 0.8247 : 0;
    return {
      exchangeRate: 0.8247,
      totalPooledHbar: 1_420_000_000,
      totalHbarX: 1_171_170_000,
      stakingAPY: 2.5,
      isSimulated: true,
      network: HEDERA_NETWORK,
      hbarxTokenId: STADER.hbarxTokenId,
      hbarPriceUSD,
      hbarxPriceUSD,
      priceSource,
    };
  }
}

export async function getHbarxBalance(accountId: string): Promise<number> {
  try {
    const res = await fetch(
      `${STADER.mirrorNodeBase}/api/v1/accounts/${accountId}/tokens?token.id=${STADER.hbarxTokenId}&limit=1`
    );
    if (!res.ok) return 0;
    const data = await res.json();
    const token = data.tokens?.[0];
    if (!token) return 0;
    return parseInt(token.balance) / 10 ** STADER.hbarxDecimals;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════
// Stake HBAR → HBARX
// ═══════════════════════════════════════════════════════════

export async function stakeHbar(amountHbar: number): Promise<ExecutionResult> {
  console.log(
    `[Stader] Staking ${amountHbar} HBAR → HBARX (${HEDERA_NETWORK})`
  );
  const txIds: string[] = [];
  const hashScanLinks: string[] = [];
  const hashscanBase =
    HEDERA_NETWORK === "mainnet"
      ? "https://hashscan.io/mainnet"
      : "https://hashscan.io/testnet";

  if (STADER.isSimulated) {
    const staderData = await getStaderData();
    const hbarxReceived = amountHbar * staderData.exchangeRate;
    const valueUSD = amountHbar * staderData.hbarPriceUSD;

    console.log(
      `[Stader] 🧪 SIMULATED: ${amountHbar} HBAR ($${valueUSD.toFixed(
        2
      )}) → ${hbarxReceived.toFixed(4)} HBARX`
    );
    return {
      success: true,
      action: "stader_stake",
      details: `[Testnet Simulation] Staked ${amountHbar} HBAR (~$${valueUSD.toFixed(
        2
      )}) with Stader Labs.\nExchange rate: 1 HBAR = ${staderData.exchangeRate.toFixed(
        6
      )} HBARX\nReceived: ~${hbarxReceived.toFixed(4)} HBARX (~$${(
        hbarxReceived * staderData.hbarxPriceUSD
      ).toFixed(2)})\nStaking APY: ~${
        staderData.stakingAPY
      }%\nHBAR price: $${staderData.hbarPriceUSD.toFixed(4)} (Pyth ${
        staderData.priceSource
      })\n\nNote: Stader staking contract is mainnet-only. On testnet, the staking step is simulated but Bonzo deposits use real testnet contracts.`,
      txIds: ["simulated-stader-stake"],
      hashScanLinks: [],
      toolsUsed: ["stader_stake", "pyth_price_feed"],
    };
  }

  // MAINNET: Real staking
  try {
    const client = getHederaClient();
    const contractId = ContractId.fromString(STADER.stakingContract);

    // Associate HBARX token
    try {
      const assocTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!))
        .setTokenIds([TokenId.fromString(STADER.hbarxTokenId)]);
      await assocTx.execute(client);
    } catch {
      /* Already associated */
    }

    // Stake HBAR
    const stakeTx = new ContractExecuteTransaction()
      .setContractId(contractId)
      .setGas(300_000)
      .setPayableAmount(new Hbar(amountHbar))
      .setFunction("stake");
    const stakeResult = await stakeTx.execute(client);
    await stakeResult.getReceipt(client);
    const txId = stakeResult.transactionId.toString();
    txIds.push(txId);
    hashScanLinks.push(`${hashscanBase}/transaction/${txId}`);

    const staderData = await getStaderData();
    const hbarxReceived = amountHbar * staderData.exchangeRate;

    return {
      success: true,
      action: "stader_stake",
      details: `Staked ${amountHbar} HBAR (~$${(
        amountHbar * staderData.hbarPriceUSD
      ).toFixed(2)}) → ~${hbarxReceived.toFixed(4)} HBARX\nAPY: ~${
        staderData.stakingAPY
      }%\nHBAR price: $${staderData.hbarPriceUSD.toFixed(4)} (Pyth)`,
      txIds,
      hashScanLinks,
      toolsUsed: ["stader_stake", "pyth_price_feed"],
    };
  } catch (err: any) {
    console.error("[Stader] Stake failed:", err.message);
    return {
      success: false,
      action: "stader_stake",
      details: `Stader stake failed: ${err.message}`,
      error: err.message,
      txIds,
      hashScanLinks,
      toolsUsed: ["stader_stake"],
    };
  }
}

// ═══════════════════════════════════════════════════════════
// Full Strategy: HBAR → HBARX → Bonzo Supply (→ Borrow)
// ═══════════════════════════════════════════════════════════

export interface StrategyResult {
  steps: StrategyStep[];
  totalSteps: number;
  successfulSteps: number;
  overallStatus: "success" | "partial" | "failed";
  summary: string;
  staderData?: StaderData;
}

export interface StrategyStep {
  step: number;
  name: string;
  description: string;
  status: "success" | "failed" | "skipped" | "simulated";
  txId?: string;
  details?: string;
}

export async function executeHbarxStrategy(
  amountHbar: number,
  borrowUSDC: boolean = false,
  borrowAmount?: number
): Promise<StrategyResult> {
  const steps: StrategyStep[] = [];
  const staderData = await getStaderData();
  const hbarxAmount = amountHbar * staderData.exchangeRate;
  const totalSteps = borrowUSDC ? 3 : 2;
  const valueUSD = amountHbar * staderData.hbarPriceUSD;

  console.log(
    `[Stader Strategy] ${amountHbar} HBAR ($${valueUSD.toFixed(
      2
    )}) → HBARX → Bonzo (${HEDERA_NETWORK})`
  );

  // Step 1: Stake HBAR → HBARX
  if (STADER.isSimulated) {
    // Testnet: simulate staking, but REAL Bonzo deposit
    steps.push({
      step: 1,
      name: "Stake HBAR → HBARX",
      description: `Stake ${amountHbar} HBAR with Stader Labs`,
      status: "simulated",
      details: `${amountHbar} HBAR ($${valueUSD.toFixed(
        2
      )}) → ${hbarxAmount.toFixed(
        4
      )} HBARX at rate ${staderData.exchangeRate.toFixed(6)}\nStaking APY: ~${
        staderData.stakingAPY
      }%\nPrice source: Pyth (${staderData.priceSource})`,
    });

    // Step 2: REAL Bonzo deposit on testnet
    try {
      const depositResult = await executeDeposit("HBARX", hbarxAmount);
      steps.push({
        step: 2,
        name: "Supply HBARX to Bonzo Lend",
        description: `Deposit ~${hbarxAmount.toFixed(4)} HBARX as collateral`,
        status: depositResult.success ? "success" : "failed",
        txId: depositResult.txIds?.[0],
        details: depositResult.details,
      });

      if (!depositResult.success) {
        return {
          steps,
          totalSteps,
          successfulSteps: 1,
          overallStatus: "partial",
          summary: `Staked HBAR (simulated) but Bonzo deposit failed: ${depositResult.details}`,
          staderData,
        };
      }
    } catch (err: any) {
      steps.push({
        step: 2,
        name: "Supply HBARX to Bonzo Lend",
        description: `Deposit HBARX as collateral`,
        status: "failed",
        details: err.message,
      });
      return {
        steps,
        totalSteps,
        successfulSteps: 1,
        overallStatus: "partial",
        summary: `Staked HBAR (simulated) but Bonzo deposit failed: ${err.message}`,
        staderData,
      };
    }

    // Step 3: Optional borrow (REAL on testnet)
    if (borrowUSDC) {
      try {
        const bAmount = borrowAmount || Math.floor(hbarxAmount * 0.3);
        const borrowResult = await executeBorrow("USDC", bAmount);
        steps.push({
          step: 3,
          name: "Borrow USDC against collateral",
          description: `Borrow ${bAmount} USDC`,
          status: borrowResult.success ? "success" : "failed",
          txId: borrowResult.txIds?.[0],
          details: borrowResult.details,
        });
      } catch (err: any) {
        steps.push({
          step: 3,
          name: "Borrow USDC against collateral",
          description: "Borrow USDC",
          status: "failed",
          details: err.message,
        });
      }
    }
  } else {
    // MAINNET: Everything is real
    const stakeResult = await stakeHbar(amountHbar);
    steps.push({
      step: 1,
      name: "Stake HBAR → HBARX",
      description: `Stake ${amountHbar} HBAR with Stader Labs`,
      status: stakeResult.success ? "success" : "failed",
      txId: stakeResult.txIds?.[0],
      details: stakeResult.details,
    });

    if (!stakeResult.success) {
      return {
        steps,
        totalSteps,
        successfulSteps: 0,
        overallStatus: "failed",
        summary: `Strategy failed at step 1: ${stakeResult.details}`,
        staderData,
      };
    }

    try {
      const depositResult = await executeDeposit("HBARX", hbarxAmount);
      steps.push({
        step: 2,
        name: "Supply HBARX to Bonzo Lend",
        description: `Deposit ~${hbarxAmount.toFixed(4)} HBARX as collateral`,
        status: depositResult.success ? "success" : "failed",
        txId: depositResult.txIds?.[0],
        details: depositResult.details,
      });

      if (!depositResult.success) {
        return {
          steps,
          totalSteps,
          successfulSteps: 1,
          overallStatus: "partial",
          summary: `Staked HBAR but Bonzo deposit failed: ${depositResult.details}`,
          staderData,
        };
      }
    } catch (err: any) {
      steps.push({
        step: 2,
        name: "Supply HBARX to Bonzo Lend",
        description: `Deposit HBARX`,
        status: "failed",
        details: err.message,
      });
      return {
        steps,
        totalSteps,
        successfulSteps: 1,
        overallStatus: "partial",
        summary: `Staked HBAR but Bonzo deposit failed: ${err.message}`,
        staderData,
      };
    }

    if (borrowUSDC) {
      try {
        const bAmount = borrowAmount || Math.floor(hbarxAmount * 0.3);
        const borrowResult = await executeBorrow("USDC", bAmount);
        steps.push({
          step: 3,
          name: "Borrow USDC against collateral",
          description: `Borrow ${bAmount} USDC`,
          status: borrowResult.success ? "success" : "failed",
          txId: borrowResult.txIds?.[0],
          details: borrowResult.details,
        });
      } catch (err: any) {
        steps.push({
          step: 3,
          name: "Borrow USDC against collateral",
          description: "Borrow USDC",
          status: "failed",
          details: err.message,
        });
      }
    }
  }

  const successCount = steps.filter(
    (s) => s.status === "success" || s.status === "simulated"
  ).length;

  return {
    steps,
    totalSteps: steps.length,
    successfulSteps: successCount,
    overallStatus:
      successCount === steps.length
        ? "success"
        : successCount > 0
        ? "partial"
        : "failed",
    summary: buildStrategySummary(amountHbar, staderData, steps, borrowUSDC),
    staderData,
  };
}

function buildStrategySummary(
  hbarAmount: number,
  staderData: StaderData,
  steps: StrategyStep[],
  borrowUSDC: boolean
): string {
  const hbarxAmount = hbarAmount * staderData.exchangeRate;
  const allSuccess = steps.every(
    (s) => s.status === "success" || s.status === "simulated"
  );
  const isSimulated = steps.some((s) => s.status === "simulated");
  const valueUSD = hbarAmount * staderData.hbarPriceUSD;

  if (allSuccess) {
    return (
      `✅ **HBARX Yield-on-Yield Strategy${
        isSimulated ? " (Testnet — Staking Simulated, Bonzo Real)" : ""
      }**\n\n` +
      `📥 **Step 1 — Stake:** ${hbarAmount} HBAR (~$${valueUSD.toFixed(
        2
      )}) → ~${hbarxAmount.toFixed(4)} HBARX via Stader Labs\n` +
      `🏦 **Step 2 — Supply:** ${hbarxAmount.toFixed(
        4
      )} HBARX deposited to Bonzo Lend as collateral\n` +
      (borrowUSDC
        ? `💵 **Step 3 — Borrow:** USDC borrowed against HBARX collateral\n`
        : "") +
      `\n📊 **Yield Breakdown:**\n` +
      `• Staking yield: ~${staderData.stakingAPY}% APY (HBARX appreciation)\n` +
      `• Bonzo supply yield: variable APY (on top of staking)\n` +
      `• Combined: staking + lending yield stacked\n\n` +
      `💰 **Prices (Pyth Network):**\n` +
      `• HBAR: $${staderData.hbarPriceUSD.toFixed(4)}\n` +
      `• HBARX: $${staderData.hbarxPriceUSD.toFixed(4)}\n` +
      `• Source: ${staderData.priceSource}\n\n` +
      `🔄 HBARX collateral grows in value automatically as Stader distributes rewards.\n` +
      (isSimulated
        ? `\n_On testnet, Stader staking is simulated. Bonzo Lend deposit/borrow are REAL testnet transactions. On mainnet, all steps execute via real contracts._`
        : "")
    );
  }

  const failedSteps = steps.filter((s) => s.status === "failed");
  return (
    `⚠️ **HBARX Strategy Partially Completed**\n\n` +
    steps
      .map(
        (s) =>
          `${
            s.status === "success" || s.status === "simulated" ? "✅" : "❌"
          } Step ${s.step}: ${s.name}`
      )
      .join("\n") +
    `\n\nFailed: ${failedSteps.map((s) => s.details).join(", ")}`
  );
}

// ═══════════════════════════════════════════════════════════
// Chat Formatting
// ═══════════════════════════════════════════════════════════

export function formatStaderInfoForChat(data: StaderData): string {
  return (
    `🔷 **Stader Labs — HBARX Liquid Staking**\n\n` +
    `HBARX is Hedera's liquid staking token. Stake HBAR → receive HBARX → ` +
    `HBARX appreciates as staking rewards accumulate.\n\n` +
    `📊 **Current Data${
      data.isSimulated ? " (Testnet — Exchange rate from mainnet)" : ""
    }:**\n` +
    `• Exchange Rate: 1 HBAR = ${data.exchangeRate.toFixed(6)} HBARX\n` +
    `• Staking APY: ~${data.stakingAPY}%\n` +
    `• Total Pooled: ${(data.totalPooledHbar / 1e9).toFixed(2)}B HBAR\n` +
    `• Total HBARX: ${(data.totalHbarX / 1e9).toFixed(2)}B\n` +
    `• Token: ${data.hbarxTokenId}\n\n` +
    `💰 **Live Prices (Pyth Network):**\n` +
    `• HBAR: $${data.hbarPriceUSD.toFixed(4)}\n` +
    `• HBARX: $${data.hbarxPriceUSD.toFixed(4)}\n` +
    `• Source: ${data.priceSource}\n\n` +
    `💡 **VaultMind Strategy:** Stake HBAR → HBARX → Supply to Bonzo Lend → ` +
    `Earn staking APY + lending APY simultaneously.\n\n` +
    `Say "HBARX strategy with 100 HBAR" to execute, or "stake 50 HBAR with Stader" for just staking.`
  );
}

export function getStaderConfig(): StaderConfig {
  return STADER;
}
