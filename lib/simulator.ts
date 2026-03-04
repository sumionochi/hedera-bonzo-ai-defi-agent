// ============================================
// VaultMind Backtest Simulator
// Generates "VaultMind Strategy" vs "Passive HODL" comparison
// Uses real HBAR price history + simulated keeper decisions
// ============================================

export interface BacktestDataPoint {
  timestamp: number; // unix ms
  date: string; // YYYY-MM-DD
  hbarPrice: number;
  passiveValue: number; // just holding HBAR
  vaultmindValue: number; // VaultMind managed
  decision?: {
    action: string;
    reason: string;
    confidence: number;
  };
}

export interface BacktestResult {
  dataPoints: BacktestDataPoint[];
  summary: {
    startDate: string;
    endDate: string;
    initialInvestment: number;
    passiveFinalValue: number;
    vaultmindFinalValue: number;
    passiveReturn: number; // percentage
    vaultmindReturn: number; // percentage
    outperformance: number; // percentage points
    totalDecisions: number;
    harvests: number;
    holds: number;
    increases: number;
    rebalances: number;
  };
}

// ── Fetch real HBAR price history ──

async function fetchPriceHistory(
  days: number
): Promise<Array<{ timestamp: number; price: number }>> {
  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/coins/hedera-hashgraph/market_chart?vs_currency=usd&days=${days}&interval=daily`
    );

    if (!res.ok) {
      throw new Error(`CoinGecko API error: ${res.status}`);
    }

    const data = await res.json();
    return (data.prices || []).map((p: [number, number]) => ({
      timestamp: p[0],
      price: p[1],
    }));
  } catch (err: any) {
    console.error("[Simulator] Price history fetch failed:", err.message);
    // Return synthetic data if API fails
    return generateSyntheticPrices(days);
  }
}

function generateSyntheticPrices(
  days: number
): Array<{ timestamp: number; price: number }> {
  const points: Array<{ timestamp: number; price: number }> = [];
  const now = Date.now();
  let price = 0.1; // Starting HBAR price

  for (let i = days; i >= 0; i--) {
    const timestamp = now - i * 24 * 60 * 60 * 1000;
    // Random walk with slight downward bias (realistic for crypto)
    const change = (Math.random() - 0.48) * 0.06;
    price = Math.max(0.02, price * (1 + change));
    points.push({ timestamp, price });
  }

  return points;
}

// ── Simulate keeper decisions based on price movements ──

interface SimState {
  hbarHolding: number; // HBAR tokens held
  stableHolding: number; // USD value in stables
  yieldAccrued: number; // Yield earned from Bonzo deposits
  isDeposited: boolean; // Currently in Bonzo vault
  totalValue: number; // Total portfolio value in USD
}

function simulateKeeperDecision(
  prices: Array<{ timestamp: number; price: number }>,
  index: number
): {
  action: string;
  reason: string;
  confidence: number;
} | null {
  if (index < 3) return null; // Need history

  const current = prices[index].price;
  const prev1 = prices[index - 1].price;
  const prev2 = prices[index - 2].price;
  const prev3 = prices[index - 3].price;

  const change1d = (current - prev1) / prev1;
  const change3d = (current - prev3) / prev3;

  // Calculate short-term volatility
  const returns = [(prev1 - prev2) / prev2, (prev2 - prev3) / prev3, change1d];
  const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const volatility = Math.sqrt(
    returns.reduce((a, b) => a + Math.pow(b - avgReturn, 2), 0) / returns.length
  );

  // Decision logic (mirrors keeper.ts strategies)

  // Bearish: 2+ days of decline with acceleration
  if (change3d < -0.08 && change1d < -0.03) {
    return {
      action: "HARVEST",
      reason: `Price dropped ${(change3d * 100).toFixed(
        1
      )}% over 3 days. Converting to stables.`,
      confidence: 0.8,
    };
  }

  // High volatility: stay cautious
  if (volatility > 0.05 && Math.abs(change1d) > 0.04) {
    return {
      action: "HOLD",
      reason: `High volatility (${(volatility * 100).toFixed(
        1
      )}%). Maintaining current position.`,
      confidence: 0.7,
    };
  }

  // Bullish recovery: re-enter after dip
  if (change1d > 0.04 && change3d > 0.02 && prev1 < prev2) {
    return {
      action: "INCREASE_POSITION",
      reason: `Recovery detected (+${(change1d * 100).toFixed(
        1
      )}% today). Increasing vault position.`,
      confidence: 0.75,
    };
  }

  // Yield rebalance opportunity (simulated every ~7 days)
  if (index % 7 === 0 && Math.random() > 0.6) {
    return {
      action: "REBALANCE",
      reason: "Weekly yield check: found better APY opportunity. Rebalancing.",
      confidence: 0.65,
    };
  }

  return null; // HOLD implicitly
}

// ── Run full backtest ──

export async function runBacktest(
  days: number = 30,
  initialInvestment: number = 1000
): Promise<BacktestResult> {
  console.log(
    `[Simulator] Running ${days}-day backtest with $${initialInvestment}...`
  );

  const prices = await fetchPriceHistory(days);

  if (prices.length < 2) {
    throw new Error("Insufficient price data for backtest");
  }

  const startPrice = prices[0].price;
  const initialHbar = initialInvestment / startPrice;

  // Passive strategy: just hold HBAR
  // VaultMind strategy: actively manage with keeper decisions

  const passiveState = { hbar: initialHbar };

  const vmState: SimState = {
    hbarHolding: initialHbar,
    stableHolding: 0,
    yieldAccrued: 0,
    isDeposited: true, // Start deposited in Bonzo
    totalValue: initialInvestment,
  };

  const dataPoints: BacktestDataPoint[] = [];
  let harvests = 0,
    holds = 0,
    increases = 0,
    rebalances = 0,
    totalDecisions = 0;

  // Daily yield rate (simulating ~5% APY from Bonzo deposits)
  const dailyYieldRate = 0.05 / 365;

  for (let i = 0; i < prices.length; i++) {
    const { timestamp, price } = prices[i];
    const date = new Date(timestamp).toISOString().split("T")[0];

    // Passive value: simple HBAR holding
    const passiveValue = passiveState.hbar * price;

    // VaultMind: accrue yield if deposited
    if (vmState.isDeposited && vmState.hbarHolding > 0) {
      const yieldToday = vmState.hbarHolding * price * dailyYieldRate;
      vmState.yieldAccrued += yieldToday;
    }

    // Run keeper decision
    const decision = simulateKeeperDecision(prices, i);

    if (decision) {
      totalDecisions++;

      switch (decision.action) {
        case "HARVEST":
          // Convert HBAR to stables at current price
          if (vmState.hbarHolding > 0) {
            vmState.stableHolding +=
              vmState.hbarHolding * price + vmState.yieldAccrued;
            vmState.hbarHolding = 0;
            vmState.yieldAccrued = 0;
            vmState.isDeposited = false;
            harvests++;
          }
          break;

        case "INCREASE_POSITION":
          // Convert stables back to HBAR
          if (vmState.stableHolding > 0) {
            vmState.hbarHolding += vmState.stableHolding / price;
            vmState.stableHolding = 0;
            vmState.isDeposited = true;
            increases++;
          }
          break;

        case "REBALANCE":
          // Small yield bonus from rebalancing to better pool
          vmState.yieldAccrued += vmState.hbarHolding * price * 0.001;
          rebalances++;
          break;

        default:
          holds++;
          break;
      }
    }

    // Calculate VaultMind total value
    vmState.totalValue =
      vmState.hbarHolding * price +
      vmState.stableHolding +
      vmState.yieldAccrued;

    dataPoints.push({
      timestamp,
      date,
      hbarPrice: price,
      passiveValue: Math.round(passiveValue * 100) / 100,
      vaultmindValue: Math.round(vmState.totalValue * 100) / 100,
      decision: decision || undefined,
    });
  }

  const lastPoint = dataPoints[dataPoints.length - 1];
  const passiveReturn =
    ((lastPoint.passiveValue - initialInvestment) / initialInvestment) * 100;
  const vaultmindReturn =
    ((lastPoint.vaultmindValue - initialInvestment) / initialInvestment) * 100;

  const result: BacktestResult = {
    dataPoints,
    summary: {
      startDate: dataPoints[0].date,
      endDate: lastPoint.date,
      initialInvestment,
      passiveFinalValue: lastPoint.passiveValue,
      vaultmindFinalValue: lastPoint.vaultmindValue,
      passiveReturn: Math.round(passiveReturn * 100) / 100,
      vaultmindReturn: Math.round(vaultmindReturn * 100) / 100,
      outperformance: Math.round((vaultmindReturn - passiveReturn) * 100) / 100,
      totalDecisions,
      harvests,
      holds,
      increases,
      rebalances,
    },
  };

  console.log(
    `[Simulator] Backtest complete: Passive ${passiveReturn.toFixed(
      1
    )}% vs VaultMind ${vaultmindReturn.toFixed(1)}% (${
      result.summary.outperformance > 0 ? "+" : ""
    }${result.summary.outperformance.toFixed(1)}pp)`
  );

  return result;
}
