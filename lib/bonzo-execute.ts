// ============================================
// VaultMind — Bonzo Finance Execution Layer
// ============================================
// NETWORK-AWARE: Reads HEDERA_NETWORK env to switch between testnet/mainnet
//
// CONTRACT ADDRESSES SOURCE: Official bonzoPlugin bonzo-contracts.json
//   https://github.com/Bonzo-Labs/bonzoPlugin/blob/main/bonzo-contracts.json
//   + Bonzo Finance docs: https://docs.bonzo.finance → Developer → Lend Contracts
//   Verified: 2026-03-02
//
// AUTO-ASSOCIATION: Enables unlimited HTS token auto-association
//   so aTokens/debtTokens from LendingPool can be received without
//   pre-knowing exact HTS IDs (critical for Hedera's HTS model).
//
// HBAR deposits: WETHGateway.depositETH() wraps + deposits in 1 tx
//   Fallback: manual wrap via SaucerSwap → approve → LendingPool.deposit()
//
// POSITION QUERIES: Uses Bonzo Data API as primary on mainnet,
//   on-chain DataProvider queries as fallback/testnet.
// ============================================

import {
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
  AccountId,
  AccountInfoQuery,
  TokenAssociateTransaction,
  TokenId,
  AccountUpdateTransaction,
} from "@hashgraph/sdk";
import { Interface, defaultAbiCoder } from "@ethersproject/abi";
import { getHederaClient } from "./hedera";

// ═══════════════════════════════════════════════════════════
// NETWORK CONFIGURATION — ALL ADDRESSES FROM OFFICIAL BONZO DOCS
// Source: https://docs.bonzo.finance → Lend Contracts
// ═══════════════════════════════════════════════════════════
const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

interface TokenConfig {
  evmAddr: string;
  htsId: string;
  decimals: number;
  aToken?: string;
  variableDebt?: string;
}

interface NetworkConfig {
  // Core protocol — "Lending Pool Infrastructure"
  lendingPool: string;
  wethGateway: string;
  dataProvider: string;
  // Additional protocol contracts
  addressesProviderRegistry: string;
  addressesProvider: string;
  oracle: string;
  priceOracle: string;
  lendingRateOracle: string;
  lendingPoolConfigurator: string;
  lendingPoolCollateralManager: string;
  walletBalanceProvider: string;
  // WHBAR wrapping (SaucerSwap)
  saucerSwapWrapper: string;
  // URLs
  hashscanBase: string;
  bonzoApiBase: string;
  // Tokens
  tokens: Record<string, TokenConfig>;
}

// ═══════════════════════════════════════════════════════════
// TESTNET CONFIG — from official Bonzo Plugin bonzo-contracts.json
// Source: https://github.com/Bonzo-Labs/bonzoPlugin/blob/main/bonzo-contracts.json
// Verified: 2026-03-02
// ═══════════════════════════════════════════════════════════
const TESTNET_CONFIG: NetworkConfig = {
  // Core protocol — from bonzoPlugin bonzo-contracts.json
  lendingPool: "0x7710a96b01e02eD00768C3b39BfA7B4f1c128c62",
  wethGateway: "0xA824820e35D6AE4D368153e83b7920B2DC3Cf964",
  dataProvider: "0xe7432d9012d2a6cd811FDf42ecE43a0aa680c958",
  addressesProviderRegistry: "0x9c29f4f9BdDacB2De586d11e5DC8Aaf7065916b6",
  addressesProvider: "0xa184010a65343280e795eeF0B0B6eD870b551e6f",
  lendingPoolConfigurator: "0xCd97B221ddEd10E6d94B0f00D20aB94c52aC9352",
  lendingPoolCollateralManager: "0x137c29aE0b52102aD109c502EF014ec5197DCCa2",
  // Oracles
  oracle: "0x4aa505a308EdBA7854C031976DB56A8Aa635d3a6",
  priceOracle: "0xd70c1Bd2d27d3b2016De045ED28329e714fB6E07",
  lendingRateOracle: "0xcAF8F3925F18C151906a59C6e51e14Caa07f16f1",
  // Helpers
  walletBalanceProvider: "0x2D0c5133666113BB04d71D9Dbc34f0e2dc6B1F52",
  // SaucerSwap WHBAR wrapper (same across deployments)
  saucerSwapWrapper: "0x0000000000000000000000000000000000003ad1", // 0.0.15057
  hashscanBase: "https://hashscan.io/testnet",
  bonzoApiBase: "", // No public testnet data API
  // Testnet tokens — aToken/variableDebt from bonzoPlugin bonzo-contracts.json
  tokens: {
    WHBAR: {
      evmAddr: "0x0000000000000000000000000000000000003ad2",
      htsId: "0.0.15058",
      decimals: 8,
      aToken: "0xe65dAF55D9A2F7768bdd27d430726b2Df7144636",
      variableDebt: "0xacE6c84d8737e377c1f85BE5f7BC82E4fF3248E6",
    },
    HBAR: {
      evmAddr: "0x0000000000000000000000000000000000003ad2",
      htsId: "0.0.15058",
      decimals: 8,
      aToken: "0xe65dAF55D9A2F7768bdd27d430726b2Df7144636",
      variableDebt: "0xacE6c84d8737e377c1f85BE5f7BC82E4fF3248E6",
    },
    USDC: {
      evmAddr: "0x0000000000000000000000000000000000001549",
      htsId: "0.0.5449",
      decimals: 6,
      aToken: "0xee72C37fEc48C9FeC6bbD0982ecEb7d7a038841e",
      variableDebt: "0x5F52FB083A807554b0A9bdB6b5777Fa4C620b7A6",
    },
    HBARX: {
      evmAddr: "0x0000000000000000000000000000000000220ced",
      htsId: "0.0.2233069",
      decimals: 8,
      aToken: "0x37FfB9d2c91ef6858E54DD5B05805339A1aEA207",
      variableDebt: "0x7A617Ec0B2aF56d4BD5f2aeBB547fcD3439987AD",
    },
    SAUCE: {
      evmAddr: "0x0000000000000000000000000000000000120f46",
      htsId: "0.0.1183558",
      decimals: 6,
      aToken: "0xC4d4315Ac919253b8bA48D5e609594921eb5525c",
      variableDebt: "0x65be417A48511d2f20332673038e5647a4ED194D",
    },
    KARATE: {
      evmAddr: "0x00000000000000000000000000000000003991ed",
      htsId: "0.0.3772909",
      decimals: 8,
      aToken: "0xd5D2e84E2d29E3b8C49C2ec08Bc9d5CA01639de9",
      variableDebt: "0x0AeCA92D29fF9CEb3751dB01034bFE71E7f6B13c",
    },
    XSAUCE: {
      evmAddr: "0x000000000000000000000000000000000015a59b",
      htsId: "0.0.1418651",
      decimals: 8,
      aToken: "0x2217F55E2056C15a21ED7a600446094C36720f29",
      variableDebt: "0xD1C09A79C5A2b1eA488A1a00b23FCEDa40f750f9",
    },
  },
};

