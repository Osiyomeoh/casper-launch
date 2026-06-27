import { NextResponse } from "next/server";

export const revalidate = 120;

const NODES = [
  "https://node.testnet.casper.network/rpc",
  "https://rpc.testnet.casperlabs.io/rpc",
];

async function getAuctionInfo(): Promise<{ bids?: unknown[] }> {
  for (const node of NODES) {
    try {
      const res = await fetch(node, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "state_get_auction_info", params: [] }),
        signal: AbortSignal.timeout(60_000),
      });
      const json = await res.json() as {
        result?: { auction_state?: { bids?: unknown[] } };
        error?: unknown;
      };
      if (!json.error && json.result?.auction_state) return json.result.auction_state;
    } catch { /* try next */ }
  }
  throw new Error("All nodes failed");
}

export async function GET() {
  try {
    const state = await getAuctionInfo();
    const bids = state.bids ?? [];

    const validators = (bids as Record<string, unknown>[])
      .filter((b) => {
        const bid = (b.bid ?? b.Bid) as Record<string, unknown> | undefined;
        return bid && !bid.inactive;
      })
      .map((b) => {
        const publicKey = (b.public_key ?? b.PublicKey ?? "") as string;
        const bid = (b.bid ?? b.Bid ?? {}) as Record<string, unknown>;
        const staked = BigInt((bid.staked_amount ?? bid.StakedAmount ?? "0") as string);
        const delegators = (bid.delegators ?? bid.Delegators ?? {}) as unknown;
        const delegatorCount = Array.isArray(delegators)
          ? delegators.length
          : Object.keys(delegators as object).length;
        const delegationRate = (bid.delegation_rate ?? bid.DelegationRate ?? 0) as number;
        return { publicKey, stakedAmount: staked.toString(), delegationRate, delegatorCount, inactive: false };
      })
      .sort((a, b) => {
        const diff = BigInt(b.stakedAmount) - BigInt(a.stakedAmount);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      })
      .slice(0, 50);

    return NextResponse.json({ validators, totalValidators: bids.length });
  } catch {
    return NextResponse.json({ error: "Validators unavailable" }, { status: 503 });
  }
}
