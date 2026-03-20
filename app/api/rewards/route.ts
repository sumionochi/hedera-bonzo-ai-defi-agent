// ============================================
// app/api/rewards/route.ts — VKS Token + EVM Audit API
// ============================================

import { NextRequest, NextResponse } from "next/server";
import {
  ensureVKSToken,
  mintKeeperReward,
  getVKSBalance,
  getVKSTokenInfo,
} from "@/lib/hts-rewards";
import {
  deployAuditContract,
  getAuditCount,
  getLatestAudit,
  getAuditContractInfo,
} from "@/lib/evm-audit";

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("action");
  const accountId = req.nextUrl.searchParams.get("accountId");

  try {
    switch (action) {
      case "vks-info": {
        const info = getVKSTokenInfo();
        return NextResponse.json({ success: true, data: info });
      }

      case "vks-balance": {
        if (!accountId) {
          return NextResponse.json(
            { success: false, error: "accountId required" },
            { status: 400 }
          );
        }
        const balance = await getVKSBalance(accountId);
        const info = getVKSTokenInfo();
        return NextResponse.json({
          success: true,
          data: {
            accountId,
            balance,
            tokenId: info.tokenId,
            symbol: "VKS",
          },
        });
      }

      case "audit-info": {
        const info = getAuditContractInfo();
        const count = info.deployed ? await getAuditCount() : 0;
        const latest = info.deployed ? await getLatestAudit() : null;
        return NextResponse.json({
          success: true,
          data: { ...info, auditCount: count, latestAudit: latest },
        });
      }

      default: {
        const vksInfo = getVKSTokenInfo();
        const auditInfo = getAuditContractInfo();
        return NextResponse.json({
          success: true,
          data: {
            vksToken: vksInfo,
            auditContract: auditInfo,
            hederaServices: {
              hcs: true,
              hts: vksInfo.created,
              evm: auditInfo.deployed,
              network: vksInfo.network,
            },
          },
        });
      }
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  try {
    switch (action) {
      case "create-token": {
        const tokenId = await ensureVKSToken();
        const info = getVKSTokenInfo();
        return NextResponse.json({
          success: !!tokenId,
          data: info,
        });
      }

      case "mint-reward": {
        const { recipientAccountId, keeperAction, confidence } = body;
        const acct = recipientAccountId || process.env.HEDERA_ACCOUNT_ID;
        if (!acct) {
          return NextResponse.json(
            { success: false, error: "No account ID" },
            { status: 400 }
          );
        }
        const result = await mintKeeperReward(acct, keeperAction, confidence);
        return NextResponse.json({ success: result.success, data: result });
      }

      case "deploy-contract": {
        const result = await deployAuditContract();
        return NextResponse.json({ success: result.success, data: result });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message },
      { status: 500 }
    );
  }
}
