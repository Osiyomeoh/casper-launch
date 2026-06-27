/**
 * POST /api/casper/make-transfer
 * Creates an unsigned CSPR transfer deploy for browser-side signing.
 *
 * If the buyer account doesn't exist on-chain yet, the agent activates it
 * first with a 3 CSPR seed transfer so the buyer can submit deploys.
 *
 * Body: { buyerPublicKey, sellerPublicKey, csprMotes }
 * Returns: { deployJson, activated? } — unsigned deploy JSON for CasperWallet to sign
 */
import { NextResponse } from "next/server";
import { accountHashFromPublicKey } from "@/lib/casper-cli";
import {
  RpcClient,
  HttpHandler,
  PrivateKey,
  KeyAlgorithm,
  makeCsprTransferDeploy,
  Deploy,
} from "casper-js-sdk";

const CHAIN = "casper-test";
const NODE  = "https://node.testnet.casper.network/rpc";

const rpc = new RpcClient(new HttpHandler(NODE));

async function accountExists(pubKeyHex: string): Promise<boolean> {
  try {
    const accountHash = `account-hash-${accountHashFromPublicKey(pubKeyHex)}`;
    const res = await fetch(NODE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "query_global_state",
        params: { state_identifier: null, key: accountHash, path: [] },
      }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = await res.json() as { error?: unknown };
    return !json.error;
  } catch {
    return false;
  }
}

function getAgentPrivateKey(): PrivateKey {
  const pem = process.env.AGENT_SECRET_KEY_PEM;
  if (!pem) throw new Error("AGENT_SECRET_KEY_PEM env var not set");
  return PrivateKey.fromPem(pem.replace(/\\n/g, "\n"), KeyAlgorithm.ED25519);
}

async function activateAccount(pubKeyHex: string, seedMotes: string): Promise<string> {
  const agentKey = getAgentPrivateKey();
  const agentPubKey = agentKey.publicKey;
  // Send seed + 0.5 CSPR for gas
  const amount = (BigInt(seedMotes) + 500_000_000n).toString();

  const deploy = makeCsprTransferDeploy({
    senderPublicKeyHex: agentPubKey.toHex(),
    recipientPublicKeyHex: pubKeyHex,
    transferAmount: amount,
    chainName: CHAIN,
    paymentAmount: "100000000",
  });
  deploy.sign(agentKey);

  const result = await rpc.putDeploy(deploy);
  // deployHash is a Hash object — convert to string
  const hash = result?.deployHash;
  return hash ? (typeof hash === "string" ? hash : (hash as { toHex?: () => string }).toHex?.() ?? String(hash)) : "agent-activation-ok";
}

async function waitForAccount(pubKeyHex: string, maxMs = 60_000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await accountExists(pubKeyHex)) return;
    await new Promise(r => setTimeout(r, 4_000));
  }
  throw new Error("Timeout waiting for buyer account to be activated on-chain");
}

export async function POST(req: Request) {
  try {
    const { buyerPublicKey, sellerPublicKey, csprMotes } = await req.json() as {
      buyerPublicKey: string;
      sellerPublicKey: string;
      csprMotes: string;
    };

    if (!buyerPublicKey || !sellerPublicKey || !csprMotes)
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    // Always top up the buyer with enough CSPR for this purchase.
    // If the account doesn't exist yet, this also creates it.
    await activateAccount(buyerPublicKey, csprMotes);
    await waitForAccount(buyerPublicKey);
    const activated = true;

    // Build unsigned transfer deploy for the buyer to sign in their wallet
    const deploy = makeCsprTransferDeploy({
      senderPublicKeyHex: buyerPublicKey,
      recipientPublicKeyHex: sellerPublicKey.startsWith("account-hash-")
        ? sellerPublicKey
        : sellerPublicKey,
      transferAmount: csprMotes,
      chainName: CHAIN,
      paymentAmount: "100000000",
      memo: Date.now().toString(),
    });

    return NextResponse.json({ deployJson: Deploy.toJSON(deploy), activated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create transfer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
