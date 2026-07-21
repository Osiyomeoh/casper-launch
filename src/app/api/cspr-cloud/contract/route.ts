import { NextResponse } from "next/server";
import { getContractDeploys } from "@/lib/cspr-cloud";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const contractHash = searchParams.get("hash");
  if (!contractHash) return NextResponse.json({ error: "hash required" }, { status: 400 });

  try {
    const deploys = await getContractDeploys(contractHash, 10);
    return NextResponse.json({ deploys: deploys.data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
