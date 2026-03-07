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
  ContractCallQuery,
  ContractId,
  Hbar,
  AccountId,
  AccountInfoQuery,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { Interface, defaultAbiCoder } from "@ethersproject/abi";
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
  "function balanceOf(address owner) view returns (uint256)",
]);

const LENDING_POOL_ABI = new Interface([
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

// Bonzo aToken addresses on testnet
const ATOKEN_MAP: Record<string, string> = {
  WHBAR: "0xe65dAF55D9A2F7768bdd27d430726b2Df7144636",
  HBAR: "0xe65dAF55D9A2F7768bdd27d430726b2Df7144636", // same as WHBAR
  USDC: "0xee72C37fEc48C9FeC6bbD0982ecEb7d7a038841e",
  HBARX: "0x37FfB9d2c91ef6858E54DD5B05805339A1aEA207",
  SAUCE: "0xC4d4315Ac919253b8bA48D5e609594921eb5525c",
  KARATE: "0xd5D2e84E2d29E3b8C49C2ec08Bc9d5CA01639de9",
};

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

// ═══ QUERY POSITIONS ═══
export interface PositionInfo {
  token: string;
  aTokenBalance: string;
  aTokenBalanceRaw: bigint;
  decimals: number;
}

export interface AccountData {
  totalCollateralETH: number; // in HBAR units (18 dec)
  totalDebtETH: number;
  availableBorrowsETH: number;
  healthFactor: number;
}

async function queryUserAccountData(
  client: any,
  userEvm: string
): Promise<AccountData | null> {
  try {
    const data = LENDING_POOL_ABI.encodeFunctionData("getUserAccountData", [
      userEvm,
    ]);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(200_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    const bytes = result.bytes;
    if (bytes && bytes.length >= 192) {
      // 6 x 32 bytes
      const decoded = defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        bytes
      );
      return {
        totalCollateralETH: Number(BigInt(decoded[0].toString())) / 1e18,
        totalDebtETH: Number(BigInt(decoded[1].toString())) / 1e18,
        availableBorrowsETH: Number(BigInt(decoded[2].toString())) / 1e18,
        healthFactor: Number(BigInt(decoded[5].toString())) / 1e18,
      };
    }
  } catch (e: any) {
    console.warn(
      `[BonzoExec] getUserAccountData failed: ${e.message?.substring(0, 60)}`
    );
  }
  return null;
}

async function queryATokenBalance(
  client: any,
  aTokenEvm: string,
  userEvm: string
): Promise<bigint> {
  try {
    const data = ERC20_ABI.encodeFunctionData("balanceOf", [userEvm]);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(aTokenEvm))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    const bytes = result.bytes;
    if (bytes && bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], bytes);
      return BigInt(decoded[0].toString());
    }
  } catch (e: any) {
    console.warn(
      `[BonzoExec] aToken query failed: ${e.message?.substring(0, 60)}`
    );
  }
  return BigInt(0);
}

