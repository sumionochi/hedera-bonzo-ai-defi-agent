// ============================================
// VaultMind — HTS Keeper Score (VKS) Token
// ============================================
// Creates and mints a fungible HTS token (VKS — VaultMind Keeper Score)
// that rewards users for each successful keeper cycle.
//
// Token Details:
//   Name: VaultMind Keeper Score
//   Symbol: VKS
//   Decimals: 0 (whole tokens only — 1 VKS per keeper cycle)
//   Initial Supply: 0 (mint-on-demand)
//   Supply Type: INFINITE (operator holds supply key)
//
// Usage:
//   import { ensureVKSToken, mintKeeperReward, getVKSBalance } from './hts-rewards';
//
//   // Auto-creates token on first call (stores token ID in env)
//   const tokenId = await ensureVKSToken();
//
//   // Mint 1 VKS after each keeper cycle
//   await mintKeeperReward(userAccountId, "HOLD", 0.75);
//
// Works on both testnet and mainnet. No simulation.
// ============================================

import {
  TokenCreateTransaction,
  TokenMintTransaction,
  TokenType,
  TokenSupplyType,
  TokenId,
  AccountId,
  TokenAssociateTransaction,
  TransferTransaction,
  AccountBalanceQuery,
  Hbar,
} from "@hashgraph/sdk";
import {
  getHederaClient,
  getOperatorAccountId,
  getOperatorPrivateKey,
} from "./hedera";

// ── Configuration ──

const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

// Set these in .env after first token creation:
//   VKS_TOKEN_ID_TESTNET=0.0.XXXXX
//   VKS_TOKEN_ID_MAINNET=0.0.XXXXX
function getConfiguredTokenId(): string | null {
  if (HEDERA_NETWORK === "mainnet") {
    return process.env.VKS_TOKEN_ID_MAINNET || null;
  }
  return process.env.VKS_TOKEN_ID_TESTNET || null;
}

// In-memory cache
let runtimeTokenId: string | null = null;

function getEffectiveTokenId(): string | null {
  return getConfiguredTokenId() || runtimeTokenId;
}

// Track associations to avoid redundant calls
const associationCache = new Set<string>();

// ═══════════════════════════════════════════════════════════
// CREATE TOKEN — One-time setup
// ═══════════════════════════════════════════════════════════

/**
 * Creates the VKS (VaultMind Keeper Score) fungible token on Hedera.
 * Only needs to run once per network. Stores the token ID for reuse.
 *
 * The operator account holds the Supply Key so it can mint new tokens.
 * The operator is also the Treasury that initially holds all minted tokens
 * before transferring them to users.
 */
