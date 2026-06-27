/**
 * Casper client CLI wrappers — Casper 2.0 (Condor) compatible.
 *
 * Uses `put-transaction invocable-entity` (single-step make+sign+submit)
 * instead of the deprecated make-deploy / sign-deploy / send-deploy pipeline.
 *
 * All functions here are synchronous wrappers around spawnSync so they can
 * be used from both regular async routes and SSE streaming routes.
 */

import { spawnSync } from "child_process";
import { join } from "path";
import { homedir } from "os";

const NODE = "https://node.testnet.casper.network/rpc";
const CHAIN = "casper-test";

export const AGENT_KEY = join(homedir(), ".casper", "keys", "secret_key.pem");
export const AGENT_PUBKEY = join(homedir(), ".casper", "keys", "public_key.pem");

// ── Spawn helper ──────────────────────────────────────────────────────────────

function run(args: string[]): string {
  const r = spawnSync("casper-client", args, { encoding: "utf8", timeout: 45_000 });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  if (r.status !== 0) throw new Error(`casper-client failed: ${out.slice(0, 400)}`);
  return out;
}

type TxHashWrapper = { Deploy?: string; Version1?: string } | string;

function extractHash(out: string): string {
  const s = out.indexOf("{"), e = out.lastIndexOf("}");
  if (s === -1 || e === -1) throw new Error(`No JSON in output: ${out.slice(0, 200)}`);
  const result = JSON.parse(out.slice(s, e + 1)) as {
    result?: { transaction_hash?: TxHashWrapper; deploy_hash?: string };
    transaction_hash?: TxHashWrapper;
    deploy_hash?: string;
  };
  const r = result?.result ?? result;
  const th = r?.transaction_hash;
  if (th && typeof th === "object") {
    // Version1 (put-transaction) or Deploy (legacy put-deploy)
    if ("Version1" in th && th.Version1) return th.Version1;
    if ("Deploy"   in th && th.Deploy)   return th.Deploy;
  }
  if (th && typeof th === "string") return th;
  if (r?.deploy_hash) return r.deploy_hash;
  throw new Error(`No transaction/deploy hash in: ${out.slice(0, 300)}`);
}

function extractHashAndTrack(out: string): string {
  return extractHash(out);
}

// ── Account address ───────────────────────────────────────────────────────────

let _agentHash: string | null = null;

export function agentAccountHash(): string {
  if (_agentHash) return _agentHash;
  const out = run(["account-address", "--public-key", AGENT_PUBKEY]);
  const m = out.match(/account-hash-([0-9a-f]{64})/i);
  if (!m) throw new Error(`Cannot parse agent account hash from: ${out.slice(0, 200)}`);
  _agentHash = m[1];
  return _agentHash;
}

export function accountHashFromPublicKey(pubKeyHex: string): string {
  const r = spawnSync("casper-client", ["account-address", "--public-key", pubKeyHex], {
    encoding: "utf8", timeout: 10_000,
  });
  const out = (r.stdout ?? "") + (r.stderr ?? "");
  const m = out.match(/account-hash-([0-9a-f]{64})/i);
  if (!m) throw new Error(`Cannot parse account hash for ${pubKeyHex.slice(0, 20)}…: ${out.slice(0, 200)}`);
  return m[1];
}

// ── Contract calls ────────────────────────────────────────────────────────────

export interface ContractCallArgs {
  contractHash: string;           // 64-char hex, no prefix
  entryPoint: string;
  sessionArgs: string[];          // each: "name:type='value'"
  paymentMotes?: string;          // default 5 CSPR
  gasPriceTolerance?: string;     // default "1"
}

/**
 * Build, sign, and submit a contract call in one step.
 * Returns the deploy/transaction hash.
 */
export function putTransaction(args: ContractCallArgs): string {
  const {
    contractHash,
    entryPoint,
    sessionArgs,
    paymentMotes = "5000000000",
    gasPriceTolerance = "1",
  } = args;

  const argv = [
    "put-transaction", "invocable-entity",
    "--chain-name", CHAIN,
    "--node-address", NODE,
    "--secret-key", AGENT_KEY,
    "--contract-hash", `hash-${contractHash}`,
    "--session-entry-point", entryPoint,
    "--payment-amount", paymentMotes,
    "--gas-price-tolerance", gasPriceTolerance,
    "--standard-payment", "true",
  ];

  for (const arg of sessionArgs) {
    argv.push("--session-arg", arg);
  }

  return extractHashAndTrack(run(argv));
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export function submitSetKyc(
  rwaContractHash: string,
  accountHashHex: string
): string {
  return putTransaction({
    contractHash: rwaContractHash,
    entryPoint: "set_kyc",
    sessionArgs: [
      `account:byte_array_32='${accountHashHex}'`,
      "approved:bool='true'",
    ],
    paymentMotes: "3000000000",
  });
}

export function submitMint(
  rwaContractHash: string,
  recipientAccountHashHex: string,
  tokenId: string | number,
  metadataJson: string
): string {
  return putTransaction({
    contractHash: rwaContractHash,
    entryPoint: "mint",
    sessionArgs: [
      `recipient:byte_array_32='${recipientAccountHashHex}'`,
      `token_id:u64='${tokenId}'`,
      `metadata:string='${metadataJson}'`,
    ],
    paymentMotes: "10000000000",
  });
}

export function submitRegisterHolder(
  yieldContractHash: string,
  accountHashHex: string,
  shareBps: number
): string {
  return putTransaction({
    contractHash: yieldContractHash,
    entryPoint: "register_holder",
    sessionArgs: [
      `account:byte_array_32='${accountHashHex}'`,
      `share_bps:u64='${shareBps}'`,
    ],
  });
}
