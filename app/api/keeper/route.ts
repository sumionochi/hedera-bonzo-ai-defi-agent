import { NextRequest, NextResponse } from "next/server";
import { runKeeperCycle, type StrategyConfig } from "@/lib/keeper";
import {
  getVaultsWithLiveData,
  makeVaultDecision,
  type VaultKeeperContext,
} from "@/lib/bonzo-vaults";
import { analyzeSentiment } from "@/lib/sentiment";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/keeper — Run a keeper cycle (dry-run by default)
 * Query params:
 *   ?execute=true — Actually execute the decision (default: false)
 *   ?mode=lend|vault|full — Which keeper to run (default: full)
 */
export async function GET(req: NextRequest) {
  const execute = req.nextUrl.searchParams.get("execute") === "true";
  const mode = req.nextUrl.searchParams.get("mode") || "full";

  try {
    console.log(
      `[API/keeper] Running multi-agent cycle (execute: ${execute}, mode: ${mode})...`
    );

    // Run the multi-agent keeper cycle
    const lendResult =
      mode !== "vault" ? await runKeeperCycle(undefined, execute) : null;

    // Run vault keeper separately if needed
    let vaultDecision = lendResult?.vaultDecision || null;
    if (!vaultDecision && mode !== "lend") {
      try {
        const [vaults, sentiment] = await Promise.all([
          getVaultsWithLiveData(),
          analyzeSentiment(),
        ]);
        const ctx: VaultKeeperContext = {
          vaults,
          sentimentScore: sentiment.score,
          volatility: sentiment.dataPoints.volatility,
          hbarPrice: sentiment.dataPoints.hbarPrice,
          fearGreedIndex: sentiment.dataPoints.fearGreedValue,
          userHbarBalance: 1000,
          userPositions: [],
        };
        vaultDecision = makeVaultDecision(ctx);
      } catch (e: any) {
        console.warn("[API/keeper] Vault decision error:", e.message);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        decision: lendResult?.decision || null,
        sentiment: lendResult
          ? {
              score: lendResult.sentiment.score,
              signal: lendResult.sentiment.signal,
              confidence: lendResult.sentiment.confidence,
              reasoning: lendResult.sentiment.reasoning,
            }
          : null,
        portfolio: lendResult?.portfolio
          ? {
              positions: lendResult.portfolio.positions,
              totalSuppliedUSD: lendResult.portfolio.totalSuppliedUSD,
              totalBorrowedUSD: lendResult.portfolio.totalBorrowedUSD,
              netWorthUSD: lendResult.portfolio.netWorthUSD,
              healthFactor: lendResult.portfolio.healthFactor,
              averageNetAPY: lendResult.portfolio.averageNetAPY,
            }
          : null,
        execution: lendResult?.execution || null,
        hcsLog: lendResult?.hcsLog || null,
        evmAudit: lendResult?.evmAudit || null,
        vksReward: lendResult?.vksReward || null,
        vaultDecision,
        agentsUsed: lendResult?.agentsUsed || [],
        dcaExecutions: lendResult?.dcaExecutions || 0,
        durationMs: lendResult?.durationMs || 0,
        timestamp: lendResult?.timestamp || new Date().toISOString(),
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

    const config: StrategyConfig = {
      bearishThreshold: customConfig?.bearishThreshold ?? -30,
      bullishThreshold: customConfig?.bullishThreshold ?? 50,
      confidenceMinimum: customConfig?.confidenceMinimum ?? 0.6,
      healthFactorDanger: customConfig?.healthFactorDanger ?? 1.3,
      healthFactorTarget: customConfig?.healthFactorTarget ?? 1.8,
      highVolatilityThreshold: customConfig?.highVolatilityThreshold ?? 80,
      minYieldDifferential: customConfig?.minYieldDifferential ?? 2.0,
    };

    console.log(
      `[API/keeper] Running multi-agent cycle (execute: ${execute}, mode: full)...`
    );

    // Run both keepers in parallel
    const [lendResult, vaultResult] = await Promise.all([
      runKeeperCycle(config, execute),
      (async () => {
        try {
          const [vaults, sentiment] = await Promise.all([
            getVaultsWithLiveData(),
            analyzeSentiment(),
          ]);
          const ctx: VaultKeeperContext = {
            vaults,
            sentimentScore: sentiment.score,
            volatility: sentiment.dataPoints.volatility,
            hbarPrice: sentiment.dataPoints.hbarPrice,
            fearGreedIndex: sentiment.dataPoints.fearGreedValue,
            userHbarBalance: 1000,
            userPositions: [],
          };
          return makeVaultDecision(ctx);
        } catch (e: any) {
          console.warn("[API/keeper] Vault decision error:", e.message);
          return null;
        }
      })(),
    ]);

    // Use multi-agent vault decision if available, fallback to standalone
    const vaultDecision = lendResult.vaultDecision || vaultResult;

    return NextResponse.json({
      success: true,
      data: {
        decision: lendResult.decision,
        sentiment: {
          score: lendResult.sentiment.score,
          signal: lendResult.sentiment.signal,
          confidence: lendResult.sentiment.confidence,
          reasoning: lendResult.sentiment.reasoning,
        },
        portfolio: lendResult.portfolio,
        execution: lendResult.execution,
        hcsLog: lendResult.hcsLog,
        evmAudit: lendResult.evmAudit,
        vksReward: lendResult.vksReward,
        vaultDecision,
        agentsUsed: lendResult.agentsUsed || [],
        dcaExecutions: lendResult.dcaExecutions || 0,
        durationMs: lendResult.durationMs,
        timestamp: lendResult.timestamp,
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