// ═══════════════════════════════════════════════════════════
// MAINNET CONFIG — from official bonzoPlugin bonzo-contracts.json
// Source: https://github.com/Bonzo-Labs/bonzoPlugin/blob/main/bonzo-contracts.json
// + Bonzo Finance docs "Supported Mainnet Assets" for HTS IDs
// ═══════════════════════════════════════════════════════════
const MAINNET_CONFIG: NetworkConfig = {
  // Lending Pool Infrastructure
  lendingPool: "0x236897c518996163E7b313aD21D1C9fCC7BA1afc", // 0.0.7308459
  wethGateway: "0x9a601543e9264255BebB20Cef0E7924e97127105", // 0.0.7308485
  dataProvider: "0x78feDC4D7010E409A0c0c7aF964cc517D3dCde18", // 0.0.7308483
  addressesProviderRegistry: "0xE20273F10D1b85BaF56F6063cd5271C885427EC5", // 0.0.7308449
  addressesProvider: "0x76b846DAB3646527bfb75952E1f33AfAA72B56D1", // 0.0.7308451
  lendingPoolConfigurator: "0xf41332220e51Ca8dB22De683fB0157e644e7A963", // 0.0.7308462
  lendingPoolCollateralManager: "0x7687E1AaAD6cE335fb7d64ede7Dd7273De883698", // 0.0.7308529
  // Oracles
  oracle: "0xc0Bb4030b55093981700559a0B751DCf7Db03cBB", // 0.0.7308480
  priceOracle: "0x9F1981afD19e2881A4Acb39aa144c7fBc4a6D8b3", // 0.0.7308479
  lendingRateOracle: "0x2a9272C588c8b6C04757577d08285211C18232DD", // 0.0.7308481
  // Helpers
  walletBalanceProvider: "0xD64ffB431cF66fDEDB6f98Af07c63F49295b69e5", // 0.0.7308530
  saucerSwapWrapper: "0x0000000000000000000000000000000000163b59",
  hashscanBase: "https://hashscan.io/mainnet",
  // Per Bonzo docs warning: use staging URL temporarily
  bonzoApiBase: "https://mainnet-data-staging.bonzo.finance",
  // All mainnet tokens from "Supported Mainnet Assets"
  tokens: {
    WHBAR: {
      evmAddr: "0x0000000000000000000000000000000000163b5a",
      htsId: "0.0.1456986",
      decimals: 8,
      aToken: "0x6e96a607F2F5657b39bf58293d1A006f9415aF32",
      variableDebt: "0xCD5A1FF3AD6EDd7e85ae6De3854f3915dD8c9103",
    },
    HBAR: {
      evmAddr: "0x0000000000000000000000000000000000163b5a",
      htsId: "0.0.1456986",
      decimals: 8,
      aToken: "0x6e96a607F2F5657b39bf58293d1A006f9415aF32",
      variableDebt: "0xCD5A1FF3AD6EDd7e85ae6De3854f3915dD8c9103",
    },
    HBARX: {
      evmAddr: "0x00000000000000000000000000000000000cba44",
      htsId: "0.0.834116",
      decimals: 8,
      aToken: "0x40EBC87627Fe4689567C47c8C9C84EDC4Cf29132",
      variableDebt: "0xF4167Af5C303ec2aD1B96316fE013CA96Eb141B5",
    },
    USDC: {
      evmAddr: "0x000000000000000000000000000000000006f89a",
      htsId: "0.0.456858",
      decimals: 6,
      aToken: "0xB7687538c7f4CAD022d5e97CC778d0b46457c5DB",
      variableDebt: "0x8a90C2f80Fc266e204cb37387c69EA2ed42A3cc1",
    },
    SAUCE: {
      evmAddr: "0x00000000000000000000000000000000000b2ad5",
      htsId: "0.0.731861",
      decimals: 6,
      aToken: "0x2bcC0a304c0bc816D501c7C647D958b9A5bc716d",
      variableDebt: "0x736c5dbB8ADC643f04c1e13a9C25f28d3D4f0503",
    },
    XSAUCE: {
      evmAddr: "0x00000000000000000000000000000000001647e8",
      htsId: "0.0.1460200",
      decimals: 8,
      aToken: "0xEc9CEF1167b4673726B1e5f5A978150e63cDf23b",
      variableDebt: "0x08c816eC7aC0580c802151E4efFbDa687f7Cac2a",
    },
    KARATE: {
      evmAddr: "0x000000000000000000000000000000000022d6de",
      htsId: "0.0.2283230",
      decimals: 8,
      aToken: "0x98262552C8246Ffb55E3539Ceb51838912402959",
      variableDebt: "0xB6209F33982CE99139Ab325b13B260d32287A807",
    },
    DOVU: {
      evmAddr: "0x000000000000000000000000000000000038b3db",
      htsId: "0.0.3716059",
      decimals: 8,
      aToken: "0x89D2789481cB4CB5B6949Ff55EBA5629c5bC5B1E",
      variableDebt: "0x9d81E1676A7e116ec725208DdeAB11929eA3F7A6",
    },
    HST: {
      evmAddr: "0x00000000000000000000000000000000000ec585",
      htsId: "0.0.968069",
      decimals: 8,
      aToken: "0x2e63e864AAD2ce87b45d2C93bc126850DC5122c9",
      variableDebt: "0xdc6e9E967648cd28E8BaF2EB1124ef7C9C5Bd027",
    },
    PACK: {
      evmAddr: "0x0000000000000000000000000000000000492a28",
      htsId: "0.0.4794920",
      decimals: 8,
      aToken: "0x5F98C43ce4b4765638d69B4a2407a2186A347CB9",
      variableDebt: "0x63c7EF5398E8Fe23D95E762802F011590A7816a1",
    },
    STEAM: {
      evmAddr: "0x000000000000000000000000000000000030fb8b",
      htsId: "0.0.3210123",
      decimals: 8,
      aToken: "0x46BEf910150a3880ce6eAC60A059E70494A4805e",
      variableDebt: "0xdFD1D43cbd700AEC5bcc151d028274412d31db70",
    },
    GRELF: {
      evmAddr: "0x000000000000000000000000000000000011afa2",
      htsId: "0.0.1159074",
      decimals: 8,
      aToken: "0xb8c34c9a46AEdf1decb846F942861EeE7dE78075",
      variableDebt: "0x0E509Fc72f4b5d97494c0d45fcd1cF04d531Be44",
    },
    KBL: {
      evmAddr: "0x00000000000000000000000000000000005b665a",
      htsId: "0.0.5989978",
      decimals: 8,
      aToken: "0xC45A34b9D9e29fBfCAACC9193FD0CE950e63Ba81",
      variableDebt: "0x6a74429E0D761085C4D5520A14ab59874dfe1C06",
    },
    BONZO: {
      evmAddr: "0x00000000000000000000000000000000007e545e",
      htsId: "0.0.8279134",
      decimals: 8,
      aToken: "0xC5aa104d5e7D9baE3A69Ddd5A722b8F6B69729c9",
      variableDebt: "0x1790C9169480c5C67D8011cd0311DDE1b2DC76e0",
    },
  },
};

