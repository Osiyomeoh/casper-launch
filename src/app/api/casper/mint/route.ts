import { NextResponse } from "next/server";
import { waitForDeploy } from "@/lib/casper-rpc";
import {
  agentAccountHash,
  accountHashFromPublicKey,
  submitSetKyc,
  submitMint,
} from "@/lib/casper-cli";

const CONTRACT_HASH = process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "";

export async function POST(req: Request) {
  try {
    if (!CONTRACT_HASH) throw new Error("NEXT_PUBLIC_RWA_NFT_HASH not configured");

    const { recipientAccountHash, tokenId, metadata } = await req.json() as {
      recipientAccountHash: string;
      tokenId: number | string;
      metadata: Record<string, unknown>;
    };

    if (!recipientAccountHash || !tokenId || !metadata)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const metaJson = JSON.stringify(metadata);
    const agentHash = agentAccountHash();
    // recipientAccountHash may be:
    //   - "account-hash-<64hex>"  → strip prefix
    //   - bare 64-char hex        → already an account hash
    //   - "01<64hex>" / "02<66hex>" public key → derive via CLI
    const recipientHash = recipientAccountHash.startsWith("account-hash-")
      ? recipientAccountHash.slice("account-hash-".length)
      : /^[0-9a-f]{64}$/i.test(recipientAccountHash)
        ? recipientAccountHash
        : accountHashFromPublicKey(recipientAccountHash);

    // ── Step 1: KYC-whitelist agent + recipient ──────────────────────────────
    console.log("[mint] whitelisting agent:", agentHash);
    const kycHashes: string[] = [await submitSetKyc(CONTRACT_HASH, agentHash)];

    if (recipientHash !== agentHash) {
      console.log("[mint] whitelisting recipient:", recipientHash);
      kycHashes.push(await submitSetKyc(CONTRACT_HASH, recipientHash));
    }

    console.log("[mint] waiting for KYC confirmation:", kycHashes);
    await Promise.all(kycHashes.map(h => waitForDeploy(h)));
    console.log("[mint] KYC confirmed — minting");

    // ── Step 2: Mint ─────────────────────────────────────────────────────────
    const deployHash = await submitMint(CONTRACT_HASH, recipientHash, tokenId, metaJson);
    return NextResponse.json({ deployHash, kycDeployHashes: kycHashes });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Mint failed";
    console.error("[mint]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
