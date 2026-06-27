import { NextResponse } from "next/server";
import { getProposals, createProposal } from "@/lib/db";

export async function GET(req: Request) {
  const voter = new URL(req.url).searchParams.get("voter") ?? undefined;
  return NextResponse.json(await getProposals(voter));
}

export async function POST(req: Request) {
  const { title, description, createdBy, endDate } = await req.json() as {
    title: string; description: string; createdBy: string; endDate: string;
  };
  if (!title || !description || !endDate)
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const proposal = await createProposal(title, description, createdBy ?? "anonymous", endDate);
  return NextResponse.json(proposal);
}
