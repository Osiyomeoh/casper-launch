/**
 * POST /api/casper/make-x402-payment
 * Builds an unsigned 3 CSPR transfer Deploy from the user to the platform
 * treasury, for browser-side signing as an x402 payment.
 *
 * Body: { senderPublicKey }
 * Returns: { deployJson, payTo, amountMotes }
 */
import { NextResponse } from "next/server";
import { makeCsprTransferDeploy, Deploy, PublicKey } from "casper-js-sdk";

const CHAIN = "casper-test";
const PAYMENT_MOTES = "3000000000"; // 3 CSPR (testnet minimum transfer is 2.5 CSPR)
const GAS_MOTES = "100000000";      // 0.1 CSPR gas

// Platform treasury — agent public key
const TREASURY_PUBLIC_KEY = process.env.NEXT_PUBLIC_AGENT_PUBLIC_KEY
  ?? "01e208d198c18d6bd1802c90ae44173393a18d16cbe70144ead27018d237888c2a";

function publicKeyToAccountHashHex(pubKeyHex: string): string {
  const pub = PublicKey.fromHex(pubKeyHex);
  const ah = pub.accountHash() as unknown as { hashBytes: Uint8Array };
  return Buffer.from(ah.hashBytes).toString("hex");
}

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
      memo: String(Date.now() % 1_000_000),
    });

    // Casper 2.0 requires CLKey(Account) as transfer target, not CLPublicKey.
    // Post-process the deploy JSON to replace the target field.
    const deployJson = Deploy.toJSON(deploy) as Record<string, unknown>;
    const treasuryHashHex = publicKeyToAccountHashHex(TREASURY_PUBLIC_KEY);
    const session = (deployJson.session as Record<string, unknown>);
    const transferArgs = (session?.Transfer as Record<string, unknown>)?.args as [string, unknown][];
    if (transferArgs) {
      for (const arg of transferArgs) {
        if (arg[0] === "target") {
          // Replace CLPublicKey with CLKey(Account) — prefix 00 + 32-byte account hash
          (arg[1] as Record<string, unknown>).bytes = "00" + treasuryHashHex;
          (arg[1] as Record<string, unknown>).cl_type = "Key";
        }
      }
    }

    return NextResponse.json({
      deployJson,
      payTo: TREASURY_PUBLIC_KEY,
      amountMotes: PAYMENT_MOTES,
      amountCspr: "3",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to build payment deploy";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
