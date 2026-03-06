// ============================================
// VaultMind — Bonzo Finance Execution Layer
// ============================================
// Bonzo uses SaucerSwap's WHBAR contract for wrapping:
//   - WHBAR Contract: 0.0.15057 (call deposit() here)
//   - WHBAR Token:    0.0.15058 (the ERC20 token)
//   - EVM address:    0x0000000000000000000000000000000000003ad2
//
// Flow for HBAR deposit:
//   1. Associate account with WHBAR token 0.0.15058
//   2. Call WHBAR contract 0.0.15057 deposit() with payable HBAR
//   3. Approve WHBAR token for LendingPool
//   4. Call LendingPool.deposit(WHBAR_addr, amount, onBehalfOf, 0)
// ============================================

import {
  ContractExecuteTransaction,
  ContractId,
  Hbar,
  AccountId,
  AccountInfoQuery,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { Interface } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";

// SaucerSwap WHBAR - used by Bonzo Finance
const WHBAR_CONTRACT_ID = "0.0.15057";
const WHBAR_TOKEN_HTS = "0.0.15058";
const WHBAR_TOKEN_EVM = "0x0000000000000000000000000000000000003ad2";

// Bonzo LendingPool from bonzo-contracts.json
const LENDING_POOL_EVM = "0x7710a96b01e02eD00768C3b39BfA7B4f1c128c62";

const TOKEN_MAP: Record<
  string,
  { evmAddr: string; htsId: string; decimals: number }
> = {
  WHBAR: { evmAddr: WHBAR_TOKEN_EVM, htsId: WHBAR_TOKEN_HTS, decimals: 8 },
  HBAR: { evmAddr: WHBAR_TOKEN_EVM, htsId: WHBAR_TOKEN_HTS, decimals: 8 },
  USDC: {
    evmAddr: "0x0000000000000000000000000000000000001549",
    htsId: "0.0.5449",
    decimals: 6,
  },
  HBARX: {
    evmAddr: "0x0000000000000000000000000000000000220ced",
    htsId: "0.0.2233069",
    decimals: 8,
  },
  SAUCE: {
    evmAddr: "0x0000000000000000000000000000000000120f46",
    htsId: "0.0.1183558",
    decimals: 6,
  },
  KARATE: {
    evmAddr: "0x00000000000000000000000000000000003991ed",
    htsId: "0.0.3772909",
    decimals: 8,
  },
};

const WHBAR_ABI = new Interface([
  "function deposit() payable",
  "function withdraw(uint256 amount)",
]);

const ERC20_ABI = new Interface([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

const LENDING_POOL_ABI = new Interface([
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)",
]);

export interface ExecutionResult {
  success: boolean;
  action: string;
  txIds: string[];
  hashScanLinks: string[];
  details: string;
  error?: string;
  toolsUsed: string[];
}

function txLink(txId: string): string {
  const parts = txId.split("@");
  if (parts.length === 2) {
    return `https://hashscan.io/testnet/transaction/${
      parts[0]
    }-${parts[1].replace(".", "-")}`;
  }
  return `https://hashscan.io/testnet/transaction/${txId}`;
}

function toSmallestUnit(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * Math.pow(10, decimals)));
}

function getToken(symbol: string) {
  return TOKEN_MAP[symbol.toUpperCase().trim()] || TOKEN_MAP.WHBAR;
}

async function getEvmAddress(client: any, accountId: string): Promise<string> {
  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);
    const evm = (info as any).evmAddress;
    if (
      typeof evm === "string" &&
      evm.startsWith("0x") &&
      evm.length === 42 &&
      evm !== "0x0000000000000000000000000000000000000000"
    ) {
      return evm;
    }
    const caid = info.contractAccountId;
    if (typeof caid === "string" && caid.length > 0) {
      return caid.startsWith("0x") ? caid : `0x${caid}`;
    }
  } catch {}
  return "0x" + AccountId.fromString(accountId).toSolidityAddress();
}

const assocCache = new Set<string>();

