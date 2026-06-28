import { NextResponse } from "next/server";
import { putTransaction } from "@/lib/casper-cli";
import { createOrder } from "@/lib/db";
import { Args, NamedArg, CLValue } from "casper-js-sdk";

const ESCROW_HASH = process.env.NEXT_PUBLIC_ESCROW_HASH ?? "";

export async function POST(req: Request) {
  try {
    const { token_id, bps, price_cspr, price_usd, seller_wallet, asset_name } = await req.json() as {
      token_id: string; bps: number; price_cspr: string;
      price_usd: number; seller_wallet: string; asset_name: string;
    };

    if (!token_id || !bps || !price_cspr) {
      return NextResponse.json({ error: "token_id, bps, price_cspr required" }, { status: 400 });
    }
    if (!ESCROW_HASH) {
      return NextResponse.json({ error: "NEXT_PUBLIC_ESCROW_HASH not set" }, { status: 500 });
    }

    const args = Args.fromNamedArgs([
      new NamedArg("bps",        CLValue.newCLUint64(BigInt(bps))),
      new NamedArg("price_cspr", CLValue.newCLUInt512(BigInt(price_cspr))),
    ]);

    const txHash = await putTransaction({
      contractHash: ESCROW_HASH,
      entryPoint: "list",
      args,
      paymentMotes: 20_000_000_000n,
    });

    const order = await createOrder({
      token_id, asset_name: asset_name ?? token_id,
      order_type: "sell", amount: bps, price_usd, total_usd: price_usd,
      status: "open", seller_wallet, buyer_wallet: "",
      bps, payment_hash: "", settle_hash: txHash,
      cspr_amount: Number(BigInt(price_cspr) / BigInt(1_000_000_000)),
    });

    return NextResponse.json({ listing_id: order.id, tx_hash: txHash });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
