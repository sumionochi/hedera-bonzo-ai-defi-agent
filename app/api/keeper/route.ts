import { NextRequest, NextResponse } from "next/server";
import { runKeeperCycle, type StrategyConfig } from "@/lib/keeper";
import { runMultiAgentCycle, runDCATick } from "@/lib/agents/orchestrator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/keeper — Run a multi-agent keeper cycle (dry-run by default)
 * Query params:
 *   ?execute=true — Actually execute decisions (default: false)
 *   ?mode=full|dca|lend|vault — Which subsystem to run (default: full)
 *
 * The multi-agent pipeline:
 *   Sentinel → Strategist → Auditor → Executor → Auditor
 *
 * DCA plans are automatically checked and executed every cycle.
 */
export async function GET(req: NextRequest) {
  const execute = req.nextUrl.searchParams.get("execute") === "true";
  const mode = req.nextUrl.searchParams.get("mode") || "full";

  try {
    console.log(
      `[API/keeper] Running multi-agent cycle (execute: ${execute}, mode: ${mode})...`
    );

    // DCA-only mode (lightweight, for frequent polling)
    if (mode === "dca") {
      const dcaResult = await runDCATick();
      return NextResponse.json({
        success: true,
        data: {
          mode: "dca",
          dcaExecutions: dcaResult.executed,
          results: dcaResult.results,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Full multi-agent cycle
    const result = await runMultiAgentCycle(undefined, execute);

    return NextResponse.json({
      success: true,
      data: {
        // Strategy decision
        decision: {
          action: result.strategy.actions[0]?.type || "HOLD",
          reason: result.strategy.actions[0]?.reasoning || "No action needed",
          confidence: result.strategy.actions[0]?.confidence || 0.5,
          allActions: result.strategy.actions.map((a) => ({
            type: a.type,
            priority: a.priority,
            confidence: a.confidence,
            description: a.description,
          })),
          overallStrategy: result.strategy.overallStrategy,
          riskAssessment: result.strategy.riskAssessment,
        },

        // Sentinel intelligence
        sentiment: result.intel.sentiment
          ? {
              score: result.intel.sentiment.score,
              signal: result.intel.sentiment.signal,
              confidence: result.intel.sentiment.confidence,
              reasoning: result.intel.sentiment.reasoning,
            }
          : null,
        prices: {
          hbar: result.intel.prices.hbar,
          hbarConfidence: result.intel.prices.hbarConfidence,
          btc: result.intel.prices.btc,
          eth: result.intel.prices.eth,
          hbarx: result.intel.prices.hbarx,
          source: result.intel.prices.source,
        },
        signals: result.intel.signals,

        // Portfolio
        portfolio: result.portfolio
          ? {
              positions: result.portfolio.positions,
              totalSuppliedUSD: result.portfolio.totalSuppliedUSD,
              totalBorrowedUSD: result.portfolio.totalBorrowedUSD,
              netWorthUSD: result.portfolio.netWorthUSD,
              healthFactor: result.portfolio.healthFactor,
              averageNetAPY: result.portfolio.averageNetAPY,
            }
          : null,

        // Vault decision
        vaultDecision:
          result.strategy.actions.find((a) => a.type.startsWith("VAULT_")) ||
          null,

        // Execution results
        executions: result.executions.map((e) => ({
          action: e.action.type,
          success: e.result.success,
          details: e.result.details,
          txIds: e.result.txIds,
          durationMs: e.durationMs,
        })),

        // Audit
        hcsLog: result.auditEntries.find((e) => e.phase === "decision")
          ?.hcsLog || { logged: false },
        riskChecks: result.riskChecks.map((rc) => ({
          action: rc.action.type,
          approved: rc.check.approved,
          warnings: rc.check.warnings,
          blocks: rc.check.blocks,
          riskScore: rc.check.riskScore,
        })),

        // DCA
        dcaExecutions: result.dcaExecutions,

        // Meta
        agentsUsed: result.agentsUsed,
        durationMs: result.durationMs,
        timestamp: result.timestamp,
      },
    });
  } catch (error: any) {
    console.error("[API/keeper] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/keeper — Run keeper with custom strategy config
 * Body: { config?: Partial<StrategyConfig>, execute?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const execute = body.execute === true;
    const customConfig: Partial<StrategyConfig> | undefined = body.config;

    const config: Partial<StrategyConfig> = {
      bearishThreshold: customConfig?.bearishThreshold ?? -30,
      bullishThreshold: customConfig?.bullishThreshold ?? 50,
      confidenceMinimum: customConfig?.confidenceMinimum ?? 0.6,
      healthFactorDanger: customConfig?.healthFactorDanger ?? 1.3,
      healthFactorTarget: customConfig?.healthFactorTarget ?? 1.8,
      highVolatilityThreshold: customConfig?.highVolatilityThreshold ?? 80,
      minYieldDifferential: customConfig?.minYieldDifferential ?? 2.0,
    };

    console.log(
      `[API/keeper] Custom multi-agent cycle (execute: ${execute})`,
      config
    );

    const result = await runMultiAgentCycle(config, execute);

    return NextResponse.json({
      success: true,
      data: {
        decision: {
          action: result.strategy.actions[0]?.type || "HOLD",
          reason: result.strategy.actions[0]?.reasoning || "No action needed",
          confidence: result.strategy.actions[0]?.confidence || 0.5,
          overallStrategy: result.strategy.overallStrategy,
        },
        sentiment: result.intel.sentiment
          ? {
              score: result.intel.sentiment.score,
              signal: result.intel.sentiment.signal,
              confidence: result.intel.sentiment.confidence,
              reasoning: result.intel.sentiment.reasoning,
            }
          : null,
        prices: result.intel.prices,
        signals: result.intel.signals,
        portfolio: result.portfolio,
        executions: result.executions.map((e) => ({
          action: e.action.type,
          success: e.result.success,
          details: e.result.details,
          txIds: e.result.txIds,
        })),
        hcsLog: result.auditEntries[0]?.hcsLog || { logged: false },
        vaultDecision:
          result.strategy.actions.find((a) => a.type.startsWith("VAULT_")) ||
          null,
        dcaExecutions: result.dcaExecutions,
        agentsUsed: result.agentsUsed,
        durationMs: result.durationMs,
        timestamp: result.timestamp,
      },
    });
  } catch (error: any) {
    console.error("[API/keeper] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