export async function queryAllPositions(): Promise<PositionInfo[]> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);
  const positions: PositionInfo[] = [];

  console.log(`[BonzoExec] Querying positions for ${operatorId} (${userEvm})`);

  for (const [symbol, aTokenAddr] of Object.entries(ATOKEN_MAP)) {
    if (symbol === "HBAR") continue; // skip duplicate (same as WHBAR)
    const token = TOKEN_MAP[symbol];
    if (!token) continue;
    const bal = await queryATokenBalance(client, aTokenAddr, userEvm);
    if (bal > BigInt(0)) {
      const human = Number(bal) / Math.pow(10, token.decimals);
      positions.push({
        token: symbol,
        aTokenBalance: human.toFixed(token.decimals > 6 ? 4 : 2),
        aTokenBalanceRaw: bal,
        decimals: token.decimals,
      });
      console.log(`[BonzoExec]   ${symbol}: ${human.toFixed(4)} aTokens`);
    }
  }

  return positions;
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
  const tools: string[] = [];

  console.log(`[BonzoExec] === WITHDRAW ${amount || "all"} ${tokenSymbol} ===`);

  try {
    // Pre-check: do we have a position in this token?
    tools.push("aToken.balanceOf");
    const aTokenAddr =
      ATOKEN_MAP[tokenSymbol.toUpperCase()] || ATOKEN_MAP.WHBAR;
    const bal = await queryATokenBalance(client, aTokenAddr, toAddr);
    if (bal === BigInt(0)) {
      const tkUpper = tokenSymbol.toUpperCase();
      return {
        success: false,
        action: "withdraw",
        txIds: [],
        hashScanLinks: [],
        details: `No ${tkUpper} position found — you have 0 a${tkUpper} tokens. Nothing to withdraw.`,
        error: "NO_POSITION",
        toolsUsed: tools,
      };
    }
    const balHuman = Number(bal) / Math.pow(10, token.decimals);
    console.log(`[BonzoExec] Current aToken balance: ${balHuman.toFixed(4)}`);

    // Pre-check: if user has debt, can't withdraw ALL collateral
    tools.push("getUserAccountData");
    const accountData = await queryUserAccountData(client, toAddr);
    let withdrawAmount: bigint;
    let withdrawHuman: number;

    if (accountData && accountData.totalDebtETH > 0) {
      console.log(
        `[BonzoExec] Active debt: ${accountData.totalDebtETH.toFixed(
          4
        )} HBAR-equivalent, HF: ${accountData.healthFactor.toFixed(2)}`
      );

      if (amount) {
        // User specified an amount — use it (will revert on-chain if too much)
        withdrawAmount = toSmallestUnit(amount, token.decimals);
        withdrawHuman = amount;
      } else {
        // "Withdraw all" with active debt — calculate safe max
        // Safe withdrawal = collateral - (debt / LTV), keeping HF > 1.05
        // availableBorrowsETH tells us our excess collateral in HBAR terms
        const safeExcessHbar = accountData.availableBorrowsETH * 0.9; // 10% safety margin
        if (safeExcessHbar <= 0) {
          return {
            success: false,
            action: "withdraw",
            txIds: [],
            hashScanLinks: [],
            details: `Cannot withdraw — you have active debt (${accountData.totalDebtETH.toFixed(
              4
            )} HBAR-equivalent) and your health factor is ${accountData.healthFactor.toFixed(
              2
            )}. Repay your debt first with "repay my USDC loan", then withdraw.`,
            error: "ACTIVE_DEBT",
            toolsUsed: tools,
          };
        }

        // Convert safe excess from HBAR to the token's units
        // For WHBAR: 1:1. For other tokens, this is approximate.
        const isWhbar = ["HBAR", "WHBAR"].includes(tokenSymbol.toUpperCase());
        if (isWhbar) {
          withdrawHuman = Math.min(safeExcessHbar, balHuman);
        } else {
          // For non-HBAR tokens, use 80% of balance as safe estimate
          withdrawHuman = balHuman * 0.8;
        }
        withdrawAmount = toSmallestUnit(withdrawHuman, token.decimals);
        console.log(
          `[BonzoExec] Safe withdrawal (with debt): ${withdrawHuman.toFixed(
            4
          )} ${tokenSymbol}`
        );
      }
    } else {
      // No debt — withdraw everything
      if (amount) {
        withdrawAmount = toSmallestUnit(amount, token.decimals);
        withdrawHuman = amount;
      } else {
        // Use actual balance instead of maxUint (safer on Hedera)
        withdrawAmount = bal;
        withdrawHuman = balHuman;
      }
    }

    tools.push("LendingPool.withdraw");
    const data = LENDING_POOL_ABI.encodeFunctionData("withdraw", [
      token.evmAddr,
      withdrawAmount,
      toAddr,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const txId = resp.transactionId.toString();
    try {
      const receipt = await resp.getReceipt(client);
      const status = receipt.status.toString();
      return {
        success: status === "SUCCESS",
        action: "withdraw",
        txIds: [txId],
        hashScanLinks: [txLink(txId)],
        details:
          status === "SUCCESS"
            ? `Withdrew ${withdrawHuman.toFixed(
                4
              )} ${tokenSymbol} from Bonzo Finance.`
            : `Withdraw failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    } catch (receiptErr: any) {
      return {
        success: false,
        action: "withdraw",
        txIds: [txId],
        hashScanLinks: [txLink(txId)],
        details: `Withdraw reverted. You may have active debt preventing full withdrawal. Try repaying your loans first, or withdraw a smaller amount.`,
        error: "CONTRACT_REVERT",
        toolsUsed: tools,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      action: "withdraw",
      txIds: [],
      hashScanLinks: [],
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
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
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  console.log(
    `[BonzoExec] === BORROW ${amount} ${tokenSymbol} (${rateMode}) ===`
  );

  try {
    // Pre-check: query collateral & available borrows
    tools.push("getUserAccountData");
    const accountData = await queryUserAccountData(client, onBehalfOf);
    if (accountData) {
      console.log(
        `[BonzoExec] Collateral: ${accountData.totalCollateralETH}, Available borrows: ${accountData.availableBorrowsETH}, Health: ${accountData.healthFactor}`
      );

      // availableBorrowsETH is in 18-decimal "ETH" units (=HBAR on Bonzo)
      // For non-HBAR tokens, we need price conversion. Rough check:
      if (accountData.totalCollateralETH === 0) {
        return {
          success: false,
          action: "borrow",
          txIds: [],
          hashScanLinks: [],
          details: `Cannot borrow — no collateral deposited. Deposit HBAR or other assets first, then borrow against them.`,
          error: "NO_COLLATERAL",
          toolsUsed: tools,
        };
      }

      if (accountData.availableBorrowsETH === 0) {
        return {
          success: false,
          action: "borrow",
          txIds: [],
          hashScanLinks: [],
          details: `Cannot borrow — you've reached your borrowing limit. Your health factor is ${accountData.healthFactor.toFixed(
            2
          )}. Deposit more collateral or repay existing debt first.`,
          error: "BORROW_LIMIT_REACHED",
          toolsUsed: tools,
        };
      }

      // Rough USD estimate: HBAR ~$0.33, USDC = $1
      const isStable = ["USDC"].includes(tokenSymbol.toUpperCase());
      const hbarPrice = 0.33;
      const availableUSD = accountData.availableBorrowsETH * hbarPrice;
      const borrowUSD = isStable ? amount : amount * hbarPrice;
      if (borrowUSD > availableUSD * 1.1) {
        // 10% tolerance
        const maxBorrow = isStable
          ? availableUSD.toFixed(2)
          : accountData.availableBorrowsETH.toFixed(2);
        return {
          success: false,
          action: "borrow",
          txIds: [],
          hashScanLinks: [],
          details: `Borrow amount (${amount} ${tokenSymbol} ≈ $${borrowUSD.toFixed(
            0
          )}) exceeds your borrowing power (~$${availableUSD.toFixed(
            0
          )}). Max safe borrow: ~${maxBorrow} ${tokenSymbol}. Deposit more collateral or reduce the amount.`,
          error: "INSUFFICIENT_COLLATERAL",
          toolsUsed: tools,
        };
      }
    }

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
    const txId = resp.transactionId.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    tools.push("LendingPool.borrow");
    try {
      const receipt = await resp.getReceipt(client);
      const status = receipt.status.toString();
      return {
        success: status === "SUCCESS",
        action: "borrow",
        txIds,
        hashScanLinks: links,
        details:
          status === "SUCCESS"
            ? `Borrowed ${amount} ${tokenSymbol} (${rateMode}) from Bonzo Finance. Remember to repay to maintain a healthy position.`
            : `Borrow failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    } catch (receiptErr: any) {
      return {
        success: false,
        action: "borrow",
        txIds,
        hashScanLinks: links,
        details: `Borrow reverted on-chain. This usually means: insufficient collateral, borrowing not enabled for ${tokenSymbol}, or insufficient liquidity in the pool.`,
        error: "CONTRACT_REVERT",
        toolsUsed: tools,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      action: "borrow",
      txIds,
      hashScanLinks: links,
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
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
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  console.log(
    `[BonzoExec] === REPAY ${amount || "all"} ${tokenSymbol} (${rateMode}) ===`
  );

  try {
    // Pre-check: does user have any debt?
    tools.push("getUserAccountData");
    const accountData = await queryUserAccountData(client, onBehalfOf);
    if (accountData && accountData.totalDebtETH === 0) {
      return {
        success: false,
        action: "repay",
        txIds: [],
        hashScanLinks: [],
        details: `No outstanding debt found — nothing to repay. You're debt-free! 🎉`,
        error: "NO_DEBT",
        toolsUsed: tools,
      };
    }

    // Pre-check: does user have the token to repay with?
    tools.push("balanceOf");
    const tokenBal = await queryATokenBalance(
      client,
      token.evmAddr,
      onBehalfOf
    );
    const tokenBalHuman = Number(tokenBal) / Math.pow(10, token.decimals);
    console.log(
      `[BonzoExec] ${tokenSymbol} wallet balance: ${tokenBalHuman.toFixed(4)}`
    );

    if (tokenBal === BigInt(0)) {
      const isHbar = ["HBAR", "WHBAR"].includes(tokenSymbol.toUpperCase());
      return {
        success: false,
        action: "repay",
        txIds: [],
        hashScanLinks: [],
        details: isHbar
          ? `You have 0 WHBAR tokens to repay with. Your HBAR needs to be wrapped to WHBAR first. Try: "deposit 10 HBAR" first to get WHBAR, or ensure you have WHBAR in your wallet.`
          : `You have 0 ${tokenSymbol} tokens to repay with. You need ${tokenSymbol} in your wallet to repay the loan.`,
        error: "NO_TOKEN_BALANCE",
        toolsUsed: tools,
      };
    }

    // Use actual balance for "repay all" instead of maxUint (Hedera doesn't handle maxUint well)
    const repayAmount = amount
      ? toSmallestUnit(amount, token.decimals)
      : tokenBal;
    const repayHuman = amount || tokenBalHuman;
    console.log(
      `[BonzoExec] Repaying ${repayHuman} ${tokenSymbol} (raw: ${repayAmount})`
    );

    // Approve the exact repay amount (not maxUint — Hedera HTS tokens reject maxUint approvals)
    await ensureAssociated(client, operatorId, token.htsId);
    const approve = await approveToken(
      client,
      token.evmAddr,
      LENDING_POOL_EVM,
      repayAmount
    );
    txIds.push(approve.txId);
    links.push(txLink(approve.txId));
    tools.push("ERC20.approve");
    if (!approve.success) {
      return {
        success: false,
        action: "repay",
        txIds,
        hashScanLinks: links,
        details: `Approve failed: ${approve.error}`,
        error: approve.error,
        toolsUsed: tools,
      };
    }

    const data = LENDING_POOL_ABI.encodeFunctionData("repay", [
      token.evmAddr,
      repayAmount,
      rate,
      onBehalfOf,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const txId = resp.transactionId.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    tools.push("LendingPool.repay");
    try {
      const receipt = await resp.getReceipt(client);
      const status = receipt.status.toString();
      return {
        success: status === "SUCCESS",
        action: "repay",
        txIds,
        hashScanLinks: links,
        details:
          status === "SUCCESS"
            ? `Repaid ${repayHuman} ${tokenSymbol} (${rateMode}) on Bonzo Finance. Health factor improved.`
            : `Repay failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    } catch (receiptErr: any) {
      return {
        success: false,
        action: "repay",
        txIds,
        hashScanLinks: links,
        details: `Repay reverted. This may mean: no active ${tokenSymbol} ${rateMode} debt exists (try the other rate mode), or the repay amount exceeds your debt.`,
        error: "CONTRACT_REVERT",
        toolsUsed: tools,
      };
    }
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
