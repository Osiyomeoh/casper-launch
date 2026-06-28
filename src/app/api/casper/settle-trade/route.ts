/**
 * POST /api/casper/settle-trade
 * Agent submits CSPR payment on-chain, then settles yield rights.
 * Works with or without a pre-submitted paymentHash from the client.
 */
import { NextResponse } from "next/server";
import { getOrder, updateOrder, getToken, upsertToken } from "@/lib/db";
import { accountHashFromPublicKey, submitRegisterHolder, putTransaction } from "@/lib/casper-cli";
import {
  PublicKey,
  Args,
  NamedArg,
  CLValue,
} from "casper-js-sdk";

const YIELD_HASH = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";
const TREASURY_PUBLIC_KEY = process.env.NEXT_PUBLIC_AGENT_PUBLIC_KEY
  ?? "01e208d198c18d6bd1802c90ae44173393a18d16cbe70144ead27018d237888c2a";

async function submitPaymentTx(): Promise<string> {
  const treasuryPub = PublicKey.fromHex(TREASURY_PUBLIC_KEY);
  // Native transfer: agent → treasury (self-transfer records payment on-chain)
  // Uses putTransaction with a native transfer entry point
  const treasuryAH = treasuryPub.accountHash() as unknown as { hashBytes: Uint8Array };
  const treasuryHashHex = Buffer.from(treasuryAH.hashBytes).toString("hex");
  const args = Args.fromNamedArgs([
    new NamedArg("target", CLValue.newCLPublicKey(treasuryPub)),
    new NamedArg("amount", CLValue.newCLUInt512(3_000_000_000n)),
    new NamedArg("id", CLValue.newCLOption(CLValue.newCLUint64(BigInt(Date.now() % 1_000_000)))),
  ]);
  // Use a special native-transfer contract hash sentinel — handled in putTransaction
  return putTransaction({
    contractHash: treasuryHashHex, // unused for native, but required by type
    entryPoint: "__native_transfer__",
    args,
    paymentMotes: 3_000_000_000n,
  });
}

export async function POST(req: Request) {
  try {
    const { orderId, buyerPublicKey, paymentHash: clientPaymentHash } = await req.json() as {
      orderId: string;
      buyerPublicKey: string;
      paymentHash: string | null;
    };

    const order = await getOrder(orderId);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "open") return NextResponse.json({ error: "Order already settled" }, { status: 409 });

    // Submit payment on-chain (use client hash if provided, else agent submits)
    let paymentHash = clientPaymentHash;
    if (!paymentHash) {
      console.log("[settle] no client paymentHash — agent submitting native transfer");
      paymentHash = await submitPaymentOnChain();
      console.log("[settle] agent payment tx:", paymentHash);
    }

    await updateOrder(orderId, { buyer_wallet: buyerPublicKey, payment_hash: paymentHash });

    // Get current cap table
    const token = await getToken(order.token_id);
    if (!token) throw new Error("Token not found");

    const buyerHash = accountHashFromPublicKey(buyerPublicKey);
    const sellerHash = accountHashFromPublicKey(order.seller_wallet);

    // Submit on-chain: register buyer, reduce seller
    const buyerSettleHash = await submitRegisterHolder(YIELD_HASH, buyerHash, order.bps);
    const sellerNewBps = Math.max(0, (token.holders.find(h => h.publicKey === order.seller_wallet)?.bps ?? 0) - order.bps);
    const sellerSettleHash = await submitRegisterHolder(YIELD_HASH, sellerHash, sellerNewBps);

    console.log("[settle] cap table txs:", buyerSettleHash, sellerSettleHash);

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

    await updateOrder(orderId, { status: "filled", settle_hash: buyerSettleHash });

    return NextResponse.json({ ok: true, buyerSettleHash, sellerSettleHash, paymentHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Settlement failed";
    console.error("[settle]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function submitPaymentOnChain(): Promise<string> {
  // Agent submits a 3 CSPR native transfer on-chain as proof of payment
  const NODE = "https://node.testnet.casper.network/rpc";
  const { PrivateKey, KeyAlgorithm, TransactionV1Payload, TransactionV1,
    TransactionEntryPoint, TransactionScheduling, TransactionTarget,
    PaymentLimitedMode, PricingMode, Args: TxArgs, NamedArg: TxNamedArg,
    CLValue: TxCLValue, PublicKey: TxPublicKey, InitiatorAddr, Duration, Timestamp } =
    await import("casper-js-sdk");

  const pem = process.env.AGENT_SECRET_KEY_PEM;
  if (!pem) throw new Error("AGENT_SECRET_KEY_PEM not set");
  const privateKey = PrivateKey.fromPem(pem.replace(/\\n/g, "\n"), KeyAlgorithm.ED25519);
  const treasuryPub = TxPublicKey.fromHex(TREASURY_PUBLIC_KEY);

  const args = TxArgs.fromNamedArgs([
    new TxNamedArg("target", TxCLValue.newCLPublicKey(treasuryPub)),
    new TxNamedArg("amount", TxCLValue.newCLUInt512(3_000_000_000n)),
    new TxNamedArg("id", TxCLValue.newCLOption(TxCLValue.newCLUint64(BigInt(Date.now() % 1_000_000)))),
  ]);

  const nativeTarget = TransactionTarget.fromJSON("Native");
  const pricing = new PricingMode();
  const limited = new PaymentLimitedMode();
  limited.paymentAmount = 3_000_000_000;
  limited.gasPriceTolerance = 1;
  limited.standardPayment = true;
  pricing.paymentLimited = limited;

  const payload = TransactionV1Payload.build({
    initiatorAddr: new InitiatorAddr(privateKey.publicKey),
    args, ttl: new Duration(30 * 60 * 1000),
    entryPoint: TransactionEntryPoint.fromJSON("Transfer"),
    pricingMode: pricing,
    timestamp: new Timestamp(new Date()),
    transactionTarget: nativeTarget,
    scheduling: TransactionScheduling.fromJSON("Standard"),
    chainName: "casper-test",
  });

  const tx = TransactionV1.makeTransactionV1(payload);
  tx.sign(privateKey);
  const txJson = TransactionV1.toJSON(tx);

  const res = await fetch(NODE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "account_put_transaction", params: { transaction: { Version1: txJson } } }),
  });
  const data = await res.json() as { result?: { transaction_hash?: { Version1?: string } }; error?: { message?: string; data?: unknown } };
  if (data.error) throw new Error(`Payment tx failed: ${data.error.message} — ${JSON.stringify(data.error.data ?? "")}`);
  const hash = data.result?.transaction_hash?.Version1;
  if (!hash) throw new Error(`No tx hash: ${JSON.stringify(data)}`);
  return hash;
}
