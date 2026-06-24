import { NextResponse } from "next/server";
import { withFallback } from "@/lib/casper";

export const revalidate = 120;

export async function GET() {
  try {
    const auction = await withFallback((c) => c.getLatestAuctionInfo());
    const state = (auction as any).auction_state ?? (auction as any).AuctionState;
    const bids = state?.bids ?? [];

    const validators = bids
      .filter((b: any) => {
        const bid = b.bid ?? b.Bid;
        return bid && !bid.inactive;
      })
      .map((b: any) => {
        const publicKey = b.public_key ?? b.PublicKey ?? "";
        const bid = b.bid ?? b.Bid ?? {};
        const staked = BigInt(bid.staked_amount ?? bid.StakedAmount ?? "0");
        const delegators = bid.delegators ?? bid.Delegators ?? {};
        const delegatorCount = Array.isArray(delegators)
          ? delegators.length
          : Object.keys(delegators).length;
        const delegationRate = bid.delegation_rate ?? bid.DelegationRate ?? 0;
        return {
          publicKey,
          stakedAmount: staked.toString(),
          delegationRate,
          delegatorCount,
          inactive: false,
        };
      })
      .sort((a: any, b: any) => {
        const diff = BigInt(b.stakedAmount) - BigInt(a.stakedAmount);
        return diff > BigInt(0) ? 1 : diff < BigInt(0) ? -1 : 0;
      })
      .slice(0, 50);

    return NextResponse.json({ validators, totalValidators: bids.length });
  } catch (e) {
    return NextResponse.json({ error: "Validators unavailable" }, { status: 503 });
  }
}
