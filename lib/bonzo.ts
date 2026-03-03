// ============================================
// Bonzo Finance - Real API Integration
// Docs: https://docs.bonzo.finance/hub/developer/bonzo-lend/lend-data-api
//
// data.bonzo.finance is temporarily returning 500.
// Per Bonzo docs, use mainnet-data-staging.bonzo.finance as fallback.
// ============================================

const BONZO_API_URLS = [
  "https://mainnet-data-staging.bonzo.finance",
  "https://data.bonzo.finance",
];

export interface BonzoReserve {
  id: number;
  symbol: string;
  name: string;
  coingeckoId: string;
  htsAddress: string;
  evmAddress: string;
  atokenAddress: string;
  decimals: number;
  ltv: number;
  liquidationThreshold: number;
  liquidationBonus: number;
  active: boolean;
  frozen: boolean;
  variableBorrowingEnabled: boolean;
  reserveFactor: number;
  utilizationRate: number;
  supplyAPY: number;
  variableBorrowAPY: number;
  stableBorrowAPY: number;
  availableLiquidity: string;
  totalSupply: string;
  totalVariableDebt: string;
  totalStableDebt: string;
  borrowCap: string;
  supplyCap: string;
  priceUSD: string;
}

export interface BonzoMarketData {
  chainId: string;
  networkName: string;
  reserves: BonzoReserve[];
  timestamp: string;
}

export interface BonzoAccountDashboard {
  htsAddress: string;
  evmAddress: string;
  reserves: Array<{
    symbol: string;
    name: string;
    tokenBalance: { token_display: string; usd_display: string };
    atokenBalance: { token_display: string; usd_display: string };
    variableDebtBalance: { token_display: string; usd_display: string };
    stableDebtBalance: { token_display: string; usd_display: string };
    supplyAPY: number;
    variableBorrowAPY: number;
    useAsCollateralEnabled: boolean;
  }>;
  userCredit: {
    hbarBalance: { hbar_display: string; usd_display: string };
    totalSupply: { hbar_display: string; usd_display: string };
    totalCollateral: { hbar_display: string; usd_display: string };
    totalDebt: { hbar_display: string; usd_display: string };
    creditLimit: { hbar_display: string; usd_display: string };
    healthFactor: number;
    currentLtv: number;
    maxLtv: number;
    liquidationLtv: number;
  };
  averageSupplyApy: number;
  averageBorrowApy: number;
  averageNetApy: number;
  timestamp: string;
}

/**
 * Fetch from Bonzo API with automatic URL fallback
 */
