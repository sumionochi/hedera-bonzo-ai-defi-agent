import { NextRequest, NextResponse } from "next/server";
import { runKeeperCycle, type StrategyConfig } from "@/lib/keeper";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // keeper cycle can take time

/**
 * GET /api/keeper — Run a keeper cycle (dry-run by default)
 * Query params:
 *   ?execute=true — Actually execute the decision (default: false)
 */
export async function GET(req: NextRequest) {
  const execute = req.nextUrl.searchParams.get("execute") === "true";

  try {
    console.log(`[API/keeper] Running keeper cycle (execute: ${execute})...`);
    const result = await runKeeperCycle(undefined, execute);

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
