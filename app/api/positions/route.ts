import { NextRequest, NextResponse } from "next/server";
import {
  queryAllPositions,
  fetchBonzoDashboard,
  type AccountData,
  type BonzoDashboardResponse,
} from "@/lib/bonzo-execute";

import {
  ContractCallQuery,
  ContractId,
  Hbar,
  AccountId,
  AccountInfoQuery,
} from "@hashgraph/sdk";
import { Interface, defaultAbiCoder } from "@ethersproject/abi";
import { getHederaClient } from "@/lib/hedera";

export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// Network-aware config — ADDRESSES FROM OFFICIAL BONZO DOCS
// Source: https://docs.bonzo.finance → Lend Contracts
// Verified: 2026-03-01
// ═══════════════════════════════════════════════════════════
const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

const LENDING_POOL_EVM =
  HEDERA_NETWORK === "mainnet"
    ? "0x236897c518996163E7b313aD21D1C9fCC7BA1afc" // Mainnet 0.0.7308459
    : "0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2"; // Testnet 0.0.4999355

// Bonzo Data API (mainnet only)
// Per docs warning: use staging URL temporarily for live data
const BONZO_API_BASE =
  HEDERA_NETWORK === "mainnet"
    ? "https://mainnet-data-staging.bonzo.finance"
    : "";

const LENDING_POOL_ABI = new Interface([
  "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
]);

// Fallback prices — only used when Bonzo API is unavailable
const APPROX_PRICES: Record<string, number> = {
  WHBAR: 0.2,
  HBAR: 0.2,
  USDC: 1.0,
  HBARX: 0.22,
  SAUCE: 0.02,
  KARATE: 0.001,
  XSAUCE: 0.03,
  DOVU: 0.001,
  HST: 0.01,
  PACK: 0.001,
  STEAM: 0.001,
  GRELF: 0.001,
  KBL: 0.001,
  BONZO: 0.01,
};

async function getEvmAddress(client: any, accountId: string): Promise<string> {
  try {
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(accountId))
      .execute(client);
    const evm = (info as any).evmAddress;
    if (
      typeof evm === "string" &&
      evm.startsWith("0x") &&
      evm.length === 42 &&
      evm !== "0x0000000000000000000000000000000000000000"
    ) {
      return evm;
    }
    const caid = info.contractAccountId;
    if (typeof caid === "string" && caid.length > 0) {
      return caid.startsWith("0x") ? caid : `0x${caid}`;
    }
  } catch {}
  return "0x" + AccountId.fromString(accountId).toSolidityAddress();
}

