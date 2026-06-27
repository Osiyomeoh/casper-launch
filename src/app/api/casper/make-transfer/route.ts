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
import { spawnSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";
import { accountHashFromPublicKey, AGENT_KEY } from "@/lib/casper-cli";

const CHAIN = "casper-test";
const NODE  = "https://node.testnet.casper.network/rpc";

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

function activateAccount(pubKeyHex: string, seedMotes: string): string {
  // Use the legacy `transfer` command (v1 deploy format) so the new account
  // is a v1-compatible account that can later submit legacy make-transfer deploys.
  const seed = (BigInt(seedMotes) + BigInt(500_000_000)).toString(); // purchase + 0.5 CSPR gas buffer
  const accountHash = `account-hash-${accountHashFromPublicKey(pubKeyHex)}`;
  const r = spawnSync("casper-client", [
    "transfer",
    "--chain-name", CHAIN,
    "--node-address", NODE,
    "--secret-key", AGENT_KEY,
    "--amount", seed,
    "--target-account", accountHash,
    "--transfer-id", "1",
    "--payment-amount", "100000000",
  ], { encoding: "utf8", timeout: 30_000 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0) throw new Error(`Account activation failed: ${out.slice(0, 300)}`);
  return out;
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

    const sellerHash = sellerPublicKey.startsWith("account-hash-")
      ? sellerPublicKey
      : `account-hash-${accountHashFromPublicKey(sellerPublicKey)}`;

    // Always top up the buyer with enough CSPR for this purchase.
    // If the account doesn't exist yet, this also creates it.
    // We use the legacy transfer command so the account is v1-compatible.
    activateAccount(buyerPublicKey, csprMotes);
    await waitForAccount(buyerPublicKey);
    const activated = true;

    const outFile = join(tmpdir(), `transfer-${Date.now()}.json`);

    const r = spawnSync("casper-client", [
      "make-transfer",
      "--chain-name", CHAIN,
      "--amount", csprMotes,
      "--target-account", sellerHash,
      "--payment-amount", "100000000",
      "--transfer-id", Date.now().toString(),
      "--session-account", buyerPublicKey,
      "--output", outFile,
    ], { encoding: "utf8", timeout: 15_000 });

    if (r.status !== 0) {
      const out = (r.stdout ?? "") + (r.stderr ?? "");
      throw new Error(`make-transfer failed: ${out.slice(0, 300)}`);
    }

    const deployJson = readFileSync(outFile, "utf8");
    try { unlinkSync(outFile); } catch {}

    return NextResponse.json({ deployJson: JSON.parse(deployJson), activated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create transfer";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
