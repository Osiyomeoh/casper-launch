/**
 * POST /api/casper/escrow-list
 *
 * Records a completed on-chain listing in the DB.
 * The transaction is built by /api/casper/build-tx, signed by the user's
 * CasperWallet, and submitted directly from the browser. This endpoint
 * is called after submission to persist the order.
 *
 * Body: { token_id, bps, price_cspr, price_usd, seller_wallet, asset_name, tx_hash }
 * Returns: { listing_id, tx_hash }
 */

import { NextResponse } from "next/server";
import { createOrder } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      token_id: string;
      bps: number;
      price_cspr: string;
      price_usd: number;
      seller_wallet: string;
      asset_name: string;
      tx_hash: string;
    };

    const { token_id, bps, price_cspr, price_usd, seller_wallet, asset_name, tx_hash } = body;

    if (!token_id || !bps || !price_cspr || !tx_hash) {
      return NextResponse.json({ error: "token_id, bps, price_cspr, tx_hash required" }, { status: 400 });
    }

    const order = await createOrder({
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
      settle_hash: tx_hash,
      cspr_amount: Number(BigInt(price_cspr) / BigInt(1_000_000_000)),
    });

    return NextResponse.json({ listing_id: order.id, tx_hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
