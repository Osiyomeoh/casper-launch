import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import os from "os";
import { PrivateKey, PublicKey, KeyAlgorithm } from "casper-js-sdk";
import { buildSetKycTransaction, CONTRACT_HASHES } from "@/lib/contracts";
import { withFallback } from "@/lib/casper";
import { getAllTokens } from "@/lib/db";
import {
  getComplianceState, setComplianceRunning, recordComplianceCheck,
  addFlag, resolveFlag, complianceLog,
} from "@/lib/compliance-store";

const POLL_INTERVAL_MS = 60_000;
const KYC_EXPIRY_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

let complianceTimer: ReturnType<typeof setInterval> | null = null;

function loadAgentKey(): PrivateKey | null {
  const pemEnv = process.env.AGENT_SECRET_KEY_PEM;
  if (pemEnv) {
    try { return PrivateKey.fromPem(pemEnv, KeyAlgorithm.ED25519); } catch {}
  }
  const locations = [
    process.env.AGENT_SECRET_KEY_PATH,
    path.join(os.homedir(), ".casper", "keys", "secret_key.pem"),
    path.join(process.cwd(), "agent_secret_key.pem"),
  ].filter(Boolean) as string[];
  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) return PrivateKey.fromPem(fs.readFileSync(loc, "utf8"), KeyAlgorithm.ED25519);
    } catch {}
  }
  return null;
}

async function revokeKyc(agentKey: PrivateKey, walletPublicKey: string): Promise<string> {
  const userPk = PublicKey.fromHex(walletPublicKey);
  const accountHash = userPk.accountHash().toBytes();

  const tx = buildSetKycTransaction({
    sender: agentKey.publicKey,
    accountHash,
    approved: false,
    chainName: "casper-test",
  });

  const deployObj = tx.toJSON() as Record<string, unknown>;
  const sigBytes = agentKey.sign(Buffer.from((deployObj.hash as string), "hex"));
  const sigHex = Buffer.from(sigBytes).toString("hex");
  const signedDeploy = {
    ...deployObj,
    approvals: [{ signer: agentKey.publicKey.toHex(), signature: `01${sigHex}` }],
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await withFallback((c) => c.putDeploy(signedDeploy as any)) as unknown as Record<string, unknown>;
  return (result.deploy_hash ?? result.transaction_hash ?? result.hash ?? "unknown") as string;
}

export async function complianceTick() {
  const nextCheck = Date.now() + POLL_INTERVAL_MS;
  recordComplianceCheck(nextCheck);
  complianceLog("info", "Scanning token holders for KYC compliance...");

  if (!CONTRACT_HASHES.rwaNft) {
    complianceLog("warn", "RWA NFT contract not configured — scan skipped");
    return;
  }

  let tokens: Awaited<ReturnType<typeof getAllTokens>>;
  try {
    tokens = await getAllTokens();
  } catch (e) {
    complianceLog("error", `DB error: ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  if (tokens.length === 0) {
    complianceLog("info", "No tokens found — nothing to scan");
    return;
  }

  const now = Date.now();
  let scanned = 0;
  let flagged = 0;

  for (const token of tokens) {
    const holders: { publicKey: string; bps: number }[] = token.holders ?? [];
    const meta = (token.metadata ?? {}) as Record<string, unknown>;
    const kycTs = meta.kyc_attested_at as number | undefined;

    for (const holder of holders) {
      scanned++;

      // Check KYC missing
      if (!kycTs) {
        complianceLog("warn", `No KYC attestation found for holder`, holder.publicKey);
        addFlag({
          wallet: holder.publicKey,
          reason: "kyc_missing",
          flaggedAt: now,
        });
        flagged++;
        continue;
      }

      // Check KYC expired (> 90 days)
      const age = now - kycTs;
      if (age > KYC_EXPIRY_MS) {
        const days = Math.floor(age / (24 * 60 * 60 * 1000));
        complianceLog("warn", `KYC expired ${days} days ago — initiating autonomous revocation`, holder.publicKey);
        addFlag({
          wallet: holder.publicKey,
          reason: "kyc_expired",
          flaggedAt: now,
        });
        flagged++;

        // Attempt autonomous revocation
        const agentKey = loadAgentKey();
        if (agentKey) {
          try {
            const txHash = await revokeKyc(agentKey, holder.publicKey);
            resolveFlag(holder.publicKey, txHash);
            complianceLog("success", `KYC autonomously revoked on-chain`, holder.publicKey, txHash);
          } catch (e) {
            complianceLog("error", `Revocation failed: ${e instanceof Error ? e.message : String(e)}`, holder.publicKey);
          }
        } else {
          complianceLog("warn", `Agent key unavailable — KYC revocation flagged for manual review`, holder.publicKey);
        }
      }
    }
  }

  if (flagged === 0) {
    complianceLog("success", `Scan complete — ${scanned} holder(s) checked, all KYC valid`);
  } else {
    complianceLog("warn", `Scan complete — ${scanned} holder(s) checked, ${flagged} compliance issue(s) found`);
  }
}

export function startComplianceAgent() {
  if (complianceTimer) return;
  setComplianceRunning(true);
  complianceLog("info", "Compliance Agent started — scanning every 60s");
  complianceTick();
  complianceTimer = setInterval(complianceTick, POLL_INTERVAL_MS);
}

export function stopComplianceAgent() {
  if (complianceTimer) {
    clearInterval(complianceTimer);
    complianceTimer = null;
  }
  setComplianceRunning(false);
  complianceLog("info", "Compliance Agent stopped");
}

export async function GET() {
  await complianceTick();
  return NextResponse.json(getComplianceState());
}

export async function POST(req: Request) {
  const { action } = await req.json() as { action: "start" | "stop" };
  if (action === "start") startComplianceAgent();
  else if (action === "stop") stopComplianceAgent();
  return NextResponse.json(getComplianceState());
}
