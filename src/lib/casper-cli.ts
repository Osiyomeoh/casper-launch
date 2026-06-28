/**
 * Casper contract interaction helpers — pure SDK, no casper-client binary.
 * Works on Vercel serverless and any Node.js environment.
 */

import {
  RpcClient,
  HttpHandler,
  PrivateKey,
  PublicKey,
  KeyAlgorithm,
  TransactionV1Payload,
  TransactionV1,
  Transaction,
  TransactionEntryPoint,
  TransactionScheduling,
  TransactionTarget,
  TransactionInvocationTarget,
  StoredTarget,
  TransactionRuntime,
  Hash,
  PaymentLimitedMode,
  PricingMode,
  Args,
  NamedArg,
  CLValue,
  InitiatorAddr,
  Duration,
  Timestamp,
} from "casper-js-sdk";

const NODE  = "https://node.testnet.casper.network/rpc";
const CHAIN = "casper-test";
const TTL   = new Duration(30 * 60 * 1000); // 30 minutes

const rpc = new RpcClient(new HttpHandler(NODE));

// ── Agent key (loaded once) ───────────────────────────────────────────────────

let _privateKey: PrivateKey | null = null;

function getAgentKey(): PrivateKey {
  if (_privateKey) return _privateKey;
  const pem = process.env.AGENT_SECRET_KEY_PEM;
  if (!pem) throw new Error("AGENT_SECRET_KEY_PEM env var not set");
  _privateKey = PrivateKey.fromPem(pem.replace(/\\n/g, "\n"), KeyAlgorithm.ED25519);
  return _privateKey;
}

// ── Account hash helpers ──────────────────────────────────────────────────────

export function agentAccountHash(): string {
  const pubKey = getAgentKey().publicKey;
  const hash = pubKey.accountHash() as unknown as { hashBytes: Uint8Array };
  return Buffer.from(hash.hashBytes).toString("hex");
}

export function accountHashFromPublicKey(pubKeyHex: string): string {
  const pub = PublicKey.fromHex(pubKeyHex);
  const hash = pub.accountHash() as unknown as { hashBytes: Uint8Array };
  return Buffer.from(hash.hashBytes).toString("hex");
}

// ── Build + sign + submit a stored contract call ─────────────────────────────

export interface ContractCallArgs {
  contractHash: string;   // 64-char hex, no prefix
  entryPoint: string;
  args: Args;
  paymentMotes?: bigint;
}

export async function putTransaction(callArgs: ContractCallArgs): Promise<string> {
  const { contractHash, entryPoint, args, paymentMotes = 5_000_000_000n } = callArgs;

  const privateKey  = getAgentKey();
  const publicKey   = privateKey.publicKey;
  const initiatorAddr = new InitiatorAddr(publicKey);

  const invTarget = new TransactionInvocationTarget();
  invTarget.byHash = Hash.fromHex(contractHash);
  const storedTarget = new StoredTarget();
  storedTarget.id = invTarget;
  storedTarget.runtime = TransactionRuntime.vmCasperV1();
  const target = new TransactionTarget();
  target.stored = storedTarget;

  const pricing = new PricingMode();
  const limited = new PaymentLimitedMode();
  limited.paymentAmount = Number(paymentMotes);
  limited.gasPriceTolerance = 5;
  limited.standardPayment = true;
  pricing.paymentLimited = limited;

  const payload = TransactionV1Payload.build({
    initiatorAddr,
    args,
    ttl: TTL,
    entryPoint: TransactionEntryPoint.fromJSON({ Custom: entryPoint }),
    pricingMode: pricing,
    timestamp: new Timestamp(new Date()),
    transactionTarget: target,
    scheduling: TransactionScheduling.fromJSON("Standard"),
    chainName: CHAIN,
  });

  const tx = TransactionV1.makeTransactionV1(payload);
  tx.sign(privateKey);

  // Use raw JSON-RPC fetch — avoids SDK wrapper adding extra fields
  const txJson = TransactionV1.toJSON(tx);
  const rpcRes = await fetch(NODE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: 1,
      method: "account_put_transaction",
      params: { transaction: { Version1: txJson } },
    }),
  });
  const rpcData = await rpcRes.json() as {
    result?: { transaction_hash?: { Version1?: string; Deploy?: string } };
    error?: { code?: number; message?: string };
  };
  if (rpcData.error) throw new Error(`Code: ${rpcData.error.code}, err: ${rpcData.error.message}`);
  const hash = rpcData.result?.transaction_hash?.Version1 ?? rpcData.result?.transaction_hash?.Deploy ?? "";
  if (!hash) throw new Error(`No hash in RPC response: ${JSON.stringify(rpcData)}`);
  return hash;
}