async function queryUserAccountData(
  client: any,
  userEvm: string
): Promise<AccountData | null> {
  try {
    const data = LENDING_POOL_ABI.encodeFunctionData("getUserAccountData", [
      userEvm,
    ]);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(200_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    const bytes = result.bytes;
    if (bytes && bytes.length >= 192) {
      const decoded = defaultAbiCoder.decode(
        ["uint256", "uint256", "uint256", "uint256", "uint256", "uint256"],
        bytes
      );
      return {
        totalCollateralETH: Number(BigInt(decoded[0].toString())) / 1e18,
        totalDebtETH: Number(BigInt(decoded[1].toString())) / 1e18,
        availableBorrowsETH: Number(BigInt(decoded[2].toString())) / 1e18,
        healthFactor: Number(BigInt(decoded[5].toString())) / 1e18,
      };
    }
  } catch (e: any) {
    console.warn(
      `[Positions] getUserAccountData failed: ${e.message?.substring(0, 80)}`
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// BONZO DATA API — Parse dashboard response into positions
// Docs: https://docs.bonzo.finance → Lend Data API → /dashboard/{accountId}
// ═══════════════════════════════════════════════════════════

function parseBonzoDashboard(dashboard: BonzoDashboardResponse) {
  const positions = [];

  for (const reserve of dashboard.reserves) {
    const supplied = parseFloat(reserve.atoken_balance?.token_display || "0");
    const suppliedUSD = parseFloat(reserve.atoken_balance?.usd_display || "0");
    const borrowed =
      parseFloat(reserve.variable_debt_balance?.token_display || "0") +
      parseFloat(reserve.stable_debt_balance?.token_display || "0");
    const borrowedUSD =
      parseFloat(reserve.variable_debt_balance?.usd_display || "0") +
      parseFloat(reserve.stable_debt_balance?.usd_display || "0");

    if (supplied > 0 || borrowed > 0) {
      positions.push({
        symbol: reserve.symbol,
        supplied,
        suppliedUSD,
        borrowed,
        borrowedUSD,
        supplyAPY: reserve.supply_apy || 0,
        borrowAPY: reserve.variable_borrow_apy || 0,
        isCollateral: reserve.use_as_collateral_enabled,
        priceUSD: parseFloat(reserve.price_usd_display || "0"),
        ltv: reserve.ltv,
        liquidationThreshold: reserve.liquidation_threshold,
      });
    }
  }

  const credit = dashboard.user_credit;
  const totalSuppliedUSD = parseFloat(credit.total_supply?.usd_display || "0");
  const totalCollateralUSD = parseFloat(
    credit.total_collateral?.usd_display || "0"
  );
  const totalDebtUSD = parseFloat(credit.total_debt?.usd_display || "0");

  return {
    positions,
    totalSuppliedUSD,
    totalCollateralUSD,
    totalBorrowedUSD: totalDebtUSD,
    netWorthUSD: totalSuppliedUSD - totalDebtUSD,
    healthFactor: credit.health_factor,
    currentLtv: credit.current_ltv,
    maxLtv: credit.max_ltv,
    liquidationLtv: credit.liquidation_ltv,
    averageSupplyAPY: dashboard.average_supply_apy || 0,
    averageBorrowAPY: dashboard.average_borrow_apy || 0,
    averageNetAPY: dashboard.average_net_apy || 0,
    source: "bonzo-api" as const,
    timestamp: dashboard.timestamp,
  };
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// Strategy:
//   Mainnet: Bonzo Data API first (richer data), on-chain fallback
//   Testnet: On-chain queries via DataProvider
// ═══════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const accountId =
    req.nextUrl.searchParams.get("accountId") || process.env.HEDERA_ACCOUNT_ID;

  if (!accountId) {
    return NextResponse.json(
      {
        success: false,
        error: "No account ID. Set HEDERA_ACCOUNT_ID in .env.local",
      },
      { status: 400 }
    );
  }

  try {
    console.log(
      `[Positions] Querying positions for ${accountId} (${HEDERA_NETWORK})`
    );
    console.log(`[Positions] LendingPool: ${LENDING_POOL_EVM}`);

    // === Strategy 1: Bonzo Data API (mainnet) ===
    if (BONZO_API_BASE) {
      console.log(
        `[Positions] Trying Bonzo Data API: ${BONZO_API_BASE}/dashboard/${accountId}`
      );
      const dashboard = await fetchBonzoDashboard(accountId);

      if (dashboard && dashboard.reserves) {
        const parsed = parseBonzoDashboard(dashboard);
        console.log(
          `[Positions] Bonzo API: ${
            parsed.positions.length
          } positions, $${parsed.totalSuppliedUSD.toFixed(2)} supplied, HF: ${
            parsed.healthFactor
          }`
        );

        return NextResponse.json({
          success: true,
          data: { accountId, network: HEDERA_NETWORK, ...parsed },
        });
      }
      console.warn(
        `[Positions] Bonzo API returned no data, falling back to on-chain`
      );
    }

    // === Strategy 2: On-chain queries (testnet primary, mainnet fallback) ===
    console.log(`[Positions] Using on-chain queries via DataProvider`);

    const client = getHederaClient();
    const userEvm = await getEvmAddress(client, accountId);

    const [onChainPositions, accountData] = await Promise.all([
      queryAllPositions(),
      queryUserAccountData(client, userEvm),
    ]);

    console.log(
      `[Positions] On-chain: ${
        onChainPositions.length
      } positions, accountData: ${accountData ? "yes" : "no"}`
    );

    if (
      onChainPositions.length > 0 ||
      (accountData && accountData.totalCollateralETH > 0)
    ) {
      const hbarPrice = APPROX_PRICES.HBAR;

      const positions = onChainPositions.map((p) => {
        const price = APPROX_PRICES[p.token] || hbarPrice;
        const suppliedAmount = parseFloat(p.aTokenBalance) || 0;
        const borrowedAmount = parseFloat(p.variableDebt) || 0;

        return {
          symbol: p.token,
          supplied: suppliedAmount,
          suppliedUSD: suppliedAmount * price,
          borrowed: borrowedAmount,
          borrowedUSD: borrowedAmount * price,
          supplyAPY: 0,
          borrowAPY: 0,
          isCollateral: p.isCollateral,
        };
      });

      const totalCollateralUSD = accountData
        ? accountData.totalCollateralETH * hbarPrice
        : positions.reduce((s, p) => s + p.suppliedUSD, 0);
      const totalDebtUSD = accountData
        ? accountData.totalDebtETH * hbarPrice
        : positions.reduce((s, p) => s + p.borrowedUSD, 0);
      const healthFactor = accountData?.healthFactor || 0;
      const totalSuppliedUSD = positions.reduce((s, p) => s + p.suppliedUSD, 0);

      console.log(
        `[Positions] On-chain: $${totalSuppliedUSD.toFixed(
          2
        )} supplied, $${totalDebtUSD.toFixed(
          2
        )} debt, HF: ${healthFactor.toFixed(2)}`
      );

      return NextResponse.json({
        success: true,
        data: {
          accountId,
          network: HEDERA_NETWORK,
          positions,
          totalSuppliedUSD,
          totalBorrowedUSD: totalDebtUSD,
          netWorthUSD: totalSuppliedUSD - totalDebtUSD,
          healthFactor,
          currentLtv: accountData
            ? (accountData.totalDebtETH /
                Math.max(accountData.totalCollateralETH, 0.001)) *
              100
            : 0,
          maxLtv: 75,
          averageSupplyAPY: 0,
          averageBorrowAPY: 0,
          averageNetAPY: 0,
          source: "on-chain",
        },
      });
    }

    // No positions found
    return NextResponse.json({
      success: true,
      data: {
        accountId,
        network: HEDERA_NETWORK,
        positions: [],
        totalSuppliedUSD: 0,
        totalBorrowedUSD: 0,
        netWorthUSD: 0,
        healthFactor: 0,
        currentLtv: 0,
        maxLtv: 0,
        averageSupplyAPY: 0,
        averageBorrowAPY: 0,
        averageNetAPY: 0,
        source: "none",
        note: "No Bonzo positions found",
      },
    });
  } catch (error: any) {
    console.error("[Positions] Error:", error.message);
    return NextResponse.json({
      success: true,
      data: {
        accountId,
        network: HEDERA_NETWORK,
        positions: [],
        totalSuppliedUSD: 0,
        totalBorrowedUSD: 0,
        netWorthUSD: 0,
        healthFactor: 0,
        currentLtv: 0,
        maxLtv: 0,
        averageSupplyAPY: 0,
        averageBorrowAPY: 0,
        averageNetAPY: 0,
        note: `Query failed: ${error.message}`,
      },
    });
  }
}
