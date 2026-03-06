// Diagnostic endpoint: checks token associations, contract addresses, and more
import { NextResponse } from "next/server";
import {
  AccountInfoQuery,
  AccountId,
  ContractCallQuery,
  ContractId,
  Hbar,
} from "@hashgraph/sdk";
import { getHederaClient } from "@/lib/hedera";

export const dynamic = "force-dynamic";

export async function GET() {
  const results: Record<string, any> = {};

  try {
    const client = getHederaClient();
    const opId = client.operatorAccountId!.toString();
    results.account = opId;

    // 1. Account Info
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(opId))
      .execute(client);

    results.evmAddress = info.contractAccountId;
    results.hbarBalance = info.balance.toString();

    // 2. Token associations
    const associations: {
      tokenId: string;
      balance: string;
      decimals: number;
    }[] = [];
    const tokenMap = (info as any).tokenRelationships;
    if (tokenMap && tokenMap._map) {
      for (const [k, v] of tokenMap._map) {
        associations.push({
          tokenId: k.toString(),
          balance: v.balance?.toString() || "0",
          decimals: v.decimals || 0,
        });
      }
    }
    results.tokenAssociations = associations;

    // Key testnet tokens
    const WHBAR_ID = "0.0.15058"; // 0x3ad2
    const USDC_ID = "0.0.5449"; // 0x1549
    const assocIds = associations.map((a) => a.tokenId);
    results.whbarAssociated = assocIds.includes(WHBAR_ID);
    results.usdcAssociated = assocIds.includes(USDC_ID);

    // 3. Contract verification
    const contracts = [
      {
        name: "Plugin_LendingPool",
        addr: "0x7710a96b01e02eD00768C3b39BfA7B4f1c128c62",
      },
      {
        name: "Docs_LendingPool",
        addr: "0xf67DBe9bD1B331cA379c44b5562EAa1CE831EbC2",
      },
      {
        name: "Plugin_WETHGateway",
        addr: "0xA824820e35D6AE4D368153e83b7920B2DC3Cf964",
      },
      {
        name: "Docs_WETHGateway",
        addr: "0x16197Ef10F26De77C9873d075f8774BdEc20A75d",
      },
    ];

    results.contracts = {} as Record<string, any>;
    for (const c of contracts) {
      try {
        const cid = ContractId.fromSolidityAddress(c.addr);
        results.contracts[c.name] = {
          contractId: cid.toString(),
          evmAddr: c.addr,
          status: "address_valid",
        };
      } catch (e: any) {
        results.contracts[c.name] = { error: e.message };
      }
    }

    // 4. Try getWETHAddress() on both WETHGateway candidates
    for (const gwName of ["Plugin_WETHGateway", "Docs_WETHGateway"]) {
      const addr = contracts.find((c) => c.name === gwName)?.addr;
      if (!addr) continue;
      try {
        const cid = ContractId.fromSolidityAddress(addr);
        const query = new ContractCallQuery()
          .setContractId(cid)
          .setGas(100000)
          .setFunction("getWETHAddress")
          .setQueryPayment(new Hbar(1));
        const result = await query.execute(client);
        const wethAddr =
          "0x" + Buffer.from(result.bytes).slice(12, 32).toString("hex");
        results.contracts[gwName].wethAddress = wethAddr;
        results.contracts[gwName].status = "verified_gateway";
      } catch (e: any) {
        results.contracts[gwName].queryError = (e.message || "").substring(
          0,
          150
        );
      }
    }

    // 5. Try getLendingPoolAddress() on both WETHGateway candidates
    for (const gwName of ["Plugin_WETHGateway", "Docs_WETHGateway"]) {
      const addr = contracts.find((c) => c.name === gwName)?.addr;
      if (!addr) continue;
      try {
        const cid = ContractId.fromSolidityAddress(addr);
        const query = new ContractCallQuery()
          .setContractId(cid)
          .setGas(100000)
          .setFunction("getLendingPoolAddress")
          .setQueryPayment(new Hbar(1));
        const result = await query.execute(client);
        const poolAddr =
          "0x" + Buffer.from(result.bytes).slice(12, 32).toString("hex");
        results.contracts[gwName].lendingPoolAddress = poolAddr;
      } catch (e: any) {
        results.contracts[gwName].poolQueryError = (e.message || "").substring(
          0,
          150
        );
      }
    }
  } catch (e: any) {
    results.error = e.message;
  }

  return NextResponse.json(results, { status: 200 });
}
