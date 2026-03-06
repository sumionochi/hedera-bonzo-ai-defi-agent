#!/usr/bin/env node
// ============================================
// VaultMind — Account Setup for Bonzo Finance
// Run once to configure account for DeFi:
//   1. Set unlimited max auto-associations
//   2. Associate WHBAR and other key tokens
//   3. Verify account state
// ============================================

const {
  Client, PrivateKey, AccountId, AccountUpdateTransaction,
  AccountInfoQuery, TokenAssociateTransaction, TokenId,
  ContractCallQuery, ContractId, Hbar,
} = require("@hashgraph/sdk");
require("dotenv").config({ path: ".env.local" });

const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY;
const NETWORK = process.env.HEDERA_NETWORK || "testnet";

// Key tokens for Bonzo Finance
const TOKENS = {
  WHBAR:  "0.0.15058",
  USDC:   "0.0.5449",
  HBARX:  "0.0.2233069",
  SAUCE:  "0.0.1183558",
  KARATE: "0.0.3772909",
};

// Bonzo aTokens (ERC20 not HTS, but attempt association anyway)
const A_TOKENS = {
  aWHBAR: "0.0.5816542", // official WHBAR - may also need this
};

async function main() {
  if (!ACCOUNT_ID || !PRIVATE_KEY) {
    console.error("❌ Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in .env.local");
    process.exit(1);
  }

  const client = NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(
    AccountId.fromString(ACCOUNT_ID),
    PrivateKey.fromStringECDSA(PRIVATE_KEY)
  );

  console.log(`\n🔧 VaultMind Account Setup`);
  console.log(`   Network: ${NETWORK}`);
  console.log(`   Account: ${ACCOUNT_ID}\n`);

  // ═══ Step 1: Set unlimited auto-associations ═══
  console.log("═══ Step 1: Unlimited Auto-Associations ═══");
  try {
    const updateTx = await new AccountUpdateTransaction()
      .setAccountId(AccountId.fromString(ACCOUNT_ID))
      .setMaxAutomaticTokenAssociations(-1)
      .execute(client);
    const receipt = await updateTx.getReceipt(client);
    console.log(`✅ maxAutomaticTokenAssociations set to UNLIMITED: ${receipt.status}`);
  } catch (e) {
    const msg = e.message || "";
    if (msg.includes("EXISTING_AUTOMATIC_ASSOCIATIONS_EXCEED_GIVEN_LIMIT")) {
      console.log("⚠️  Already has associations exceeding limit — may already be unlimited");
    } else {
      console.warn(`⚠️  Could not set unlimited associations: ${msg.substring(0, 100)}`);
    }
  }

  // ═══ Step 2: Associate key tokens ═══
  console.log("\n═══ Step 2: Token Associations ═══");
  for (const [name, tokenId] of Object.entries(TOKENS)) {
    try {
      const tx = await new TokenAssociateTransaction()
        .setAccountId(AccountId.fromString(ACCOUNT_ID))
        .setTokenIds([TokenId.fromString(tokenId)])
        .execute(client);
      const receipt = await tx.getReceipt(client);
      console.log(`✅ ${name} (${tokenId}): ${receipt.status}`);
    } catch (e) {
      const msg = e.message || "";
      if (msg.includes("ALREADY_ASSOCIATED") || msg.includes("TOKEN_ALREADY_ASSOCIATED")) {
        console.log(`✅ ${name} (${tokenId}): Already associated`);
      } else {
        console.warn(`⚠️  ${name} (${tokenId}): ${msg.substring(0, 80)}`);
      }
    }
  }

  // ═══ Step 3: Verify account state ═══
  console.log("\n═══ Step 3: Account Verification ═══");
  const info = await new AccountInfoQuery()
    .setAccountId(AccountId.fromString(ACCOUNT_ID))
    .execute(client);

  console.log(`Account:        ${ACCOUNT_ID}`);
  console.log(`EVM Address:    ${info.contractAccountId ? `0x${info.contractAccountId}` : "N/A"}`);
  console.log(`HBAR Balance:   ${info.balance.toString()}`);
  console.log(`Max Auto Assoc: ${info.maxAutomaticTokenAssociations}`);

  const tokenMap = info.tokenRelationships;
  const associated = [];
  if (tokenMap && tokenMap._map) {
    console.log("\nAssociated Tokens:");
    for (const [k, v] of tokenMap._map) {
      const id = k.toString();
      associated.push(id);
      const name = Object.entries(TOKENS).find(([_, tid]) => tid === id)?.[0] || "unknown";
      console.log(`  ${name.padEnd(8)} ${id.padEnd(14)} balance: ${v.balance.toString()}`);
    }
  }

  // Check for missing tokens
  console.log("\nRequired Token Status:");
  for (const [name, tokenId] of Object.entries(TOKENS)) {
    const ok = associated.includes(tokenId);
    console.log(`  ${ok ? "✅" : "❌"} ${name} (${tokenId})`);
  }

  // ═══ Step 4: Verify Bonzo contracts ═══
  console.log("\n═══ Step 4: Contract Verification ═══");
  const contracts = [
    { name: "LendingPool",  addr: "0x7710a96b01e02eD00768C3b39BfA7B4f1c128c62" },
    { name: "WHBAR Contract", addr: "0x0000000000000000000000000000000000003ad1" }, // 0.0.15057
  ];

  for (const c of contracts) {
    try {
      const contractId = ContractId.fromSolidityAddress(c.addr);
      // Simple existence check via a call query
      const query = new ContractCallQuery()
        .setContractId(contractId)
        .setGas(100000)
        .setFunction("paused") // common Aave function
        .setMaxQueryPayment(new Hbar(1));
      try {
        await query.execute(client);
        console.log(`✅ ${c.name} (${contractId}): EXISTS & responsive`);
      } catch (e) {
        if (e.message?.includes("CONTRACT_REVERT")) {
          console.log(`✅ ${c.name} (${contractId}): EXISTS (revert = contract present)`);
        } else {
          console.log(`⚠️  ${c.name} (${contractId}): ${e.message?.substring(0, 60)}`);
        }
      }
    } catch (e) {
      console.log(`❌ ${c.name}: Invalid - ${e.message}`);
    }
  }

  console.log("\n✅ Setup complete! You can now run VaultMind.");
  client.close();
}

main().catch(e => {
  console.error("❌ Fatal:", e.message);
  process.exit(1);
});