// Active config
const NET = HEDERA_NETWORK === "mainnet" ? MAINNET_CONFIG : TESTNET_CONFIG;
const LENDING_POOL_EVM = NET.lendingPool;
const WETH_GATEWAY_EVM = NET.wethGateway;
const DATA_PROVIDER_EVM = NET.dataProvider;
const SAUCERSWAP_WRAPPER = NET.saucerSwapWrapper;
const TOKEN_MAP = NET.tokens;

console.log(`[BonzoExec] Network: ${HEDERA_NETWORK}`);
console.log(`[BonzoExec]   LendingPool:  ${LENDING_POOL_EVM}`);
console.log(`[BonzoExec]   WETHGateway:  ${WETH_GATEWAY_EVM}`);
console.log(`[BonzoExec]   DataProvider: ${DATA_PROVIDER_EVM}`);
console.log(`[BonzoExec]   Oracle:       ${NET.oracle}`);
if (NET.bonzoApiBase)
  console.log(`[BonzoExec]   Bonzo API:    ${NET.bonzoApiBase}`);

// ═══════════════════════════════════════════════════════════
// ABIs — Aave V2 compatible (Bonzo is Aave V2 fork)
// ═══════════════════════════════════════════════════════════

const ERC20_ABI = new Interface([
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
]);

const LENDING_POOL_ABI = new Interface([
  "function deposit(address asset, uint256 amount, address onBehalfOf, uint16 referralCode)",
  "function withdraw(address asset, uint256 amount, address to) returns (uint256)",
  "function borrow(address asset, uint256 amount, uint256 interestRateMode, uint16 referralCode, address onBehalfOf)",
  "function repay(address asset, uint256 amount, uint256 rateMode, address onBehalfOf) returns (uint256)",
  "function getUserAccountData(address user) view returns (uint256 totalCollateralETH, uint256 totalDebtETH, uint256 availableBorrowsETH, uint256 currentLiquidationThreshold, uint256 ltv, uint256 healthFactor)",
  "function getReservesList() view returns (address[])",
]);

const WETH_GATEWAY_ABI = new Interface([
  "function depositETH(address lendingPool, address onBehalfOf, uint16 referralCode) payable",
  "function withdrawETH(address lendingPool, uint256 amount, address to)",
]);

const WHBAR_WRAPPER_ABI = new Interface(["function deposit() payable"]);

const DATA_PROVIDER_ABI = new Interface([
  "function getUserReserveData(address asset, address user) view returns (uint256 currentATokenBalance, uint256 currentStableDebt, uint256 currentVariableDebt, uint256 principalStableDebt, uint256 scaledVariableDebt, uint256 stableBorrowRate, uint256 liquidityRate, uint40 stableRateLastUpdated, bool usageAsCollateralEnabled)",
  "function getAllReservesTokens() view returns (tuple(string symbol, address tokenAddress)[])",
  "function getReserveTokensAddresses(address asset) view returns (address aTokenAddress, address stableDebtTokenAddress, address variableDebtTokenAddress)",
]);

// ═══════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════

export interface ExecutionResult {
  success: boolean;
  action: string;
  txIds: string[];
  hashScanLinks: string[];
  details: string;
  error?: string;
  toolsUsed: string[];
}

export interface PositionInfo {
  token: string;
  aTokenBalance: string;
  aTokenBalanceRaw: bigint;
  variableDebt: string;
  variableDebtRaw: bigint;
  stableDebt: string;
  stableDebtRaw: bigint;
  isCollateral: boolean;
  decimals: number;
}

export interface AccountData {
  totalCollateralETH: number;
  totalDebtETH: number;
  availableBorrowsETH: number;
  healthFactor: number;
}

// Bonzo Data API types (from docs: https://docs.bonzo.finance → Lend Data API)
export interface BonzoDashboardResponse {
  chain_id: string;
  network_name: string;
  hts_address: string;
  evm_address: string;
  reserves: BonzoReserve[];
  user_credit: {
    hbar_balance: BonzoBalanceInfo;
    total_supply: BonzoBalanceInfo;
    total_collateral: BonzoBalanceInfo;
    total_debt: BonzoBalanceInfo;
    credit_limit: BonzoBalanceInfo;
    liquidation_ltv: number;
    current_ltv: number;
    max_ltv: number;
    health_factor: number;
  };
  average_supply_apy: number;
  average_borrow_apy: number;
  average_net_apy: number;
  timestamp: string;
}

