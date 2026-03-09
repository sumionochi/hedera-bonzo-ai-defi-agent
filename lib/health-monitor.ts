// ============================================
// VaultMind — Health Monitor
// ============================================
// Real-time position health tracking with proactive alerts.
// Combines Bonzo on-chain data with keeper strategy thresholds
// to provide a comprehensive position safety dashboard.
//
// FEATURES:
//   - Live health factor gauge
//   - Liquidation distance calculator
//   - Proactive alerts at configurable thresholds
//   - Risk decomposition by asset
//   - Historical health factor tracking
//   - Integration with keeper for auto-protective actions
//
// CTO Workshop Category: "AI Agents" — Health monitor for vaults
// ============================================

import {
  queryAllPositions,
  type PositionInfo,
  type AccountData,
} from "./bonzo-execute";

// ═══════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════

export type HealthLevel =
  | "safe"
  | "healthy"
  | "moderate"
  | "at_risk"
  | "danger"
  | "critical";

export interface HealthAlert {
  id: string;
  level: HealthLevel;
  title: string;
  message: string;
  timestamp: string;
  actionable: boolean;
  suggestedAction?: string;
  /** Once dismissed, don't show again until condition changes */
  dismissed: boolean;
}

export interface AssetRisk {
  symbol: string;
  suppliedUSD: number;
  borrowedUSD: number;
  /** How much this asset contributes to total risk (0-100%) */
  riskContribution: number;
  /** Asset-specific collateral factor */
  collateralFactor: number;
  /** If this asset were removed, what would HF become */
  hfWithoutThis: number;
}

export interface LiquidationInfo {
  /** Current HF */
  healthFactor: number;
  /** USD distance to liquidation */
  liquidationDistanceUSD: number;
  /** % drop in collateral that triggers liquidation */
  collateralDropToLiquidation: number;
  /** HBAR price at which liquidation occurs (if HBAR is collateral) */
  hbarLiquidationPrice?: number;
  /** Current HBAR price for reference */
  currentHbarPrice?: number;
}

export interface HealthSnapshot {
  timestamp: string;
  healthFactor: number;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  level: HealthLevel;
}

export interface HealthMonitorState {
  /** Current health data */
  healthFactor: number;
  level: HealthLevel;
  totalSuppliedUSD: number;
  totalBorrowedUSD: number;
  netWorthUSD: number;
  /** Liquidation analysis */
  liquidation: LiquidationInfo;
  /** Per-asset risk breakdown */
  assetRisks: AssetRisk[];
  /** Active alerts */
  alerts: HealthAlert[];
  /** Historical snapshots (last 50) */
  history: HealthSnapshot[];
  /** Alert thresholds */
  thresholds: HealthThresholds;
  /** Is monitoring active */
  isMonitoring: boolean;
  /** Last update time */
  lastUpdated: string;
}

export interface HealthThresholds {
  /** Below this = critical (default 1.1) */
  critical: number;
  /** Below this = danger (default 1.3) */
  danger: number;
  /** Below this = at_risk (default 1.5) */
  atRisk: number;
  /** Below this = moderate (default 1.8) */
  moderate: number;
  /** Below this = healthy (default 2.5) */
  healthy: number;
  /** Above healthy = safe */
}

// ═══════════════════════════════════════════════════════════
// In-Memory State
// ═══════════════════════════════════════════════════════════

const DEFAULT_THRESHOLDS: HealthThresholds = {
  critical: 1.1,
  danger: 1.3,
  atRisk: 1.5,
  moderate: 1.8,
  healthy: 2.5,
};

let monitorState: HealthMonitorState = {
  healthFactor: Infinity,
  level: "safe",
  totalSuppliedUSD: 0,
  totalBorrowedUSD: 0,
  netWorthUSD: 0,
  liquidation: {
    healthFactor: Infinity,
    liquidationDistanceUSD: Infinity,
    collateralDropToLiquidation: 100,
  },
  assetRisks: [],
  alerts: [],
  history: [],
  thresholds: { ...DEFAULT_THRESHOLDS },
  isMonitoring: false,
  lastUpdated: new Date().toISOString(),
};

