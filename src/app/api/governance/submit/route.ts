/**
 * Submits governance actions to the on-chain governance contract via the agent key.
 * action: "propose" | "vote"
 */
import { NextResponse } from "next/server";
import { putTransaction } from "@/lib/casper-cli";
import { Args, NamedArg, CLValue } from "casper-js-sdk";

const GOV_HASH = process.env.NEXT_PUBLIC_GOVERNANCE_HASH ?? "";

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
      const deadline = BigInt(Math.floor(Date.now() / 1000) + (body.deadlineDays ?? 14) * 86400);
      const args = Args.fromNamedArgs([
        new NamedArg("title", CLValue.newCLString((body.title ?? "").replace(/'/g, ""))),
        new NamedArg("description", CLValue.newCLString((body.description ?? "").replace(/'/g, ""))),
        new NamedArg("deadline", CLValue.newCLUint64(deadline)),
      ]);
      txHash = await putTransaction({
        contractHash: GOV_HASH,
        entryPoint: "create_proposal",
        args,
        paymentMotes: 5_000_000_000n,
      });
    } else if (body.action === "vote") {
      const args = Args.fromNamedArgs([
        new NamedArg("proposal_id", CLValue.newCLUint64(BigInt(body.proposalIndex ?? 0))),
        new NamedArg("choice", CLValue.newCLUint8(body.choice ?? 0)),
      ]);
      txHash = await putTransaction({
        contractHash: GOV_HASH,
        entryPoint: "vote",
        args,
        paymentMotes: 5_000_000_000n,
      });
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
