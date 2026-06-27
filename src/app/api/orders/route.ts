import { NextResponse } from "next/server";
import { getAllOrders, createOrder, getOpenSellOrders } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get("listings") === "1") {
    const tokenId = searchParams.get("token_id") ?? undefined;
    return NextResponse.json(await getOpenSellOrders(tokenId));
  }
  return NextResponse.json(await getAllOrders());
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      token_id: string;
      asset_name: string;
      order_type: "buy" | "sell";
      amount: number;
      price_usd: number;
      seller_wallet?: string;
      buyer_wallet?: string;
      bps?: number;
      cspr_amount?: number;
    };
    const { token_id, asset_name, order_type, amount, price_usd } = body;
    if (!token_id || !order_type || !amount || !price_usd)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const order = await createOrder({
      token_id,
      asset_name,
      order_type,
      amount,
      price_usd,
      total_usd: amount * price_usd,
      status: "open",
      seller_wallet: body.seller_wallet ?? "",
      buyer_wallet: body.buyer_wallet ?? "",
      bps: body.bps ?? 0,
      payment_hash: "",
      settle_hash: "",
      cspr_amount: body.cspr_amount ?? 0,
    });
    return NextResponse.json(order, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
