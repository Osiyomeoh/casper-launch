/**
 * POST /api/casper/settle-trade
 * Buyer authorizes via signMessage; agent handles CSPR transfer + yield settlement.
 *
 * Body: { orderId, buyerPublicKey, paymentHash }
 *   paymentHash: null → agent sends CSPR (testnet demo mode)
 *   paymentHash: string → wait for buyer's on-chain deploy to confirm
 */
import { NextResponse } from "next/server";
import { getOrder, updateOrder, getToken, upsertToken } from "@/lib/db";
import { waitForDeploy } from "@/lib/casper-rpc";
import { accountHashFromPublicKey, submitRegisterHolder, AGENT_KEY } from "@/lib/casper-cli";
import { spawnSync } from "child_process";

const YIELD_HASH = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";
const CHAIN = process.env.NEXT_PUBLIC_CASPER_CHAIN ?? "casper-test";
const NODE = process.env.NEXT_PUBLIC_CASPER_NODE ?? "https://node.testnet.casper.network/rpc";

function agentTransfer(sellerPublicKey: string, csprAmount: number): string {
  const motes = BigInt(Math.ceil(csprAmount * 1_000_000_000)).toString();
  const sellerHash = `account-hash-${accountHashFromPublicKey(sellerPublicKey)}`;
  const r = spawnSync("casper-client", [
    "transfer",
    "--chain-name", CHAIN,
    "--node-address", NODE,
    "--secret-key", AGENT_KEY,
    "--amount", motes,
    "--target-account", sellerHash,
    "--transfer-id", Date.now().toString().slice(-8),
    "--payment-amount", "100000000",
  ], { encoding: "utf8", timeout: 30_000 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0) throw new Error(`Agent transfer failed: ${out.slice(0, 300)}`);
  const match = out.match(/"deploy_hash"\s*:\s*"([0-9a-f]{64})"/i);
  return match?.[1] ?? "agent-transfer-ok";
}

export async function POST(req: Request) {
  try {
    const { orderId, buyerPublicKey, paymentHash } = await req.json() as {
      orderId: string;
      buyerPublicKey: string;
      paymentHash: string | null;
    };

    const order = getOrder(orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "open") return NextResponse.json({ error: "Order already settled" }, { status: 409 });

    updateOrder(orderId, { buyer_wallet: buyerPublicKey, payment_hash: paymentHash ?? "agent" });

    if (paymentHash) {
      // Buyer signed and submitted their own deploy — wait for it to confirm
      console.log("[settle] waiting for buyer payment:", paymentHash);
      await waitForDeploy(paymentHash, 240_000);
    } else {
      // Agent-pays mode: agent sends CSPR directly to seller on behalf of buyer
      console.log("[settle] agent sending CSPR to seller:", order.seller_wallet);
      const txHash = agentTransfer(order.seller_wallet, order.cspr_amount);
      console.log("[settle] agent transfer submitted:", txHash);
      if (txHash !== "agent-transfer-ok") await waitForDeploy(txHash, 240_000);
    }
    console.log("[settle] payment confirmed");

    // Get current cap table
    const token = getToken(order.token_id);
    if (!token) throw new Error("Token not found");

    const buyerHash = accountHashFromPublicKey(buyerPublicKey);
    const sellerHash = accountHashFromPublicKey(order.seller_wallet);

    // Submit on-chain: register buyer, reduce seller
    const buyerSettleHash = submitRegisterHolder(YIELD_HASH, buyerHash, order.bps);
    const sellerNewBps = Math.max(0, (token.holders.find(h => h.publicKey === order.seller_wallet)?.bps ?? 0) - order.bps);
    const sellerSettleHash = submitRegisterHolder(YIELD_HASH, sellerHash, sellerNewBps);

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
    updateOrder(orderId, { status: "filled", settle_hash: buyerSettleHash });

    return NextResponse.json({ ok: true, buyerSettleHash, sellerSettleHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Settlement failed";
    console.error("[settle]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
