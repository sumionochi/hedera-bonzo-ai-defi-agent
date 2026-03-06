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
 *   ?mode=lend|vault|both — Which keeper to run (default: both)
 */
export async function GET(req: NextRequest) {
  const execute = req.nextUrl.searchParams.get("execute") === "true";
  const mode = req.nextUrl.searchParams.get("mode") || "both";

  try {
    console.log(
      `[API/keeper] Running keeper cycle (execute: ${execute}, mode: ${mode})...`
    );

    // Always run lend keeper
    const lendResult =
      mode !== "vault" ? await runKeeperCycle(undefined, execute) : null;

    // Run vault keeper
    let vaultDecision = null;
    if (mode !== "lend") {
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
        // Lend keeper result
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
        // Vault keeper result
        vaultDecision,
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
      `[API/keeper] Custom keeper cycle (execute: ${execute})`,
      config
    );
    const result = await runKeeperCycle(config, execute);

    return NextResponse.json({
      success: true,
      data: {
        decision: result.decision,
        sentiment: {
          score: result.sentiment.score,
          signal: result.sentiment.signal,
          confidence: result.sentiment.confidence,
          reasoning: result.sentiment.reasoning,
        },
        portfolio: result.portfolio,
        execution: result.execution,
        hcsLog: result.hcsLog,
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
