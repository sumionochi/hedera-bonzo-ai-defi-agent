// ============================================
// HCS Audit Logger - Real Hedera Consensus Service
// Every agent decision logged immutably on-chain
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

/**
 * Create a new HCS topic for the user's audit log
 * Call this once per user, then save the topic ID
 */
export async function createAuditTopic(): Promise<string> {
  const client = getHederaClient();

  const tx = new TopicCreateTransaction()
    .setTopicMemo("VaultMind AI Keeper Audit Log")
    .setSubmitKey(client.operatorPublicKey!);

  const response = await tx.execute(client);
  const receipt = await response.getReceipt(client);

  if (!receipt.topicId) {
    throw new Error("Failed to create HCS audit topic");
  }

  const topicId = receipt.topicId.toString();
  console.log(`[HCS] Created audit topic: ${topicId}`);
  return topicId;
}

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

/**
 * Read all decision history from HCS via Mirror Node REST API
 * This is real on-chain data, not a database
 */
export async function getDecisionHistory(
  topicId: string,
  limit: number = 50
): Promise<AgentDecisionLog[]> {
  const url = `${MIRROR_NODE_BASE}/api/v1/topics/${topicId}/messages?limit=${limit}&order=desc`;

  const res = await fetch(url);
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
          // Overwrite timestamp with consensus timestamp from Hedera
          consensusTimestamp: msg.consensus_timestamp,
          sequenceNumber: msg.sequence_number,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

/**
 * Get or create the audit topic
 * Checks env var first, creates new topic if none exists
 */
export async function ensureAuditTopic(): Promise<string> {
  const existingTopic = process.env.HCS_AUDIT_TOPIC_ID;
  if (existingTopic) {
    return existingTopic;
  }

  console.log("[HCS] No audit topic found, creating new one...");
  const topicId = await createAuditTopic();
  console.log(
    `[HCS] ⚠️  Save this to your .env.local: HCS_AUDIT_TOPIC_ID=${topicId}`
  );
  return topicId;
}