// ── Build unsigned tx for wallet signing (user pays) ─────────────────────────

export async function buildUnsignedTx(callArgs: {
  initiatorPublicKey: string;
  contractHash: string;
  entryPoint: string;
  args: Args;
  paymentMotes?: bigint;
}): Promise<Record<string, unknown>> {
  const { initiatorPublicKey, contractHash, entryPoint, args, paymentMotes = 5_000_000_000n } = callArgs;

  const publicKey = PublicKey.fromHex(initiatorPublicKey);
  const initiatorAddr = new InitiatorAddr(publicKey);

  const invTarget = new TransactionInvocationTarget();
  invTarget.byHash = Hash.fromHex(contractHash);
  const storedTarget = new StoredTarget();
  storedTarget.id = invTarget;
  storedTarget.runtime = TransactionRuntime.vmCasperV1();
  const target = new TransactionTarget();
  target.stored = storedTarget;

  const pricing = new PricingMode();
  const limited = new PaymentLimitedMode();
  limited.paymentAmount = Number(paymentMotes);
  limited.gasPriceTolerance = 5;
  limited.standardPayment = true;
  pricing.paymentLimited = limited;

  const payload = TransactionV1Payload.build({
    initiatorAddr,
    args,
    ttl: TTL,
    entryPoint: TransactionEntryPoint.fromJSON({ Custom: entryPoint }),
    pricingMode: pricing,
    timestamp: new Timestamp(new Date()),
    transactionTarget: target,
    scheduling: TransactionScheduling.fromJSON("Standard"),
    chainName: CHAIN,
  });

  const tx = TransactionV1.makeTransactionV1(payload);
  return (TransactionV1.toJSON(tx) ?? {}) as Record<string, unknown>;
}

// ── Convenience wrappers ──────────────────────────────────────────────────────

export async function submitSetKyc(
  rwaContractHash: string,
  accountHashHex: string
): Promise<string> {
  const hashBytes = Buffer.from(accountHashHex, "hex");
  const args = Args.fromNamedArgs([
    new NamedArg("account", CLValue.newCLByteArray(hashBytes)),
    new NamedArg("approved", CLValue.newCLValueBool(true)),
  ]);
  return putTransaction({
    contractHash: rwaContractHash,
    entryPoint: "set_kyc",
    args,
    paymentMotes: 3_000_000_000n,
  });
}

export async function submitMint(
  rwaContractHash: string,
  recipientAccountHashHex: string,
  tokenId: string | number,
  metadataJson: string
): Promise<string> {
  const hashBytes = Buffer.from(recipientAccountHashHex, "hex");
  const args = Args.fromNamedArgs([
    new NamedArg("recipient", CLValue.newCLByteArray(hashBytes)),
    new NamedArg("token_id", CLValue.newCLUint64(BigInt(tokenId))),
    new NamedArg("metadata", CLValue.newCLString(metadataJson)),
  ]);
  return putTransaction({
    contractHash: rwaContractHash,
    entryPoint: "mint",
    args,
    paymentMotes: 10_000_000_000n,
  });
}

export async function submitRegisterHolder(
  yieldContractHash: string,
  accountHashHex: string,
  shareBps: number
): Promise<string> {
  const hashBytes = Buffer.from(accountHashHex, "hex");
  const args = Args.fromNamedArgs([
    new NamedArg("account", CLValue.newCLByteArray(hashBytes)),
    new NamedArg("share_bps", CLValue.newCLUint64(BigInt(shareBps))),
  ]);
  return putTransaction({
    contractHash: yieldContractHash,
    entryPoint: "register_holder",
    args,
  });
}

// Keep these for any routes that still import them as values
export const AGENT_KEY = "";
export const AGENT_PUBKEY = "";
