/**
 * POST /api/casper/escrow-list
 *
 * Agent calls the trade-escrow contract's `list` entry point on behalf of the
 * seller (agent must hold yield rights on behalf of the user — or seller calls
 * this directly from their own wallet via the browser-side flow).
 *
 * For the hackathon demo the agent is both admin and seller-proxy.
 *
 * Body: { token_id, bps, price_cspr, seller_wallet }
 * Returns: { listing_id, tx_hash }
 */

import { NextResponse } from "next/server";
import { putTransaction } from "@/lib/casper-cli";
import { createOrder } from "@/lib/db";
import { Args, NamedArg, CLValue } from "casper-js-sdk";

const ESCROW_HASH = process.env.NEXT_PUBLIC_ESCROW_HASH ?? "";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      token_id: string;
      bps: number;
      price_cspr: string;   // motes as string (U512)
      price_usd: number;
      seller_wallet: string;
      asset_name: string;
    };

    const { token_id, bps, price_cspr, price_usd, seller_wallet, asset_name } = body;

    if (!token_id || !bps || !price_cspr) {
      return NextResponse.json({ error: "token_id, bps, price_cspr required" }, { status: 400 });
    }
    if (!ESCROW_HASH) {
      return NextResponse.json({ error: "NEXT_PUBLIC_ESCROW_HASH not set" }, { status: 500 });
    }

    // Call escrow contract `list` entry point
    const args = Args.fromNamedArgs([
      new NamedArg("bps", CLValue.newCLUint64(BigInt(bps))),
      new NamedArg("price_cspr", CLValue.newCLUInt512(BigInt(price_cspr))),
    ]);

    const txHash = await putTransaction({
      contractHash: ESCROW_HASH,
      entryPoint: "list",
      args,
      paymentMotes: 3_000_000_000n,
    });

    // Mirror the on-chain listing in SQLite for the orders UI
    const order = createOrder({
      token_id,
      asset_name: asset_name ?? token_id,
      order_type: "sell",
      amount: bps,
      price_usd,
      total_usd: price_usd,
      status: "open",
      seller_wallet,
      buyer_wallet: "",
      bps,
      payment_hash: "",
      settle_hash: txHash,
      cspr_amount: Number(BigInt(price_cspr) / BigInt(1_000_000_000)),
    });

    return NextResponse.json({ listing_id: order.id, tx_hash: txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
