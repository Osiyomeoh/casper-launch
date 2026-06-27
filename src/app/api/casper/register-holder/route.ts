import { NextResponse } from "next/server";
import { withFallback } from "@/lib/casper";
import { buildRegisterHolderTransaction, CONTRACT_HASHES } from "@/lib/contracts";
import { PrivateKey, PublicKey } from "casper-js-sdk";
import fs from "fs";
import os from "os";
import path from "path";

function loadAgentKey(): PrivateKey | null {
  const locations = [
    process.env.AGENT_SECRET_KEY_PATH,
    path.join(os.homedir(), ".casper", "keys", "secret_key.pem"),
    path.join(process.cwd(), "agent_secret_key.pem"),
  ].filter(Boolean) as string[];
  for (const loc of locations) {
    try {
      if (fs.existsSync(loc)) return PrivateKey.fromPem(fs.readFileSync(loc, "utf8"), 1);
    } catch {}
  }
  return null;
}

/**
 * POST /api/casper/register-holder
 * Body: { walletPublicKey: string, shareBps: number }
 *
 * Called server-side (agent key) immediately after a successful mint to
 * register the issuer as 100% holder in the yield-distributor contract.
 * Called again when the issuer transfers a fraction to an investor.
 */
export async function POST(req: Request) {
  try {
    const { walletPublicKey, shareBps = 10_000 } = await req.json() as {
      walletPublicKey: string;
      shareBps?: number;
    };

    if (!walletPublicKey) return NextResponse.json({ error: "walletPublicKey required" }, { status: 400 });
    if (shareBps < 0 || shareBps > 10_000) return NextResponse.json({ error: "shareBps must be 0–10000" }, { status: 400 });
    if (!CONTRACT_HASHES.yield) {
      // No yield contract deployed yet — record locally and return gracefully
      return NextResponse.json({ success: true, onChain: false, reason: "NEXT_PUBLIC_YIELD_HASH not set" });
    }

    const agentKey = loadAgentKey();
    if (!agentKey) {
      return NextResponse.json({ success: true, onChain: false, reason: "No agent key available" });
    }

    const agentPub = agentKey.publicKey;
    const recipientPk = PublicKey.fromHex(walletPublicKey);
    const accountHashBytes = recipientPk.accountHash().toBytes();

    const tx = buildRegisterHolderTransaction({
      sender: agentPub,
      accountHash: accountHashBytes,
      shareBps,
      chainName: "casper-test",
    });

    const deployObj = tx.toJSON() as Record<string, unknown>;
    const deployHash = (deployObj as { hash?: string }).hash ?? "";
    const sigBytes = agentKey.sign(Buffer.from(deployHash, "hex"));
    const sigHex = `01${Buffer.from(sigBytes).toString("hex")}`;
    const signedDeploy = {
      ...deployObj,
      approvals: [{ signer: agentPub.toHex(), signature: sigHex }],
    };

    const result = await withFallback((c) => c.putDeploy(signedDeploy as any));
    const hash = String((result as unknown as { deployHash?: unknown }).deployHash ?? "");

    return NextResponse.json({ success: true, onChain: true, deployHash: hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[register-holder]", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
