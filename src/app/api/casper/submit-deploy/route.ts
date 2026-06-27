/**
 * POST /api/casper/submit-deploy
 * Submits a browser-signed deploy to the Casper node.
 * Returns { deployHash }
 */
import { NextResponse } from "next/server";

const NODE = "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const { deploy } = await req.json() as { deploy: Record<string, unknown> };
    if (!deploy) return NextResponse.json({ error: "Missing deploy" }, { status: 400 });

    const res = await fetch(NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "account_put_deploy",
        params: { deploy },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const json = await res.json() as {
      result?: { deploy_hash?: string };
      error?: { message: string };
    };

    if (json.error) throw new Error(json.error.message);
    const deployHash = json.result?.deploy_hash;
    if (!deployHash) throw new Error("No deploy hash returned");

    return NextResponse.json({ deployHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Submit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
