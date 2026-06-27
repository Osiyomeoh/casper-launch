import { NextResponse } from "next/server";
import { castVote } from "@/lib/db";

export async function POST(req: Request) {
  const { proposalId, voter, choice } = await req.json() as {
    proposalId: string; voter: string; choice: "for" | "against";
  };
  if (!proposalId || !voter || !choice)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  try {
    const updated = castVote(proposalId, voter, choice);
    return NextResponse.json(updated);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Vote failed" }, { status: 400 });
  }
}
