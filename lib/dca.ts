// ============================================
// VaultMind — DCA Scheduler with HCS Persistence
// ============================================
// Event sourcing on Hedera Consensus Service.
// Every DCA operation (create, cancel, pause, resume, execute)
// is an immutable on-chain event. State is reconstructed by
// replaying events from Mirror Node.
//
// ARCHITECTURE:
//   Write: User action → DCA_EVENT JSON → HCS TopicMessageSubmit → on-chain
//   Read:  Mirror Node → filter DCA_EVENT → replay events → reconstruct state
//   Cache: In-memory with 10s TTL + optimistic updates after writes
// ============================================

import { TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";
import { getHederaClient, getOperatorAccountId } from "./hedera";
import { executeDeposit, type ExecutionResult } from "./bonzo-execute";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type DCAFrequency =
  | "hourly"
  | "daily"
  | "weekly"
  | "biweekly"
  | "monthly";
export type DCAStatus =
  | "active"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export interface DCAPlan {
  id: string;
  asset: string;
  amount: number;
  frequency: DCAFrequency;
  action: "bonzo_supply" | "stader_stake" | "wallet_hold";
  status: DCAStatus;
  createdAt: string;
  nextExecutionAt: string;
  maxExecutions?: number;
  totalBudget?: number;
  executionCount: number;
  totalDeposited: number;
  totalSpentUSD: number;
  history: DCAExecution[];
  consecutiveFailures: number;
  lastError?: string;
}

export interface DCAExecution {
  timestamp: string;
  amount: number;
  asset: string;
  priceUSD: number;
  totalValueUSD: number;
  txId?: string;
  status: "success" | "failed" | "skipped";
  reason?: string;
}

export interface DCACreateParams {
  asset: string;
  amount: number;
  frequency: DCAFrequency;
  action?: "bonzo_supply" | "stader_stake" | "wallet_hold";
  maxExecutions?: number;
  totalBudget?: number;
}

export interface DCASummary {
  activePlans: number;
  totalPlans: number;
  plans: DCAPlan[];
  nextExecution: string | null;
  totalDeposited: Record<string, number>;
  estimatedMonthlyDeposit: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════
// HCS Event Types
// ═══════════════════════════════════════════════════════════

type DCAEventType =
  | "DCA_CREATE"
  | "DCA_CANCEL"
  | "DCA_PAUSE"
  | "DCA_RESUME"
  | "DCA_EXECUTE"
  | "DCA_COMPLETE";

interface DCAEvent {
  type: "DCA_EVENT";
  event: DCAEventType;
  planId: string;
  timestamp: string;
  agent: "vaultmind";
  version: "1.0";
  data: Record<string, unknown>;
}

// Mirror Node response types
interface MirrorMessage {
  message: string;
  consensus_timestamp: string;
  sequence_number: number;
}

interface MirrorTopicResponse {
  messages: MirrorMessage[];
  links: { next: string | null };
}

// ═══════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════

const MIRROR_NODE_BASE =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://mainnet.mirrornode.hedera.com"
    : "https://testnet.mirrornode.hedera.com";

const FREQ_MS: Record<DCAFrequency, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

function nextExecutionTime(freq: DCAFrequency, from?: Date): string {
  const base = from || new Date();
  return new Date(base.getTime() + FREQ_MS[freq]).toISOString();
}

function executionsPerMonth(freq: DCAFrequency): number {
  return { hourly: 720, daily: 30, weekly: 4.3, biweekly: 2.15, monthly: 1 }[
    freq
  ];
}

function getAuditTopicId(): string {
  return (
    process.env.HCS_AUDIT_TOPIC_ID ||
    process.env.NEXT_PUBLIC_HCS_TOPIC_ID ||
    "0.0.7984171"
  );
}

// ═══════════════════════════════════════════════════════════
// HCS Write — Submit DCA events on-chain
// ═══════════════════════════════════════════════════════════

async function submitDCAEvent(event: DCAEvent): Promise<{
  logged: boolean;
  sequenceNumber?: number;
  error?: string;
}> {
  try {
    const client = getHederaClient();
    const topicId = getAuditTopicId();
    const message = JSON.stringify(event);

    console.log(
      `[DCA/HCS] Submitting ${event.event} for plan ${event.planId}...`
    );

    const tx = new TopicMessageSubmitTransaction()
      .setTopicId(TopicId.fromString(topicId))
      .setMessage(message);

    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const seq = receipt.topicSequenceNumber?.toNumber();

    console.log(`[DCA/HCS] ✅ ${event.event} → topic ${topicId} (seq: ${seq})`);
    return { logged: true, sequenceNumber: seq };
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(`[DCA/HCS] ⚠️ Submit failed: ${errMsg.substring(0, 80)}`);
    return { logged: false, error: errMsg };
  }
}

// ═══════════════════════════════════════════════════════════
// HCS Read — Query Mirror Node & Reconstruct State
// ═══════════════════════════════════════════════════════════

let cachedPlans: Map<string, DCAPlan> = new Map();
let cacheTimestamp = 0;
const CACHE_TTL_MS = 10_000;

async function loadPlansFromHCS(): Promise<Map<string, DCAPlan>> {
  const now = Date.now();
  if (now - cacheTimestamp < CACHE_TTL_MS && cacheTimestamp > 0) {
    return cachedPlans;
  }

  const topicId = getAuditTopicId();
  const plans = new Map<string, DCAPlan>();

  try {
    let url:
      | string
      | null = `${MIRROR_NODE_BASE}/api/v1/topics/${topicId}/messages?limit=100&order=asc`;
    const allMessages: MirrorMessage[] = [];

    while (url) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const response: Response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        console.warn(`[DCA/HCS] Mirror Node ${response.status}`);
        break;
      }

      const data: MirrorTopicResponse =
        (await response.json()) as MirrorTopicResponse;
      if (data.messages) allMessages.push(...data.messages);

      url = data.links?.next ? `${MIRROR_NODE_BASE}${data.links.next}` : null;
      if (allMessages.length > 500) break;
    }

    console.log(
      `[DCA/HCS] Loaded ${allMessages.length} messages from topic ${topicId}`
    );

    for (const msg of allMessages) {
      try {
        const decoded = Buffer.from(msg.message, "base64").toString("utf-8");
        const parsed = JSON.parse(decoded);
        if (parsed.type !== "DCA_EVENT") continue;
        replayEvent(plans, parsed as DCAEvent);
      } catch {
        continue;
      }
    }

    cachedPlans = plans;
    cacheTimestamp = now;
    console.log(
      `[DCA/HCS] Reconstructed ${plans.size} DCA plan(s) from HCS events`
    );
    return plans;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.warn(
      `[DCA/HCS] Mirror Node query failed: ${errMsg.substring(0, 80)}`
    );
    return cachedPlans.size > 0 ? cachedPlans : plans;
  }
}

