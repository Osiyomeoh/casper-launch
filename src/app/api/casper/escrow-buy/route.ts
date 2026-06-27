/**
 * POST /api/casper/escrow-buy
 *
 * SSE endpoint — buyer triggers an atomic escrow purchase.
 *
 * The escrow contract handles everything atomically:
 *   1. Buyer's CSPR locked in escrow purse
 *   2. Contract calls yield_distributor.register_holder(buyer, bps)
 *   3. On success: CSPR released to seller — both sides settled atomically
 *   4. On failure: entire tx reverts — buyer keeps CSPR, listing stays open
 *
 * For the hackathon demo the agent submits on behalf of the buyer using
 * `put-transaction` with the agent key. In production the buyer would sign
 * from their CasperWallet (see /api/casper/make-transfer for unsigned flow).
 *
 * Body: { listing_id, order_id, buyer_wallet, amount_cspr_motes }
 * Returns: SSE stream with { step, status, hash? }
 */

import {
  putTransaction,
  accountHashFromPublicKey,
} from "@/lib/casper-cli";
import { updateOrder, getOrder } from "@/lib/db";
import { Args, NamedArg, CLValue } from "casper-js-sdk";

const ESCROW_HASH = process.env.NEXT_PUBLIC_ESCROW_HASH ?? "";

export async function POST(req: Request) {
  const body = await req.json() as {
    listing_id: string;    // on-chain LST-N id
    order_id: string;      // SQLite ORD-xxx id
    buyer_wallet: string;  // buyer's public key
    amount_cspr_motes: string; // exact motes to send (must match listing price)
  };

  const { listing_id, order_id, buyer_wallet, amount_cspr_motes } = body;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      try {
        if (!ESCROW_HASH) throw new Error("NEXT_PUBLIC_ESCROW_HASH not set");

        // 1. Resolve buyer account hash for the contract arg
        send({ step: "resolve", status: "running", msg: "Resolving buyer account..." });
        let buyerHash: string;
        try {
          buyerHash = buyer_wallet.startsWith("account-hash-")
            ? buyer_wallet.slice("account-hash-".length)
            : accountHashFromPublicKey(buyer_wallet);
        } catch {
          buyerHash = buyer_wallet; // fallback — contract will validate
        }
        send({ step: "resolve", status: "done" });

        // 2. Submit the atomic escrow buy transaction
        send({ step: "escrow", status: "running", msg: "Submitting atomic escrow buy..." });
        const buyerHashBytes = Buffer.from(buyerHash, "hex");
        const args = Args.fromNamedArgs([
          new NamedArg("listing_id", CLValue.newCLString(listing_id)),
          new NamedArg("buyer_hash", CLValue.newCLByteArray(buyerHashBytes)),
          new NamedArg("amount", CLValue.newCLUInt512(BigInt(amount_cspr_motes))),
        ]);
        const txHash = await putTransaction({
          contractHash: ESCROW_HASH,
          entryPoint: "buy",
          args,
          paymentMotes: BigInt(amount_cspr_motes) + 5_000_000_000n,
        });
        send({ step: "escrow", status: "done", hash: txHash });

        // 3. Update SQLite order
        await updateOrder(order_id, {
          status: "filled",
          buyer_wallet,
          settle_hash: txHash,
        });

        send({ step: "complete", status: "done", hash: txHash });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        // Revert local order status if we had one
        try {
          const ord = await getOrder(order_id);
          if (ord && ord.status === "open") {
            await updateOrder(order_id, { status: "open" });
          }
        } catch { /* ignore */ }
        send({ step: "error", status: "error", msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