let alertCounter = 0;

// ═══════════════════════════════════════════════════════════
// Health Level Classification
// ═══════════════════════════════════════════════════════════

function classifyHealthLevel(
  hf: number,
  thresholds: HealthThresholds
): HealthLevel {
  if (hf === Infinity || hf > 1e10) return "safe"; // No borrows
  if (hf < thresholds.critical) return "critical";
  if (hf < thresholds.danger) return "danger";
  if (hf < thresholds.atRisk) return "at_risk";
  if (hf < thresholds.moderate) return "moderate";
  if (hf < thresholds.healthy) return "healthy";
  return "safe";
}

const LEVEL_COLORS: Record<HealthLevel, string> = {
  safe: "#10b981",
  healthy: "#34d399",
  moderate: "#eab308",
  at_risk: "#f97316",
  danger: "#ef4444",
  critical: "#dc2626",
};

const LEVEL_LABELS: Record<HealthLevel, string> = {
  safe: "Safe",
  healthy: "Healthy",
  moderate: "Moderate",
  at_risk: "At Risk",
  danger: "Danger",
  critical: "CRITICAL",
};

// ═══════════════════════════════════════════════════════════
// Liquidation Calculator
// ═══════════════════════════════════════════════════════════

function calculateLiquidation(
  totalSuppliedUSD: number,
  totalBorrowedUSD: number,
  healthFactor: number,
  hbarPrice?: number,
  hbarCollateralUSD?: number
): LiquidationInfo {
  if (totalBorrowedUSD === 0 || healthFactor === Infinity) {
    return {
      healthFactor: Infinity,
      liquidationDistanceUSD: Infinity,
      collateralDropToLiquidation: 100,
    };
  }

  // Liquidation occurs when HF < 1.0
  // HF = (totalCollateralUSD * avgLTV) / totalBorrowedUSD
  // Assuming average LTV of ~0.75 (typical for Bonzo)
  const avgLTV = 0.75;

  // USD amount of collateral drop that would trigger liquidation
  // liquidation when: (totalSupplied - drop) * avgLTV / totalBorrowed = 1.0
  // drop = totalSupplied - (totalBorrowed / avgLTV)
  const collateralAtLiquidation = totalBorrowedUSD / avgLTV;
  const liquidationDistanceUSD = Math.max(
    0,
    totalSuppliedUSD - collateralAtLiquidation
  );

  // % drop in collateral value
  const collateralDropToLiquidation =
    totalSuppliedUSD > 0
      ? (liquidationDistanceUSD / totalSuppliedUSD) * 100
      : 100;

  const result: LiquidationInfo = {
    healthFactor,
    liquidationDistanceUSD,
    collateralDropToLiquidation,
  };

  // Calculate HBAR liquidation price if HBAR is collateral
  if (hbarPrice && hbarCollateralUSD && hbarCollateralUSD > 0) {
    const hbarFraction = hbarCollateralUSD / totalSuppliedUSD;
    // If HBAR drops by X%, total collateral drops by (X% * hbarFraction)
    // Need total drop of (collateralDropToLiquidation)%
    // So HBAR needs to drop: collateralDropToLiquidation / hbarFraction %
    const hbarDropNeeded = collateralDropToLiquidation / (hbarFraction * 100);
    result.hbarLiquidationPrice = hbarPrice * (1 - hbarDropNeeded);
    result.currentHbarPrice = hbarPrice;
  }

  return result;
}

// ═══════════════════════════════════════════════════════════
// Alert Generation
// ═══════════════════════════════════════════════════════════

