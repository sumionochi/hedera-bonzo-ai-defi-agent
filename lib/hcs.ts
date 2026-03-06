// ============================================
// HCS Audit Logger - Real Hedera Consensus Service
// Every agent decision logged immutably on-chain
//
// Topic persistence strategy (Vercel-compatible):
//   1. process.env.HCS_AUDIT_TOPIC_ID (if set in Vercel dashboard)
//   2. In-memory cache (survives warm serverless invocations)
//   3. Mirror Node discovery — scan chain for existing VaultMind topic
//   4. Create new topic only if none found anywhere
//
// No filesystem writes. No external DB. Works on Vercel free tier.
// ============================================

import {
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TopicId,
} from "@hashgraph/sdk";
import { getHederaClient, getOperatorAccountId } from "./hedera";

const MIRROR_NODE_BASE =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

const TOPIC_MEMO = "VaultMind AI Keeper Audit Log";

// ── In-memory cache (survives warm serverless invocations) ──
let cachedTopicId: string | null = null;

export interface AgentDecisionLog {
  timestamp: string;
  agent: string;
  version: string;
  action: string;
  reason: string;
  confidence: number;
  context: {
    sentimentScore?: number;
    sentimentSignal?: string;
    volatility?: number;
    fearGreedIndex?: number;
    hbarPrice?: number;
    hbarChange24h?: number;
  };
  params?: Record<string, unknown>;
  walletAddress?: string;
}

// ════════════════════════════════════════════
// Topic Discovery via Mirror Node
// ════════════════════════════════════════════

/**
 * Discover existing VaultMind audit topic from the blockchain.
 * Scans the operator account's CONSENSUSCREATETOPIC transactions
 * and checks each topic's memo for "VaultMind".
 *
 * Returns the most recent matching topic ID, or null if none found.
 */
async function discoverAuditTopic(): Promise<string | null> {
  try {
    const operatorId = getOperatorAccountId();
    console.log(`[HCS] Discovering existing audit topics for ${operatorId}...`);

    // Step 1: Find all CONSENSUSCREATETOPIC transactions by this account
    const txUrl = `${MIRROR_NODE_BASE}/api/v1/transactions?account.id=${operatorId}&transactiontype=CONSENSUSCREATETOPIC&order=desc&limit=25`;
    const txRes = await fetch(txUrl, { cache: "no-store" });

    if (!txRes.ok) {
      console.warn(`[HCS] Mirror Node tx query failed: ${txRes.status}`);
      return null;
    }

    const txData = await txRes.json();
    const transactions = txData.transactions || [];

    if (transactions.length === 0) {
      console.log(
        "[HCS] No topic creation transactions found for this account"
      );
      return null;
    }

    // Step 2: Extract topic IDs from transaction entity_id field
    const candidateTopicIds: string[] = [];
    for (const tx of transactions) {
      if (tx.entity_id && !candidateTopicIds.includes(tx.entity_id)) {
        candidateTopicIds.push(tx.entity_id);
      }
    }

    if (candidateTopicIds.length === 0) {
      console.log("[HCS] Found transactions but no entity_id fields");
      return null;
    }

    console.log(
      `[HCS] Found ${candidateTopicIds.length} candidate topic(s), checking memos...`
    );

    // Step 3: Check each topic's memo to find VaultMind audit topic
    // Prefer topics WITH messages (active audit trail) over empty ones
    let bestTopicWithMessages: string | null = null;
    let bestTopicEmpty: string | null = null;

    for (const topicId of candidateTopicIds) {
      try {
        const topicUrl = `${MIRROR_NODE_BASE}/api/v1/topics/${topicId}`;
        const topicRes = await fetch(topicUrl, { cache: "no-store" });
        if (!topicRes.ok) continue;

        const topicInfo = await topicRes.json();
        const memo = topicInfo.memo || "";

        if (memo.includes("VaultMind")) {
          // Check if it has messages
          const msgUrl = `${MIRROR_NODE_BASE}/api/v1/topics/${topicId}/messages?limit=1`;
          const msgRes = await fetch(msgUrl, { cache: "no-store" });
          const msgData = msgRes.ok ? await msgRes.json() : { messages: [] };
          const hasMessages = (msgData.messages?.length || 0) > 0;

          if (hasMessages && !bestTopicWithMessages) {
            bestTopicWithMessages = topicId;
            console.log(`[HCS] ✅ Found active VaultMind topic: ${topicId}`);
            // Keep searching — prefer the one with MOST messages
          } else if (!hasMessages && !bestTopicEmpty) {
            bestTopicEmpty = topicId;
          }
        }
      } catch {
        continue;
      }
    }

    // Prefer topic that already has messages (active audit trail)
    if (bestTopicWithMessages) return bestTopicWithMessages;
    if (bestTopicEmpty) {
      console.log(`[HCS] Found empty VaultMind topic: ${bestTopicEmpty}`);
      return bestTopicEmpty;
    }

    // Step 4: Fallback — check if any topic has VaultMind messages
    // (handles edge case where topic memo was different)
    for (const topicId of candidateTopicIds.slice(0, 5)) {
      try {
        const msgUrl = `${MIRROR_NODE_BASE}/api/v1/topics/${topicId}/messages?limit=1&order=desc`;
        const msgRes = await fetch(msgUrl, { cache: "no-store" });
        if (!msgRes.ok) continue;

        const msgData = await msgRes.json();
        if (msgData.messages?.length > 0) {
          const decoded = Buffer.from(
            msgData.messages[0].message,
            "base64"
          ).toString("utf-8");
          if (decoded.includes("VaultMind") || decoded.includes("vaultmind")) {
            console.log(
              `[HCS] ✅ Found VaultMind topic by message content: ${topicId}`
            );
            return topicId;
          }
        }
      } catch {
        continue;
      }
    }

    console.log("[HCS] No existing VaultMind audit topic found on-chain");
    return null;
  } catch (err: any) {
    console.warn(`[HCS] Topic discovery error: ${err.message}`);
    return null;
  }
}