function replayEvent(plans: Map<string, DCAPlan>, event: DCAEvent): void {
  const d = event.data;
  switch (event.event) {
    case "DCA_CREATE": {
      plans.set(event.planId, {
        id: event.planId,
        asset: (d.asset as string) || "HBAR",
        amount: (d.amount as number) || 0,
        frequency: (d.frequency as DCAFrequency) || "daily",
        action: (d.action as DCAPlan["action"]) || "bonzo_supply",
        status: "active",
        createdAt: event.timestamp,
        nextExecutionAt:
          (d.nextExecutionAt as string) ||
          nextExecutionTime((d.frequency as DCAFrequency) || "daily"),
        maxExecutions: d.maxExecutions as number | undefined,
        totalBudget: d.totalBudget as number | undefined,
        executionCount: 0,
        totalDeposited: 0,
        totalSpentUSD: 0,
        history: [],
        consecutiveFailures: 0,
      });
      break;
    }
    case "DCA_CANCEL": {
      const p = plans.get(event.planId);
      if (p) p.status = "cancelled";
      break;
    }
    case "DCA_PAUSE": {
      const p = plans.get(event.planId);
      if (p) p.status = "paused";
      break;
    }
    case "DCA_RESUME": {
      const p = plans.get(event.planId);
      if (p) {
        p.status = "active";
        p.nextExecutionAt =
          (d.nextExecutionAt as string) || nextExecutionTime(p.frequency);
        p.consecutiveFailures = 0;
      }
      break;
    }
    case "DCA_EXECUTE": {
      const p = plans.get(event.planId);
      if (p) {
        p.executionCount++;
        const s = d.execStatus as string;
        if (s === "success") {
          p.totalDeposited += (d.amount as number) || 0;
          p.totalSpentUSD += (d.totalValueUSD as number) || 0;
          p.consecutiveFailures = 0;
        } else {
          p.consecutiveFailures++;
          p.lastError = d.error as string;
        }
        p.nextExecutionAt =
          (d.nextExecutionAt as string) || nextExecutionTime(p.frequency);
        p.history.push({
          timestamp: event.timestamp,
          amount: (d.amount as number) || 0,
          asset: p.asset,
          priceUSD: (d.priceUSD as number) || 0,
          totalValueUSD: (d.totalValueUSD as number) || 0,
          txId: d.txId as string | undefined,
          status: s as "success" | "failed" | "skipped",
          reason: d.reason as string | undefined,
        });
        if (p.history.length > 50) p.history = p.history.slice(-50);
        if (p.consecutiveFailures >= 3) p.status = "paused";
      }
      break;
    }
    case "DCA_COMPLETE": {
      const p = plans.get(event.planId);
      if (p) p.status = "completed";
      break;
    }
  }
}

