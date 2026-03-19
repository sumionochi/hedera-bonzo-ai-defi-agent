// ============================================
// VaultMind — Multi-Agent System
// ============================================
// Architecture:
//   Sentinel  → Market intelligence (Pyth, sentiment, Bonzo markets)
//   Strategist → Decision engine (produces action plans)
//   Executor  → Transaction runner (on-chain execution)
//   Auditor   → Compliance (HCS logging, risk checks)
//   Orchestrator → Coordinates all agents in a pipeline
// ============================================

export {
  gatherMarketIntelligence,
  quickPriceCheck,
  type MarketIntelligence,
  type MarketSignals,
} from "./sentinel-agent";

export {
  formulateStrategy,
  type StrategyPlan,
  type StrategyAction,
  type ActionType,
} from "./strategist-agent";

export {
  executeAction,
  executePlan,
  type ExecutionReport,
} from "./executor-agent";

export {
  preFlightCheck,
  logStrategyDecision,
  logExecutionResult,
  getAuditHistory,
  type AuditEntry,
  type RiskCheckResult,
} from "./auditor-agent";

export {
  runMultiAgentCycle,
  runDCATick,
  type OrchestratorCycleResult,
} from "./orchestrator";
