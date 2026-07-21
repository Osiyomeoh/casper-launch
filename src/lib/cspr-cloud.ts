/**
 * CSPR.cloud API client
 * Enterprise-grade Casper blockchain middleware by MAKE Software.
 * Docs: https://docs.cspr.cloud
 */

const BASE = "https://api.cspr.cloud";
const API_KEY = process.env.CSPR_CLOUD_API_KEY ?? "";

type CloudOpts = { path: string; params?: Record<string, string | number> };

async function cloudGet<T>(opts: CloudOpts): Promise<T> {
  const url = new URL(`${BASE}${opts.path}`);
  if (opts.params) {
    Object.entries(opts.params).forEach(([k, v]) => url.searchParams.set(k, String(v)));
  }
  const res = await fetch(url.toString(), {
    headers: {
      "authorization": API_KEY,
      "accept": "application/json",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`CSPR.cloud ${opts.path}: ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

// ── Account ───────────────────────────────────────────────────────────────────

export type CloudAccount = {
  public_key: string;
  account_hash: string;
  balance: string;
  total_balance: string;
  transferable_balance: string;
};

export async function getAccount(publicKeyHex: string): Promise<CloudAccount> {
  return cloudGet<CloudAccount>({ path: `/accounts/${publicKeyHex}` });
}

// ── Transfers ─────────────────────────────────────────────────────────────────

export type CloudTransfer = {
  transfer_id: string;
  deploy_hash: string;
  block_hash: string;
  timestamp: string;
  from_account_hash: string;
  to_account_hash: string;
  amount: string;
};

export async function getAccountTransfers(
  publicKeyHex: string,
  limit = 10
): Promise<{ data: CloudTransfer[]; item_count: number }> {
  return cloudGet({ path: `/accounts/${publicKeyHex}/transfers`, params: { page: 1, page_size: limit } });
}

// ── Deploys ───────────────────────────────────────────────────────────────────

export type CloudDeploy = {
  deploy_hash: string;
  block_hash: string;
  caller_public_key: string;
  timestamp: string;
  status: "executed" | "failed" | "pending";
  error_message: string | null;
  cost: string;
};

export async function getDeploy(deployHash: string): Promise<CloudDeploy> {
  return cloudGet<CloudDeploy>({ path: `/deploys/${deployHash}` });
}

export async function getAccountDeploys(
  publicKeyHex: string,
  limit = 10
): Promise<{ data: CloudDeploy[] }> {
  return cloudGet({ path: `/accounts/${publicKeyHex}/deploys`, params: { page: 1, page_size: limit } });
}

// ── Blocks ────────────────────────────────────────────────────────────────────

export type CloudBlock = {
  block_hash: string;
  block_height: number;
  timestamp: string;
  era_id: number;
  deploy_count: number;
  transfer_count: number;
};

export async function getLatestBlock(): Promise<CloudBlock> {
  const r = await cloudGet<{ data: CloudBlock[] }>({ path: "/blocks", params: { page: 1, page_size: 1 } });
  return r.data[0];
}

// ── Contract deploys ──────────────────────────────────────────────────────────

export async function getContractDeploys(
  contractHash: string,
  limit = 10
): Promise<{ data: CloudDeploy[] }> {
  return cloudGet({ path: `/contracts/${contractHash}/deploys`, params: { page: 1, page_size: limit } });
}

// ── Validators ────────────────────────────────────────────────────────────────

export type CloudValidator = {
  public_key: string;
  fee: number;
  delegators_number: number;
  total_stake: string;
  self_stake: string;
};

export async function getValidators(): Promise<{ data: CloudValidator[] }> {
  return cloudGet({ path: "/validators", params: { page: 1, page_size: 10 } });
}