function optimisticUpdate(event: DCAEvent): void {
  replayEvent(cachedPlans, event);
  cacheTimestamp = Date.now();
}

// ═══════════════════════════════════════════════════════════
// CRUD Operations — HCS-Backed
// ═══════════════════════════════════════════════════════════

let planCounter = 0;

export async function createDCAPlan(
  params: DCACreateParams
): Promise<DCAPlan & { hcsLog: { logged: boolean; sequenceNumber?: number } }> {
  planCounter++;
  const id = `dca-${planCounter}-${Date.now()}`;
  const now = new Date();
  const event: DCAEvent = {
    type: "DCA_EVENT",
    event: "DCA_CREATE",
    planId: id,
    timestamp: now.toISOString(),
    agent: "vaultmind",
    version: "1.0",
    data: {
      asset: params.asset.toUpperCase(),
      amount: params.amount,
      frequency: params.frequency,
      action: params.action || "bonzo_supply",
      nextExecutionAt: nextExecutionTime(params.frequency, now),
      maxExecutions: params.maxExecutions,
      totalBudget: params.totalBudget,
    },
  };
  const hcsResult = await submitDCAEvent(event);
  optimisticUpdate(event);
  const plan = cachedPlans.get(id)!;
  console.log(
    `[DCA] ✅ Created plan ${id}: ${params.amount} ${params.asset} ${
      params.frequency
    } → ${plan.action} [HCS: ${
      hcsResult.logged ? `seq ${hcsResult.sequenceNumber}` : "failed"
    }]`
  );
  return { ...plan, hcsLog: hcsResult };
}

export async function pauseDCAPlan(
  planId: string
): Promise<(DCAPlan & { hcsLog: { logged: boolean } }) | null> {
  const plans = await loadPlansFromHCS();
  const plan = plans.get(planId);
  if (!plan || plan.status !== "active") return null;
  const event: DCAEvent = {
    type: "DCA_EVENT",
    event: "DCA_PAUSE",
    planId,
    timestamp: new Date().toISOString(),
    agent: "vaultmind",
    version: "1.0",
    data: {},
  };
  const hcsResult = await submitDCAEvent(event);
  optimisticUpdate(event);
  return { ...cachedPlans.get(planId)!, hcsLog: hcsResult };
}

export async function resumeDCAPlan(
  planId: string
): Promise<(DCAPlan & { hcsLog: { logged: boolean } }) | null> {
  const plans = await loadPlansFromHCS();
  const plan = plans.get(planId);
  if (!plan || plan.status !== "paused") return null;
  const event: DCAEvent = {
    type: "DCA_EVENT",
    event: "DCA_RESUME",
    planId,
    timestamp: new Date().toISOString(),
    agent: "vaultmind",
    version: "1.0",
    data: { nextExecutionAt: nextExecutionTime(plan.frequency) },
  };
  const hcsResult = await submitDCAEvent(event);
  optimisticUpdate(event);
  return { ...cachedPlans.get(planId)!, hcsLog: hcsResult };
}

