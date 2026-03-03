// ============================================
// Phase 0 Verification Script
// Tests all real external APIs - no keys needed
// Run: npx tsx scripts/verify-apis.ts
// ============================================

async function testBonzoAPI() {
  console.log("\n=== Testing Bonzo Finance Data API ===");

  // Test /market endpoint
  const marketRes = await fetch("https://data.bonzo.finance/market");
  if (!marketRes.ok) throw new Error(`Bonzo market API: ${marketRes.status}`);
  const marketData = await marketRes.json();

  console.log("✅ Bonzo /market endpoint working");
  console.log(`   Lending Pool: ${marketData.lending_pool_address}`);
  console.log(`   Reserves found: ${marketData.reserves?.length || 0}`);

  if (marketData.reserves) {
    console.log("\n   Live Reserve Data:");
    for (const r of marketData.reserves.slice(0, 5)) {
      console.log(
        `   ${r.symbol.padEnd(8)} | Supply APY: ${parseFloat(r.supply_apy || 0).toFixed(2)}% | Borrow APY: ${parseFloat(r.variable_borrow_apy || 0).toFixed(2)}% | Utilization: ${parseFloat(r.utilization_rate || 0).toFixed(1)}%`
      );
    }
  }

  // Test /dashboard endpoint
  const dashRes = await fetch("https://data.bonzo.finance/dashboard");
  if (dashRes.ok) {
    console.log("✅ Bonzo /dashboard endpoint working");
  } else {
    console.log("⚠️  Bonzo /dashboard returned", dashRes.status);
  }

  // Test /usage endpoint
  const usageRes = await fetch("https://data.bonzo.finance/usage");
  if (usageRes.ok) {
    const usage = await usageRes.json();
    console.log("✅ Bonzo /usage endpoint working");
    console.log(
      `   24h transactions: ${usage.total_successful_transactions || "N/A"}`
    );
    console.log(`   Active users: ${usage.active_users?.length || "N/A"}`);
  } else {
    console.log("⚠️  Bonzo /usage returned", usageRes.status);
  }
}

async function testCoinGeckoAPI() {
  console.log("\n=== Testing CoinGecko Price API ===");

  const res = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd&include_24hr_change=true&include_7d_change=true"
  );
  if (!res.ok) throw new Error(`CoinGecko API: ${res.status}`);
  const data = await res.json();
  const hbar = data["hedera-hashgraph"];

  console.log("✅ CoinGecko API working");
  console.log(`   HBAR Price: $${hbar.usd}`);
  console.log(`   24h Change: ${hbar.usd_24h_change?.toFixed(2)}%`);

  // Test price history
  const histRes = await fetch(
    "https://api.coingecko.com/api/v3/coins/hedera-hashgraph/market_chart?vs_currency=usd&days=7"
  );
  if (histRes.ok) {
    const hist = await histRes.json();
    console.log(
      `✅ CoinGecko price history working (${hist.prices?.length || 0} data points)`
    );
  }
}

async function testFearGreedAPI() {
  console.log("\n=== Testing Fear & Greed Index API ===");

  const res = await fetch("https://api.alternative.me/fng/?limit=1");
  if (!res.ok) throw new Error(`Fear & Greed API: ${res.status}`);
  const data = await res.json();
  const entry = data.data[0];

  console.log("✅ Fear & Greed Index API working");
  console.log(
    `   Current: ${entry.value} (${entry.value_classification})`
  );
}

async function testHederaMirrorNode() {
  console.log("\n=== Testing Hedera Mirror Node (Testnet) ===");

  const res = await fetch(
    "https://testnet.mirrornode.hedera.com/api/v1/network/supply"
  );
  if (!res.ok) throw new Error(`Mirror Node API: ${res.status}`);
  const data = await res.json();

  console.log("✅ Hedera Testnet Mirror Node working");
  console.log(`   Total supply: ${data.total_supply}`);

  // Test a known topic to verify HCS query works
  const topicRes = await fetch(
    "https://testnet.mirrornode.hedera.com/api/v1/topics/0.0.10/messages?limit=1"
  );
  if (topicRes.ok) {
    console.log("✅ HCS topic query endpoint working");
  }
}

async function main() {
  console.log("🔍 VaultMind Phase 0 - API Verification");
  console.log("========================================");
  console.log("Testing all real APIs (no mock data)...\n");

  let passed = 0;
  let failed = 0;

  try {
    await testBonzoAPI();
    passed++;
  } catch (e: any) {
    console.log("❌ Bonzo API FAILED:", e.message);
    failed++;
  }

  try {
    await testCoinGeckoAPI();
    passed++;
  } catch (e: any) {
    console.log("❌ CoinGecko API FAILED:", e.message);
    failed++;
  }

  try {
    await testFearGreedAPI();
    passed++;
  } catch (e: any) {
    console.log("❌ Fear & Greed API FAILED:", e.message);
    failed++;
  }

  try {
    await testHederaMirrorNode();
    passed++;
  } catch (e: any) {
    console.log("❌ Hedera Mirror Node FAILED:", e.message);
    failed++;
  }

  console.log("\n========================================");
  console.log(`Results: ${passed} passed, ${failed} failed out of 4 services`);

  if (failed === 0) {
    console.log("\n🎉 All APIs verified! You're ready for Phase 1.");
    console.log("\nNext steps:");
    console.log(
      "1. Create Hedera testnet account: https://portal.hedera.com/dashboard"
    );
    console.log("2. Get OpenAI API key: https://platform.openai.com/api-keys");
    console.log("3. Copy .env.example to .env.local and fill in your keys");
    console.log("4. Run: npm run dev");
  } else {
    console.log("\n⚠️  Some APIs failed. Check your network connection.");
  }
}

main().catch(console.error);