async function ensureAssociated(
  client: any,
  accountId: string,
  htsId: string
): Promise<void> {
  const key = `${accountId}:${htsId}`;
  if (assocCache.has(key)) return;
  try {
    console.log(`[BonzoExec] Associating ${htsId}...`);
    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(htsId)]);
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(`[BonzoExec] Association ${htsId}: ${receipt.status}`);
    assocCache.add(key);
  } catch (e: any) {
    const msg = e.message || "";
    if (
      msg.includes("TOKEN_ALREADY_ASSOCIATED") ||
      msg.includes("ALREADY_ASSOCIATED")
    ) {
      console.log(`[BonzoExec] ${htsId} already associated`);
      assocCache.add(key);
    } else {
      console.warn(`[BonzoExec] Association warning: ${msg.substring(0, 100)}`);
    }
  }
}

async function wrapHBAR(
  client: any,
  amountHbar: number
): Promise<{ success: boolean; txId: string; error?: string }> {
  console.log(
    `[BonzoExec] Wrapping ${amountHbar} HBAR via SaucerSwap WHBAR contract ${WHBAR_CONTRACT_ID}`
  );
  const data = WHBAR_ABI.encodeFunctionData("deposit", []);
  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromString(WHBAR_CONTRACT_ID))
    .setGas(300_000)
    .setPayableAmount(new Hbar(amountHbar))
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .setMaxTransactionFee(new Hbar(5));
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  const txId = resp.transactionId.toString();
  const status = receipt.status.toString();
  console.log(`[BonzoExec] WHBAR.deposit() -> ${status} (tx: ${txId})`);
  return {
    success: status === "SUCCESS",
    txId,
    error: status !== "SUCCESS" ? status : undefined,
  };
}

async function approveToken(
  client: any,
  tokenEvm: string,
  spender: string,
  amount: bigint
): Promise<{ success: boolean; txId: string; error?: string }> {
  console.log(`[BonzoExec] Approving ${tokenEvm} for ${spender}`);
  const data = ERC20_ABI.encodeFunctionData("approve", [spender, amount]);
  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromSolidityAddress(tokenEvm))
    .setGas(1_000_000)
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .setMaxTransactionFee(new Hbar(5));
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  const txId = resp.transactionId.toString();
  const status = receipt.status.toString();
  console.log(`[BonzoExec] approve() -> ${status}`);
  return {
    success: status === "SUCCESS",
    txId,
    error: status !== "SUCCESS" ? status : undefined,
  };
}

