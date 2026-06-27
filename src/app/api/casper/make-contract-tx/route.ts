/**
 * POST /api/casper/make-contract-tx
 *
 * Creates an unsigned Casper 2.0 transaction targeting an invocable-entity
 * (contract call), for browser-side signing via CasperWallet.
 *
 * Body: { signerPublicKey, contractHash, entryPoint, sessionArgs, paymentMotes }
 * Returns: { txJson } — unsigned transaction JSON for CasperWallet to sign
 */
import { NextResponse } from "next/server";
import { spawnSync } from "child_process";
import { writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const CHAIN = "casper-test";
const NODE  = "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      signerPublicKey: string;
      contractHash: string;     // 64-char hex, no prefix
      entryPoint: string;
      sessionArgs: string[];    // "name:type='value'" strings
      paymentMotes?: string;
    };

    const { signerPublicKey, contractHash, entryPoint, sessionArgs, paymentMotes = "3000000000" } = body;

    if (!signerPublicKey || !contractHash || !entryPoint)
      return NextResponse.json({ error: "signerPublicKey, contractHash, entryPoint required" }, { status: 400 });

    const outFile = join(tmpdir(), `contract-tx-${Date.now()}.json`);

    const argv = [
      "make-deploy",
      "--chain-name", CHAIN,
      "--session-account", signerPublicKey,
      "--session-hash", contractHash,
      "--session-entry-point", entryPoint,
      "--payment-amount", paymentMotes,
      "--output", outFile,
    ];

    for (const arg of sessionArgs) {
      argv.push("--session-arg", arg);
    }

    const r = spawnSync("casper-client", argv, { encoding: "utf8", timeout: 15_000 });

    if (r.status !== 0) {
      const out = (r.stdout ?? "") + (r.stderr ?? "");
      throw new Error(`make-transaction failed: ${out.slice(0, 400)}`);
    }

    const txJson = readFileSync(outFile, "utf8");
    try { unlinkSync(outFile); } catch {}

    return NextResponse.json({ txJson: JSON.parse(txJson) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create transaction";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