function generateAlerts(
  currentState: HealthMonitorState,
  newHF: number,
  newLevel: HealthLevel,
  prevLevel: HealthLevel
): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const now = new Date().toISOString();

  // Level change alerts
  const levelSeverity: Record<HealthLevel, number> = {
    safe: 0,
    healthy: 1,
    moderate: 2,
    at_risk: 3,
    danger: 4,
    critical: 5,
  };

  if (levelSeverity[newLevel] > levelSeverity[prevLevel]) {
    // Health deteriorated
    alertCounter++;
    if (newLevel === "critical") {
      alerts.push({
        id: `alert-${alertCounter}`,
        level: "critical",
        title: "🚨 LIQUIDATION IMMINENT",
        message: `Health factor dropped to ${newHF.toFixed(
          2
        )}. Immediate action required to avoid liquidation.`,
        timestamp: now,
        actionable: true,
        suggestedAction: "Repay debt immediately or add more collateral",
        dismissed: false,
      });
    } else if (newLevel === "danger") {
      alertCounter++;
      alerts.push({
        id: `alert-${alertCounter}`,
        level: "danger",
        title: "⚠️ High Liquidation Risk",
        message: `Health factor at ${newHF.toFixed(
          2
        )}. Consider reducing borrowed amount or adding collateral.`,
        timestamp: now,
        actionable: true,
        suggestedAction: "Repay part of your loan or supply more collateral",
        dismissed: false,
      });
    } else if (newLevel === "at_risk") {
      alertCounter++;
      alerts.push({
        id: `alert-${alertCounter}`,
        level: "at_risk",
        title: "⚡ Position Under Pressure",
        message: `Health factor at ${newHF.toFixed(
          2
        )}. Monitor closely — a market dip could push toward liquidation.`,
        timestamp: now,
        actionable: true,
        suggestedAction: "Consider partial repayment to increase safety margin",
        dismissed: false,
      });
    }
  } else if (
    levelSeverity[newLevel] < levelSeverity[prevLevel] &&
    prevLevel !== "safe" &&
    prevLevel !== "healthy"
  ) {
    // Health improved from a bad state
    alertCounter++;
    alerts.push({
      id: `alert-${alertCounter}`,
      level: newLevel,
      title: "✅ Position Improved",
      message: `Health factor recovered to ${newHF.toFixed(2)} (${
        LEVEL_LABELS[newLevel]
      }).`,
      timestamp: now,
      actionable: false,
      dismissed: false,
    });
  }

  return alerts;
}

// ═══════════════════════════════════════════════════════════
// Main Update Function
// ═══════════════════════════════════════════════════════════

/**
 * Update health monitor with fresh position data.
 * Called by keeper cycle, position fetch, or explicit "monitor" command.
 */
export async function updateHealthMonitor(
  portfolioData?: {
    positions: Array<{
      symbol: string;
      supplied: number;
      suppliedUSD: number;
      borrowed: number;
      borrowedUSD: number;
      supplyAPY: number;
      borrowAPY: number;
      isCollateral: boolean;
    }>;
    totalSuppliedUSD: number;
    totalBorrowedUSD: number;
    netWorthUSD: number;
    healthFactor: number;
  },
  hbarPrice?: number
): Promise<HealthMonitorState> {
  const prevLevel = monitorState.level;

  if (portfolioData) {
    const hf = portfolioData.healthFactor;
    const level = classifyHealthLevel(hf, monitorState.thresholds);

    // Calculate per-asset risk
    const assetRisks: AssetRisk[] = portfolioData.positions
      .filter((p) => p.suppliedUSD > 0 || p.borrowedUSD > 0)
      .map((p) => {
        const riskContribution =
          portfolioData.totalBorrowedUSD > 0
            ? (p.borrowedUSD / portfolioData.totalBorrowedUSD) * 100
            : 0;

        return {
          symbol: p.symbol,
          suppliedUSD: p.suppliedUSD,
          borrowedUSD: p.borrowedUSD,
          riskContribution,
          collateralFactor: p.isCollateral ? 0.75 : 0, // Approximate
          hfWithoutThis: Infinity, // Would need per-asset calculation
        };
      });

    // Calculate liquidation info
    const hbarPosition = portfolioData.positions.find(
      (p) => p.symbol === "HBAR" || p.symbol === "WHBAR"
    );
    const liquidation = calculateLiquidation(
      portfolioData.totalSuppliedUSD,
      portfolioData.totalBorrowedUSD,
      hf,
      hbarPrice,
      hbarPosition?.suppliedUSD
    );

    // Generate alerts
    const newAlerts = generateAlerts(monitorState, hf, level, prevLevel);

    // Add to history
    const snapshot: HealthSnapshot = {
      timestamp: new Date().toISOString(),
      healthFactor: hf,
      totalSuppliedUSD: portfolioData.totalSuppliedUSD,
      totalBorrowedUSD: portfolioData.totalBorrowedUSD,
      level,
    };

    const history = [...monitorState.history, snapshot].slice(-50);

    // Update state
    monitorState = {
      healthFactor: hf,
      level,
      totalSuppliedUSD: portfolioData.totalSuppliedUSD,
      totalBorrowedUSD: portfolioData.totalBorrowedUSD,
      netWorthUSD: portfolioData.netWorthUSD,
      liquidation,
      assetRisks,
      alerts: [
        ...newAlerts,
        ...monitorState.alerts.filter((a) => !a.dismissed),
      ].slice(0, 20),
      history,
      thresholds: monitorState.thresholds,
      isMonitoring: true,
      lastUpdated: new Date().toISOString(),
    };
  }

  return monitorState;
}

