import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { AGENT_KEY } from "@/lib/casper-cli";

const CHAIN = process.env.NEXT_PUBLIC_CASPER_CHAIN ?? "casper-test";
const NODE = process.env.NEXT_PUBLIC_CASPER_NODE ?? "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const { validatorPublicKey, amountMotes } = await req.json() as {
      validatorPublicKey: string;
      amountMotes: string;
    };

    if (!validatorPublicKey || !amountMotes)
      return NextResponse.json({ error: "validatorPublicKey and amountMotes required" }, { status: 400 });

    const r = spawnSync("casper-client", [
      "put-deploy",
      "--node-address", NODE,
      "--chain-name", CHAIN,
      "--secret-key", AGENT_KEY,
      "--session-path", "/dev/null",
      "--payment-amount", "3000000000",
    ], { encoding: "utf8", timeout: 30_000 });

    // Casper native delegation via auction contract
    const delegate = spawnSync("casper-client", [
      "put-transaction", "native",
      "--node-address", NODE,
      "--chain-name", CHAIN,
      "--secret-key", AGENT_KEY,
      "--transfer-amount", amountMotes,
      "--target-account", validatorPublicKey,
      "--payment-amount", "3000000000",
      "--standard-payment", "true",
      "--gas-price-tolerance", "1",
      "--transaction-category", "1",
    ], { encoding: "utf8", timeout: 30_000 });

    const out = (delegate.stdout ?? "") + (delegate.stderr ?? "");

    if (delegate.status !== 0) {
      // Fall back to auction contract delegation
      const auction = spawnSync("casper-client", [
        "put-deploy",
        "--node-address", NODE,
        "--chain-name", CHAIN,
        "--secret-key", AGENT_KEY,
        "--payment-amount", "3000000000",
        "--session-hash", "hash-93d923e336b20a4c4b3b9b5604c4d55a",
        "--session-entry-point", "delegate",
        "--session-arg", `delegator:public_key='${validatorPublicKey}'`,
        "--session-arg", `validator:public_key='${validatorPublicKey}'`,
        "--session-arg", `amount:u512='${amountMotes}'`,
      ], { encoding: "utf8", timeout: 30_000 });

      const aOut = (auction.stdout ?? "") + (auction.stderr ?? "");
      if (auction.status !== 0) throw new Error(aOut.slice(0, 300));
      const match = aOut.match(/"deploy_hash"\s*:\s*"([0-9a-f]{64})"/i) ?? aOut.match(/([0-9a-f]{64})/);
      return NextResponse.json({ txHash: match?.[1] ?? "submitted" });
    }

    const match = out.match(/"[A-Za-z0-9_]*hash"\s*:\s*"([0-9a-f]{64})"/i) ?? out.match(/([0-9a-f]{64})/);
    return NextResponse.json({ txHash: match?.[1] ?? "submitted" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delegation failed";
    console.error("[delegate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