export async function cancelDCAPlan(
  planId: string
): Promise<(DCAPlan & { hcsLog: { logged: boolean } }) | null> {
  const plans = await loadPlansFromHCS();
  const plan = plans.get(planId);
  if (!plan) return null;
  const event: DCAEvent = {
    type: "DCA_EVENT",
    event: "DCA_CANCEL",
    planId,
    timestamp: new Date().toISOString(),
    agent: "vaultmind",
    version: "1.0",
    data: {},
  };
  const hcsResult = await submitDCAEvent(event);
  optimisticUpdate(event);
  return { ...cachedPlans.get(planId)!, hcsLog: hcsResult };
}

export async function cancelAllDCAPlans(): Promise<{
  cancelled: number;
  hcsLogged: number;
}> {
  const plans = await loadPlansFromHCS();
  let cancelled = 0;
  let hcsLogged = 0;
  const entries = Array.from(plans.entries());
  for (const [id, plan] of entries) {
    if (plan.status === "active" || plan.status === "paused") {
      const event: DCAEvent = {
        type: "DCA_EVENT",
        event: "DCA_CANCEL",
        planId: id,
        timestamp: new Date().toISOString(),
        agent: "vaultmind",
        version: "1.0",
        data: {},
      };
      const result = await submitDCAEvent(event);
      optimisticUpdate(event);
      cancelled++;
      if (result.logged) hcsLogged++;
    }
  }
  return { cancelled, hcsLogged };
}

// ═══════════════════════════════════════════════════════════
// Read Operations
// ═══════════════════════════════════════════════════════════

export async function getDCAPlan(planId: string): Promise<DCAPlan | null> {
  const plans = await loadPlansFromHCS();
  return plans.get(planId) || null;
}

