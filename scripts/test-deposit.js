#!/usr/bin/env node
// ============================================
// VaultMind — Test Deposit Flow
// Tests: HBAR → WHBAR wrap → approve → deposit
// ============================================

const {
  Client, PrivateKey, AccountId, ContractExecuteTransaction,
  ContractId, Hbar, AccountInfoQuery,
} = require("@hashgraph/sdk");
const { Interface } = require("@ethersproject/abi");
require("dotenv").config({ path: ".env.local" });

const ACCOUNT_ID = process.env.HEDERA_ACCOUNT_ID;
const PRIVATE_KEY = process.env.HEDERA_PRIVATE_KEY;

const WHBAR_CONTRACT = "0.0.15057";  // SaucerSwap WHBAR wrapper
const WHBAR_TOKEN_EVM = "0x0000000000000000000000000000000000003ad2"; // 0.0.15058
const LENDING_POOL = "0x7710a96b01e02eD00768C3b39BfA7B4f1c128c62";

const WHBAR_ABI = new Interface(["function deposit() payable", "function withdraw(uint256)"]);
const ERC20_ABI = new Interface(["function approve(address,uint256) returns (bool)", "function balanceOf(address) view returns (uint256)"]);
const LP_ABI = new Interface(["function deposit(address,uint256,address,uint16)"]);

async function test() {
  if (!ACCOUNT_ID || !PRIVATE_KEY) {
    console.error("❌ Missing credentials in .env.local");
    process.exit(1);
  }

  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(ACCOUNT_ID),
    PrivateKey.fromStringECDSA(PRIVATE_KEY)
  );

  const TEST_AMOUNT = 1; // 1 HBAR
  const AMOUNT_TINYBARS = BigInt(TEST_AMOUNT * 1e8); // 8 decimals

  // Get EVM address
  const info = await new AccountInfoQuery()
    .setAccountId(AccountId.fromString(ACCOUNT_ID))
    .execute(client);
  const evmAddr = info.contractAccountId
    ? (info.contractAccountId.startsWith("0x") ? info.contractAccountId : `0x${info.contractAccountId}`)
    : "0x" + AccountId.fromString(ACCOUNT_ID).toSolidityAddress();

  console.log(`\n🧪 VaultMind Test Deposit`);
  console.log(`   Account: ${ACCOUNT_ID}`);
  console.log(`   EVM:     ${evmAddr}`);
  console.log(`   Amount:  ${TEST_AMOUNT} HBAR`);
  console.log(`   Balance: ${info.balance.toString()}\n`);

  // ── Step 1: Wrap HBAR → WHBAR ──
  console.log("── Step 1: Wrap HBAR → WHBAR ──");
  try {
    const data = WHBAR_ABI.encodeFunctionData("deposit", []);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(WHBAR_CONTRACT))
      .setGas(300_000)
      .setPayableAmount(new Hbar(TEST_AMOUNT))
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Tx:     ${resp.transactionId.toString()}`);
    if (receipt.status.toString() !== "SUCCESS") {
      console.error("❌ Wrapping failed — aborting");
      client.close();
      return;
    }
    console.log("   ✅ HBAR wrapped to WHBAR\n");
  } catch (e) {
    console.error(`   ❌ Wrap error: ${e.message}`);
    client.close();
    return;
  }

  // ── Step 2: Approve WHBAR for LendingPool ──
  console.log("── Step 2: Approve WHBAR for LendingPool ──");
  try {
    const data = ERC20_ABI.encodeFunctionData("approve", [LENDING_POOL, AMOUNT_TINYBARS]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(WHBAR_TOKEN_EVM))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(5));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Tx:     ${resp.transactionId.toString()}`);
    if (receipt.status.toString() !== "SUCCESS") {
      console.error("❌ Approve failed — aborting");
      client.close();
      return;
    }
    console.log("   ✅ WHBAR approved\n");
  } catch (e) {
    console.error(`   ❌ Approve error: ${e.message}`);
    client.close();
    return;
  }

  // ── Step 3: Deposit into Bonzo LendingPool ──
  console.log("── Step 3: Deposit into Bonzo LendingPool ──");
  try {
    const data = LP_ABI.encodeFunctionData("deposit", [WHBAR_TOKEN_EVM, AMOUNT_TINYBARS, evmAddr, 0]);
    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromSolidityAddress(LENDING_POOL))
      .setGas(1_000_000)
      .setFunctionParameters(Buffer.from(data.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));
    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    console.log(`   Status: ${receipt.status}`);
    console.log(`   Tx:     ${resp.transactionId.toString()}`);
    if (receipt.status.toString() === "SUCCESS") {
      console.log("\n🎉 SUCCESS! Full deposit flow completed:");
      console.log("   HBAR → WHBAR (SaucerSwap) → approve → LendingPool.deposit");
    } else {
      console.error(`\n❌ Deposit failed with status: ${receipt.status}`);
    }
  } catch (e) {
    console.error(`   ❌ Deposit error: ${e.message}`);
  }

  client.close();
}

test().catch(e => {
  console.error("❌ Fatal:", e.message);
  process.exit(1);
});
