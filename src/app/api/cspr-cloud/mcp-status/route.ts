import { NextResponse } from "next/server";
import { runMcpTools, mcpGetCsprRate } from "@/lib/casper-mcp";

const NFT_CONTRACT_HASH = process.env.NEXT_PUBLIC_NFT_HASH ?? "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get("publicKey") ?? "";

  try {
    const [toolCalls, csprRateRaw] = await Promise.all([
      runMcpTools(publicKey, NFT_CONTRACT_HASH),
      mcpGetCsprRate("usd").catch(() => ""),
    ]);

    let csprUsd: string | null = null;
    const rateMatch = csprRateRaw.match(/[\d.]+/);
    if (rateMatch) csprUsd = rateMatch[0];

    return NextResponse.json({ toolCalls, csprUsd });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
