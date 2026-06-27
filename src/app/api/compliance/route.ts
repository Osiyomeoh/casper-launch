import { NextResponse } from "next/server";
import { getAllTokens, getAllOrders } from "@/lib/db";

export async function GET() {
  const tokens = getAllTokens();
  const orders = getAllOrders();

  const tokenEvents = tokens.map(t => ({
    type: "mint" as const,
    id: `mint-${t.token_id}`,
    tokenId: t.token_id,
    assetName: (t.metadata as Record<string, unknown>)?.asset_name as string ?? `Token #${t.token_id}`,
    actor: t.owner,
    hash: t.deploy_hash,
    status: t.deploy_status,
    ts: t.minted_at,
    documentHash: (t.metadata as Record<string, unknown>)?.document_hash as string | undefined,
    documentName: (t.metadata as Record<string, unknown>)?.document_name as string | undefined,
  }));

  const tradeEvents = orders.map(o => ({
    type: o.status === "filled" ? "trade" as const : "listing" as const,
    id: `order-${o.id}`,
    tokenId: o.token_id,
    assetName: o.asset_name,
    actor: o.buyer_wallet || o.seller_wallet,
    hash: o.settle_hash || o.payment_hash,
    status: o.status === "filled" ? "confirmed" : o.status === "cancelled" ? "failed" : "pending",
    ts: o.created_at,
    meta: {
      seller: o.seller_wallet,
      buyer: o.buyer_wallet,
      bps: o.bps,
      cspr: o.cspr_amount,
    },
  }));

  const events = [...tokenEvents, ...tradeEvents].sort((a, b) => b.ts - a.ts);
  return NextResponse.json(events);
}