export interface BonzoReserve {
  id: number;
  name: string;
  symbol: string;
  coingecko_id: string;
  hts_address: string;
  evm_address: string;
  atoken_address: string;
  stable_debt_address: string;
  variable_debt_address: string;
  protocol_treasury_address: string;
  decimals: number;
  ltv: number;
  liquidation_threshold: number;
  liquidation_bonus: number;
  active: boolean;
  frozen: boolean;
  variable_borrowing_enabled: boolean;
  stable_borrowing_enabled: boolean;
  reserve_factor: number;
  token_balance: BonzoBalanceInfo;
  atoken_balance: BonzoBalanceInfo;
  stable_debt_balance: BonzoBalanceInfo;
  variable_debt_balance: BonzoBalanceInfo;
  available_liquidity: BonzoBalanceInfo;
  total_stable_debt: BonzoBalanceInfo;
  total_variable_debt: BonzoBalanceInfo;
  total_supply: BonzoBalanceInfo;
  borrow_cap: BonzoBalanceInfo;
  supply_cap: BonzoBalanceInfo;
  utilization_rate: number;
  supply_apy: number;
  variable_borrow_apy: number;
  stable_borrow_apy: number;
  use_as_collateral_enabled: boolean;
  price_weibars: string;
  price_usd_wad: string;
  price_usd_display: string;
}

export interface BonzoBalanceInfo {
  tiny_token: string;
  token_display: string;
  hbar_tinybar: string;
  hbar_display: string;
  usd_wad: string;
  usd_display: string;
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function txLink(txId: string): string {
  const parts = txId.split("@");
  if (parts.length === 2) {
    return `${NET.hashscanBase}/transaction/${parts[0]}-${parts[1].replace(
      ".",
      "-"
    )}`;
  }
  return `${NET.hashscanBase}/transaction/${txId}`;
}

function toSmallestUnit(amount: number, decimals: number): bigint {
  return BigInt(Math.round(amount * Math.pow(10, decimals)));
}

function getToken(symbol: string): TokenConfig {
  const key = symbol.toUpperCase().trim();
  return TOKEN_MAP[key] || TOKEN_MAP.WHBAR || TOKEN_MAP.HBAR;
}

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

const assocCache = new Set<string>();

// ═══════════════════════════════════════════════════════════
// AUTO-ASSOCIATION — enables unlimited HTS token auto-association
// This ensures aTokens/debtTokens from Bonzo can be received
// without needing to know exact HTS IDs ahead of time.
// ═══════════════════════════════════════════════════════════
let autoAssocDone = false;

async function ensureAutoAssociation(client: any): Promise<void> {
  if (autoAssocDone) return;
  const operatorId = client.operatorAccountId!.toString();
  try {
    // Check current auto-association limit
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(operatorId))
      .execute(client);
    const currentSlots = (info as any).maxAutomaticTokenAssociations ?? 0;
    if (currentSlots < 0 || currentSlots >= 100) {
      // Already unlimited (-1) or >= 100 slots — good enough
      console.log(
        `[BonzoExec] Auto-association: ${currentSlots} slots (sufficient)`
      );
      autoAssocDone = true;
      return;
    }
    // Set to -1 (unlimited) so any aToken/debtToken can be received
    console.log(
      `[BonzoExec] Auto-association: upgrading from ${currentSlots} to unlimited (-1)...`
    );
    const tx = new AccountUpdateTransaction()
      .setAccountId(AccountId.fromString(operatorId))
      .setMaxAutomaticTokenAssociations(-1);
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(`[BonzoExec] Auto-association: ${receipt.status} → unlimited`);
    autoAssocDone = true;
  } catch (e: any) {
    // Fallback: try setting to 100 if -1 not supported
    console.warn(
      `[BonzoExec] Auto-association unlimited failed: ${e.message?.substring(
        0,
        80
      )}`
    );
    try {
      const tx = new AccountUpdateTransaction()
        .setAccountId(AccountId.fromString(operatorId))
        .setMaxAutomaticTokenAssociations(100);
      const resp = await tx.execute(client);
      const receipt = await resp.getReceipt(client);
      console.log(
        `[BonzoExec] Auto-association fallback: ${receipt.status} → 100 slots`
      );
      autoAssocDone = true;
    } catch (e2: any) {
      console.warn(
        `[BonzoExec] Auto-association fallback also failed: ${e2.message?.substring(
          0,
          80
        )}`
      );
    }
  }
}

async function ensureAssociated(
  client: any,
  accountId: string,
  htsId: string
): Promise<void> {
  const key = `${accountId}:${htsId}`;
  if (assocCache.has(key)) return;
  try {
    const tx = new TokenAssociateTransaction()
      .setAccountId(AccountId.fromString(accountId))
      .setTokenIds([TokenId.fromString(htsId)]);
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(`[BonzoExec] Association ${htsId}: ${receipt.status}`);
    assocCache.add(key);
  } catch (e: any) {
    const msg = e.message || "";
    if (
      msg.includes("TOKEN_ALREADY_ASSOCIATED") ||
      msg.includes("ALREADY_ASSOCIATED")
    ) {
      assocCache.add(key);
    } else {
      console.warn(`[BonzoExec] Association warning: ${msg.substring(0, 100)}`);
    }
  }
}

async function approveToken(
  client: any,
  tokenEvm: string,
  spender: string,
  amount: bigint
): Promise<{ success: boolean; txId: string; error?: string }> {
  console.log(`[BonzoExec] Approving ${tokenEvm} for spender ${spender}`);
  const data = ERC20_ABI.encodeFunctionData("approve", [spender, amount]);
  const tx = new ContractExecuteTransaction()
    .setContractId(ContractId.fromSolidityAddress(tokenEvm))
    .setGas(1_000_000)
    .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
    .setMaxTransactionFee(new Hbar(5));
  const resp = await tx.execute(client);
  const receipt = await resp.getReceipt(client);
  const txId = resp.transactionId.toString();
  const status = receipt.status.toString();
  console.log(`[BonzoExec] approve() -> ${status}`);
  return {
    success: status === "SUCCESS",
    txId,
    error: status !== "SUCCESS" ? status : undefined,
  };
}

// ═══════════════════════════════════════════════════════════
// BONZO DATA API
// Docs: https://docs.bonzo.finance → Developer → Lend Data API
// Per docs warning: use mainnet-data-staging.bonzo.finance temporarily
// ═══════════════════════════════════════════════════════════

const BONZO_API_URLS = NET.bonzoApiBase
  ? [NET.bonzoApiBase, "https://data.bonzo.finance"]
  : [];

