import { NextResponse } from "next/server";

const NODES = [
  "https://node.testnet.casper.network/rpc",
  "https://rpc.testnet.casperlabs.io/rpc",
];

async function rpc(node: string, method: string, params: unknown = []) {
  const res = await fetch(node, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = await res.json() as { result?: unknown; error?: { message: string } };
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

async function withFallback<T>(fn: (node: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const node of NODES) {
    try { return await fn(node); } catch (e) { last = e; }
  }
  throw last;
}

export const revalidate = 10;

export async function GET() {
  try {
    const [status, blockResult] = await Promise.all([
      withFallback(n => rpc(n, "info_get_status")) as Promise<Record<string, unknown>>,
      withFallback(n => rpc(n, "chain_get_block", { block_identifier: null })) as Promise<Record<string, unknown>>,
    ]);

    const block = (blockResult?.block ?? blockResult) as Record<string, unknown>;
    const header = (block?.header ?? {}) as Record<string, unknown>;

    return NextResponse.json({
      blockHeight:  (header.height      as number) ?? 0,
      eraId:        (header.era_id      as number) ?? 0,
      blockHash:    (block.hash         as string) ?? "",
      chainName:    (status.chainspec_name as string) ?? "casper-test",
      peerCount:    Array.isArray(status.peers) ? status.peers.length : 0,
      buildVersion: (status.build_version as string) ?? "",
      timestamp:    (header.timestamp   as string) ?? new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Casper RPC unavailable" }, { status: 503 });
  }
}
