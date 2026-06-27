/**
 * Submits governance actions to the on-chain governance contract via the agent key.
 * action: "propose" | "vote"
 */
import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { AGENT_KEY } from "@/lib/casper-cli";

const GOV_HASH = process.env.NEXT_PUBLIC_GOVERNANCE_HASH ?? "";
const CHAIN = process.env.NEXT_PUBLIC_CASPER_CHAIN ?? "casper-test";
const NODE = process.env.NEXT_PUBLIC_CASPER_NODE ?? "https://node.testnet.casper.network/rpc";

function putTx(args: string[]): string {
  const r = spawnSync("casper-client", [
    "put-transaction", "invocable-entity",
    "--node-address", NODE,
    "--chain-name", CHAIN,
    "--secret-key", AGENT_KEY,
    "--entity-address", `entity-contract-${GOV_HASH}`,
    "--payment-amount", "5000000000",
    "--standard-payment", "true",
    "--gas-price-tolerance", "1",
    ...args,
  ], { encoding: "utf8", timeout: 30_000 });

  const out = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0) throw new Error(out.replace(/#{2,}.*?#{2,}/gs, "").trim().slice(0, 300));
  const match = out.match(/"[A-Za-z0-9_]*hash"\s*:\s*"([0-9a-f]{64})"/i) ?? out.match(/([0-9a-f]{64})/);
  return match?.[1] ?? "submitted";
}

export async function POST(req: Request) {
  try {
    if (!GOV_HASH) return NextResponse.json({ error: "Governance contract not deployed" }, { status: 500 });

    const body = await req.json() as {
      action: "propose" | "vote";
      title?: string;
      description?: string;
      deadlineDays?: number;
      proposalIndex?: number;
      choice?: number; // 0=for, 1=against
    };

    let txHash: string;
    if (body.action === "propose") {
      const deadline = Math.floor(Date.now() / 1000) + (body.deadlineDays ?? 14) * 86400;
      txHash = putTx([
        "--session-entry-point", "create_proposal",
        "--session-arg", `title:string='${(body.title ?? "").replace(/'/g, "")}'`,
        "--session-arg", `description:string='${(body.description ?? "").replace(/'/g, "")}'`,
        "--session-arg", `deadline:u64='${deadline}'`,
      ]);
    } else if (body.action === "vote") {
      txHash = putTx([
        "--session-entry-point", "vote",
        "--session-arg", `proposal_id:u64='${body.proposalIndex ?? 0}'`,
        "--session-arg", `choice:u8='${body.choice ?? 0}'`,
      ]);
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Governance tx failed";
    console.error("[governance/submit]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