export async function createVKSToken(): Promise<{
  success: boolean;
  tokenId?: string;
  txId?: string;
  error?: string;
}> {
  const existing = getEffectiveTokenId();
  if (existing) {
    console.log(`[HTS/VKS] Token already exists: ${existing}`);
    return { success: true, tokenId: existing };
  }

  try {
    const client = getHederaClient();
    const operatorId = getOperatorAccountId();
    const operatorKey = getOperatorPrivateKey();

    console.log(`[HTS/VKS] Creating VKS token on ${HEDERA_NETWORK}...`);

    const tx = new TokenCreateTransaction()
      .setTokenName("VaultMind Keeper Score")
      .setTokenSymbol("VKS")
      .setTokenType(TokenType.FungibleCommon)
      .setDecimals(0)
      .setInitialSupply(0)
      .setSupplyType(TokenSupplyType.Infinite)
      .setTreasuryAccountId(AccountId.fromString(operatorId))
      .setSupplyKey(operatorKey.publicKey)
      .setAdminKey(operatorKey.publicKey)
      .setTokenMemo(
        "VaultMind Keeper Score — minted per successful keeper cycle"
      )
      .setMaxTransactionFee(new Hbar(30))
      .freezeWith(client);

    const signed = await tx.sign(operatorKey);
    const resp = await signed.execute(client);
    const receipt = await resp.getReceipt(client);
    const tokenId = receipt.tokenId!.toString();
    const txId = resp.transactionId.toString();

    runtimeTokenId = tokenId;

    console.log(`[HTS/VKS] ✅ Created VKS token: ${tokenId}`);
    console.log(
      `[HTS/VKS] ⚠️  Add to .env: VKS_TOKEN_ID_${HEDERA_NETWORK.toUpperCase()}=${tokenId}`
    );

    return { success: true, tokenId, txId };
  } catch (e: any) {
    console.error(`[HTS/VKS] Create failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
// ENSURE TOKEN — Auto-create on first use
// ═══════════════════════════════════════════════════════════

export async function ensureVKSToken(): Promise<string | null> {
  const existing = getEffectiveTokenId();
  if (existing) return existing;

  const result = await createVKSToken();
  return result.tokenId || null;
}

// ═══════════════════════════════════════════════════════════
// MINT + TRANSFER — Reward user after keeper cycle
// ═══════════════════════════════════════════════════════════

/**
 * Mints 1 VKS token and transfers it to the specified account.
 * Called after each successful keeper cycle.
 *
 * Flow:
 *   1. Ensure token exists (auto-create if needed)
 *   2. Ensure user is associated with VKS token
 *   3. Mint 1 new VKS to treasury (operator)
 *   4. Transfer 1 VKS from treasury to user
 *
 * @param recipientAccountId - Hedera account to reward (e.g. "0.0.5907362")
 * @param action - The keeper action that was taken (for logging)
 * @param confidence - Decision confidence (for logging)
 */
export async function mintKeeperReward(
  recipientAccountId: string,
  action: string = "KEEPER_CYCLE",
  confidence: number = 0
): Promise<{
  success: boolean;
  tokenId?: string;
  txId?: string;
  mintTxId?: string;
  transferTxId?: string;
  newBalance?: number;
  error?: string;
}> {
  try {
    const tokenIdStr = await ensureVKSToken();
    if (!tokenIdStr) {
      return { success: false, error: "Failed to create/find VKS token" };
    }

    const client = getHederaClient();
    const operatorId = getOperatorAccountId();
    const operatorKey = getOperatorPrivateKey();
    const tokenId = TokenId.fromString(tokenIdStr);

    console.log(
      `[HTS/VKS] Minting 1 VKS for ${recipientAccountId} (action: ${action})...`
    );

    // Step 1: Ensure recipient is associated
    const assocKey = `${recipientAccountId}:${tokenIdStr}`;
    if (!associationCache.has(assocKey)) {
      try {
        const assocTx = new TokenAssociateTransaction()
          .setAccountId(AccountId.fromString(recipientAccountId))
          .setTokenIds([tokenId]);
        await assocTx.execute(client);
        associationCache.add(assocKey);
        console.log(`[HTS/VKS] Associated ${recipientAccountId} with VKS`);
      } catch (e: any) {
        const msg = e.message || "";
        if (
          msg.includes("ALREADY_ASSOCIATED") ||
          msg.includes("TOKEN_ALREADY_ASSOCIATED")
        ) {
          associationCache.add(assocKey);
        } else {
          // If recipient has auto-association enabled, this will work anyway
          console.warn(
            `[HTS/VKS] Association warning: ${msg.substring(0, 80)}`
          );
        }
      }
    }

    // Step 2: Mint 1 VKS to treasury
    const mintTx = new TokenMintTransaction()
      .setTokenId(tokenId)
      .setAmount(1)
      .setMaxTransactionFee(new Hbar(5))
      .freezeWith(client);

    const mintSigned = await mintTx.sign(operatorKey);
    const mintResp = await mintSigned.execute(client);
    const mintReceipt = await mintResp.getReceipt(client);
    const mintTxId = mintResp.transactionId.toString();
    const mintStatus = mintReceipt.status.toString();

    if (mintStatus !== "SUCCESS") {
      return {
        success: false,
        tokenId: tokenIdStr,
        error: `Mint failed: ${mintStatus}`,
        mintTxId,
      };
    }

    console.log(`[HTS/VKS] Minted 1 VKS → treasury (${mintTxId})`);

    // Step 3: Transfer 1 VKS from treasury to recipient
    // Skip transfer if recipient IS the operator (they already have it)
    let transferTxId: string | undefined;
    if (recipientAccountId !== operatorId) {
      const transferTx = new TransferTransaction()
        .addTokenTransfer(tokenId, AccountId.fromString(operatorId), -1)
        .addTokenTransfer(tokenId, AccountId.fromString(recipientAccountId), 1)
        .setMaxTransactionFee(new Hbar(3));

      const transferResp = await transferTx.execute(client);
      const transferReceipt = await transferResp.getReceipt(client);
      transferTxId = transferResp.transactionId.toString();
      const transferStatus = transferReceipt.status.toString();

      if (transferStatus !== "SUCCESS") {
        console.warn(
          `[HTS/VKS] Transfer failed: ${transferStatus}. VKS stays in treasury.`
        );
        return {
          success: true, // Mint succeeded, transfer failed — token exists in treasury
          tokenId: tokenIdStr,
          mintTxId,
          error: `Transfer to ${recipientAccountId} failed: ${transferStatus}`,
        };
      }

      console.log(
        `[HTS/VKS] Transferred 1 VKS → ${recipientAccountId} (${transferTxId})`
      );
    } else {
      console.log(`[HTS/VKS] Recipient is operator — VKS stays in treasury`);
    }

    // Step 4: Query new balance
    let newBalance: number | undefined;
    try {
      newBalance = await getVKSBalance(recipientAccountId);
    } catch {}

    console.log(
      `[HTS/VKS] ✅ Reward complete. ${recipientAccountId} now has ${
        newBalance ?? "?"
      } VKS`
    );

    return {
      success: true,
      tokenId: tokenIdStr,
      mintTxId,
      transferTxId,
      newBalance,
    };
  } catch (e: any) {
    console.error(`[HTS/VKS] Reward failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
// QUERY — Check VKS balance for any account
// ═══════════════════════════════════════════════════════════

export async function getVKSBalance(accountId: string): Promise<number> {
  const tokenIdStr = getEffectiveTokenId();
  if (!tokenIdStr) return 0;

  try {
    const client = getHederaClient();
    const balance = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);

    const tokenBalance = balance.tokens?._map?.get(tokenIdStr);
    return tokenBalance ? Number(tokenBalance) : 0;
  } catch (e: any) {
    console.warn(
      `[HTS/VKS] Balance query failed: ${e.message?.substring(0, 60)}`
    );
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════
// INFO — Export token details for README/UI
// ═══════════════════════════════════════════════════════════

export function getVKSTokenInfo() {
  const tokenId = getEffectiveTokenId();
  const hashscanBase =
    HEDERA_NETWORK === "mainnet"
      ? "https://hashscan.io/mainnet"
      : "https://hashscan.io/testnet";

  return {
    network: HEDERA_NETWORK,
    tokenId,
    tokenName: "VaultMind Keeper Score",
    tokenSymbol: "VKS",
    decimals: 0,
    supplyType: "INFINITE",
    hashScanLink: tokenId ? `${hashscanBase}/token/${tokenId}` : null,
    created: !!tokenId,
  };
}
