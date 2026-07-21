import { NextResponse } from "next/server";
import { getAccountTransfers } from "@/lib/cspr-cloud";

const NODE = "https://node.testnet.casper.network/rpc";

async function getBalanceMotes(publicKeyHex: string): Promise<string> {
  const res = await fetch(NODE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "query_balance",
      params: { purse_identifier: { main_purse_under_public_key: publicKeyHex } },
    }),
  });
  const data = await res.json() as { result?: { balance?: string } };
  return data.result?.balance ?? "0";
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get("publicKey");
  if (!publicKey) return NextResponse.json({ error: "publicKey required" }, { status: 400 });

  try {
    const [balance, transfers] = await Promise.all([
      getBalanceMotes(publicKey),
      getAccountTransfers(publicKey, 5).catch(() => ({ data: [] })),
    ]);

    return NextResponse.json({
      account: { public_key: publicKey, balance },
      transfers: transfers.data,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
