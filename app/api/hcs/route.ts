import { NextRequest, NextResponse } from "next/server";
import { getDecisionHistory, ensureAuditTopic } from "@/lib/hcs";

export async function GET(req: NextRequest) {
  try {
    const topicId = req.nextUrl.searchParams.get("topicId");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

    if (!topicId) {
      return NextResponse.json(
        { success: false, error: "topicId query parameter is required" },
        { status: 400 }
      );
    }

    const decisions = await getDecisionHistory(topicId, limit);

    return NextResponse.json({
      success: true,
      data: {
        topicId,
        decisions,
        count: decisions.length,
      },
    });
  } catch (error: any) {
    console.error("[API/hcs] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

// POST to create a new audit topic or log a decision
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;

    if (action === "create-topic") {
      const topicId = await ensureAuditTopic();
      return NextResponse.json({
        success: true,
        data: { topicId },
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action" },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("[API/hcs] Error:", error.message);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
