import { NextResponse } from "next/server";

const NODE = "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let deploy = body.deploy;
    if (!deploy) return NextResponse.json({ error: "deploy payload required" }, { status: 400 });

    // Unwrap if SDK wrapped the deploy
    if (deploy.Deploy) deploy = deploy.Deploy;
    else if (deploy.Version1) deploy = deploy.Version1;

    const res = await fetch(NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "account_put_deploy",
        params: { deploy },
      }),
    });
    const json = await res.json() as { result?: { deploy_hash?: string }; error?: unknown };
    const deployHash = json?.result?.deploy_hash;
    if (!deployHash) throw new Error(JSON.stringify(json?.error ?? json));
    return NextResponse.json({ deployHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Deploy submission failed";
    console.error("[deploy]", msg);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
