// ============================================
// VaultMind — Stader Labs HBARX Integration
// ============================================
// Enables the liquid staking strategy loop:
//   HBAR → Stader (stake) → HBARX → Bonzo (supply as collateral) → Borrow USDC
//
// TESTNET: Full simulation — Stader has no testnet contract.
//          The entire strategy is simulated with realistic numbers.
// MAINNET: Real Stader staking contract (0.0.800556) + real Bonzo deposits.
//
// CTO Workshop Category: "New Strategies" — Stader Labs integration
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
// Exchange Rate & Data
// ═══════════════════════════════════════════════════════════

export interface StaderData {
  exchangeRate: number;
  totalPooledHbar: number;
  totalHbarX: number;
  stakingAPY: number;
  isSimulated: boolean;
  network: string;
  hbarxTokenId: string;
}

export async function getStaderData(): Promise<StaderData> {
  if (STADER.isSimulated) {
    return {
      exchangeRate: 0.8247,
      totalPooledHbar: 1_420_000_000,
      totalHbarX: 1_171_170_000,
      stakingAPY: 2.5,
      isSimulated: true,
      network: "testnet",
      hbarxTokenId: STADER.hbarxTokenId,
    };
  }
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
    return {
      exchangeRate: 1 / exchangeRate,
      totalPooledHbar: Number(rawPool) / 1e8,
      totalHbarX: Number(rawHbarX) / 1e8,
      stakingAPY: 2.5,
      isSimulated: false,
      network: "mainnet",
      hbarxTokenId: STADER.hbarxTokenId,
    };
  } catch (err: any) {
    console.error("[Stader] Failed to query on-chain data:", err.message);
    return {
      exchangeRate: 0.8247,
      totalPooledHbar: 1_420_000_000,
      totalHbarX: 1_171_170_000,
      stakingAPY: 2.5,
      isSimulated: true,
      network: HEDERA_NETWORK,
      hbarxTokenId: STADER.hbarxTokenId,
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
    console.log(
      `[Stader] 🧪 SIMULATED: ${amountHbar} HBAR → ${hbarxReceived.toFixed(
        4
      )} HBARX`
    );
    return {
      success: true,
      action: "stader_stake",
      details: `[Simulated] Staked ${amountHbar} HBAR with Stader Labs.\nExchange rate: 1 HBAR = ${staderData.exchangeRate.toFixed(
        6
      )} HBARX\nReceived: ~${hbarxReceived.toFixed(4)} HBARX\nStaking APY: ~${
        staderData.stakingAPY
      }%\n\nNote: Stader staking is mainnet-only. On testnet this is simulated.`,
      txIds: ["simulated-stader-stake"],
      hashScanLinks: [],
      toolsUsed: ["stader_stake"],
    };
  }

  try {
    const client = getHederaClient();
    const contractId = ContractId.fromString(STADER.stakingContract);
    try {
      const assocTx = new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!))
        .setTokenIds([TokenId.fromString(STADER.hbarxTokenId)]);
      await assocTx.execute(client);
    } catch {
      /* Already associated */
    }
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
      details: `Staked ${amountHbar} HBAR → ~${hbarxReceived.toFixed(
        4
      )} HBARX\nAPY: ~${staderData.stakingAPY}%`,
      txIds,
      hashScanLinks,
      toolsUsed: ["stader_stake"],
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

/**
 * Execute the full HBAR → HBARX → Bonzo yield strategy.
 *
 * TESTNET: Entire flow simulated (no real HBARX minted, no real deposit).
 * MAINNET: Real staking + real Bonzo deposit + optional borrow.
 */
export async function executeHbarxStrategy(
  amountHbar: number,
  borrowUSDC: boolean = false,
  borrowAmount?: number
): Promise<StrategyResult> {
  const steps: StrategyStep[] = [];
  const staderData = await getStaderData();
  const hbarxAmount = amountHbar * staderData.exchangeRate;
  const totalSteps = borrowUSDC ? 3 : 2;

  console.log(
    `[Stader Strategy] ${amountHbar} HBAR → HBARX → Bonzo (${HEDERA_NETWORK})`
  );

  // ═══ TESTNET: Full end-to-end simulation ═══
  if (STADER.isSimulated) {
    console.log("[Stader Strategy] 🧪 Full testnet simulation");

    steps.push({
      step: 1,
      name: "Stake HBAR → HBARX",
      description: `Stake ${amountHbar} HBAR with Stader Labs`,
      status: "simulated",
      details: `${amountHbar} HBAR → ${hbarxAmount.toFixed(
        4
      )} HBARX at rate ${staderData.exchangeRate.toFixed(6)}\nStaking APY: ~${
        staderData.stakingAPY
      }%`,
    });

    steps.push({
      step: 2,
      name: "Supply HBARX to Bonzo Lend",
      description: `Deposit ~${hbarxAmount.toFixed(4)} HBARX as collateral`,
      status: "simulated",
      details: `${hbarxAmount.toFixed(
        4
      )} HBARX deposited into Bonzo Lend.\nEarns lending APY on top of staking APY.`,
    });

    if (borrowUSDC) {
      const bAmount = borrowAmount || Math.floor(hbarxAmount * 0.3);
      steps.push({
        step: 3,
        name: "Borrow USDC against collateral",
        description: `Borrow ${bAmount} USDC at conservative 30% LTV`,
        status: "simulated",
        details: `${bAmount} USDC borrowed against HBARX collateral.`,
      });
    }

    return {
      steps,
      totalSteps,
      successfulSteps: steps.length,
      overallStatus: "success",
      summary: buildStrategySummary(amountHbar, staderData, steps, borrowUSDC),
      staderData,
    };
  }

  // ═══ MAINNET: Real execution ═══
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
      description: `Deposit HBARX as collateral`,
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

  if (allSuccess) {
    return (
      `✅ **HBARX Yield-on-Yield Strategy${
        isSimulated ? " (Testnet Simulation)" : ""
      }**\n\n` +
      `📥 **Step 1 — Stake:** ${hbarAmount} HBAR → ~${hbarxAmount.toFixed(
        4
      )} HBARX via Stader Labs\n` +
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
      `🔄 HBARX collateral grows in value automatically as Stader distributes rewards.\n` +
      (isSimulated
        ? `\n_On testnet, Stader staking is simulated. On mainnet, this executes real atomic transactions via Stader contract 0.0.800556._`
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
    `📊 **Current Data${data.isSimulated ? " (Testnet Simulation)" : ""}:**\n` +
    `• Exchange Rate: 1 HBAR = ${data.exchangeRate.toFixed(6)} HBARX\n` +
    `• Staking APY: ~${data.stakingAPY}%\n` +
    `• Total Pooled: ${(data.totalPooledHbar / 1e9).toFixed(2)}B HBAR\n` +
    `• Total HBARX: ${(data.totalHbarX / 1e9).toFixed(2)}B\n` +
    `• Token: ${data.hbarxTokenId}\n\n` +
    `💡 **VaultMind Strategy:** Stake HBAR → HBARX → Supply to Bonzo Lend → ` +
    `Earn staking APY + lending APY simultaneously.\n\n` +
    `Say "HBARX strategy with 100 HBAR" to execute, or "stake 50 HBAR with Stader" for just staking.`
  );
}

export function getStaderConfig(): StaderConfig {
  return STADER;
}