// ═══ DEPOSIT ═══
export async function executeDeposit(
  tokenSymbol: string,
  amount: number
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const isHbar = ["HBAR", "WHBAR"].includes(tokenSymbol.toUpperCase());
  const token = getToken(tokenSymbol);
  const amountWei = toSmallestUnit(amount, token.decimals);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  console.log(`[BonzoExec] === DEPOSIT ${amount} ${tokenSymbol} ===`);
  console.log(`[BonzoExec] Operator: ${operatorId}, onBehalfOf: ${onBehalfOf}`);

  try {
    await ensureAssociated(client, operatorId, token.htsId);

    if (isHbar) {
      const wrap = await wrapHBAR(client, amount);
      txIds.push(wrap.txId);
      links.push(txLink(wrap.txId));
      tools.push("SaucerSwap_WHBAR.deposit");
      if (!wrap.success)
        return {
          success: false,
          action: "deposit",
          txIds,
          hashScanLinks: links,
          details: `WHBAR wrapping failed: ${wrap.error}`,
          error: wrap.error,
          toolsUsed: tools,
        };
    }

    const approve = await approveToken(
      client,
      token.evmAddr,
      LENDING_POOL_EVM,
      amountWei
    );
    txIds.push(approve.txId);
    links.push(txLink(approve.txId));
    tools.push(`ERC20.approve`);
    if (!approve.success)
      return {
        success: false,
        action: "deposit",
        txIds,
        hashScanLinks: links,
        details: `Approve failed: ${approve.error}`,
        error: approve.error,
        toolsUsed: tools,
      };

    const data = LENDING_POOL_ABI.encodeFunctionData("deposit", [
      token.evmAddr,
      amountWei,
      onBehalfOf,
      0,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const txId = resp.transactionId.toString();
    const status = receipt.status.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    tools.push("LendingPool.deposit");

    return {
      success: status === "SUCCESS",
      action: "deposit",
      txIds,
      hashScanLinks: links,
      details:
        status === "SUCCESS"
          ? `Deposited ${amount} ${tokenSymbol} to Bonzo Finance.${
              isHbar ? " HBAR wrapped to WHBAR via SaucerSwap." : ""
            }`
          : `Deposit failed at LendingPool.deposit: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: tools,
    };
  } catch (e: any) {
    return {
      success: false,
      action: "deposit",
      txIds,
      hashScanLinks: links,
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
    };
  }
}

// ═══ WITHDRAW ═══
export async function executeWithdraw(
  tokenSymbol: string,
  amount?: number
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const toAddr = await getEvmAddress(client, operatorId);
  const token = getToken(tokenSymbol);
  const maxUint = BigInt(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  );
  const amountWei = amount ? toSmallestUnit(amount, token.decimals) : maxUint;
  try {
    const data = LENDING_POOL_ABI.encodeFunctionData("withdraw", [
      token.evmAddr,
      amountWei,
      toAddr,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const txId = resp.transactionId.toString();
    const status = receipt.status.toString();
    return {
      success: status === "SUCCESS",
      action: "withdraw",
      txIds: [txId],
      hashScanLinks: [txLink(txId)],
      details:
        status === "SUCCESS"
          ? `Withdrew ${amount || "all"} ${tokenSymbol} from Bonzo Finance.`
          : `Withdraw failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: ["LendingPool.withdraw"],
    };
  } catch (e: any) {
    return {
      success: false,
      action: "withdraw",
      txIds: [],
      hashScanLinks: [],
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: [],
    };
  }
}

// ═══ BORROW ═══
export async function executeBorrow(
  tokenSymbol: string,
  amount: number,
  rateMode = "variable"
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const token = getToken(tokenSymbol);
  const amountWei = toSmallestUnit(amount, token.decimals);
  const rate = rateMode === "stable" ? 1 : 2;
  try {
    await ensureAssociated(client, operatorId, token.htsId);
    const data = LENDING_POOL_ABI.encodeFunctionData("borrow", [
      token.evmAddr,
      amountWei,
      rate,
      0,
      onBehalfOf,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const txId = resp.transactionId.toString();
    const status = receipt.status.toString();
    return {
      success: status === "SUCCESS",
      action: "borrow",
      txIds: [txId],
      hashScanLinks: [txLink(txId)],
      details:
        status === "SUCCESS"
          ? `Borrowed ${amount} ${tokenSymbol} (${rateMode}) from Bonzo Finance.`
          : `Borrow failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: ["LendingPool.borrow"],
    };
  } catch (e: any) {
    return {
      success: false,
      action: "borrow",
      txIds: [],
      hashScanLinks: [],
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: [],
    };
  }
}

// ═══ REPAY ═══
export async function executeRepay(
  tokenSymbol: string,
  amount?: number,
  rateMode = "variable"
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const token = getToken(tokenSymbol);
  const rate = rateMode === "stable" ? 1 : 2;
  const maxUint = BigInt(
    "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"
  );
  const amountWei = amount ? toSmallestUnit(amount, token.decimals) : maxUint;
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];
  try {
    const approve = await approveToken(
      client,
      token.evmAddr,
      LENDING_POOL_EVM,
      maxUint
    );
    txIds.push(approve.txId);
    links.push(txLink(approve.txId));
    tools.push("ERC20.approve");
    const data = LENDING_POOL_ABI.encodeFunctionData("repay", [
      token.evmAddr,
      amountWei,
      rate,
      onBehalfOf,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    txIds.push(resp.transactionId.toString());
    links.push(txLink(resp.transactionId.toString()));
    tools.push("LendingPool.repay");
    const status = receipt.status.toString();
    return {
      success: status === "SUCCESS",
      action: "repay",
      txIds,
      hashScanLinks: links,
      details:
        status === "SUCCESS"
          ? `Repaid ${
              amount || "all"
            } ${tokenSymbol} (${rateMode}) on Bonzo Finance.`
          : `Repay failed: ${status}`,
      error: status !== "SUCCESS" ? status : undefined,
      toolsUsed: tools,
    };
  } catch (e: any) {
    return {
      success: false,
      action: "repay",
      txIds,
      hashScanLinks: links,
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
    };
  }
}