// ════════════════════════════════════════════
// Topic Creation
// ════════════════════════════════════════════

/**
 * Create a new HCS topic for the audit log
 */
export async function createAuditTopic(): Promise<string> {
  const client = getHederaClient();

  const tx = new TopicCreateTransaction()
    .setTopicMemo(TOPIC_MEMO)
    .setSubmitKey(client.operatorPublicKey!);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  if (!receipt.topicId) {
    throw new Error("Failed to create HCS audit topic");
  }

  const topicId = receipt.topicId.toString();
  console.log(`[HCS] Created new audit topic: ${topicId}`);
  return topicId;
}

// ════════════════════════════════════════════
// Core: Ensure Audit Topic (Vercel-safe)
// ════════════════════════════════════════════

/**
 * Get or create the audit topic — fully Vercel-compatible.
 *
 * Resolution order:
 *   1. process.env.HCS_AUDIT_TOPIC_ID (Vercel dashboard env var)
 *   2. In-memory cache (warm serverless function)
 *   3. Mirror Node discovery (scan blockchain for existing topic)
 *   4. Create new topic (first time only)
 *
 * Once resolved, caches in memory + process.env for the lifetime
 * of the serverless function instance.
 */
export async function ensureAuditTopic(): Promise<string> {
  // 1. Check env var (set in Vercel dashboard or .env.local)
  const envTopic = process.env.HCS_AUDIT_TOPIC_ID;
  if (envTopic) {
    cachedTopicId = envTopic;
    return envTopic;
  }

  // 2. Check in-memory cache (warm invocation)
  if (cachedTopicId) {
    return cachedTopicId;
  }

  // 3. Discover existing topic from the blockchain
  const discovered = await discoverAuditTopic();
  if (discovered) {
    cachedTopicId = discovered;
    process.env.HCS_AUDIT_TOPIC_ID = discovered;
    console.log(`[HCS] Using discovered topic: ${discovered}`);
    return discovered;
  }

  // 4. No existing topic — create new one
  console.log("[HCS] No existing topic found. Creating new audit topic...");
  const newTopic = await createAuditTopic();
  cachedTopicId = newTopic;
  process.env.HCS_AUDIT_TOPIC_ID = newTopic;

  console.log(
    `[HCS] 💡 Optional: add HCS_AUDIT_TOPIC_ID=${newTopic} to Vercel env vars for faster cold starts`
  );
  return newTopic;
}

// ════════════════════════════════════════════
// Message Logging
// ════════════════════════════════════════════

/**
 * Log an agent decision to HCS — immutable, timestamped, on-chain
 */
export async function logDecisionToHCS(
  topicId: string,
  decision: AgentDecisionLog
): Promise<{ sequenceNumber: number; timestamp: string }> {
  const client = getHederaClient();

  const message = JSON.stringify({
    ...decision,
    agent: "VaultMind",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
  });

  const tx = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topicId))
    .setMessage(message);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  console.log(
    `[HCS] Logged decision: ${decision.action} → topic ${topicId} (seq: ${receipt.topicSequenceNumber})`
  );

  return {
    sequenceNumber: receipt.topicSequenceNumber
      ? Number(receipt.topicSequenceNumber)
      : 0,
    timestamp: new Date().toISOString(),
  };
}

// ════════════════════════════════════════════
// Message Reading
// ════════════════════════════════════════════

/**
 * Read all decision history from HCS via Mirror Node REST API
 * This is real on-chain data, not a database
 */
export async function getDecisionHistory(
  topicId: string,
  limit: number = 50
): Promise<AgentDecisionLog[]> {
  const url = `${MIRROR_NODE_BASE}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Mirror node error: ${res.status} ${res.statusText}`);
  }

  const data = await res.json();

  if (!data.messages || data.messages.length === 0) {
    return [];
  }

  return data.messages
    .map((msg: any) => {
      try {
        const decoded = Buffer.from(msg.message, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded) as AgentDecisionLog;
        return {
          ...parsed,
          consensusTimestamp: msg.consensus_timestamp,
          sequenceNumber: msg.sequence_number,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}
