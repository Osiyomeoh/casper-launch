/**
 * Low-level Casper JSON-RPC helpers used by the chain-sync endpoint.
 * Keeps all node I/O in one place so the sync logic stays readable.
 */

const NODES = [
  "https://node.testnet.casper.network/rpc",
  "https://rpc.testnet.casperlabs.io/rpc",
];

type RpcResult = Record<string, unknown>;

async function rpc(node: string, method: string, params: unknown): Promise<RpcResult> {
  const res = await fetch(node, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json() as { result?: RpcResult; error?: { message: string } };
  if (json.error) throw new Error(`RPC ${method}: ${json.error.message}`);
  return json.result ?? {};
}

// Try each node in order, return on first success
async function withFallback<T>(fn: (node: string) => Promise<T>): Promise<T> {
  let last: unknown;
  for (const node of NODES) {
    try { return await fn(node); } catch (e) { last = e; }
  }
  throw last;
}

// ── State ─────────────────────────────────────────────────────────────────────

export async function getStateRootHash(): Promise<string> {
  const r = await withFallback(n => rpc(n, "chain_get_state_root_hash", {}));
  return r.state_root_hash as string;
}

export async function getStateItem(
  stateRoot: string,
  key: string,
  path: string[] = []
): Promise<unknown> {
  const r = await withFallback(n =>
    rpc(n, "state_get_item", { state_root_hash: stateRoot, key, path })
  );
  return (r as { stored_value?: unknown }).stored_value;
}

// ── Contract named keys ───────────────────────────────────────────────────────

type NamedKey = { name: string; key: string };
type ContractResult = { Contract?: { named_keys?: NamedKey[] } };

export async function getContractNamedKeys(
  contractHash: string,
  stateRoot: string
): Promise<Record<string, string>> {
  const stored = await getStateItem(stateRoot, `hash-${contractHash}`) as ContractResult | null;
  const keys = stored?.Contract?.named_keys ?? [];
  return Object.fromEntries(keys.map(k => [k.name, k.key]));
}

// ── Dictionary reads ──────────────────────────────────────────────────────────

// CEP-78 stores token data in named dictionaries keyed by token_id string
export async function getDictItem(
  stateRoot: string,
  contractHash: string,
  dictionaryName: string,
  itemKey: string
): Promise<unknown> {
  try {
    const r = await withFallback(n =>
      rpc(n, "state_get_dictionary_item", {
        state_root_hash: stateRoot,
        contract_named_key: {
          hash: `hash-${contractHash}`,
          dictionary_name: dictionaryName,
          dictionary_item_key: itemKey,
        },
      })
    );
    return (r as { stored_value?: { CLValue?: { parsed?: unknown } } })
      .stored_value?.CLValue?.parsed ?? null;
  } catch {
    return null;
  }
}

// ── Total supply ──────────────────────────────────────────────────────────────

export async function getTotalSupply(
  contractHash: string,
  stateRoot: string,
  namedKeys: Record<string, string>
): Promise<number> {
  const uref = namedKeys["total_supply"];
  if (!uref) return 0;
  try {
    const stored = await getStateItem(stateRoot, uref) as { CLValue?: { parsed?: number } } | null;
    return stored?.CLValue?.parsed ?? 0;
  } catch { return 0; }
}

// ── Deploy status — Casper 2.0 (Condor) compatible ───────────────────────────
//
// The testnet runs Casper 2.0 which uses info_get_transaction for execution
// results. info_get_deploy still accepts the deploy but returns empty
// execution_results on v2 nodes. We try info_get_transaction first (v2),
// then fall back to info_get_deploy (v1) for older nodes.

export type DeployStatus = "confirmed" | "pending" | "failed" | "unknown";

async function getDeployStatusFromNode(node: string, deployHash: string): Promise<DeployStatus> {
  // Try both Version1 (put-transaction) and Deploy (put-deploy) wrappers
  for (const txHashParam of [{ Version1: deployHash }, { Deploy: deployHash }]) {
    try {
      const res = await fetch(node, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0", id: 1,
          method: "info_get_transaction",
          params: { transaction_hash: txHashParam, finalized_approvals: false },
        }),
        signal: AbortSignal.timeout(12_000),
      });
      const json = await res.json() as {
        result?: { execution_info?: { execution_result?: { Version2?: { error_message?: string | null } } } };
        error?: unknown;
      };
      if (!json.error && json.result?.execution_info?.execution_result) {
        const r = json.result.execution_info.execution_result.Version2;
        if (!r) return "pending";
        if (r.error_message === null || r.error_message === undefined) return "confirmed";
        throw new Error(`On-chain execution error: ${r.error_message}`);
      }
    } catch { /* try next */ }
  }

  // Fall back to v1 endpoint
  try {
    const res = await fetch(node, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "info_get_deploy", params: { deploy_hash: deployHash } }),
      signal: AbortSignal.timeout(12_000),
    });
    const json = await res.json() as {
      result?: { execution_results?: { result?: { Success?: unknown; Failure?: unknown } }[] };
    };
    const exec = json.result?.execution_results?.[0]?.result;
    if (!exec) return "pending";
    if (exec.Success !== undefined) return "confirmed";
    if (exec.Failure !== undefined) throw new Error(`On-chain failure: ${JSON.stringify(exec.Failure).slice(0, 200)}`);
  } catch { /* ignore */ }

  return "unknown";
}

export async function getDeployStatus(deployHash: string): Promise<DeployStatus> {
  if (!deployHash) return "unknown";
  for (const node of NODES) {
    const s = await getDeployStatusFromNode(node, deployHash);
    if (s !== "unknown") return s;
  }
  return "unknown";
}

// ── waitForDeploy — shared poller used by mint and offer-shares ───────────────

export async function waitForDeploy(
  deployHash: string,
  maxMs = 240_000,
  onTick?: (elapsedSec: number) => void,
): Promise<void> {
  const deadline = Date.now() + maxMs;
  const start = Date.now();
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 4_000));
    onTick?.(Math.round((Date.now() - start) / 1000));
    for (const node of NODES) {
      const status = await getDeployStatusFromNode(node, deployHash);
      if (status === "confirmed") return;
      if (status === "failed") throw new Error(`Deploy ${deployHash.slice(0, 12)}… failed on-chain`);
    }
  }
  throw new Error(
    `Deploy ${deployHash.slice(0, 12)}… not confirmed after ${maxMs / 60_000} min. ` +
    `Check: https://testnet.cspr.live/deploy/${deployHash}`
  );
}

// ── Batch deploy status (bounded concurrency) ─────────────────────────────────

export async function batchDeployStatus(
  hashes: string[],
  concurrency = 5
): Promise<Record<string, DeployStatus>> {
  const results: Record<string, DeployStatus> = {};
  for (let i = 0; i < hashes.length; i += concurrency) {
    const batch = hashes.slice(i, i + concurrency);
    const statuses = await Promise.all(batch.map(h => getDeployStatus(h)));
    batch.forEach((h, j) => { results[h] = statuses[j]; });
  }
  return results;
}
