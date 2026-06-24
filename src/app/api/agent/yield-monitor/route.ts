import { NextResponse } from "next/server";
import fs from "fs";
import {
  ContractCallBuilder,
  Args,
  PrivateKey,
  KeyAlgorithm,
  RpcClient,
  HttpHandler,
} from "casper-js-sdk";
import { log, recordCheck, recordDistribution, setAgentRunning, getAgentState } from "@/lib/agent-store";

const TESTNET_RPC = "https://node.testnet.casper.network";
const CHAIN_NAME = "casper-test";
const YIELD_CONTRACT = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";
const PAYMENT_MOTES = 5_000_000_000;
// Threshold: agent distributes when pool has >= 1 CSPR (1e9 motes)
const DISTRIBUTE_THRESHOLD_MOTES = 1_000_000_000n;
const POLL_INTERVAL_MS = 30_000;

let agentTimer: ReturnType<typeof setInterval> | null = null;

function loadPrivateKey(): PrivateKey | null {
  const keyPath = process.env.AGENT_KEY_PATH ?? `${process.env.HOME}/.casper/keys/secret_key.pem`;
  try {
    const pem = fs.readFileSync(keyPath, "utf8");
    return PrivateKey.fromPem(pem, KeyAlgorithm.ED25519);
  } catch (e) {
    log("error", `Cannot load agent key from ${keyPath}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

async function checkPoolBalance(client: RpcClient): Promise<bigint> {
  try {
    // Query the yield contract's pool_total named key via global state
    const contractHash = `contract-${YIELD_CONTRACT}`;
    const stateRes = await fetch(`${TESTNET_RPC}/rpc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "query_global_state",
        params: {
          state_identifier: { BlockHeight: await getLatestBlockHeight(client) },
          key: contractHash,
          path: ["pool_total"],
        },
      }),
    });
    const stateData = await stateRes.json() as { result?: { stored_value?: { CLValue?: { parsed?: string } } } };
    const parsed = stateData.result?.stored_value?.CLValue?.parsed;
    if (parsed) return BigInt(parsed);
    return 0n;
  } catch {
    return 0n;
  }
}

async function getLatestBlockHeight(client: RpcClient): Promise<number> {
  try {
    const info = await client.getLatestBlock();
    return (info as unknown as { block?: { Version2?: { header?: { height?: number } } } })
      ?.block?.Version2?.header?.height ?? 0;
  } catch {
    return 0;
  }
}

async function runDistribute(privateKey: PrivateKey): Promise<string> {
  const publicKey = privateKey.publicKey;

  const tx = new ContractCallBuilder()
    .from(publicKey)
    .chainName(CHAIN_NAME)
    .payment(PAYMENT_MOTES)
    .byHash(YIELD_CONTRACT)
    .entryPoint("distribute")
    .runtimeArgs(new Args(new Map()))
    .buildFor1_5();

  tx.sign(privateKey);

  const client = new RpcClient(new HttpHandler(`${TESTNET_RPC}/rpc`));
  const result = await client.putTransaction(tx) as unknown as { transaction_hash?: { Deploy?: string } };
  return result?.transaction_hash?.Deploy ?? "unknown";
}

export async function agentTick() {
  if (!YIELD_CONTRACT) {
    log("warn", "NEXT_PUBLIC_YIELD_HASH not set — agent paused");
    return;
  }

  const nextCheck = Date.now() + POLL_INTERVAL_MS;
  recordCheck(nextCheck);
  log("info", `Checking yield pool balance on Casper testnet...`);

  const client = new RpcClient(new HttpHandler(`${TESTNET_RPC}/rpc`));
  const balance = await checkPoolBalance(client);

  log("info", `Pool balance: ${(Number(balance) / 1e9).toFixed(4)} CSPR (threshold: ${Number(DISTRIBUTE_THRESHOLD_MOTES) / 1e9} CSPR)`);

  if (balance < DISTRIBUTE_THRESHOLD_MOTES) {
    log("info", "Pool below threshold — no distribution needed");
    return;
  }

  const privateKey = loadPrivateKey();
  if (!privateKey) return;

  log("info", `Pool has ${(Number(balance) / 1e9).toFixed(4)} CSPR — triggering autonomous distribution...`);

  try {
    const txHash = await runDistribute(privateKey);
    recordDistribution();
    log("success", `Distribution submitted autonomously`, txHash);
    log("success", `Tx: ${txHash.slice(0, 16)}... — holders can now claim yield`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // NothingToDistribute is expected when pool is empty — not a real error
    if (msg.includes("NothingToDistribute") || msg.includes("User(2)")) {
      log("info", "Contract confirmed: pool empty, nothing to distribute");
    } else {
      log("error", `Distribution failed: ${msg}`);
    }
  }
}

export function startAgent() {
  if (agentTimer) return;
  setAgentRunning(true);
  log("info", "Autonomous yield agent started — polling every 30s");
  agentTick();
  agentTimer = setInterval(agentTick, POLL_INTERVAL_MS);
}

export function stopAgent() {
  if (agentTimer) {
    clearInterval(agentTimer);
    agentTimer = null;
  }
  setAgentRunning(false);
  log("info", "Agent stopped");
}

// GET — manual trigger for a single tick (useful for testing / demo)
export async function GET() {
  await agentTick();
  return NextResponse.json(getAgentState());
}

// POST — start or stop the agent
export async function POST(req: Request) {
  const { action } = await req.json() as { action: "start" | "stop" };
  if (action === "start") {
    startAgent();
  } else if (action === "stop") {
    stopAgent();
  }
  return NextResponse.json(getAgentState());
}
