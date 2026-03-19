// ============================================
// VaultMind — Real Vault Execution Layer (Mainnet)
// ============================================
// Executes REAL on-chain transactions against Bonzo vault contracts:
//   - ICHI Vaults: Single-asset deposit via DepositGuard
//   - Beefy Vaults: deposit()/withdraw()/harvest() on vault + strategy
//   - Leveraged LST: HBARX recursive leverage vault
//
// All addresses from official Bonzo docs:
//   https://docs.bonzo.finance → Vaults Contracts
// ============================================

import {
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
  AccountId,
  TokenAssociateTransaction,
  TokenId,
  AccountUpdateTransaction,
} from "@hashgraph/sdk";
import { Interface, defaultAbiCoder } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";
import { BONZO_VAULTS, VAULT_CORE, type BonzoVault } from "./bonzo-vaults";

// ═══════════════════════════════════════════════════════════
// NETWORK
// ═══════════════════════════════════════════════════════════

const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

const HASHSCAN_BASE =
  HEDERA_NETWORK === "mainnet"
    ? "https://hashscan.io/mainnet"
    : "https://hashscan.io/testnet";

// ═══════════════════════════════════════════════════════════
// ABIs
// ═══════════════════════════════════════════════════════════

const ERC20_ABI = new Interface([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
]);

// Beefy-style vault (used by Dual Asset + Leveraged LST)
const BEEFY_VAULT_IFACE = new Interface([
  "function deposit(uint256 _amount)",
  "function depositAll()",
  "function withdraw(uint256 _shares)",
  "function withdrawAll()",
  "function earn()",
  "function getPricePerFullShare() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function balance() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function want() view returns (address)",
  "function strategy() view returns (address)",
]);

const BEEFY_STRATEGY_IFACE = new Interface([
  "function harvest()",
  "function harvest(address callFeeRecipient)",
  "function lastHarvest() view returns (uint256)",
  "function paused() view returns (bool)",
  "function callReward() view returns (uint256)",
  "function balanceOf() view returns (uint256)",
  "function balanceOfPool() view returns (uint256)",
  "function balanceOfWant() view returns (uint256)",
]);

// ICHI vault (Single Asset DEX)
const ICHI_VAULT_IFACE = new Interface([
  "function deposit(uint256 deposit0, uint256 deposit1, address to) returns (uint256 shares)",
  "function withdraw(uint256 shares, address to) returns (uint256 amount0, uint256 amount1)",
  "function getTotalAmounts() view returns (uint256 total0, uint256 total1)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function allowToken0() view returns (bool)",
  "function allowToken1() view returns (bool)",
]);

// DepositGuard — recommended entry point for ICHI vaults
const DEPOSIT_GUARD_IFACE = new Interface([
  "function forwardDepositToICHIVault(address vault, address vaultDeployer, uint256 deposit0, uint256 deposit1, address to, uint256 minShares)",
]);

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface VaultExecutionResult {
  success: boolean;
  action: "vault_deposit" | "vault_withdraw" | "vault_harvest" | "vault_query";
  vaultId: string;
  vaultName: string;
  txIds: string[];
  hashScanLinks: string[];
  details: string;
  error?: string;
  toolsUsed: string[];
  data?: Record<string, any>;
}

export interface VaultLiveData {
  vaultId: string;
  pricePerShare: number;
  totalBalance: number;
  totalSupply: number;
  userBalance: number;
  userDepositedValue: number;
  lastHarvest: number;
  isPaused: boolean;
  wantTokenAddress: string;
}

// ═══════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════

function txLink(txId: string): string {
  const parts = txId.split("@");
  if (parts.length === 2) {
    return `${HASHSCAN_BASE}/transaction/${parts[0]}-${parts[1].replace(
      ".",
      "-"
    )}`;
  }
  return `${HASHSCAN_BASE}/transaction/${txId}`;
}

function toSmallestUnit(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * Math.pow(10, decimals)));
}

async function getEvmAddress(client: any, accountId: string): Promise<string> {
  try {
    const { AccountInfoQuery } = await import("@hashgraph/sdk");
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);
    const evm = (info as any).evmAddress;
    if (typeof evm === "string" && evm.startsWith("0x") && evm.length === 42) {
      return evm;
    }
    const caid = info.contractAccountId;
    if (typeof caid === "string" && caid.length > 0) {
      return caid.startsWith("0x") ? caid : `0x${caid}`;
    }
  } catch {}
  return "0x" + AccountId.fromString(accountId).toSolidityAddress();
}

