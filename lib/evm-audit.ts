// ============================================
// VaultMind — EVM Audit Contract (lib/evm-audit.ts)
// ============================================
// Deploys VaultMindAudit.sol on Hedera EVM and records
// keccak256 hashes of keeper decisions on-chain.
// Works on both testnet and mainnet.
// ============================================

import {
  ContractCreateFlow,
  ContractExecuteTransaction,
  ContractCallQuery,
  ContractId,
  Hbar,
} from "@hashgraph/sdk";
import { Interface, defaultAbiCoder } from "@ethersproject/abi";
import { createHash } from "crypto";
import { getHederaClient } from "./hedera";

// ── Compiled bytecode (solc 0.8.34, optimizer 200) ──

const BYTECODE =
  "6080604052348015600e575f5ffd5b506104ad8061001c5f395ff3fe608060405234801561000f575f5ffd5b5060043610610060575f3560e01c806312351a751461006457806317bf37a3146100995780636353bde6146100ac578063a23100a2146100bd578063b60e73db146100dc578063f9bdf2bd146100ef575b5f5ffd5b61006c610104565b604080519485526001600160a01b0390931660208501529183015260608201526080015b60405180910390f35b61006c6100a73660046103da565b6101b0565b5f545b604051908152602001610090565b6100af6100cb3660046103f1565b60016020525f908152604090205481565b61006c6100ea3660046103da565b61024b565b6101026100fd3660046103da565b61028b565b005b5f5f5f5f5f5f80549050116101555760405162461bcd60e51b8152602060048201526012602482015271139bc8185d591a5d1cc81c9958dbdc99195960721b60448201526064015b60405180910390fd5b5f8054819061016690600190610432565b815481106101765761017661044b565b5f918252602090912060049091020180546001820154600283015460039093015491986001600160a01b0390911697509195509350915050565b5f5f5f5f5f8054905085106101fd5760405162461bcd60e51b8152602060048201526013602482015272496e646578206f7574206f6620626f756e647360681b604482015260640161014c565b5f5f86815481106102105761021061044b565b5f918252602090912060049091020180546001820154600283015460039093015491996001600160a01b039091169850919650945092505050565b5f8181548110610259575f80fd5b5f91825260209091206004909102018054600182015460028301546003909301549193506001600160a01b0316919084565b5f80546040805160808101825284815233602080830182815242848601908152436060860190815260018089018a5589805295517f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e56360048a029081019190915592517f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e564840180546001600160a01b0319166001600160a01b0390921691909117905590517f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e565830155517f290decd9548b62a8d60345a988386fc84ba6bc95484008f6362f93160ef3e566909101559085525282208054919261038c8361045f565b9190505550336001600160a01b031682827f8f2304a9fe5f1fb4bec4ba66f545eebd47cbece9b52ab61d1d035d9a68503b8f426040516103ce91815260200190565b60405180910390a45050565b5f602082840312156103ea575f5ffd5b5035919050565b5f60208284031215610401575f5ffd5b81356001600160a01b0381168114610417575f5ffd5b9392505050565b634e487b7160e01b5f52601160045260245ffd5b818103818111156104455761044561041e565b92915050565b634e487b7160e01b5f52603260045260245ffd5b5f600182016104705761047061041e565b506001019056fea264697066735822122097a6957ab545c3a091cca72d644d310cfce131a5a3fc4e630ddba4668d21b40f64736f6c63430008220033";

const AUDIT_ABI = new Interface([
  "function recordAudit(bytes32 decisionHash) external",
  "function getAudit(uint256 index) external view returns (bytes32 decisionHash, address agent, uint256 timestamp, uint256 blockNumber)",
  "function getAuditCount() external view returns (uint256)",
  "function getLatestAudit() external view returns (bytes32 decisionHash, address agent, uint256 timestamp, uint256 blockNumber)",
  "function auditCountByAgent(address) external view returns (uint256)",
]);

// ── Hash helper (Node.js crypto, no extra dependency) ──

function hashDecision(data: string): string {
  return "0x" + createHash("sha256").update(data, "utf8").digest("hex");
}

// ── Contract address management ──

const HEDERA_NETWORK =
  process.env.HEDERA_NETWORK ||
  process.env.NEXT_PUBLIC_HEDERA_NETWORK ||
  "testnet";

function getConfiguredContractId(): string | null {
  return HEDERA_NETWORK === "mainnet"
    ? process.env.VAULTMIND_AUDIT_CONTRACT_MAINNET || null
    : process.env.VAULTMIND_AUDIT_CONTRACT_TESTNET || null;
}

let runtimeContractId: string | null = null;

function getEffectiveContractId(): string | null {
  return getConfiguredContractId() || runtimeContractId;
}

// ═══════════════════════════════════════════════════════════
// DEPLOY
// ═══════════════════════════════════════════════════════════

