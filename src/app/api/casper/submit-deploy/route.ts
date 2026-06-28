import { NextResponse } from "next/server";

const NODE = "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const { deploy } = await req.json() as { deploy: unknown };
    const res = await fetch(NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "account_put_deploy", params: { deploy } }),
    });
    const data = await res.json() as { result?: { deploy_hash?: string }; error?: { code?: number; message?: string } };
    if (data.error) return NextResponse.json({ error: `Code: ${data.error.code}, err: ${data.error.message}, data: ${JSON.stringify((data.error as Record<string,unknown>).data ?? '')}` }, { status: 400 });
    const hash = data.result?.deploy_hash;
    if (!hash) return NextResponse.json({ error: `No hash: ${JSON.stringify(data)}` }, { status: 500 });
    return NextResponse.json({ deploy_hash: hash });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