async function ensureAutoAssociation(client: any): Promise<void> {
  const operatorId = client.operatorAccountId!.toString();
  try {
    const tx = new AccountUpdateTransaction()
      .setAccountId(AccountId.fromString(operatorId))
      .setMaxAutomaticTokenAssociations(-1);
    const resp = await tx.execute(client);
    await resp.getReceipt(client);
  } catch {
    // Already set or fallback
    try {
      const tx = new AccountUpdateTransaction()
        .setAccountId(AccountId.fromString(operatorId))
        .setMaxAutomaticTokenAssociations(100);
      const resp = await tx.execute(client);
      await resp.getReceipt(client);
    } catch {}
  }
}

function getVault(vaultId: string): BonzoVault | undefined {
  return BONZO_VAULTS.find((v) => v.id === vaultId);
}

// ═══════════════════════════════════════════════════════════
// QUERY: Get vault live data from on-chain
// ═══════════════════════════════════════════════════════════

export async function queryVaultData(
  vaultId: string
): Promise<VaultLiveData | null> {
  const vault = getVault(vaultId);
  if (!vault) return null;

  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);

  try {
    if (
      vault.strategy === "dual-asset-dex" ||
      vault.strategy === "leveraged-lst"
    ) {
      return await queryBeefyVaultData(client, vault, userEvm);
    } else {
      return await queryIchiVaultData(client, vault, userEvm);
    }
  } catch (err: any) {
    console.warn(
      `[VaultExec] Query failed for ${vaultId}: ${err.message?.substring(
        0,
        80
      )}`
    );
    return null;
  }
}

async function queryBeefyVaultData(
  client: any,
  vault: BonzoVault,
  userEvm: string
): Promise<VaultLiveData> {
  const vaultAddr = vault.vaultAddress;
  const stratAddr = vault.strategyAddress;

  // getPricePerFullShare()
  let pricePerShare = 1.0;
  try {
    const data = BEEFY_VAULT_IFACE.encodeFunctionData(
      "getPricePerFullShare",
      []
    );
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      pricePerShare = Number(BigInt(decoded[0].toString())) / 1e18;
    }
  } catch {}

  // balance() — total assets under management
  let totalBalance = 0;
  try {
    const data = BEEFY_VAULT_IFACE.encodeFunctionData("balance", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      totalBalance = Number(BigInt(decoded[0].toString())) / 1e8;
    }
  } catch {}

  // totalSupply()
  let totalSupply = 0;
  try {
    const data = BEEFY_VAULT_IFACE.encodeFunctionData("totalSupply", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      totalSupply = Number(BigInt(decoded[0].toString())) / 1e18;
    }
  } catch {}

  // balanceOf(user) — user's vault shares
  let userBalance = 0;
  try {
    const data = BEEFY_VAULT_IFACE.encodeFunctionData("balanceOf", [userEvm]);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      userBalance = Number(BigInt(decoded[0].toString())) / 1e18;
    }
  } catch {}

  // Strategy: lastHarvest()
  let lastHarvest = 0;
  try {
    const data = BEEFY_STRATEGY_IFACE.encodeFunctionData("lastHarvest", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(stratAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      lastHarvest = Number(BigInt(decoded[0].toString())) * 1000;
    }
  } catch {}

  // Strategy: paused()
  let isPaused = false;
  try {
    const data = BEEFY_STRATEGY_IFACE.encodeFunctionData("paused", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(stratAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["bool"], result.bytes);
      isPaused = decoded[0];
    }
  } catch {}

  // want() — underlying token
  let wantTokenAddress = "";
  try {
    const data = BEEFY_VAULT_IFACE.encodeFunctionData("want", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["address"], result.bytes);
      wantTokenAddress = decoded[0];
    }
  } catch {}

  return {
    vaultId: vault.id,
    pricePerShare,
    totalBalance,
    totalSupply,
    userBalance,
    userDepositedValue: userBalance * pricePerShare,
    lastHarvest,
    isPaused,
    wantTokenAddress,
  };
}