async function bonzoFetch(path: string): Promise<any> {
  let lastError: Error | null = null;

  for (const baseUrl of BONZO_API_URLS) {
    try {
      const url = `${baseUrl}${path}`;
      console.log(`[Bonzo] Trying: ${url}`);
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[Bonzo] ${url} returned ${res.status}`);
        lastError = new Error(`${baseUrl} returned ${res.status}`);
        continue;
      }

      const data = await res.json();
      console.log(`[Bonzo] Success from: ${baseUrl}`);
      return data;
    } catch (err: any) {
      console.warn(`[Bonzo] ${baseUrl} failed: ${err.message}`);
      lastError = err;
    }
  }

  throw new Error(
    `All Bonzo API URLs failed. Last error: ${lastError?.message}`
  );
}

/**
 * GET /market — All reserves with APYs, utilization, prices
 */
export async function getBonzoMarkets(): Promise<BonzoMarketData> {
  const data = await bonzoFetch("/market");

  const reserves: BonzoReserve[] = (data.reserves || []).map((r: any) => ({
    id: r.id,
    symbol: r.symbol,
    name: r.name || r.symbol,
    coingeckoId: r.coingecko_id || "",
    htsAddress: r.hts_address || "",
    evmAddress: r.evm_address || "",
    atokenAddress: r.atoken_address || "",
    decimals: r.decimals || 0,
    ltv: r.ltv || 0,
    liquidationThreshold: r.liquidation_threshold || 0,
    liquidationBonus: r.liquidation_bonus || 0,
    active: r.active !== false,
    frozen: r.frozen === true,
    variableBorrowingEnabled: r.variable_borrowing_enabled !== false,
    reserveFactor: r.reserve_factor || 0,
    utilizationRate:
      typeof r.utilization_rate === "number"
        ? r.utilization_rate
        : parseFloat(r.utilization_rate || "0"),
    supplyAPY:
      typeof r.supply_apy === "number"
        ? r.supply_apy
        : parseFloat(r.supply_apy || "0"),
    variableBorrowAPY:
      typeof r.variable_borrow_apy === "number"
        ? r.variable_borrow_apy
        : parseFloat(r.variable_borrow_apy || "0"),
    stableBorrowAPY:
      typeof r.stable_borrow_apy === "number"
        ? r.stable_borrow_apy
        : parseFloat(r.stable_borrow_apy || "0"),
    availableLiquidity:
      r.available_liquidity?.token_display || r.available_liquidity || "0",
    totalSupply: r.total_supply?.token_display || r.total_supply || "0",
    totalVariableDebt:
      r.total_variable_debt?.token_display || r.total_variable_debt || "0",
    totalStableDebt:
      r.total_stable_debt?.token_display || r.total_stable_debt || "0",
    borrowCap: r.borrow_cap?.token_display || r.borrow_cap || "0",
    supplyCap: r.supply_cap?.token_display || r.supply_cap || "0",
    priceUSD: r.price_usd_display || r.price_usd || "0",
  }));

  return {
    chainId: data.chain_id || "",
    networkName: data.network_name || "",
    reserves,
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

/**
 * GET /dashboard/{accountId} — Account positions, health factor, balances
 */
export async function getBonzoAccountDashboard(
  accountId: string
): Promise<BonzoAccountDashboard> {
  const data = await bonzoFetch(`/dashboard/${accountId}`);

  return {
    htsAddress: data.hts_address || "",
    evmAddress: data.evm_address || "",
    reserves: (data.reserves || []).map((r: any) => ({
      symbol: r.symbol,
      name: r.name,
      tokenBalance: r.token_balance || {
        token_display: "0",
        usd_display: "0",
      },
      atokenBalance: r.atoken_balance || {
        token_display: "0",
        usd_display: "0",
      },
      variableDebtBalance: r.variable_debt_balance || {
        token_display: "0",
        usd_display: "0",
      },
      stableDebtBalance: r.stable_debt_balance || {
        token_display: "0",
        usd_display: "0",
      },
      supplyAPY: r.supply_apy || 0,
      variableBorrowAPY: r.variable_borrow_apy || 0,
      useAsCollateralEnabled: r.use_as_collateral_enabled || false,
    })),
    userCredit: {
      hbarBalance: data.user_credit?.hbar_balance || {
        hbar_display: "0",
        usd_display: "0",
      },
      totalSupply: data.user_credit?.total_supply || {
        hbar_display: "0",
        usd_display: "0",
      },
      totalCollateral: data.user_credit?.total_collateral || {
        hbar_display: "0",
        usd_display: "0",
      },
      totalDebt: data.user_credit?.total_debt || {
        hbar_display: "0",
        usd_display: "0",
      },
      creditLimit: data.user_credit?.credit_limit || {
        hbar_display: "0",
        usd_display: "0",
      },
      healthFactor: data.user_credit?.health_factor || 0,
      currentLtv: data.user_credit?.current_ltv || 0,
      maxLtv: data.user_credit?.max_ltv || 0,
      liquidationLtv: data.user_credit?.liquidation_ltv || 0,
    },
    averageSupplyApy: data.average_supply_apy || 0,
    averageBorrowApy: data.average_borrow_apy || 0,
    averageNetApy: data.average_net_apy || 0,
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

/**
 * GET /stats — 24-hour protocol statistics
 */
export async function getBonzoStats() {
  const data = await bonzoFetch("/stats");
  return {
    totalSupplyValue: data.total_supply_value?.hbar_display || "0",
    totalBorrowedValue: data.total_borrowed_value?.hbar_display || "0",
    totalSuccessfulTransactions: data.total_successful_transactions || 0,
    activeUsers: data.active_users || [],
    timestampStart: data.timestamp_start || "",
    timestampEnd: data.timestamp_end || "",
  };
}

/**
 * GET /info — Protocol configuration
 */
export async function getBonzoInfo() {
  return bonzoFetch("/info");
}

/**
 * Get best yield opportunities sorted by supply APY
 */
export async function getBestYieldOpportunities(): Promise<BonzoReserve[]> {
  const { reserves } = await getBonzoMarkets();
  return reserves
    .filter((r) => r.active && !r.frozen && r.supplyAPY > 0)
    .sort((a, b) => b.supplyAPY - a.supplyAPY);
}
