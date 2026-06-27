/**
 * Neon Postgres persistence layer for CasperLaunch.
 * Replaces SQLite (which doesn't work on Vercel serverless).
 * Uses @neondatabase/serverless — works in Edge and Node.js runtimes.
 */

import { neon } from "@neondatabase/serverless";

function sql() {
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

// ── Schema bootstrap (called once per cold start) ─────────────────────────────

let _migrated = false;

export async function migrate() {
  if (_migrated) return;
  const db = sql();
  await db`
    CREATE TABLE IF NOT EXISTS tokens (
      token_id       TEXT PRIMARY KEY,
      owner          TEXT NOT NULL DEFAULT '',
      deploy_hash    TEXT NOT NULL DEFAULT '',
      minted_at      BIGINT NOT NULL DEFAULT 0,
      deploy_status  TEXT NOT NULL DEFAULT 'pending',
      metadata       JSONB NOT NULL DEFAULT '{}',
      holders        JSONB NOT NULL DEFAULT '[]',
      synced_at      BIGINT NOT NULL DEFAULT 0
    )
  `;
  await db`CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner)`;
  await db`
    CREATE TABLE IF NOT EXISTS orders (
      id             TEXT PRIMARY KEY,
      token_id       TEXT NOT NULL,
      asset_name     TEXT NOT NULL DEFAULT '',
      order_type     TEXT NOT NULL CHECK(order_type IN ('buy','sell')),
      amount         INTEGER NOT NULL DEFAULT 0,
      price_usd      REAL NOT NULL DEFAULT 0,
      total_usd      REAL NOT NULL DEFAULT 0,
      status         TEXT NOT NULL DEFAULT 'open',
      seller_wallet  TEXT NOT NULL DEFAULT '',
      buyer_wallet   TEXT NOT NULL DEFAULT '',
      bps            INTEGER NOT NULL DEFAULT 0,
      payment_hash   TEXT NOT NULL DEFAULT '',
      settle_hash    TEXT NOT NULL DEFAULT '',
      cspr_amount    REAL NOT NULL DEFAULT 0,
      created_at     BIGINT NOT NULL DEFAULT 0
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS proposals (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      status        TEXT NOT NULL DEFAULT 'Active',
      votes_for     INTEGER NOT NULL DEFAULT 0,
      votes_against INTEGER NOT NULL DEFAULT 0,
      quorum        INTEGER NOT NULL DEFAULT 0,
      end_date      TEXT NOT NULL,
      created_by    TEXT NOT NULL DEFAULT '',
      created_at    BIGINT NOT NULL DEFAULT 0
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS votes (
      proposal_id TEXT NOT NULL,
      voter       TEXT NOT NULL,
      choice      TEXT NOT NULL,
      voted_at    BIGINT NOT NULL DEFAULT 0,
      PRIMARY KEY (proposal_id, voter)
    )
  `;
  await db`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `;

  // Seed proposals if empty
  const rows = await db`SELECT COUNT(*) as n FROM proposals`;
  if (Number(rows[0].n) === 0) {
    const now = Date.now();
    await db`INSERT INTO proposals VALUES
      ('PROP-001','Reduce yield distribution threshold from 1 CSPR to 0.5 CSPR','Lower the minimum pool balance required for the autonomous agent to trigger a yield distribution.','Active',142,38,79,${new Date(now + 5 * 86400000).toISOString().slice(0,10)},'agent',${now - 86400000 * 2}),
      ('PROP-002','Whitelist Lekki Phase 2 development land for tokenization','Approve the addition of Lekki Phase 2 plots to the RWA registry.','Active',89,12,56,${new Date(now + 10 * 86400000).toISOString().slice(0,10)},'agent',${now - 86400000}),
      ('PROP-003','Increase minimum token holder stake to 50 bps','Raise the minimum fractional stake per wallet from 1 bps to 50 bps.','Passed',201,45,100,${new Date(now - 3 * 86400000).toISOString().slice(0,10)},'agent',${now - 86400000 * 14})
    `;
  }

  _migrated = true;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenRecord = {
  token_id: string;
  owner: string;
  deploy_hash: string;
  minted_at: number;
  deploy_status: "pending" | "confirmed" | "failed" | "unknown";
  metadata: Record<string, unknown>;
  holders: { publicKey: string; bps: number }[];
  synced_at: number;
};

// ── Token reads ───────────────────────────────────────────────────────────────

export async function getToken(tokenId: string): Promise<TokenRecord | null> {
  await migrate();
  const rows = await sql()`SELECT * FROM tokens WHERE token_id = ${tokenId}`;
  return rows[0] ? (rows[0] as unknown as TokenRecord) : null;
}

export async function getAllTokens(owner?: string): Promise<TokenRecord[]> {
  await migrate();
  const rows = owner
    ? await sql()`SELECT * FROM tokens WHERE owner = ${owner} ORDER BY minted_at DESC`
    : await sql()`SELECT * FROM tokens ORDER BY minted_at DESC`;
  return rows as unknown as TokenRecord[];
}

export async function getTokenCount(): Promise<number> {
  await migrate();
  const rows = await sql()`SELECT COUNT(*) as n FROM tokens`;
  return Number(rows[0].n);
}

// ── Token writes ──────────────────────────────────────────────────────────────

export async function upsertToken(token: Partial<TokenRecord> & { token_id: string }): Promise<void> {
  await migrate();
  const db = sql();
  await db`
    INSERT INTO tokens (token_id, owner, deploy_hash, minted_at, deploy_status, metadata, holders, synced_at)
    VALUES (
      ${token.token_id},
      ${token.owner ?? ""},
      ${token.deploy_hash ?? ""},
      ${token.minted_at ?? Date.now()},
      ${token.deploy_status ?? "pending"},
      ${JSON.stringify(token.metadata ?? {})},
      ${JSON.stringify(token.holders ?? [])},
      ${Date.now()}
    )
    ON CONFLICT (token_id) DO UPDATE SET
      owner         = COALESCE(NULLIF(EXCLUDED.owner, ''), tokens.owner),
      deploy_hash   = COALESCE(NULLIF(EXCLUDED.deploy_hash, ''), tokens.deploy_hash),
      minted_at     = CASE WHEN EXCLUDED.minted_at != 0 THEN EXCLUDED.minted_at ELSE tokens.minted_at END,
      deploy_status = EXCLUDED.deploy_status,
      metadata      = CASE WHEN EXCLUDED.metadata::text != '{}' THEN EXCLUDED.metadata ELSE tokens.metadata END,
      holders       = CASE WHEN EXCLUDED.holders::text != '[]' THEN EXCLUDED.holders ELSE tokens.holders END,
      synced_at     = EXCLUDED.synced_at
  `;
}

export async function updateDeployStatus(deployHash: string, status: "pending" | "confirmed" | "failed"): Promise<void> {
  await migrate();
  await sql()`UPDATE tokens SET deploy_status = ${status}, synced_at = ${Date.now()} WHERE deploy_hash = ${deployHash}`;
}

export async function bulkUpsert(tokens: (Partial<TokenRecord> & { token_id: string })[]): Promise<number> {
  for (const t of tokens) await upsertToken(t);
  return tokens.length;
}

export async function deleteEmptyTokens(): Promise<number> {
  await migrate();
  const rows = await sql()`
    DELETE FROM tokens
    WHERE (metadata = '{}'::jsonb OR metadata IS NULL)
    AND minted_at = 0
    RETURNING token_id
  `;
  return rows.length;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type OrderRow = {
  id: string; token_id: string; asset_name: string;
  order_type: "buy" | "sell"; amount: number; price_usd: number;
  total_usd: number; status: "open" | "filled" | "cancelled";
  seller_wallet: string; buyer_wallet: string; bps: number;
  payment_hash: string; settle_hash: string; cspr_amount: number; created_at: number;
};

export async function createOrder(order: Omit<OrderRow, "id" | "created_at">): Promise<OrderRow> {
  await migrate();
  const id = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const created_at = Date.now();
  await sql()`
    INSERT INTO orders (id,token_id,asset_name,order_type,amount,price_usd,total_usd,status,seller_wallet,buyer_wallet,bps,payment_hash,settle_hash,cspr_amount,created_at)
    VALUES (${id},${order.token_id},${order.asset_name},${order.order_type},${order.amount},${order.price_usd},${order.total_usd},${order.status},${order.seller_wallet},${order.buyer_wallet},${order.bps},${order.payment_hash},${order.settle_hash},${order.cspr_amount},${created_at})
  `;
  return { id, created_at, ...order };
}

export async function getOrder(id: string): Promise<OrderRow | null> {
  await migrate();
  const rows = await sql()`SELECT * FROM orders WHERE id = ${id}`;
  return (rows[0] as unknown as OrderRow) ?? null;
}

export async function updateOrder(id: string, patch: Partial<Pick<OrderRow, "status" | "buyer_wallet" | "payment_hash" | "settle_hash">>): Promise<void> {
  await migrate();
  const db = sql();
  if (patch.status !== undefined) await db`UPDATE orders SET status = ${patch.status} WHERE id = ${id}`;
  if (patch.buyer_wallet !== undefined) await db`UPDATE orders SET buyer_wallet = ${patch.buyer_wallet} WHERE id = ${id}`;
  if (patch.payment_hash !== undefined) await db`UPDATE orders SET payment_hash = ${patch.payment_hash} WHERE id = ${id}`;
  if (patch.settle_hash !== undefined) await db`UPDATE orders SET settle_hash = ${patch.settle_hash} WHERE id = ${id}`;
}

export async function getOpenSellOrders(tokenId?: string): Promise<OrderRow[]> {
  await migrate();
  const rows = tokenId
    ? await sql()`SELECT * FROM orders WHERE order_type='sell' AND status='open' AND token_id=${tokenId} ORDER BY price_usd ASC`
    : await sql()`SELECT * FROM orders WHERE order_type='sell' AND status='open' ORDER BY price_usd ASC`;
  return rows as unknown as OrderRow[];
}

export async function getAllOrders(): Promise<OrderRow[]> {
  await migrate();
  const rows = await sql()`SELECT * FROM orders ORDER BY created_at DESC`;
  return rows as unknown as OrderRow[];
}

export async function updateOrderStatus(id: string, status: "filled" | "cancelled"): Promise<void> {
  await migrate();
  await sql()`UPDATE orders SET status = ${status} WHERE id = ${id}`;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export type AppSettings = {
  riskLevel: number; biometrics: boolean; twoFactor: boolean;
  pushNotifications: boolean; emailReports: boolean; autonomousYield: boolean;
  oracleRebalancing: boolean; complianceReporting: boolean;
};

const SETTINGS_DEFAULTS: AppSettings = {
  riskLevel: 65, biometrics: true, twoFactor: true,
  pushNotifications: true, emailReports: false, autonomousYield: true,
  oracleRebalancing: true, complianceReporting: false,
};

export async function getSettings(): Promise<AppSettings> {
  await migrate();
  const rows = await sql()`SELECT key, value FROM settings`;
  const map = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value as string)]));
  return { ...SETTINGS_DEFAULTS, ...map } as AppSettings;
}

