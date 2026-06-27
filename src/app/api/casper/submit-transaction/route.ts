/**
 * POST /api/casper/submit-transaction
 * Submits a browser-signed Casper 2.0 transaction via account_put_transaction.
 * Returns { txHash }
 */
import { NextResponse } from "next/server";

const NODE = "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const { transaction } = await req.json() as { transaction: Record<string, unknown> };
    if (!transaction) return NextResponse.json({ error: "Missing transaction" }, { status: 400 });

    const res = await fetch(NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "account_put_transaction",
        params: { transaction },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const json = await res.json() as {
      result?: { transaction_hash?: { Version1?: string; Deploy?: string } };
      error?: { message: string };
    };

    if (json.error) throw new Error(json.error.message);
    const th = json.result?.transaction_hash;
    const txHash = th?.Version1 ?? th?.Deploy;
    if (!txHash) throw new Error(`No transaction hash returned: ${JSON.stringify(json).slice(0, 200)}`);

    return NextResponse.json({ txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Submit failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