/**
 * Get current health monitor state without fetching new data.
 */
export function getHealthMonitorState(): HealthMonitorState {
  return monitorState;
}

/**
 * Update alert thresholds.
 */
export function setHealthThresholds(
  thresholds: Partial<HealthThresholds>
): HealthThresholds {
  monitorState.thresholds = {
    ...monitorState.thresholds,
    ...thresholds,
  };
  // Reclassify current level
  monitorState.level = classifyHealthLevel(
    monitorState.healthFactor,
    monitorState.thresholds
  );
  return monitorState.thresholds;
}

/**
 * Dismiss an alert.
 */
export function dismissAlert(alertId: string): void {
  const alert = monitorState.alerts.find((a) => a.id === alertId);
  if (alert) alert.dismissed = true;
}

/**
 * Check if health monitor should trigger proactive warning.
 * Used by the keeper loop to inject alerts into chat.
 */
export function shouldProactivelyWarn(): HealthAlert | null {
  const activeAlerts = monitorState.alerts.filter(
    (a) => !a.dismissed && a.actionable
  );
  if (activeAlerts.length === 0) return null;

  // Return highest severity undismissed alert
  const severityOrder: HealthLevel[] = [
    "critical",
    "danger",
    "at_risk",
    "moderate",
    "healthy",
    "safe",
  ];

  for (const level of severityOrder) {
    const alert = activeAlerts.find((a) => a.level === level);
    if (alert) return alert;
  }

  return null;
}

// ═══════════════════════════════════════════════════════════
// Chat Formatting
// ═══════════════════════════════════════════════════════════

/**
 * Format health monitor state for chat display.
 * Returns a concise summary with key metrics.
 */