export async function saveSettings(settings: Partial<AppSettings>): Promise<void> {
  await migrate();
  const db = sql();
  for (const [k, v] of Object.entries(settings)) {
    await db`INSERT INTO settings (key,value) VALUES (${k},${JSON.stringify(v)}) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
  }
}

// ── Governance ────────────────────────────────────────────────────────────────

export type ProposalRow = {
  id: string; title: string; description: string; status: string;
  votes_for: number; votes_against: number; quorum: number;
  end_date: string; created_by: string; created_at: number; my_vote?: string;
};

export async function getProposals(voter?: string): Promise<ProposalRow[]> {
  await migrate();
  const rows = await sql()`SELECT * FROM proposals ORDER BY created_at DESC` as unknown as ProposalRow[];
  if (!voter) return rows;
  const votes = await sql()`SELECT proposal_id, choice FROM votes WHERE voter = ${voter}` as unknown as { proposal_id: string; choice: string }[];
  const voteMap = Object.fromEntries(votes.map(v => [v.proposal_id, v.choice]));
  return rows.map(r => ({ ...r, my_vote: voteMap[r.id] }));
}

export async function castVote(proposalId: string, voter: string, choice: "for" | "against"): Promise<ProposalRow> {
  await migrate();
  const db = sql();
  const proposals = await db`SELECT * FROM proposals WHERE id = ${proposalId}` as unknown as ProposalRow[];
  if (!proposals[0]) throw new Error("Proposal not found");
  if (proposals[0].status !== "Active") throw new Error("Proposal is not active");
  const existing = await db`SELECT choice FROM votes WHERE proposal_id = ${proposalId} AND voter = ${voter}`;
  if (existing[0]) throw new Error("Already voted");
  await db`INSERT INTO votes (proposal_id,voter,choice,voted_at) VALUES (${proposalId},${voter},${choice},${Date.now()})`;
  if (choice === "for") await db`UPDATE proposals SET votes_for = votes_for + 1, quorum = LEAST(100, quorum + 1) WHERE id = ${proposalId}`;
  else await db`UPDATE proposals SET votes_against = votes_against + 1, quorum = LEAST(100, quorum + 1) WHERE id = ${proposalId}`;
  const updated = await db`SELECT * FROM proposals WHERE id = ${proposalId}` as unknown as ProposalRow[];
  return updated[0];
}

export async function createProposal(title: string, description: string, createdBy: string, endDate: string): Promise<ProposalRow> {
  await migrate();
  const id = `PROP-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
  await sql()`INSERT INTO proposals (id,title,description,status,votes_for,votes_against,quorum,end_date,created_by,created_at) VALUES (${id},${title},${description},'Active',0,0,0,${endDate},${createdBy},${Date.now()})`;
  const rows = await sql()`SELECT * FROM proposals WHERE id = ${id}` as unknown as ProposalRow[];
  return rows[0];
}

// ── Sync log (no-op stubs — kept for API compatibility) ───────────────────────

export function startSyncLog(): number { return 0; }
export function finishSyncLog(_id: number, _n: number, _err?: string): void {}
export function getLastSync(): { finished_at: number; tokens_upserted: number; error: string | null } | null { return null; }
