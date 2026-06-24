import { NextResponse } from "next/server";
import { withFallback } from "@/lib/casper";

export async function POST(req: Request) {
  try {
    const { deploy } = await req.json();
    if (!deploy) {
      return NextResponse.json({ error: "deploy payload required" }, { status: 400 });
    }

    // Submit the signed deploy to Casper mainnet
    const result = await withFallback((c) => c.putDeploy(deploy));
    const deployHash = (result as unknown as Record<string, unknown>).deploy_hash as string;

    return NextResponse.json({ deployHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deploy submission failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
