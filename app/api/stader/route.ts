import { NextRequest, NextResponse } from "next/server";
import {
  getStaderData,
  getHbarxBalance,
  stakeHbar,
  executeHbarxStrategy,
  formatStaderInfoForChat,
} from "@/lib/stader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getStaderData();
    return NextResponse.json({
      success: true,
      data: {
        ...data,
        formatted: formatStaderInfoForChat(data),
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, amount, accountId, withBorrow, borrowAmount } = body;

    switch (action) {
      case "stake": {
        if (!amount || amount <= 0) {
          return NextResponse.json(
            { success: false, error: "Amount must be > 0" },
            { status: 400 }
          );
        }
        const result = await stakeHbar(amount);
        const staderData = await getStaderData();
        return NextResponse.json({
          success: true,
          data: {
            result,
            staderData,
            hbarxReceived: amount * staderData.exchangeRate,
            hbarPriceUSD: staderData.hbarPriceUSD,
            hbarxPriceUSD: staderData.hbarxPriceUSD,
            priceSource: staderData.priceSource,
          },
        });
      }
      case "strategy": {
        if (!amount || amount <= 0) {
          return NextResponse.json(
            { success: false, error: "Amount must be > 0" },
            { status: 400 }
          );
        }
        const strategyResult = await executeHbarxStrategy(
          amount,
          withBorrow || false,
          borrowAmount
        );
        return NextResponse.json({ success: true, data: strategyResult });
      }
      case "balance": {
        if (!accountId) {
          return NextResponse.json(
            { success: false, error: "accountId required" },
            { status: 400 }
          );
        }
        const balance = await getHbarxBalance(accountId);
        const staderData = await getStaderData();
        return NextResponse.json({
          success: true,
          data: {
            balance,
            hbarValue: balance / staderData.exchangeRate,
            exchangeRate: staderData.exchangeRate,
            balanceUSD: balance * staderData.hbarxPriceUSD,
            hbarPriceUSD: staderData.hbarPriceUSD,
            priceSource: staderData.priceSource,
          },
        });
      }
      case "info": {
        const data = await getStaderData();
        return NextResponse.json({
          success: true,
          data: {
            ...data,
            formatted: formatStaderInfoForChat(data),
          },
        });
      }
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
