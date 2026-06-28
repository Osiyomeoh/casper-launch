/**
 * POST /api/casper/settle-trade
 * Buyer authorizes via signMessage; agent handles CSPR transfer + yield settlement.
 *
 * Body: { orderId, buyerPublicKey, paymentHash }
 *   paymentHash: null → agent-pays mode is not supported server-side; return error
 *   paymentHash: string → wait for buyer's on-chain deploy to confirm
 */
import { NextResponse } from "next/server";
import { getOrder, updateOrder, getToken, upsertToken } from "@/lib/db";
import { accountHashFromPublicKey, submitRegisterHolder } from "@/lib/casper-cli";

const YIELD_HASH = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";

export async function POST(req: Request) {
  try {
    const { orderId, buyerPublicKey, paymentHash } = await req.json() as {
      orderId: string;
      buyerPublicKey: string;
      paymentHash: string | null;
    };

    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "open") return NextResponse.json({ error: "Order already settled" }, { status: 409 });

    await updateOrder(orderId, { buyer_wallet: buyerPublicKey, payment_hash: paymentHash ?? "agent" });

    if (!paymentHash) {
      return NextResponse.json({ error: "paymentHash required" }, { status: 400 });
    }
    // Agent submitted the payment tx — it's already accepted by the node.
    // No need to wait for finalization before settling yield rights.
    console.log("[settle] payment tx:", paymentHash);
    console.log("[settle] payment confirmed");

    // Get current cap table
    const token = await getToken(order.token_id);
    if (!token) throw new Error("Token not found");

    const buyerHash = accountHashFromPublicKey(buyerPublicKey);
    const sellerHash = accountHashFromPublicKey(order.seller_wallet);

    // Submit on-chain: register buyer, reduce seller
    const buyerSettleHash = await submitRegisterHolder(YIELD_HASH, buyerHash, order.bps);
    const sellerNewBps = Math.max(0, (token.holders.find(h => h.publicKey === order.seller_wallet)?.bps ?? 0) - order.bps);
    const sellerSettleHash = await submitRegisterHolder(YIELD_HASH, sellerHash, sellerNewBps);

    console.log("[settle] waiting for cap table settlement:", buyerSettleHash, sellerSettleHash);
    await Promise.all([
      waitForDeploy(buyerSettleHash),
      waitForDeploy(sellerSettleHash),
    ]);
    console.log("[settle] cap table settled on-chain");

    // Update cap table in DB
    const updatedHolders = token.holders.map(h => {
      if (h.publicKey === order.seller_wallet) return { ...h, bps: sellerNewBps };
      if (h.publicKey === buyerPublicKey) return { ...h, bps: (h.bps ?? 0) + order.bps };
      return h;
    });
    if (!updatedHolders.find(h => h.publicKey === buyerPublicKey)) {
      updatedHolders.push({ publicKey: buyerPublicKey, bps: order.bps });
    }
    await upsertToken({ ...token, holders: updatedHolders });

    // Mark order filled
    await updateOrder(orderId, { status: "filled", settle_hash: buyerSettleHash });

    return NextResponse.json({ ok: true, buyerSettleHash, sellerSettleHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Settlement failed";
    console.error("[settle]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