async function bonzoApiFetch(path: string): Promise<any | null> {
  for (const base of BONZO_API_URLS) {
    try {
      const url = `${base}${path}`;
      console.log(`[BonzoExec] Bonzo API: ${url}`);
      const res = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
      if (!res.ok) {
        console.warn(`[BonzoExec] Bonzo API ${url}: ${res.status}`);
        continue;
      }
      const data = await res.json();
      console.log(`[BonzoExec] Bonzo API success from ${base}`);
      return data;
    } catch (e: any) {
      console.warn(
        `[BonzoExec] Bonzo API ${base} error: ${e.message?.substring(0, 80)}`
      );
    }
  }
  return null;
}

export async function fetchBonzoDashboard(
  accountId: string
): Promise<BonzoDashboardResponse | null> {
  const data = await bonzoApiFetch(`/dashboard/${accountId}`);
  if (data?.reserves)
    console.log(
      `[BonzoExec] Dashboard: ${data.reserves.length} reserves, HF: ${data.user_credit?.health_factor}`
    );
  return data as BonzoDashboardResponse | null;
}

export async function fetchBonzoMarket(): Promise<any | null> {
  return bonzoApiFetch("/market");
}
export async function fetchBonzoInfo(): Promise<any | null> {
  return bonzoApiFetch("/info");
}
export async function fetchBonzoStats(): Promise<any | null> {
  return bonzoApiFetch("/stats");
}
export async function fetchBonzoDebtors(): Promise<any | null> {
  return bonzoApiFetch("/debtors");
}
export async function fetchBonzoToken(): Promise<any | null> {
  return bonzoApiFetch("/bonzo");
}

// ═══════════════════════════════════════════════════════════
// QUERY — On-chain via LendingPool & DataProvider
// ═══════════════════════════════════════════════════════════

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
      `[BonzoExec] getUserAccountData failed: ${e.message?.substring(0, 60)}`
    );
  }
  return null;
}

async function queryUserReserveData(
  client: any,
  assetEvm: string,
  userEvm: string
): Promise<{
  aTokenBalance: bigint;
  stableDebt: bigint;
  variableDebt: bigint;
  isCollateral: boolean;
} | null> {
  try {
    const data = DATA_PROVIDER_ABI.encodeFunctionData("getUserReserveData", [
      assetEvm,
      userEvm,
    ]);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(DATA_PROVIDER_EVM))
      .setGas(200_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    const bytes = result.bytes;
    if (bytes && bytes.length >= 288) {
      const decoded = defaultAbiCoder.decode(
        [
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint40",
          "bool",
        ],
        bytes
      );
      return {
        aTokenBalance: BigInt(decoded[0].toString()),
        stableDebt: BigInt(decoded[1].toString()),
        variableDebt: BigInt(decoded[2].toString()),
        isCollateral: decoded[8],
      };
    }
  } catch (e: any) {
    console.warn(
      `[BonzoExec] getUserReserveData failed for ${assetEvm}: ${e.message?.substring(
        0,
        60
      )}`
    );
  }
  return null;
}

// Discover on-chain reserves (catches tokens not in our static map)
async function queryReservesList(client: any): Promise<string[]> {
  try {
    const data = LENDING_POOL_ABI.encodeFunctionData("getReservesList", []);
    const query = new ContractCallQuery()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(300_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));
    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 64) {
      const decoded = defaultAbiCoder.decode(["address[]"], result.bytes);
      const addresses: string[] = decoded[0].map((a: string) =>
        a.toLowerCase()
      );
      console.log(`[BonzoExec] On-chain reserves: ${addresses.length} found`);
      return addresses;
    }
  } catch (e: any) {
    console.warn(
      `[BonzoExec] getReservesList failed: ${e.message?.substring(0, 60)}`
    );
  }
  return [];
}

export async function queryAllPositions(): Promise<PositionInfo[]> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const userEvm = await getEvmAddress(client, operatorId);
  const positions: PositionInfo[] = [];

  console.log(
    `[BonzoExec] Querying positions for ${operatorId} (${userEvm}) on ${HEDERA_NETWORK}`
  );

  // Build token list from static map + on-chain discovery
  const queriedAddrs = new Set<string>();
  const tokensToQuery: Array<{
    symbol: string;
    evmAddr: string;
    decimals: number;
  }> = [];

  for (const [symbol, token] of Object.entries(TOKEN_MAP)) {
    if (symbol === "HBAR") continue;
    const addr = token.evmAddr.toLowerCase();
    if (queriedAddrs.has(addr)) continue;
    queriedAddrs.add(addr);
    tokensToQuery.push({
      symbol,
      evmAddr: token.evmAddr,
      decimals: token.decimals,
    });
  }

  // Discover additional reserves from on-chain
  try {
    const onChainReserves = await queryReservesList(client);
    for (const reserveAddr of onChainReserves) {
      if (!queriedAddrs.has(reserveAddr)) {
        queriedAddrs.add(reserveAddr);
        tokensToQuery.push({
          symbol: `TOKEN_${reserveAddr.slice(-6)}`,
          evmAddr: reserveAddr,
          decimals: 8,
        });
      }
    }
  } catch {}

  for (const { symbol, evmAddr, decimals } of tokensToQuery) {
    const rd = await queryUserReserveData(client, evmAddr, userEvm);
    if (!rd) continue;

    const { aTokenBalance, stableDebt, variableDebt, isCollateral } = rd;
    if (
      aTokenBalance > BigInt(0) ||
      variableDebt > BigInt(0) ||
      stableDebt > BigInt(0)
    ) {
      const humanSupply = Number(aTokenBalance) / Math.pow(10, decimals);
      const humanVarDebt = Number(variableDebt) / Math.pow(10, decimals);
      const humanStableDebt = Number(stableDebt) / Math.pow(10, decimals);

      positions.push({
        token: symbol,
        aTokenBalance: humanSupply.toFixed(decimals > 6 ? 4 : 2),
        aTokenBalanceRaw: aTokenBalance,
        variableDebt: humanVarDebt.toFixed(decimals > 6 ? 4 : 2),
        variableDebtRaw: variableDebt,
        stableDebt: humanStableDebt.toFixed(decimals > 6 ? 4 : 2),
        stableDebtRaw: stableDebt,
        isCollateral,
        decimals,
      });
      console.log(
        `[BonzoExec]   ${symbol}: ${humanSupply.toFixed(
          4
        )} supplied, ${humanVarDebt.toFixed(4)} var debt`
      );
    }
  }
  return positions;
}

