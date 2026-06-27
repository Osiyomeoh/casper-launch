import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { accountHashFromPublicKey, AGENT_KEY } from "@/lib/casper-cli";

const YIELD_HASH = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";
const CHAIN = process.env.NEXT_PUBLIC_CASPER_CHAIN ?? "casper-test";
const NODE = process.env.NEXT_PUBLIC_CASPER_NODE ?? "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const { claimerPublicKey } = await req.json() as { claimerPublicKey: string };
    if (!claimerPublicKey) return NextResponse.json({ error: "claimerPublicKey required" }, { status: 400 });
    if (!YIELD_HASH) return NextResponse.json({ error: "NEXT_PUBLIC_YIELD_HASH not set" }, { status: 500 });

    const claimerHash = accountHashFromPublicKey(claimerPublicKey);

    const r = spawnSync("casper-client", [
      "put-transaction", "invocable-entity",
      "--node-address", NODE,
      "--chain-name", CHAIN,
      "--secret-key", AGENT_KEY,
      "--entity-address", `entity-contract-${YIELD_HASH}`,
      "--session-entry-point", "claim",
      "--session-arg", `claimer:account_hash='account-hash-${claimerHash}'`,
      "--payment-amount", "5000000000",
      "--standard-payment", "true",
      "--gas-price-tolerance", "1",
    ], { encoding: "utf8", timeout: 30_000 });

    const out = (r.stdout ?? "") + (r.stderr ?? "");
    if (r.status !== 0) throw new Error(out.replace(/#{2,}.*?#{2,}/gs, "").trim().slice(0, 300));

    const match = out.match(/"transaction_hash"[^}]*"[A-Za-z0-9]+"\s*:\s*"([0-9a-f]{64})"/i)
      ?? out.match(/[0-9a-f]{64}/);
    const txHash = match?.[1] ?? match?.[0] ?? "submitted";

    return NextResponse.json({ txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claim failed";
    console.error("[yield-claim]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
