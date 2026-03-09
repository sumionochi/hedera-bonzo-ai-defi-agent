import { NextRequest, NextResponse } from "next/server";
import {
  createDCAPlan,
  pauseDCAPlan,
  resumeDCAPlan,
  cancelDCAPlan,
  cancelAllDCAPlans,
  getDCASummary,
  executeDueDCAPlans,
  type DCACreateParams,
} from "@/lib/dca";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * GET /api/dca — Get DCA summary (reads from HCS via Mirror Node)
 */
export async function GET() {
  try {
    const summary = await getDCASummary();
    return NextResponse.json({ success: true, data: summary });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[API/dca] GET error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/dca — DCA actions (all write to HCS on-chain)
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case "create": {
        const params: DCACreateParams = body.params;
        if (!params?.asset || !params?.amount || !params?.frequency) {
          return NextResponse.json(
            {
              success: false,
              error: "Missing required params: asset, amount, frequency",
            },
            { status: 400 }
          );
        }
        const result = await createDCAPlan(params);
        return NextResponse.json({
          success: true,
          data: { plan: result, hcsLog: result.hcsLog },
        });
      }

      case "pause": {
        if (!body.planId) {
          return NextResponse.json(
            { success: false, error: "planId required" },
            { status: 400 }
          );
        }
        const result = await pauseDCAPlan(body.planId);
        if (!result) {
          return NextResponse.json(
            { success: false, error: "Plan not found or not active" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: { plan: result, hcsLog: result.hcsLog },
        });
      }

      case "resume": {
        if (!body.planId) {
          return NextResponse.json(
            { success: false, error: "planId required" },
            { status: 400 }
          );
        }
        const result = await resumeDCAPlan(body.planId);
        if (!result) {
          return NextResponse.json(
            { success: false, error: "Plan not found or not paused" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: { plan: result, hcsLog: result.hcsLog },
        });
      }

      case "cancel": {
        if (!body.planId) {
          return NextResponse.json(
            { success: false, error: "planId required" },
            { status: 400 }
          );
        }
        const result = await cancelDCAPlan(body.planId);
        if (!result) {
          return NextResponse.json(
            { success: false, error: "Plan not found" },
            { status: 404 }
          );
        }
        return NextResponse.json({
          success: true,
          data: { plan: result, hcsLog: result.hcsLog },
        });
      }

      case "cancel_all": {
        const result = await cancelAllDCAPlans();
        return NextResponse.json({ success: true, data: result });
      }

      case "execute_due":
      case "execute-due": {
        const hbarPrice = body.hbarPrice || 0;
        const dryRun = body.dryRun === true;
        const executions = await executeDueDCAPlans(hbarPrice, dryRun);
        return NextResponse.json({ success: true, data: { executions } });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[API/dca] POST error:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