export async function getAllDCAPlans(): Promise<DCAPlan[]> {
  const plans = await loadPlansFromHCS();
  return Array.from(plans.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function getDCASummary(): Promise<DCASummary> {
  const plans = await getAllDCAPlans();
  const activePlans = plans.filter((p) => p.status === "active");
  const totalDeposited: Record<string, number> = {};
  const estimatedMonthly: Record<string, number> = {};

  for (const plan of plans) {
    if (plan.totalDeposited > 0) {
      totalDeposited[plan.asset] =
        (totalDeposited[plan.asset] || 0) + plan.totalDeposited;
    }
  }
  for (const plan of activePlans) {
    estimatedMonthly[plan.asset] =
      (estimatedMonthly[plan.asset] || 0) +
      plan.amount * executionsPerMonth(plan.frequency);
  }

  let nextExecution: string | null = null;
  for (const plan of activePlans) {
    if (!nextExecution || plan.nextExecutionAt < nextExecution) {
      nextExecution = plan.nextExecutionAt;
    }
  }

  return {
    activePlans: activePlans.length,
    totalPlans: plans.length,
    plans,
    nextExecution,
    totalDeposited,
    estimatedMonthlyDeposit: estimatedMonthly,
  };
}

// ═══════════════════════════════════════════════════════════
// Execution Engine
// ═══════════════════════════════════════════════════════════

export async function executeDueDCAPlans(
  currentHbarPrice: number = 0,
  dryRun: boolean = false
): Promise<DCAExecution[]> {
  const now = new Date();
  const plans = await loadPlansFromHCS();
  const executions: DCAExecution[] = [];
  const planEntries = Array.from(plans.values());

  for (const plan of planEntries) {
    if (plan.status !== "active") continue;
    if (now < new Date(plan.nextExecutionAt)) continue;

    // Check limits
    if (plan.maxExecutions && plan.executionCount >= plan.maxExecutions) {
      const e: DCAEvent = {
        type: "DCA_EVENT",
        event: "DCA_COMPLETE",
        planId: plan.id,
        timestamp: now.toISOString(),
        agent: "vaultmind",
        version: "1.0",
        data: { reason: `Reached ${plan.maxExecutions} executions` },
      };
      await submitDCAEvent(e);
      optimisticUpdate(e);
      continue;
    }
    if (plan.totalBudget && plan.totalDeposited >= plan.totalBudget) {
      const e: DCAEvent = {
        type: "DCA_EVENT",
        event: "DCA_COMPLETE",
        planId: plan.id,
        timestamp: now.toISOString(),
        agent: "vaultmind",
        version: "1.0",
        data: { reason: `Reached budget` },
      };
      await submitDCAEvent(e);
      optimisticUpdate(e);
      continue;
    }

    let execAmount = plan.amount;
    if (plan.totalBudget)
      execAmount = Math.min(execAmount, plan.totalBudget - plan.totalDeposited);
    const priceUSD =
      plan.asset === "HBAR"
        ? currentHbarPrice
        : plan.asset === "USDC"
        ? 1.0
        : currentHbarPrice * 0.95;

    const execution: DCAExecution = {
      timestamp: now.toISOString(),
      amount: execAmount,
      asset: plan.asset,
      priceUSD,
      totalValueUSD: execAmount * priceUSD,
      status: "success",
    };

    if (dryRun) {
      execution.status = "skipped";
      execution.reason = "Dry run";
      executions.push(execution);
      continue;
    }

    // Execute actual deposit
    try {
      console.log(
        `[DCA] 🔄 Executing: ${execAmount} ${plan.asset} → ${plan.action}`
      );

      if (plan.action === "bonzo_supply" || plan.action === "stader_stake") {
        // executeDeposit(tokenSymbol, amount)
        const result: ExecutionResult = await executeDeposit(
          plan.asset,
          execAmount
        );
        if (result.success) {
          execution.txId = result.txIds?.[0];
          execution.status = "success";
        } else {
          execution.status = "failed";
          execution.reason = result.error || result.details;
        }
      } else {
        // wallet_hold — no deposit needed, just track
        execution.status = "success";
        execution.reason = `Held ${execAmount} ${plan.asset} in wallet`;
      }
    } catch (err: unknown) {
      execution.status = "failed";
      execution.reason = err instanceof Error ? err.message : String(err);
    }

    // Log execution to HCS
    const execEvent: DCAEvent = {
      type: "DCA_EVENT",
      event: "DCA_EXECUTE",
      planId: plan.id,
      timestamp: now.toISOString(),
      agent: "vaultmind",
      version: "1.0",
      data: {
        amount: execAmount,
        priceUSD,
        totalValueUSD: execution.totalValueUSD,
        execStatus: execution.status,
        txId: execution.txId,
        error: execution.reason,
        nextExecutionAt: nextExecutionTime(plan.frequency, now),
      },
    };
    await submitDCAEvent(execEvent);
    optimisticUpdate(execEvent);
    executions.push(execution);
  }

  if (executions.length > 0) {
    console.log(`[DCA] 📊 Executed ${executions.length} DCA plan(s)`);
  }
  return executions;
}

// ═══════════════════════════════════════════════════════════
// Chat Command Parser
// ═══════════════════════════════════════════════════════════

export interface DCAIntent {
  action:
    | "create"
    | "pause"
    | "resume"
    | "cancel"
    | "cancel_all"
    | "status"
    | "show";
  params?: DCACreateParams;
  planId?: string;
}

export function parseDCAIntent(message: string): DCAIntent | null {
  const lower = message.toLowerCase().trim();

  if (
    lower.includes("dca status") ||
    lower.includes("show dca") ||
    lower.includes("my dca") ||
    lower.includes("dca plans") ||
    lower.includes("dca schedule")
  ) {
    return { action: "show" };
  }
  if (
    lower.includes("cancel all dca") ||
    lower.includes("stop all dca") ||
    lower.includes("remove all dca")
  ) {
    return { action: "cancel_all" };
  }
  if (
    lower.includes("cancel dca") ||
    lower.includes("stop dca") ||
    lower.includes("remove dca")
  ) {
    const m = lower.match(/dca[- ](\d+)/);
    return { action: "cancel", planId: m ? `dca-${m[1]}` : undefined };
  }
  if (lower.includes("pause dca")) {
    const m = lower.match(/dca[- ](\d+)/);
    return { action: "pause", planId: m ? `dca-${m[1]}` : undefined };
  }
  if (lower.includes("resume dca") || lower.includes("unpause dca")) {
    const m = lower.match(/dca[- ](\d+)/);
    return { action: "resume", planId: m ? `dca-${m[1]}` : undefined };
  }

  const dcaMatch = lower.match(
    /(?:dca|dollar cost average?|auto[- ]?(?:deposit|invest|buy))\s+(\d+\.?\d*)\s+(\w+)\s+(?:every\s+)?(\w+)/i
  );
  if (dcaMatch) {
    const amount = parseFloat(dcaMatch[1]);
    const asset = dcaMatch[2].toUpperCase();
    const fw = dcaMatch[3].toLowerCase();
    let frequency: DCAFrequency = "daily";
    if (fw.includes("hour")) frequency = "hourly";
    else if (fw.includes("week") && !fw.includes("bi")) frequency = "weekly";
    else if (fw.includes("bi") || fw.includes("fortnight"))
      frequency = "biweekly";
    else if (fw.includes("month")) frequency = "monthly";

    let action: "bonzo_supply" | "stader_stake" | "wallet_hold" =
      "bonzo_supply";
    if (lower.includes("stader") || lower.includes("stake"))
      action = "stader_stake";
    if (lower.includes("hold") || lower.includes("wallet"))
      action = "wallet_hold";

    const bm = lower.match(/(?:up to|max|budget|limit)\s+(\d+\.?\d*)/);
    const cm = lower.match(/(?:for|times|executions?)\s+(\d+)/);

    return {
      action: "create",
      params: {
        asset,
        amount,
        frequency,
        action,
        maxExecutions: cm ? parseInt(cm[1]) : undefined,
        totalBudget: bm ? parseFloat(bm[1]) : undefined,
      },
    };
  }

  if (
    lower.includes("dca") &&
    (lower.includes("start") ||
      lower.includes("set") ||
      lower.includes("begin"))
  ) {
    return { action: "show" };
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// Formatting Helpers
// ═══════════════════════════════════════════════════════════

export function formatDCAPlanForChat(plan: DCAPlan): string {
  const emoji: Record<DCAStatus, string> = {
    active: "🟢",
    paused: "⏸️",
    completed: "✅",
    failed: "❌",
    cancelled: "🚫",
  };
  const labels: Record<string, string> = {
    bonzo_supply: "Bonzo Lend Supply",
    stader_stake: "Stader HBARX Stake",
    wallet_hold: "Hold in Wallet",
  };
  const freq: Record<DCAFrequency, string> = {
    hourly: "every hour",
    daily: "every day",
    weekly: "every week",
    biweekly: "every 2 weeks",
    monthly: "every month",
  };
  const next =
    plan.status === "active"
      ? `Next: ${new Date(plan.nextExecutionAt).toLocaleString()}`
      : `Status: ${plan.status}`;

  return (
    `${emoji[plan.status]} **${plan.amount} ${plan.asset} ${
      freq[plan.frequency]
    }** → ${labels[plan.action]}\n` +
    `   Executed: ${
      plan.executionCount
    }x | Total: ${plan.totalDeposited.toFixed(2)} ${
      plan.asset
    } (~$${plan.totalSpentUSD.toFixed(2)})\n` +
    `   ${next}` +
    (plan.lastError ? `\n   ⚠️ Last error: ${plan.lastError}` : "")
  );
}

export function formatDCASummaryForChat(summary: DCASummary): string {
  if (summary.totalPlans === 0) {
    return '📅 **No DCA plans configured.**\n\nSet one up: "DCA 50 HBAR daily" or "DCA 100 USDC weekly into Bonzo"';
  }
  const parts = [
    `📅 **DCA Plans** — ${summary.activePlans} active / ${summary.totalPlans} total\n`,
  ];
  for (const plan of summary.plans) parts.push(formatDCAPlanForChat(plan));
  if (summary.nextExecution) {
    parts.push(
      `\n⏰ Next execution: ${new Date(summary.nextExecution).toLocaleString()}`
    );
  }
  const monthlyEntries = Object.entries(summary.estimatedMonthlyDeposit);
  if (monthlyEntries.length > 0) {
    parts.push(
      `📊 Est. monthly: ${monthlyEntries
        .map(([a, n]) => `${(n as number).toFixed(0)} ${a}`)
        .join(", ")}`
    );
  }
  parts.push(
    `\n🔗 _All DCA plans stored on-chain via HCS (topic ${getAuditTopicId()})_`
  );
  return parts.join("\n");
}