export async function deployAuditContract(): Promise<{
  success: boolean;
  contractId?: string;
  contractEvmAddress?: string;
  txId?: string;
  error?: string;
}> {
  const existing = getEffectiveContractId();
  if (existing) {
    console.log(`[EVMAudit] Contract already deployed: ${existing}`);
    return { success: true, contractId: existing };
  }

  try {
    const client = getHederaClient();
    console.log(
      `[EVMAudit] Deploying VaultMindAudit.sol on ${HEDERA_NETWORK}...`
    );

    // ContractCreateFlow: no setMaxTransactionFee — it's not on this class
    const tx = new ContractCreateFlow().setBytecode(BYTECODE).setGas(500_000);

    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const contractId = receipt.contractId!.toString();
    const txId = resp.transactionId.toString();

    runtimeContractId = contractId;
    const evmAddr =
      "0x" + ContractId.fromString(contractId).toSolidityAddress();

    console.log(`[EVMAudit] ✅ Deployed: ${contractId} (EVM: ${evmAddr})`);
    console.log(
      `[EVMAudit] ⚠️  Add to .env: VAULTMIND_AUDIT_CONTRACT_${HEDERA_NETWORK.toUpperCase()}=${contractId}`
    );

    return { success: true, contractId, contractEvmAddress: evmAddr, txId };
  } catch (e: any) {
    console.error(`[EVMAudit] Deploy failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
// RECORD
// ═══════════════════════════════════════════════════════════

export async function recordDecisionOnChain(decisionData: any): Promise<{
  success: boolean;
  decisionHash?: string;
  txId?: string;
  auditIndex?: number;
  error?: string;
}> {
  let contractIdStr = getEffectiveContractId();

  if (!contractIdStr) {
    console.log("[EVMAudit] No contract found, deploying...");
    const deployResult = await deployAuditContract();
    if (!deployResult.success) {
      return { success: false, error: `Deploy failed: ${deployResult.error}` };
    }
    contractIdStr = getEffectiveContractId();
  }

  if (!contractIdStr) {
    return { success: false, error: "No audit contract available" };
  }

  try {
    const client = getHederaClient();
    const jsonStr = JSON.stringify(decisionData, null, 0);
    const hash = hashDecision(jsonStr);

    console.log(`[EVMAudit] Recording hash: ${hash.substring(0, 18)}...`);

    const calldata = AUDIT_ABI.encodeFunctionData("recordAudit", [hash]);

    const tx = new ContractExecuteTransaction()
      .setContractId(ContractId.fromString(contractIdStr))
      .setGas(200_000)
      .setFunctionParameters(Buffer.from(calldata.slice(2), "hex"))
      .setMaxTransactionFee(new Hbar(3));

    const resp = await tx.execute(client);
    const receipt = await resp.getReceipt(client);
    const txId = resp.transactionId.toString();
    const status = receipt.status.toString();

    if (status === "SUCCESS") {
      let auditIndex: number | undefined;
      try {
        const count = await getAuditCount();
        auditIndex = count > 0 ? count - 1 : 0;
      } catch {}

      console.log(
        `[EVMAudit] ✅ Audit #${auditIndex} on ${contractIdStr} (${txId})`
      );
      return { success: true, decisionHash: hash, txId, auditIndex };
    } else {
      return { success: false, error: status };
    }
  } catch (e: any) {
    console.error(`[EVMAudit] Record failed: ${e.message}`);
    return { success: false, error: e.message };
  }
}

// ═══════════════════════════════════════════════════════════
// QUERY
// ═══════════════════════════════════════════════════════════

export async function getAuditCount(): Promise<number> {
  const contractIdStr = getEffectiveContractId();
  if (!contractIdStr) return 0;

  try {
    const client = getHederaClient();
    const calldata = AUDIT_ABI.encodeFunctionData("getAuditCount", []);

    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractIdStr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(calldata.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));

    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 32) {
      const decoded = defaultAbiCoder.decode(["uint256"], result.bytes);
      return Number(decoded[0]);
    }
  } catch (e: any) {
    console.warn(
      `[EVMAudit] getAuditCount failed: ${e.message?.substring(0, 60)}`
    );
  }
  return 0;
}

export async function getLatestAudit(): Promise<{
  decisionHash: string;
  agent: string;
  timestamp: number;
  blockNumber: number;
} | null> {
  const contractIdStr = getEffectiveContractId();
  if (!contractIdStr) return null;

  try {
    const client = getHederaClient();
    const calldata = AUDIT_ABI.encodeFunctionData("getLatestAudit", []);

    const query = new ContractCallQuery()
      .setContractId(ContractId.fromString(contractIdStr))
      .setGas(100_000)
      .setFunctionParameters(Buffer.from(calldata.slice(2), "hex"))
      .setMaxQueryPayment(new Hbar(1));

    const result = await query.execute(client);
    if (result.bytes && result.bytes.length >= 128) {
      const decoded = defaultAbiCoder.decode(
        ["bytes32", "address", "uint256", "uint256"],
        result.bytes
      );
      return {
        decisionHash: decoded[0],
        agent: decoded[1],
        timestamp: Number(decoded[2]),
        blockNumber: Number(decoded[3]),
      };
    }
  } catch (e: any) {
    console.warn(
      `[EVMAudit] getLatestAudit failed: ${e.message?.substring(0, 60)}`
    );
  }
  return null;
}

// ═══════════════════════════════════════════════════════════
// INFO
// ═══════════════════════════════════════════════════════════

export function getAuditContractInfo() {
  const contractId = getEffectiveContractId();
  const hashscanBase =
    HEDERA_NETWORK === "mainnet"
      ? "https://hashscan.io/mainnet"
      : "https://hashscan.io/testnet";

  return {
    network: HEDERA_NETWORK,
    contractId,
    evmAddress: contractId
      ? "0x" + ContractId.fromString(contractId).toSolidityAddress()
      : null,
    hashScanLink: contractId ? `${hashscanBase}/contract/${contractId}` : null,
    deployed: !!contractId,
  };
}