export function formatHealthForChat(state?: HealthMonitorState): string {
  const s = state || monitorState;

  if (s.totalSuppliedUSD === 0 && s.totalBorrowedUSD === 0) {
    return (
      "🛡️ **Position Health Monitor**\n\n" +
      "No active positions to monitor. " +
      'Deposit assets first with "Supply 100 HBAR to Bonzo", then I\'ll track your health factor in real-time.'
    );
  }

  const levelEmoji: Record<HealthLevel, string> = {
    safe: "🟢",
    healthy: "🟢",
    moderate: "🟡",
    at_risk: "🟠",
    danger: "🔴",
    critical: "🚨",
  };

  const hfDisplay =
    s.healthFactor > 1e10 ? "∞ (no borrows)" : s.healthFactor.toFixed(2);

  const parts: string[] = [
    `🛡️ **Position Health Monitor**\n`,
    `${levelEmoji[s.level]} Health Factor: **${hfDisplay}** — ${
      LEVEL_LABELS[s.level]
    }`,
    `💰 Supplied: $${s.totalSuppliedUSD.toFixed(
      2
    )} | Borrowed: $${s.totalBorrowedUSD.toFixed(
      2
    )} | Net: $${s.netWorthUSD.toFixed(2)}`,
  ];

  // Liquidation distance
  if (s.totalBorrowedUSD > 0) {
    const liq = s.liquidation;
    if (liq.liquidationDistanceUSD < Infinity) {
      parts.push(
        `\n📏 **Liquidation Distance:**`,
        `   Collateral can drop **${liq.collateralDropToLiquidation.toFixed(
          1
        )}%** ($${liq.liquidationDistanceUSD.toFixed(2)}) before liquidation`
      );
      if (liq.hbarLiquidationPrice && liq.currentHbarPrice) {
        parts.push(
          `   HBAR liquidation price: **$${liq.hbarLiquidationPrice.toFixed(
            4
          )}** (current: $${liq.currentHbarPrice.toFixed(4)})`
        );
      }
    }
  }

  // Asset breakdown
  if (s.assetRisks.length > 0) {
    parts.push(`\n📊 **Position Breakdown:**`);
    for (const asset of s.assetRisks) {
      const bits: string[] = [];
      if (asset.suppliedUSD > 0)
        bits.push(`+$${asset.suppliedUSD.toFixed(2)} supplied`);
      if (asset.borrowedUSD > 0)
        bits.push(`-$${asset.borrowedUSD.toFixed(2)} borrowed`);
      if (asset.riskContribution > 0)
        bits.push(`${asset.riskContribution.toFixed(0)}% of debt`);
      parts.push(`   ${asset.symbol}: ${bits.join(" | ")}`);
    }
  }

  // Active alerts
  const activeAlerts = s.alerts.filter((a) => !a.dismissed);
  if (activeAlerts.length > 0) {
    parts.push(`\n🔔 **Active Alerts:**`);
    for (const alert of activeAlerts.slice(0, 3)) {
      parts.push(`   ${alert.title}: ${alert.message}`);
      if (alert.suggestedAction) {
        parts.push(`   💡 ${alert.suggestedAction}`);
      }
    }
  }

  // Trend from history
  if (s.history.length >= 2) {
    const latest = s.history[s.history.length - 1];
    const prev = s.history[s.history.length - 2];
    const trend =
      latest.healthFactor > prev.healthFactor
        ? "📈 improving"
        : latest.healthFactor < prev.healthFactor
        ? "📉 declining"
        : "➡️ stable";
    parts.push(`\n📉 Trend: ${trend} (${s.history.length} data points)`);
  }

  return parts.join("\n");
}

/**
 * Get data for the health monitor generative UI component.
 * Returns structured data that the frontend renders as an interactive gauge.
 */
export function getHealthMonitorUIData(): Record<string, any> {
  const s = monitorState;

  return {
    healthFactor: s.healthFactor > 1e10 ? null : s.healthFactor,
    level: s.level,
    levelLabel: LEVEL_LABELS[s.level],
    levelColor: LEVEL_COLORS[s.level],
    totalSuppliedUSD: s.totalSuppliedUSD,
    totalBorrowedUSD: s.totalBorrowedUSD,
    netWorthUSD: s.netWorthUSD,
    liquidation: {
      distanceUSD:
        s.liquidation.liquidationDistanceUSD > 1e10
          ? null
          : s.liquidation.liquidationDistanceUSD,
      collateralDrop: s.liquidation.collateralDropToLiquidation,
      hbarLiqPrice: s.liquidation.hbarLiquidationPrice,
      currentHbarPrice: s.liquidation.currentHbarPrice,
    },
    assetRisks: s.assetRisks,
    alerts: s.alerts.filter((a) => !a.dismissed),
    history: s.history.slice(-20).map((h) => ({
      time: h.timestamp,
      hf: h.healthFactor > 1e10 ? null : h.healthFactor,
      level: h.level,
    })),
    thresholds: s.thresholds,
    isMonitoring: s.isMonitoring,
    lastUpdated: s.lastUpdated,
  };
}
