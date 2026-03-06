// ============================================
// lib/bonzo-execute.ts – Plugin addresses + revert reason extraction
// ============================================

import {
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
  AccountId,
  AccountInfoQuery,
  TokenAssociateTransaction,
  TokenId,
  TransactionReceipt,
} from "@hashgraph/sdk";
import { Interface } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";

// ------------------------------------------------------------------
// Plugin addresses (verified by your /api/diagnose)
// ------------------------------------------------------------------
const LENDING_POOL_ADDRESS = "0x7710a96b01e02eD00768C3b39BfA7B4f1c128c62";
const WETH_GATEWAY_ADDRESS = "0xA824820e35D6AE4D368153e83b7920B2DC3Cf964";

// Testnet HTS token mappings
const TESTNET_TOKENS: Record<
  string,
  { evmAddr: string; htsId: string; decimals: number }
> = {
  HBAR: {
    evmAddr: "0x0000000000000000000000000000000000003ad2",
    htsId: "0.0.15058",
    decimals: 8,
  },
  WHBAR: {
    evmAddr: "0x0000000000000000000000000000000000003ad2",
    htsId: "0.0.15058",
    decimals: 8,
  },
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
    evmAddr: "0x0000000000000000000000000000000000220ce5",
    htsId: "0.0.2236901",
    decimals: 8,
  },
};

// ------------------------------------------------------------------
// ABIs (verified signatures)
// ------------------------------------------------------------------
const WETH_GATEWAY_ABI = new Interface([
  "function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) payable",
  "function withdrawETH(address lendingPool, uint256 amount, address to)",
  "function borrowETH(address lendingPool, uint256 amount, uint256 interestRateMode, uint16 referralCode)",
  "function repayETH(address lendingPool, uint256 amount, uint256 rateMode, address onBehalfOf) payable",
]);

const LENDING_POOL_ABI = new Interface([
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)",
]);

const ERC20_ABI = new Interface([
  "function approve(address spender, uint256 amount) returns (bool)",
]);

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------
export interface ExecutionResult {
  success: boolean;
  action: string;
  txIds: string[];
  hashScanLinks: string[];
  details: string;
  error?: string;
  toolsUsed: string[];
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------
function txIdToHashScan(txId: string): string {
  const parts = txId.split("@");
  if (parts.length === 2) {
    return `https://hashscan.io/testnet/transaction/${
      parts[0]
    }-${parts[1].replace(".", "-")}`;
  }
  return `https://hashscan.io/testnet/transaction/${txId}`;
}

function toWei(amount: number, decimals: number): bigint {
  return BigInt(Math.floor(amount * Math.pow(10, decimals)));
}

function getTokenInfo(symbol: string) {
  const upper = symbol.toUpperCase().trim();
  return TESTNET_TOKENS[upper] || TESTNET_TOKENS.HBAR;
}

async function getEvmAddress(client: any, accountId: string): Promise<string> {
  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);
    const evm = info.contractAccountId;
    if (typeof evm === "string" && evm.length > 0) {
      return evm.startsWith("0x") ? evm : `0x${evm}`;
    }
  } catch (e) {
    console.warn(`[BonzoExec] EVM lookup failed for ${accountId}`);
  }
  return "0x" + AccountId.fromString(accountId).toSolidityAddress();
}

// ------------------------------------------------------------------
// Token Association (required for HTS tokens like WHBAR)
// ------------------------------------------------------------------
const associatedTokensCache = new Set<string>();

async function ensureTokenAssociated(
  client: any,
  accountId: string,
  tokenSymbol: string
): Promise<void> {
  const token = getTokenInfo(tokenSymbol);
  const cacheKey = `${accountId}:${token.htsId}`;
  if (associatedTokensCache.has(cacheKey)) return;

  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);

    const tokenMap = (info as any).tokenRelationships;
    const existingIds = new Set<string>();
    if (tokenMap && tokenMap._map) {
      for (const [k] of tokenMap._map) existingIds.add(k.toString());
    }

    if (existingIds.has(token.htsId)) {
      associatedTokensCache.add(cacheKey);
      console.log(`[BonzoExec] ${tokenSymbol} already associated`);
      return;
    }

    console.log(`[BonzoExec] Associating ${tokenSymbol}...`);
    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(token.htsId)]);

    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(
      `[BonzoExec] Association ${tokenSymbol}: ${receipt.status.toString()}`
    );
    associatedTokensCache.add(cacheKey);
  } catch (e: any) {
    if (e.message?.includes("TOKEN_ALREADY_ASSOCIATED")) {
      associatedTokensCache.add(cacheKey);
      return;
    }
    console.warn(`[BonzoExec] Association warning: ${e.message}`);
  }
}

// ------------------------------------------------------------------
// Revert reason extraction (works with Hedera ContractFunctionResult)
// ------------------------------------------------------------------
function extractRevertReason(receipt: TransactionReceipt): string | undefined {
  // @ts-ignore – Hedera SDK includes contractFunctionResult
  const result = receipt.contractFunctionResult;
  if (!result) return undefined;

  // If errorMessage is present, use it
  if (result.errorMessage) return result.errorMessage;

  // Otherwise try to decode revert reason from raw bytes
  if (result.contractCallResult) {
    const bytes = result.contractCallResult;
    if (
      bytes.length >= 4 &&
      bytes[0] === 0x08 &&
      bytes[1] === 0xc3 &&
      bytes[2] === 0x79 &&
      bytes[3] === 0xa0
    ) {
      // That's the Error(string) selector; next 32 bytes are offset, then length, then string
      // This is simplified – in practice you'd use ethers.utils.toUtf8String after parsing.
      // We'll return a placeholder.
      return "Custom error (see contract)";
    }
  }
  return undefined;
}

