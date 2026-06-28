/**
 * POST /api/casper/make-x402-payment
 * Builds an unsigned 1 CSPR transfer Deploy from the user to the platform
 * treasury, for browser-side signing as an x402 payment.
 *
 * Body: { senderPublicKey }
 * Returns: { deployJson, payTo, amountMotes }
 */
import { NextResponse } from "next/server";
import { makeCsprTransferDeploy, Deploy } from "casper-js-sdk";

const CHAIN = "casper-test";
const PAYMENT_MOTES = "1000000000"; // 1 CSPR
const GAS_MOTES = "100000000";      // 0.1 CSPR gas

// Platform treasury — agent public key
const TREASURY_PUBLIC_KEY = process.env.NEXT_PUBLIC_AGENT_PUBLIC_KEY
  ?? "01e208d198c18d6bd1802c90ae44173393a18d16cbe70144ead27018d237888c2a";

export async function POST(req: Request) {
  try {
    const { senderPublicKey } = await req.json() as { senderPublicKey: string };
    if (!senderPublicKey) {
      return NextResponse.json({ error: "senderPublicKey required" }, { status: 400 });
    }

    const deploy = makeCsprTransferDeploy({
      senderPublicKeyHex: senderPublicKey,
      recipientPublicKeyHex: TREASURY_PUBLIC_KEY,
      transferAmount: PAYMENT_MOTES,
      chainName: CHAIN,
      paymentAmount: GAS_MOTES,
      memo: `x402:ai-tokenize:${Date.now()}`,
    });

    return NextResponse.json({
      deployJson: Deploy.toJSON(deploy),
      payTo: TREASURY_PUBLIC_KEY,
      amountMotes: PAYMENT_MOTES,
      amountCspr: "1",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build payment deploy";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
