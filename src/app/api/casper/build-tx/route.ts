/**
 * POST /api/casper/build-tx
 *
 * Builds an unsigned TransactionV1 for the client (user) to sign via
 * their CasperWallet browser extension. The user's public key is the
 * initiator, so the user pays gas from their own account.
 *
 * Body: { action, initiatorPublicKey, ...actionParams }
 * Returns: { txJson } — unsigned tx ready for provider.signTransaction()
 *
 * Supported actions:
 *   "escrow_list"  — list yield shares on the escrow contract
 *   "escrow_buy"   — buy a listed position
 *   "escrow_cancel"— cancel own listing
 */

import { NextResponse } from "next/server";
import { buildUnsignedTx } from "@/lib/casper-cli";
import { Args, NamedArg, CLValue } from "casper-js-sdk";

const ESCROW_HASH = process.env.NEXT_PUBLIC_ESCROW_HASH ?? "";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      action: string;
      initiatorPublicKey: string;
      bps?: number;
      price_cspr?: string;
      listing_id?: string;
      amount?: string;
    };

    const { action, initiatorPublicKey } = body;
    if (!initiatorPublicKey) return NextResponse.json({ error: "initiatorPublicKey required" }, { status: 400 });
    if (!ESCROW_HASH)        return NextResponse.json({ error: "NEXT_PUBLIC_ESCROW_HASH not set" }, { status: 500 });

    let args: Args;
    let entryPoint: string;
    let paymentMotes: bigint;

    switch (action) {
      case "escrow_list": {
        const { bps, price_cspr } = body;
        if (!bps || !price_cspr) return NextResponse.json({ error: "bps and price_cspr required" }, { status: 400 });
        args = Args.fromNamedArgs([
          new NamedArg("bps",        CLValue.newCLUint64(BigInt(bps))),
          new NamedArg("price_cspr", CLValue.newCLUInt512(BigInt(price_cspr))),
        ]);
        entryPoint  = "list";
        paymentMotes = 3_000_000_000n;
        break;
      }
      case "escrow_cancel": {
        const { listing_id } = body;
        if (!listing_id) return NextResponse.json({ error: "listing_id required" }, { status: 400 });
        args = Args.fromNamedArgs([
          new NamedArg("listing_id", CLValue.newCLString(listing_id)),
        ]);
        entryPoint  = "cancel";
        paymentMotes = 2_000_000_000n;
        break;
      }
      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    const txJson = await buildUnsignedTx({
      initiatorPublicKey,
      contractHash: ESCROW_HASH,
      entryPoint,
      args,
      paymentMotes,
    });

    return NextResponse.json({ txJson });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
