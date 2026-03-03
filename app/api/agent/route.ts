import { NextRequest, NextResponse } from "next/server";
import { chat } from "@/lib/agent";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, threadId } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { success: false, error: "Message is required" },
        { status: 400 }
      );
    }

    if (!process.env.HEDERA_ACCOUNT_ID || !process.env.HEDERA_PRIVATE_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hedera credentials not configured. Set HEDERA_ACCOUNT_ID and HEDERA_PRIVATE_KEY in .env.local",
        },
        { status: 500 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error:
            "OpenAI API key not configured. Set OPENAI_API_KEY in .env.local",
        },
        { status: 500 }
      );
    }

    console.log(`[Agent] User message: "${message.substring(0, 100)}..."`);

    const result = await chat(message, threadId || "default");

    console.log(
      `[Agent] Response: "${result.response.substring(0, 100)}..." (${result.toolCalls.length} tool calls)`
    );

    return NextResponse.json({
      success: true,
      data: {
        response: result.response,
        toolCalls: result.toolCalls,
        threadId: threadId || "default",
      },
    });
  } catch (error: any) {
    console.error("[API/agent] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Agent error",
      },
      { status: 500 }
    );
  }
}