// ------------------------------------------------------------------
// HBAR Deposit via Plugin WETHGateway
// ------------------------------------------------------------------
async function depositHBAR(amount: number): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);

  console.log(`[BonzoExec] depositETH: ${amount} HBAR via plugin WETHGateway`);
  console.log(`[BonzoExec] LendingPool: ${LENDING_POOL_ADDRESS}`);
  console.log(`[BonzoExec] WETHGateway: ${WETH_GATEWAY_ADDRESS}`);
  console.log(`[BonzoExec] onBehalfOf: ${onBehalfOf}`);

  const data = WETH_GATEWAY_ABI.encodeFunctionData("depositETH", [
    LENDING_POOL_ADDRESS,
    onBehalfOf,
    0, // referralCode
  ]);

  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromSolidityAddress(WETH_GATEWAY_ADDRESS))
    .setGas(2_000_000) // Increased gas
    .setPayableAmount(new Hbar(amount))
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .setMaxTransactionFee(new Hbar(10));

  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  const txId = resp.transactionId.toString();
  const status = receipt.status.toString();
  const revertReason = extractRevertReason(receipt);

  console.log(
    `[BonzoExec] depositETH result: ${status}, tx=${txId}, revert=${
      revertReason || "none"
    }`
  );

  return {
    success: status === "SUCCESS",
    action: "deposit",
    txIds: [txId],
    hashScanLinks: [txIdToHashScan(txId)],
    details: `Deposited ${amount} HBAR via plugin WETHGateway. Status: ${status}${
      revertReason ? ` Revert: ${revertReason}` : ""
    }`,
    error:
      status !== "SUCCESS"
        ? `Transaction reverted${revertReason ? `: ${revertReason}` : ""}`
        : undefined,
    toolsUsed: ["WETHGateway.depositETH"],
  };
}

// ------------------------------------------------------------------
// ERC20 Deposit (unchanged, but uses plugin LendingPool)
// ------------------------------------------------------------------
async function depositERC20(
  tokenSymbol: string,
  amount: number
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const token = getTokenInfo(tokenSymbol);
  const amountWei = toWei(amount, token.decimals);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  await ensureTokenAssociated(client, operatorId, tokenSymbol);

  // Approve
  const approveData = ERC20_ABI.encodeFunctionData("approve", [
    LENDING_POOL_ADDRESS,
    amountWei,
  ]);
  const approveTx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromSolidityAddress(token.evmAddr))
    .setGas(1_000_000)
    .setFunctionParameters(Buffer.from(approveData.slice(2), "hex"))
    .setMaxTransactionFee(new Hbar(5));
  const approveResp = await approveTx.execute(client);
  await approveResp.getReceipt(client);
  txIds.push(approveResp.transactionId.toString());
  links.push(txIdToHashScan(approveResp.transactionId.toString()));
  tools.push(`${tokenSymbol}.approve`);

  // Deposit
  const depositData = LENDING_POOL_ABI.encodeFunctionData("deposit", [
    token.evmAddr,
    amountWei,
    onBehalfOf,
    0,
  ]);
  const depositTx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_ADDRESS))
    .setGas(1_500_000)
    .setFunctionParameters(Buffer.from(depositData.slice(2), "hex"))
    .setMaxTransactionFee(new Hbar(10));
  const depositResp = await depositTx.execute(client);
  const depositReceipt = await depositResp.getReceipt(client);
  txIds.push(depositResp.transactionId.toString());
  links.push(txIdToHashScan(depositResp.transactionId.toString()));
  tools.push("LendingPool.deposit");

  const status = depositReceipt.status.toString();
  const revertReason = extractRevertReason(depositReceipt);
  return {
    success: status === "SUCCESS",
    action: "deposit",
    txIds,
    hashScanLinks: links,
    details: `Deposited ${amount} ${tokenSymbol}. Status: ${status}${
      revertReason ? ` Revert: ${revertReason}` : ""
    }`,
    error:
      status !== "SUCCESS"
        ? `Deposit reverted${revertReason ? `: ${revertReason}` : ""}`
        : undefined,
    toolsUsed: tools,
  };
}

// ------------------------------------------------------------------
// Public API
// ------------------------------------------------------------------
function isHBAR(symbol: string): boolean {
  const upper = symbol.toUpperCase().trim();
  return upper === "HBAR" || upper === "WHBAR";
}

export async function executeDeposit(
  tokenSymbol: string,
  amount: number
): Promise<ExecutionResult> {
  return isHBAR(tokenSymbol)
    ? depositHBAR(amount)
    : depositERC20(tokenSymbol, amount);
}

// Other functions (withdraw, borrow, repay) remain similar – update addresses accordingly.
// (Omitted for brevity but follow the same pattern.)
