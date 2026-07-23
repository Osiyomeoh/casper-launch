import { NextResponse } from "next/server";
import { runMcpTools, mcpGetCsprRate } from "@/lib/casper-mcp";

const NFT_CONTRACT_HASH = process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "0a8b5373f27de8ff8d3545c2d463de0052135d900c37c6a9654f1ea7de9896f7";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get("publicKey") ?? "";

  try {
    const [toolCalls, csprRateRaw] = await Promise.all([
      runMcpTools(publicKey, NFT_CONTRACT_HASH),
      mcpGetCsprRate("usd").catch(() => ""),
    ]);

    let csprUsd: string | null = null;
    // MCP rate response is markdown like "1 CSPR = **$0.0312 USD**" or "0.0312"
    const rateMatch = csprRateRaw.match(/\$?(0\.\d+|\d+\.\d+)/);
    if (rateMatch) csprUsd = rateMatch[1];

    return NextResponse.json({ toolCalls, csprUsd });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
