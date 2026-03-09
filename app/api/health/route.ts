import { NextRequest, NextResponse } from "next/server";
import {
  updateHealthMonitor,
  getHealthMonitorState,
  setHealthThresholds,
  dismissAlert,
  shouldProactivelyWarn,
  getHealthMonitorUIData,
  formatHealthForChat,
} from "@/lib/health-monitor";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const format = searchParams.get("format");

    if (format === "ui") {
      return NextResponse.json({
        success: true,
        data: getHealthMonitorUIData(),
      });
    }
    if (format === "chat") {
      const state = getHealthMonitorState();
      return NextResponse.json({
        success: true,
        data: {
          formatted: formatHealthForChat(state),
          level: state.level,
          healthFactor: state.healthFactor,
          proactiveAlert: shouldProactivelyWarn(),
        },
      });
    }
    return NextResponse.json({ success: true, data: getHealthMonitorState() });
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
    const { action, portfolioData, hbarPrice, thresholds, alertId } = body;

    switch (action) {
      case "update": {
        await updateHealthMonitor(portfolioData, hbarPrice);
        return NextResponse.json({
          success: true,
          data: {
            state: getHealthMonitorUIData(),
            proactiveAlert: shouldProactivelyWarn(),
          },
        });
      }
      case "set_thresholds": {
        if (!thresholds) {
          return NextResponse.json(
            { success: false, error: "thresholds object required" },
            { status: 400 }
          );
        }
        return NextResponse.json({
          success: true,
          data: { thresholds: setHealthThresholds(thresholds) },
        });
      }
      case "dismiss_alert": {
        if (!alertId) {
          return NextResponse.json(
            { success: false, error: "alertId required" },
            { status: 400 }
          );
        }
        dismissAlert(alertId);
        return NextResponse.json({ success: true });
      }
      case "check_warning": {
        const alert = shouldProactivelyWarn();
        return NextResponse.json({
          success: true,
          data: { alert, shouldWarn: !!alert },
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
