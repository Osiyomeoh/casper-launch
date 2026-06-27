import { NextResponse } from "next/server";
import { accountHashFromPublicKey, putTransaction } from "@/lib/casper-cli";
import { Args, NamedArg, CLValue } from "casper-js-sdk";

const YIELD_HASH = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";

export async function POST(req: Request) {
  try {
    const { claimerPublicKey } = await req.json() as { claimerPublicKey: string };
    if (!claimerPublicKey) return NextResponse.json({ error: "claimerPublicKey required" }, { status: 400 });
    if (!YIELD_HASH) return NextResponse.json({ error: "NEXT_PUBLIC_YIELD_HASH not set" }, { status: 500 });

    const claimerHash = accountHashFromPublicKey(claimerPublicKey);
    const hashBytes = Buffer.from(claimerHash, "hex");

    const args = Args.fromNamedArgs([
      new NamedArg("claimer", CLValue.newCLByteArray(hashBytes)),
    ]);

    const txHash = await putTransaction({
      contractHash: YIELD_HASH,
      entryPoint: "claim",
      args,
      paymentMotes: 5_000_000_000n,
    });

    return NextResponse.json({ txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Claim failed";
    console.error("[yield-claim]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
