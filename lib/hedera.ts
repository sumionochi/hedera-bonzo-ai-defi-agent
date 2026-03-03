import { Client, PrivateKey, AccountId } from "@hashgraph/sdk";

let clientInstance: Client | null = null;

export function getHederaClient(): Client {
  if (clientInstance) return clientInstance;

  const accountId = process.env.HEDERA_ACCOUNT_ID;
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  const network = process.env.HEDERA_NETWORK || "testnet";

  if (!accountId || !privateKey) {
    throw new Error(
      "Missing HEDERA_ACCOUNT_ID or HEDERA_PRIVATE_KEY in environment variables. " +
        "Get these from https://portal.hedera.com/dashboard"
    );
  }

  const client =
    network === "mainnet" ? Client.forMainnet() : Client.forTestnet();

  client.setOperator(
    AccountId.fromString(accountId),
    PrivateKey.fromStringECDSA(privateKey)
  );

  clientInstance = client;
  return client;
}

export function getOperatorAccountId(): string {
  const accountId = process.env.HEDERA_ACCOUNT_ID;
  if (!accountId) throw new Error("Missing HEDERA_ACCOUNT_ID");
  return accountId;
}

export function getOperatorPrivateKey(): PrivateKey {
  const privateKey = process.env.HEDERA_PRIVATE_KEY;
  if (!privateKey) throw new Error("Missing HEDERA_PRIVATE_KEY");
  return PrivateKey.fromStringECDSA(privateKey);
}