async function queryIchiVaultData(
  client: any,
  vault: BonzoVault,
  userEvm: string
): Promise<VaultLiveData> {
  const vaultAddr = vault.strategyAddress; // For ICHI, strategyAddress IS the vault

  // getTotalAmounts()
  let totalBalance = 0;
  try {
    const data = ICHI_VAULT_IFACE.encodeFunctionData("getTotalAmounts", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(200_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 64) {
      const decoded = defaultAbiCoder.decode(
        ["uint256", "uint256"],
        result.bytes
      );
      const total0 = Number(BigInt(decoded[0].toString())) / 1e8;
      const total1 = Number(BigInt(decoded[1].toString())) / 1e8;
      totalBalance = total0 + total1;
    }
  } catch {}

  // totalSupply()
  let totalSupply = 0;
  try {
    const data = ICHI_VAULT_IFACE.encodeFunctionData("totalSupply", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      totalSupply = Number(BigInt(decoded[0].toString())) / 1e18;
    }
  } catch {}

  // balanceOf(user)
  let userBalance = 0;
  try {
    const data = ICHI_VAULT_IFACE.encodeFunctionData("balanceOf", [userEvm]);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(vaultAddr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      userBalance = Number(BigInt(decoded[0].toString())) / 1e18;
    }
  } catch {}

  const pricePerShare = totalSupply > 0 ? totalBalance / totalSupply : 1.0;

  return {
    vaultId: vault.id,
    pricePerShare,
    totalBalance,
    totalSupply,
    userBalance,
    userDepositedValue: userBalance * pricePerShare,
    lastHarvest: 0, // ICHI vaults don't have harvest timestamps
    isPaused: false,
    wantTokenAddress: "",
  };
}

// ═══════════════════════════════════════════════════════════
// EXECUTE: Vault Deposit
// ═══════════════════════════════════════════════════════════

/**
 * Deposit into a Bonzo vault. Routes to the correct contract call
 * based on vault type (ICHI single-asset or Beefy dual-asset/LST).
 */
export async function executeVaultDeposit(
  vaultId: string,
  amount: number,
  tokenDecimals: number = 8
): Promise<VaultExecutionResult> {
  const vault = getVault(vaultId);
  if (!vault) {
    return {
      success: false,
      action: "vault_deposit",
      vaultId,
      vaultName: "unknown",
      txIds: [],
      hashScanLinks: [],
      details: `Vault not found: ${vaultId}`,
      error: "VAULT_NOT_FOUND",
      toolsUsed: [],
    };
  }

  if (HEDERA_NETWORK !== "mainnet") {
    return {
      success: false,
      action: "vault_deposit",
      vaultId,
      vaultName: vault.name,
      txIds: [],
      hashScanLinks: [],
      details: `Bonzo vaults are mainnet-only. Current network: ${HEDERA_NETWORK}. Switch to mainnet to execute real vault deposits.`,
      error: "WRONG_NETWORK",
      toolsUsed: [],
    };
  }

  if (
    vault.strategy === "dual-asset-dex" ||
    vault.strategy === "leveraged-lst"
  ) {
    return executeBeefyDeposit(vault, amount, tokenDecimals);
  } else {
    return executeIchiDeposit(vault, amount, tokenDecimals);
  }
}

async function executeBeefyDeposit(
  vault: BonzoVault,
  amount: number,
  decimals: number
): Promise<VaultExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];
  const amountWei = toSmallestUnit(amount, decimals);

  console.log(`[VaultExec] Beefy deposit: ${amount} into ${vault.name}`);

  await ensureAutoAssociation(client);

  try {
    // Step 1: Get want token address
    tools.push("BeefyVault.want()");
    let wantToken = vault.wantTokenId;
    try {
      const data = BEEFY_VAULT_IFACE.encodeFunctionData("want", []);
      const query = new ContractCallQuery()
        .setContractId(ContractId.fromSolidityAddress(vault.vaultAddress))
        .setGas(100_000)
        .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
        .setMaxQueryPayment(new Hbar(1));
      const result = await query.execute(client);
      if (result.bytes && result.bytes.length >= 32) {
        const decoded = defaultAbiCoder.decode(["address"], result.bytes);
        wantToken = decoded[0];
      }
    } catch {}

    // Step 2: Approve vault to spend want token
    tools.push("ERC20.approve()");
    const approveData = ERC20_ABI.encodeFunctionData("approve", [
      vault.vaultAddress,
      amountWei,
    ]);
    const approveTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(wantToken))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(approveData.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const approveResp = await approveTx.execute(client);
    const approveReceipt = await approveResp.getReceipt(client);
    const approveTxId = approveResp.transactionId.toString();
    txIds.push(approveTxId);
    links.push(txLink(approveTxId));

    if (approveReceipt.status.toString() !== "SUCCESS") {
      return {
        success: false,
        action: "vault_deposit",
        vaultId: vault.id,
        vaultName: vault.name,
        txIds,
        hashScanLinks: links,
        details: `Approve failed: ${approveReceipt.status}`,
        error: approveReceipt.status.toString(),
        toolsUsed: tools,
      };
    }

    // Step 3: deposit(amount)
    tools.push("BeefyVault.deposit()");
    const depositData = BEEFY_VAULT_IFACE.encodeFunctionData("deposit", [
      amountWei,
    ]);
    const depositTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(vault.vaultAddress))
      .setGas(2_000_000)
      .setFunctionParameters(Buffer.from(depositData.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const depositResp = await depositTx.execute(client);
    const depositReceipt = await depositResp.getReceipt(client);
    const depositTxId = depositResp.transactionId.toString();
    txIds.push(depositTxId);
    links.push(txLink(depositTxId));
    const status = depositReceipt.status.toString();

    return {
      success: status === "SUCCESS",
      action: "vault_deposit",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details:
        status === "SUCCESS"
          ? `Deposited ${amount} into ${vault.name} vault. You received moo${vault.symbol} vault tokens representing your share.`
          : `Deposit failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: tools,
    };
  } catch (err: any) {
    return {
      success: false,
      action: "vault_deposit",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details: `Error: ${err.message}`,
      error: err.message,
      toolsUsed: tools,
    };
  }
}

async function executeIchiDeposit(
  vault: BonzoVault,
  amount: number,
  decimals: number
): Promise<VaultExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];
  const amountWei = toSmallestUnit(amount, decimals);

  console.log(
    `[VaultExec] ICHI deposit: ${amount} ${vault.wantToken} into ${vault.name}`
  );

  await ensureAutoAssociation(client);

  try {
    const ichiVaultAddr = vault.strategyAddress; // ICHI vault is the strategy address

    // Determine which side to deposit on (token0 or token1)
    tools.push("ICHIVault.allowToken0/1()");
    let isToken0 = true;
    try {
      const data0 = ICHI_VAULT_IFACE.encodeFunctionData("allowToken0", []);
      const query0 = new ContractCallQuery()
        .setContractId(ContractId.fromSolidityAddress(ichiVaultAddr))
        .setGas(100_000)
        .setFunctionParameters(Buffer.from(data0.slice(2), "hex"))
        .setMaxQueryPayment(new Hbar(1));
      const result0 = await query0.execute(client);
      if (result0.bytes && result0.bytes.length >= 32) {
        const decoded = defaultAbiCoder.decode(["bool"], result0.bytes);
        isToken0 = decoded[0];
      }
    } catch {}

    // Get the want token EVM address
    const tokenFunc = isToken0 ? "token0" : "token1";
    let wantTokenEvm = "";
    try {
      const data = ICHI_VAULT_IFACE.encodeFunctionData(tokenFunc, []);
      const query = new ContractCallQuery()
        .setContractId(ContractId.fromSolidityAddress(ichiVaultAddr))
        .setGas(100_000)
        .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
        .setMaxQueryPayment(new Hbar(1));
      const result = await query.execute(client);
      if (result.bytes && result.bytes.length >= 32) {
        const decoded = defaultAbiCoder.decode(["address"], result.bytes);
        wantTokenEvm = decoded[0];
      }
    } catch {}

    if (!wantTokenEvm) {
      // Fallback: use wantTokenId from vault config
      wantTokenEvm = vault.wantTokenId.startsWith("0x")
        ? vault.wantTokenId
        : "0x" + AccountId.fromString(vault.wantTokenId).toSolidityAddress();
    }

    // Approve DepositGuard to spend token
    tools.push("ERC20.approve(DepositGuard)");
    const approveData = ERC20_ABI.encodeFunctionData("approve", [
      VAULT_CORE.DepositGuard,
      amountWei,
    ]);
    const approveTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(wantTokenEvm))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(approveData.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const approveResp = await approveTx.execute(client);
    const approveReceipt = await approveResp.getReceipt(client);
    txIds.push(approveResp.transactionId.toString());
    links.push(txLink(approveResp.transactionId.toString()));

    if (approveReceipt.status.toString() !== "SUCCESS") {
      return {
        success: false,
        action: "vault_deposit",
        vaultId: vault.id,
        vaultName: vault.name,
        txIds,
        hashScanLinks: links,
        details: `Approve failed: ${approveReceipt.status}`,
        error: approveReceipt.status.toString(),
        toolsUsed: tools,
      };
    }

    // Deposit via DepositGuard
    tools.push("DepositGuard.forwardDepositToICHIVault()");
    const deposit0 = isToken0 ? amountWei : BigInt(0);
    const deposit1 = isToken0 ? BigInt(0) : amountWei;

    const depositData = DEPOSIT_GUARD_IFACE.encodeFunctionData(
      "forwardDepositToICHIVault",
      [
        ichiVaultAddr,
        VAULT_CORE.ICHIVaultFactory,
        deposit0,
        deposit1,
        userEvm,
        BigInt(0), // minShares — set to 0 for now, could add slippage protection
      ]
    );

    const depositTx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(VAULT_CORE.DepositGuard))
      .setGas(3_000_000)
      .setFunctionParameters(Buffer.from(depositData.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const depositResp = await depositTx.execute(client);
    const depositReceipt = await depositResp.getReceipt(client);
    const depositTxId = depositResp.transactionId.toString();
    txIds.push(depositTxId);
    links.push(txLink(depositTxId));
    const status = depositReceipt.status.toString();

    return {
      success: status === "SUCCESS",
      action: "vault_deposit",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details:
        status === "SUCCESS"
          ? `Deposited ${amount} ${vault.wantToken} into ${vault.name} ICHI vault via DepositGuard. Shares minted to your account.`
          : `ICHI deposit failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: tools,
    };
  } catch (err: any) {
    return {
      success: false,
      action: "vault_deposit",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details: `Error: ${err.message}`,
      error: err.message,
      toolsUsed: tools,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// EXECUTE: Vault Withdraw
// ═══════════════════════════════════════════════════════════

export async function executeVaultWithdraw(
  vaultId: string,
  shares?: number // If undefined, withdraw all
): Promise<VaultExecutionResult> {
  const vault = getVault(vaultId);
  if (!vault) {
    return {
      success: false,
      action: "vault_withdraw",
      vaultId,
      vaultName: "unknown",
      txIds: [],
      hashScanLinks: [],
      details: `Vault not found: ${vaultId}`,
      error: "VAULT_NOT_FOUND",
      toolsUsed: [],
    };
  }

  if (HEDERA_NETWORK !== "mainnet") {
    return {
      success: false,
      action: "vault_withdraw",
      vaultId,
      vaultName: vault.name,
      txIds: [],
      hashScanLinks: [],
      details: `Bonzo vaults are mainnet-only. Switch to mainnet.`,
      error: "WRONG_NETWORK",
      toolsUsed: [],
    };
  }

  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  try {
    await ensureAutoAssociation(client);

    const isIchi = vault.strategy === "single-asset-dex";
    const contractAddr = isIchi ? vault.strategyAddress : vault.vaultAddress;
    const iface = isIchi ? ICHI_VAULT_IFACE : BEEFY_VAULT_IFACE;

    let withdrawData: string;
    if (shares !== undefined) {
      const sharesWei = toSmallestUnit(shares, 18);
      if (isIchi) {
        tools.push("ICHIVault.withdraw()");
        withdrawData = ICHI_VAULT_IFACE.encodeFunctionData("withdraw", [
          sharesWei,
          userEvm,
        ]);
      } else {
        tools.push("BeefyVault.withdraw()");
        withdrawData = BEEFY_VAULT_IFACE.encodeFunctionData("withdraw", [
          sharesWei,
        ]);
      }
    } else {
      if (isIchi) {
        // Get user balance first, then withdraw all
        tools.push("ICHIVault.balanceOf() + withdraw()");
        const balData = ICHI_VAULT_IFACE.encodeFunctionData("balanceOf", [
          userEvm,
        ]);
        const balQuery = new ContractCallQuery()
          .setContractId(ContractId.fromSolidityAddress(contractAddr))
          .setGas(100_000)
          .setFunctionParameters(Buffer.from(balData.slice(2), "hex"))
          .setMaxQueryPayment(new Hbar(1));
        const balResult = await balQuery.execute(client);
        let userShares = BigInt(0);
        if (balResult.bytes && balResult.bytes.length >= 32) {
          const decoded = defaultAbiCoder.decode(["uint256"], balResult.bytes);
          userShares = BigInt(decoded[0].toString());
        }
        if (userShares === BigInt(0)) {
          return {
            success: false,
            action: "vault_withdraw",
            vaultId: vault.id,
            vaultName: vault.name,
            txIds: [],
            hashScanLinks: [],
            details: `No shares in ${vault.name} vault.`,
            error: "NO_POSITION",
            toolsUsed: tools,
          };
        }
        withdrawData = ICHI_VAULT_IFACE.encodeFunctionData("withdraw", [
          userShares,
          userEvm,
        ]);
      } else {
        tools.push("BeefyVault.withdrawAll()");
        withdrawData = BEEFY_VAULT_IFACE.encodeFunctionData("withdrawAll", []);
      }
    }

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(contractAddr))
      .setGas(2_000_000)
      .setFunctionParameters(Buffer.from(withdrawData.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const txId = resp.transactionId.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    const status = receipt.status.toString();

    return {
      success: status === "SUCCESS",
      action: "vault_withdraw",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details:
        status === "SUCCESS"
          ? `Withdrew from ${vault.name} vault. Underlying tokens returned to your wallet.`
          : `Withdraw failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: tools,
    };
  } catch (err: any) {
    return {
      success: false,
      action: "vault_withdraw",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details: `Error: ${err.message}`,
      error: err.message,
      toolsUsed: tools,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// EXECUTE: Vault Harvest (Beefy strategy only)
// ═══════════════════════════════════════════════════════════

/**
 * Harvest rewards from a Beefy-based vault strategy.
 * The caller receives 0.05-0.5% of harvested rewards as incentive.
 */
export async function executeVaultHarvest(
  vaultId: string
): Promise<VaultExecutionResult> {
  const vault = getVault(vaultId);
  if (!vault) {
    return {
      success: false,
      action: "vault_harvest",
      vaultId,
      vaultName: "unknown",
      txIds: [],
      hashScanLinks: [],
      details: `Vault not found: ${vaultId}`,
      error: "VAULT_NOT_FOUND",
      toolsUsed: [],
    };
  }

  if (vault.strategy === "single-asset-dex") {
    return {
      success: false,
      action: "vault_harvest",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds: [],
      hashScanLinks: [],
      details: `ICHI vaults auto-compound. No manual harvest needed.`,
      error: "NOT_APPLICABLE",
      toolsUsed: [],
    };
  }

  if (HEDERA_NETWORK !== "mainnet") {
    return {
      success: false,
      action: "vault_harvest",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds: [],
      hashScanLinks: [],
      details: `Bonzo vaults are mainnet-only.`,
      error: "WRONG_NETWORK",
      toolsUsed: [],
    };
  }

  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = ["BeefyStrategy.harvest()"];

  try {
    // harvest(callFeeRecipient) — the caller gets a small fee incentive
    const harvestData = BEEFY_STRATEGY_IFACE.encodeFunctionData(
      "harvest(address)",
      [userEvm]
    );

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(vault.strategyAddress))
      .setGas(3_000_000) // Harvest can be gas-intensive
      .setFunctionParameters(Buffer.from(harvestData.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));

    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const txId = resp.transactionId.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    const status = receipt.status.toString();

    return {
      success: status === "SUCCESS",
      action: "vault_harvest",
      vaultId: vault.id,
      vaultName: vault.name,
      txIds,
      hashScanLinks: links,
      details:
        status === "SUCCESS"
          ? `Harvested rewards from ${vault.name} strategy. Rewards auto-compounded back into the vault. You received a small caller incentive fee.`
          : `Harvest failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: tools,
    };
  } catch (err: any) {
    // Try the no-arg harvest() as fallback
    try {
      const harvestData = BEEFY_STRATEGY_IFACE.encodeFunctionData(
        "harvest()",
        []
      );
      const tx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromSolidityAddress(vault.strategyAddress))
        .setGas(3_000_000)
        .setFunctionParameters(Buffer.from(harvestData.slice(2), "hex"))
        .setMaxTransactionFee(new Hbar(5));
      const resp = await tx.execute(client);
      const receipt = await resp.getReceipt(client);
      const txId = resp.transactionId.toString();
      txIds.push(txId);
      links.push(txLink(txId));
      const status = receipt.status.toString();

      return {
        success: status === "SUCCESS",
        action: "vault_harvest",
        vaultId: vault.id,
        vaultName: vault.name,
        txIds,
        hashScanLinks: links,
        details:
          status === "SUCCESS"
            ? `Harvested rewards from ${vault.name} strategy (no-arg fallback).`
            : `Harvest failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: [...tools, "BeefyStrategy.harvest() (no-arg)"],
      };
    } catch (err2: any) {
      return {
        success: false,
        action: "vault_harvest",
        vaultId: vault.id,
        vaultName: vault.name,
        txIds,
        hashScanLinks: links,
        details: `Harvest error: ${err2.message}`,
        error: err2.message,
        toolsUsed: tools,
      };
    }
  }
}
