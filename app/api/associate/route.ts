// Associates HTS tokens with the operator account
// Required before any DeFi operations on Hedera
import { NextResponse } from "next/server";
import {
  AccountInfoQuery,
  AccountId,
  TokenAssociateTransaction,
  TokenId,
} from "@hashgraph/sdk";
import { getHederaClient } from "@/lib/hedera";

export const dynamic = "force-dynamic";

// All tokens used by Bonzo Finance on testnet
const REQUIRED_TOKENS: { symbol: string; id: string }[] = [
  { symbol: "WHBAR", id: "0.0.15058" }, // 0x3ad2
  { symbol: "USDC", id: "0.0.5449" }, // 0x1549
  { symbol: "HBARX", id: "0.0.2233069" }, // 0x220ced
  { symbol: "SAUCE", id: "0.0.1183558" }, // 0x120f46
  { symbol: "KARATE", id: "0.0.2236909" }, // 0x220ce5 (docs) or 0x3991ed (plugin)
];

export async function POST() {
  try {
    const client = getHederaClient();
    const opId = client.operatorAccountId!.toString();

    // Get current associations
    const info = await new AccountInfoQuery()
      .setAccountId(AccountId.fromString(opId))
      .execute(client);

    const existingAssociations = new Set<string>();
    const tokenMap = (info as any).tokenRelationships;
    if (tokenMap && tokenMap._map) {
      for (const [k] of tokenMap._map) {
        existingAssociations.add(k.toString());
      }
    }

    const results: {
      symbol: string;
      id: string;
      status: string;
      error?: string;
    }[] = [];

    for (const token of REQUIRED_TOKENS) {
      if (existingAssociations.has(token.id)) {
        results.push({
          symbol: token.symbol,
          id: token.id,
          status: "already_associated",
        });
        continue;
      }

      try {
        console.log(`[Associate] Associating ${token.symbol} (${token.id})...`);
        const tx = new TokenAssociateTransaction()
          .setAccountId(AccountId.fromString(opId))
          .setTokenIds([TokenId.fromString(token.id)]);

        const resp = await tx.execute(client);
        const receipt = await resp.getReceipt(client);
        const status = receipt.status.toString();

        console.log(`[Associate] ${token.symbol}: ${status}`);
        results.push({
          symbol: token.symbol,
          id: token.id,
          status: status === "SUCCESS" ? "associated" : `failed: ${status}`,
        });
      } catch (e: any) {
        const msg = e.message || "";
        // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT is fine
        if (msg.includes("TOKEN_ALREADY_ASSOCIATED")) {
          results.push({
            symbol: token.symbol,
            id: token.id,
            status: "already_associated",
          });
        } else {
          console.error(`[Associate] ${token.symbol} error:`, msg);
          results.push({
            symbol: token.symbol,
            id: token.id,
            status: "error",
            error: msg.substring(0, 100),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      account: opId,
      results,
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