// ═══════════════════════════════════════════════════════════
// DEPOSIT
// ═══════════════════════════════════════════════════════════
export async function executeDeposit(
  tokenSymbol: string,
  amount: number
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const isHbar = ["HBAR", "WHBAR"].includes(tokenSymbol.toUpperCase());
  const token = getToken(tokenSymbol);
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  console.log(`[BonzoExec] === DEPOSIT ${amount} ${tokenSymbol} ===`);
  console.log(`[BonzoExec] Operator: ${operatorId}, onBehalfOf: ${onBehalfOf}`);
  console.log(
    `[BonzoExec] LendingPool: ${LENDING_POOL_EVM}, WETHGateway: ${WETH_GATEWAY_EVM}`
  );

  // Ensure auto-association so aTokens can be received
  await ensureAutoAssociation(client);

  try {
    const amountWei = toSmallestUnit(amount, token.decimals);

    if (isHbar) {
      console.log(
        `[BonzoExec] Strategy: WETHGateway.depositETH -> fallback: wrap+approve+deposit`
      );
      let success = false;
      let lastErr = "";

      // === Attempt 1: WETHGateway.depositETH (atomic) ===
      try {
        console.log(
          `[BonzoExec] WETHGateway.depositETH(${LENDING_POOL_EVM}, ${onBehalfOf}, 0) with ${amount} HBAR`
        );
        const data = WETH_GATEWAY_ABI.encodeFunctionData("depositETH", [
          LENDING_POOL_EVM,
          onBehalfOf,
          0,
        ]);
        const tx = new ContractExecuteTransaction()
          .setContractId(ContractId.fromSolidityAddress(WETH_GATEWAY_EVM))
          .setGas(1_500_000)
          .setPayableAmount(new Hbar(amount))
          .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
          .setMaxTransactionFee(new Hbar(5));
        const resp = await tx.execute(client);
        const receipt = await resp.getReceipt(client);
        const txId = resp.transactionId.toString();
        const status = receipt.status.toString();
        txIds.push(txId);
        links.push(txLink(txId));
        tools.push("WETHGateway.depositETH");

        if (status === "SUCCESS") {
          success = true;
          console.log(
            `[BonzoExec] WETHGateway.depositETH -> SUCCESS (${txId})`
          );
        } else {
          lastErr = status;
          console.warn(`[BonzoExec] WETHGateway.depositETH -> ${status}`);
        }
      } catch (eGw: any) {
        lastErr = eGw.message || "unknown";
        console.warn(
          `[BonzoExec] WETHGateway failed: ${lastErr.substring(0, 120)}`
        );
      }

      // === Attempt 2: Manual wrap → approve → LendingPool.deposit() ===
      if (!success) {
        console.log(
          `[BonzoExec] Fallback: wrap HBAR -> WHBAR -> approve -> LendingPool.deposit()`
        );
        try {
          const wrapData = WHBAR_WRAPPER_ABI.encodeFunctionData("deposit", []);
          const wrapTx = new ContractExecuteTransaction()
            .setContractId(ContractId.fromSolidityAddress(SAUCERSWAP_WRAPPER))
            .setGas(800_000)
            .setPayableAmount(new Hbar(amount))
            .setFunctionParameters(Buffer.from(wrapData.slice(2), "hex"))
            .setMaxTransactionFee(new Hbar(3));
          const wrapResp = await wrapTx.execute(client);
          const wrapReceipt = await wrapResp.getReceipt(client);
          const wrapTxId = wrapResp.transactionId.toString();
          const wrapStatus = wrapReceipt.status.toString();
          txIds.push(wrapTxId);
          links.push(txLink(wrapTxId));
          tools.push("SaucerSwap.deposit(wrap)");
          if (wrapStatus !== "SUCCESS")
            return {
              success: false,
              action: "deposit",
              txIds,
              hashScanLinks: links,
              details: `HBAR wrapping failed: ${wrapStatus}`,
              error: wrapStatus,
              toolsUsed: tools,
            };

          const approve = await approveToken(
            client,
            token.evmAddr,
            LENDING_POOL_EVM,
            amountWei
          );
          txIds.push(approve.txId);
          links.push(txLink(approve.txId));
          tools.push("ERC20.approve(WHBAR)");
          if (!approve.success)
            return {
              success: false,
              action: "deposit",
              txIds,
              hashScanLinks: links,
              details: `WHBAR approve failed: ${approve.error}`,
              error: approve.error,
              toolsUsed: tools,
            };

          const depositData = LENDING_POOL_ABI.encodeFunctionData("deposit", [
            token.evmAddr,
            amountWei,
            onBehalfOf,
            0,
          ]);
          const depositTx = new ContractExecuteTransaction()
            .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
            .setGas(1_000_000)
            .setFunctionParameters(Buffer.from(depositData.slice(2), "hex"))
            .setMaxTransactionFee(new Hbar(3));
          const depositResp = await depositTx.execute(client);
          const depositReceipt = await depositResp.getReceipt(client);
          const depositTxId = depositResp.transactionId.toString();
          const depositStatus = depositReceipt.status.toString();
          txIds.push(depositTxId);
          links.push(txLink(depositTxId));
          tools.push("LendingPool.deposit");
          success = depositStatus === "SUCCESS";
          if (!success) lastErr = depositStatus;
        } catch (eWrap: any) {
          lastErr = eWrap.message || "unknown";
          console.warn(
            `[BonzoExec] Wrap+deposit fallback failed: ${lastErr.substring(
              0,
              120
            )}`
          );
        }
      }

      return {
        success,
        action: "deposit",
        txIds,
        hashScanLinks: links,
        details: success
          ? `Deposited ${amount} HBAR to Bonzo Finance.`
          : `HBAR deposit failed: ${lastErr}`,
        error: success ? undefined : lastErr,
        toolsUsed: tools,
      };
    } else {
      // ═══ Non-HBAR: approve → LendingPool.deposit() ═══
      await ensureAssociated(client, operatorId, token.htsId);
      const approve = await approveToken(
        client,
        token.evmAddr,
        LENDING_POOL_EVM,
        amountWei
      );
      txIds.push(approve.txId);
      links.push(txLink(approve.txId));
      tools.push("ERC20.approve");
      if (!approve.success)
        return {
          success: false,
          action: "deposit",
          txIds,
          hashScanLinks: links,
          details: `Approve failed: ${approve.error}`,
          error: approve.error,
          toolsUsed: tools,
        };

      const data = LENDING_POOL_ABI.encodeFunctionData("deposit", [
        token.evmAddr,
        amountWei,
        onBehalfOf,
        0,
      ]);
      const tx = new ContractExecuteTransaction()
        .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
        .setGas(1_000_000)
        .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
        .setMaxTransactionFee(new Hbar(3));
      const resp = await tx.execute(client);
      const receipt = await resp.getReceipt(client);
      const txId = resp.transactionId.toString();
      const status = receipt.status.toString();
      txIds.push(txId);
      links.push(txLink(txId));
      tools.push("LendingPool.deposit");

      return {
        success: status === "SUCCESS",
        action: "deposit",
        txIds,
        hashScanLinks: links,
        details:
          status === "SUCCESS"
            ? `Deposited ${amount} ${tokenSymbol} to Bonzo Finance.`
            : `Deposit failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      action: "deposit",
      txIds,
      hashScanLinks: links,
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// WITHDRAW
// ═══════════════════════════════════════════════════════════
export async function executeWithdraw(
  tokenSymbol: string,
  amount?: number
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const toAddr = await getEvmAddress(client, operatorId);
  const token = getToken(tokenSymbol);
  const tools: string[] = [];

  console.log(`[BonzoExec] === WITHDRAW ${amount || "all"} ${tokenSymbol} ===`);

  // Ensure auto-association for receiving withdrawn tokens
  await ensureAutoAssociation(client);

  try {
    tools.push("DataProvider.getUserReserveData");
    const reserveData = await queryUserReserveData(
      client,
      token.evmAddr,
      toAddr
    );
    const bal = reserveData?.aTokenBalance ?? BigInt(0);
    if (bal === BigInt(0))
      return {
        success: false,
        action: "withdraw",
        txIds: [],
        hashScanLinks: [],
        details: `No ${tokenSymbol.toUpperCase()} position found.`,
        error: "NO_POSITION",
        toolsUsed: tools,
      };
    const balHuman = Number(bal) / Math.pow(10, token.decimals);

    tools.push("getUserAccountData");
    const accountData = await queryUserAccountData(client, toAddr);
    let withdrawAmount: bigint;
    let withdrawHuman: number;

    if (accountData && accountData.totalDebtETH > 0) {
      if (amount) {
        withdrawAmount = toSmallestUnit(amount, token.decimals);
        withdrawHuman = amount;
      } else {
        const safeExcessHbar = accountData.availableBorrowsETH * 0.9;
        if (safeExcessHbar <= 0)
          return {
            success: false,
            action: "withdraw",
            txIds: [],
            hashScanLinks: [],
            details: `Cannot withdraw — active debt. Repay first.`,
            error: "ACTIVE_DEBT",
            toolsUsed: tools,
          };
        const isWhbar = ["HBAR", "WHBAR"].includes(tokenSymbol.toUpperCase());
        withdrawHuman = isWhbar
          ? Math.min(safeExcessHbar, balHuman)
          : balHuman * 0.8;
        withdrawAmount = toSmallestUnit(withdrawHuman, token.decimals);
      }
    } else {
      withdrawAmount = amount ? toSmallestUnit(amount, token.decimals) : bal;
      withdrawHuman = amount || balHuman;
    }

    tools.push("LendingPool.withdraw");
    const data = LENDING_POOL_ABI.encodeFunctionData("withdraw", [
      token.evmAddr,
      withdrawAmount,
      toAddr,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const txId = resp.transactionId.toString();

    try {
      const receipt = await resp.getReceipt(client);
      const status = receipt.status.toString();
      return {
        success: status === "SUCCESS",
        action: "withdraw",
        txIds: [txId],
        hashScanLinks: [txLink(txId)],
        details:
          status === "SUCCESS"
            ? `Withdrew ${withdrawHuman.toFixed(
                4
              )} ${tokenSymbol} from Bonzo Finance.`
            : `Withdraw failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    } catch {
      return {
        success: false,
        action: "withdraw",
        txIds: [txId],
        hashScanLinks: [txLink(txId)],
        details: `Withdraw reverted. Try repaying loans first.`,
        error: "CONTRACT_REVERT",
        toolsUsed: tools,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      action: "withdraw",
      txIds: [],
      hashScanLinks: [],
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// BORROW
// ═══════════════════════════════════════════════════════════
export async function executeBorrow(
  tokenSymbol: string,
  amount: number,
  rateMode = "variable"
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const token = getToken(tokenSymbol);
  const amountWei = toSmallestUnit(amount, token.decimals);
  const rate = rateMode === "stable" ? 1 : 2;
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  console.log(
    `[BonzoExec] === BORROW ${amount} ${tokenSymbol} (${rateMode}) ===`
  );

  // Ensure auto-association so borrowed tokens can be received
  await ensureAutoAssociation(client);

  try {
    tools.push("getUserAccountData");
    const accountData = await queryUserAccountData(client, onBehalfOf);
    if (accountData) {
      if (accountData.totalCollateralETH === 0)
        return {
          success: false,
          action: "borrow",
          txIds: [],
          hashScanLinks: [],
          details: `Cannot borrow — no collateral. Deposit assets first.`,
          error: "NO_COLLATERAL",
          toolsUsed: tools,
        };
      if (accountData.availableBorrowsETH === 0)
        return {
          success: false,
          action: "borrow",
          txIds: [],
          hashScanLinks: [],
          details: `Borrowing limit reached. HF: ${accountData.healthFactor.toFixed(
            2
          )}`,
          error: "BORROW_LIMIT_REACHED",
          toolsUsed: tools,
        };

      const hbarPrice = 0.2;
      const availableUSD = accountData.availableBorrowsETH * hbarPrice;
      const isStable = ["USDC"].includes(tokenSymbol.toUpperCase());
      const borrowUSD = isStable ? amount : amount * hbarPrice;
      if (borrowUSD > availableUSD * 1.1)
        return {
          success: false,
          action: "borrow",
          txIds: [],
          hashScanLinks: [],
          details: `Exceeds borrowing power (~$${availableUSD.toFixed(
            0
          )}). Deposit more collateral.`,
          error: "INSUFFICIENT_COLLATERAL",
          toolsUsed: tools,
        };
    }

    await ensureAssociated(client, operatorId, token.htsId);
    const data = LENDING_POOL_ABI.encodeFunctionData("borrow", [
      token.evmAddr,
      amountWei,
      rate,
      0,
      onBehalfOf,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const txId = resp.transactionId.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    tools.push("LendingPool.borrow");
    try {
      const receipt = await resp.getReceipt(client);
      const status = receipt.status.toString();
      return {
        success: status === "SUCCESS",
        action: "borrow",
        txIds,
        hashScanLinks: links,
        details:
          status === "SUCCESS"
            ? `Borrowed ${amount} ${tokenSymbol} (${rateMode}) from Bonzo Finance.`
            : `Borrow failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    } catch {
      return {
        success: false,
        action: "borrow",
        txIds,
        hashScanLinks: links,
        details: `Borrow reverted. Check collateral and pool liquidity.`,
        error: "CONTRACT_REVERT",
        toolsUsed: tools,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      action: "borrow",
      txIds,
      hashScanLinks: links,
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// REPAY
// ═══════════════════════════════════════════════════════════
export async function executeRepay(
  tokenSymbol: string,
  amount?: number,
  rateMode = "variable"
): Promise<ExecutionResult> {
  const client = getHederaClient();
  const operatorId = client.operatorAccountId!.toString();
  const onBehalfOf = await getEvmAddress(client, operatorId);
  const token = getToken(tokenSymbol);
  const rate = rateMode === "stable" ? 1 : 2;
  const txIds: string[] = [];
  const links: string[] = [];
  const tools: string[] = [];

  console.log(
    `[BonzoExec] === REPAY ${amount || "all"} ${tokenSymbol} (${rateMode}) ===`
  );

  // Ensure auto-association for token handling
  await ensureAutoAssociation(client);

  try {
    tools.push("getUserAccountData");
    const accountData = await queryUserAccountData(client, onBehalfOf);
    if (accountData && accountData.totalDebtETH === 0)
      return {
        success: false,
        action: "repay",
        txIds: [],
        hashScanLinks: [],
        details: `No outstanding debt.`,
        error: "NO_DEBT",
        toolsUsed: tools,
      };

    tools.push("ERC20.balanceOf");
    let tokenBal = BigInt(0);
    try {
      const balData = ERC20_ABI.encodeFunctionData("balanceOf", [onBehalfOf]);
      const balQuery = new ContractCallQuery()
        .setContractId(ContractId.fromSolidityAddress(token.evmAddr))
        .setGas(100_000)
        .setFunctionParameters(Buffer.from(balData.slice(2), "hex"))
        .setMaxQueryPayment(new Hbar(1));
      const balResult = await balQuery.execute(client);
      if (balResult.bytes && balResult.bytes.length >= 32) {
        const decoded = defaultAbiCoder.decode(["uint256"], balResult.bytes);
        tokenBal = BigInt(decoded[0].toString());
      }
    } catch {}

    const tokenBalHuman = Number(tokenBal) / Math.pow(10, token.decimals);
    if (tokenBal === BigInt(0)) {
      const isHbar = ["HBAR", "WHBAR"].includes(tokenSymbol.toUpperCase());
      return {
        success: false,
        action: "repay",
        txIds: [],
        hashScanLinks: [],
        details: isHbar
          ? `0 WHBAR to repay with. Wrap HBAR first.`
          : `0 ${tokenSymbol} to repay with.`,
        error: "NO_TOKEN_BALANCE",
        toolsUsed: tools,
      };
    }

    const repayAmount = amount
      ? toSmallestUnit(amount, token.decimals)
      : tokenBal;
    const repayHuman = amount || tokenBalHuman;

    await ensureAssociated(client, operatorId, token.htsId);
    const approve = await approveToken(
      client,
      token.evmAddr,
      LENDING_POOL_EVM,
      repayAmount
    );
    txIds.push(approve.txId);
    links.push(txLink(approve.txId));
    tools.push("ERC20.approve");
    if (!approve.success)
      return {
        success: false,
        action: "repay",
        txIds,
        hashScanLinks: links,
        details: `Approve failed: ${approve.error}`,
        error: approve.error,
        toolsUsed: tools,
      };

    const data = LENDING_POOL_ABI.encodeFunctionData("repay", [
      token.evmAddr,
      repayAmount,
      rate,
      onBehalfOf,
    ]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const txId = resp.transactionId.toString();
    txIds.push(txId);
    links.push(txLink(txId));
    tools.push("LendingPool.repay");
    try {
      const receipt = await resp.getReceipt(client);
      const status = receipt.status.toString();
      return {
        success: status === "SUCCESS",
        action: "repay",
        txIds,
        hashScanLinks: links,
        details:
          status === "SUCCESS"
            ? `Repaid ${repayHuman} ${tokenSymbol} (${rateMode}) on Bonzo Finance.`
            : `Repay failed: ${status}`,
        error: status !== "SUCCESS" ? status : undefined,
        toolsUsed: tools,
      };
    } catch {
      return {
        success: false,
        action: "repay",
        txIds,
        hashScanLinks: links,
        details: `Repay reverted. Check debt balance.`,
        error: "CONTRACT_REVERT",
        toolsUsed: tools,
      };
    }
  } catch (e: any) {
    return {
      success: false,
      action: "repay",
      txIds,
      hashScanLinks: links,
      details: `Error: ${e.message}`,
      error: e.message,
      toolsUsed: tools,
    };
  }
}

// ═══════════════════════════════════════════════════════════
// EXPORT NETWORK INFO (for debugging/UI)
// ═══════════════════════════════════════════════════════════
export function getNetworkConfig() {
  return {
    network: HEDERA_NETWORK,
    lendingPool: LENDING_POOL_EVM,
    wethGateway: WETH_GATEWAY_EVM,
    dataProvider: DATA_PROVIDER_EVM,
    oracle: NET.oracle,
    hashscanBase: NET.hashscanBase,
    bonzoApiBase: NET.bonzoApiBase,
    tokenCount: Object.keys(TOKEN_MAP).length,
  };
}
