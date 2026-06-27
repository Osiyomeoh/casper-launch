/**
 * SQLite persistence layer for CasperLaunch token data.
 *
 * Single source of truth for all token records. The chain-sync endpoint
 * is the authoritative rebuild path — if this DB is wiped, running
 * /api/casper/sync reconstructs everything from on-chain contract state.
 *
 * Why SQLite (not JSON):
 *  - Survives server restarts and partial writes
 *  - Atomic upserts — no torn writes
 *  - Queryable by owner, status, tokenId without loading all records
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync } from "fs";

const DATA_DIR = join(process.cwd(), "data");
mkdirSync(DATA_DIR, { recursive: true });

const DB_PATH = join(DATA_DIR, "tokens.db");

// Singleton — Next.js reuses the module across requests in the same process
let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");   // safe concurrent reads
  _db.pragma("foreign_keys = ON");
  migrate(_db);
  return _db;
}

// ── Schema ────────────────────────────────────────────────────────────────────

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      token_id       TEXT PRIMARY KEY,
      owner          TEXT NOT NULL DEFAULT '',
      deploy_hash    TEXT NOT NULL DEFAULT '',
      minted_at      INTEGER NOT NULL DEFAULT 0,
      deploy_status  TEXT NOT NULL DEFAULT 'pending',
      metadata       TEXT NOT NULL DEFAULT '{}',
      holders        TEXT NOT NULL DEFAULT '[]',
      synced_at      INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_owner ON tokens(owner);
    CREATE INDEX IF NOT EXISTS idx_tokens_status ON tokens(deploy_status);

    CREATE TABLE IF NOT EXISTS orders (
      id           TEXT PRIMARY KEY,
      token_id     TEXT NOT NULL,
      asset_name   TEXT NOT NULL DEFAULT '',
      order_type   TEXT NOT NULL CHECK(order_type IN ('buy','sell')),
      amount       INTEGER NOT NULL,
      price_usd    REAL NOT NULL,
      total_usd    REAL NOT NULL,
      status           TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','filled','cancelled')),
      seller_wallet    TEXT NOT NULL DEFAULT '',
      buyer_wallet     TEXT NOT NULL DEFAULT '',
      bps              INTEGER NOT NULL DEFAULT 0,
      payment_hash     TEXT NOT NULL DEFAULT '',
      settle_hash      TEXT NOT NULL DEFAULT '',
      cspr_amount      REAL NOT NULL DEFAULT 0,
      created_at       INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_orders_token ON orders(token_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
  `);

  // Migrate existing orders table to add new columns if missing
  const orderCols = db.prepare("PRAGMA table_info(orders)").all() as { name: string }[];
  const colNames = orderCols.map(c => c.name);
  const newCols: [string, string][] = [
    ["seller_wallet", "TEXT NOT NULL DEFAULT ''"],
    ["buyer_wallet",  "TEXT NOT NULL DEFAULT ''"],
    ["bps",           "INTEGER NOT NULL DEFAULT 0"],
    ["payment_hash",  "TEXT NOT NULL DEFAULT ''"],
    ["settle_hash",   "TEXT NOT NULL DEFAULT ''"],
    ["cspr_amount",   "REAL NOT NULL DEFAULT 0"],
  ];
  for (const [col, def] of newCols) {
    if (!colNames.includes(col)) {
      db.exec(`ALTER TABLE orders ADD COLUMN ${col} ${def}`);
    }
  }

  db.exec(`

    CREATE TABLE IF NOT EXISTS sync_log (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      started_at INTEGER NOT NULL,
      finished_at INTEGER,
      tokens_upserted INTEGER NOT NULL DEFAULT 0,
      error      TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS proposals (
      id          TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status      TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active','Passed','Failed')),
      votes_for   INTEGER NOT NULL DEFAULT 0,
      votes_against INTEGER NOT NULL DEFAULT 0,
      quorum      INTEGER NOT NULL DEFAULT 0,
      end_date    TEXT NOT NULL,
      created_by  TEXT NOT NULL DEFAULT '',
      created_at  INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS votes (
      proposal_id TEXT NOT NULL,
      voter       TEXT NOT NULL,
      choice      TEXT NOT NULL CHECK(choice IN ('for','against')),
      voted_at    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (proposal_id, voter)
    );
  `);

  // Seed initial proposals if empty
  const count = (db.prepare("SELECT COUNT(*) as n FROM proposals").get() as { n: number }).n;
  if (count === 0) {
    const insert = db.prepare(`INSERT INTO proposals (id,title,description,status,votes_for,votes_against,quorum,end_date,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const now = Date.now();
    insert.run("PROP-001", "Reduce yield distribution threshold from 1 CSPR to 0.5 CSPR", "Lower the minimum pool balance required for the autonomous agent to trigger a yield distribution. This increases distribution frequency for smaller holders.", "Active", 142, 38, 79, new Date(now + 5 * 86400000).toISOString().slice(0, 10), "agent", now - 86400000 * 2);
    insert.run("PROP-002", "Whitelist Lekki Phase 2 development land for tokenization", "Approve the addition of Lekki Phase 2 plots to the RWA registry. Properties must pass KYC and title verification before minting.", "Active", 89, 12, 56, new Date(now + 10 * 86400000).toISOString().slice(0, 10), "agent", now - 86400000);
    insert.run("PROP-003", "Increase minimum token holder stake to 50 bps", "Raise the minimum fractional stake per wallet from 1 bps to 50 bps to reduce dust accounts and lower gas overhead for yield claims.", "Passed", 201, 45, 100, new Date(now - 3 * 86400000).toISOString().slice(0, 10), "agent", now - 86400000 * 14);
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────

export type AppSettings = {
  riskLevel: number;
  biometrics: boolean;
  twoFactor: boolean;
  pushNotifications: boolean;
  emailReports: boolean;
  autonomousYield: boolean;
  oracleRebalancing: boolean;
  complianceReporting: boolean;
};

const SETTINGS_DEFAULTS: AppSettings = {
  riskLevel: 65,
  biometrics: true,
  twoFactor: true,
  pushNotifications: true,
  emailReports: false,
  autonomousYield: true,
  oracleRebalancing: true,
  complianceReporting: false,
};

export function getSettings(): AppSettings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const map = Object.fromEntries(rows.map(r => [r.key, JSON.parse(r.value)]));
  return { ...SETTINGS_DEFAULTS, ...map } as AppSettings;
}

export function saveSettings(settings: Partial<AppSettings>): void {
  const db = getDb();
  const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
  const tx = db.transaction((s: Partial<AppSettings>) => {
    for (const [k, v] of Object.entries(s)) {
      upsert.run(k, JSON.stringify(v));
    }
  });
  tx(settings);
}

// ── Governance ────────────────────────────────────────────────────────────────

export type ProposalRow = {
  id: string; title: string; description: string; status: string;
  votes_for: number; votes_against: number; quorum: number;
  end_date: string; created_by: string; created_at: number;
  my_vote?: string;
};

export function getProposals(voter?: string): ProposalRow[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM proposals ORDER BY created_at DESC").all() as ProposalRow[];
  if (!voter) return rows;
  const myVotes = db.prepare("SELECT proposal_id, choice FROM votes WHERE voter = ?").all(voter) as { proposal_id: string; choice: string }[];
  const voteMap = Object.fromEntries(myVotes.map(v => [v.proposal_id, v.choice]));
  return rows.map(r => ({ ...r, my_vote: voteMap[r.id] }));
}

export function castVote(proposalId: string, voter: string, choice: "for" | "against"): ProposalRow {
  const db = getDb();
  const proposal = db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId) as ProposalRow | undefined;
  if (!proposal) throw new Error("Proposal not found");
  if (proposal.status !== "Active") throw new Error("Proposal is not active");

  const existing = db.prepare("SELECT choice FROM votes WHERE proposal_id = ? AND voter = ?").get(proposalId, voter) as { choice: string } | undefined;
  if (existing) throw new Error("Already voted");

  db.transaction(() => {
    db.prepare("INSERT INTO votes (proposal_id, voter, choice, voted_at) VALUES (?, ?, ?, ?)").run(proposalId, voter, choice, Date.now());
    if (choice === "for") db.prepare("UPDATE proposals SET votes_for = votes_for + 1, quorum = MIN(100, quorum + 1) WHERE id = ?").run(proposalId);
    else db.prepare("UPDATE proposals SET votes_against = votes_against + 1, quorum = MIN(100, quorum + 1) WHERE id = ?").run(proposalId);
  })();

  return db.prepare("SELECT * FROM proposals WHERE id = ?").get(proposalId) as ProposalRow;
}

export function createProposal(title: string, description: string, createdBy: string, endDate: string): ProposalRow {
  const db = getDb();
  const id = `PROP-${String(Math.floor(Math.random() * 900) + 100).padStart(3, "0")}`;
  db.prepare("INSERT INTO proposals (id,title,description,status,votes_for,votes_against,quorum,end_date,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)").run(id, title, description, "Active", 0, 0, 0, endDate, createdBy, Date.now());
  return db.prepare("SELECT * FROM proposals WHERE id = ?").get(id) as ProposalRow;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type TokenRow = {
  token_id: string;
  owner: string;
  deploy_hash: string;
  minted_at: number;
  deploy_status: "pending" | "confirmed" | "failed" | "unknown";
  metadata: string;        // JSON string
  holders: string;         // JSON string
  synced_at: number;
};

export type TokenRecord = Omit<TokenRow, "metadata" | "holders"> & {
  metadata: Record<string, unknown>;
  holders: { publicKey: string; bps: number }[];
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function deserialize(row: TokenRow): TokenRecord {
  return {
    ...row,
    metadata: JSON.parse(row.metadata),
    holders: JSON.parse(row.holders),
  };
}

// ── Read ──────────────────────────────────────────────────────────────────────

export function getToken(tokenId: string): TokenRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tokens WHERE token_id = ?").get(tokenId) as TokenRow | undefined;
  return row ? deserialize(row) : null;
}

export function getAllTokens(owner?: string): TokenRecord[] {
  const db = getDb();
  const rows = owner
    ? db.prepare("SELECT * FROM tokens WHERE owner = ? ORDER BY minted_at DESC").all(owner) as TokenRow[]
    : db.prepare("SELECT * FROM tokens ORDER BY minted_at DESC").all() as TokenRow[];
  return rows.map(deserialize);
}

export function getTokenCount(): number {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) as n FROM tokens").get() as { n: number };
  return row.n;
}

// ── Write ─────────────────────────────────────────────────────────────────────

export function upsertToken(token: Partial<TokenRecord> & { token_id: string }): void {
  const db = getDb();
  const existing = getToken(token.token_id);

  const merged: TokenRow = {
    token_id: token.token_id,
    owner: token.owner ?? existing?.owner ?? "",
    deploy_hash: token.deploy_hash ?? existing?.deploy_hash ?? "",
    minted_at: token.minted_at ?? existing?.minted_at ?? Date.now(),
    deploy_status: token.deploy_status ?? existing?.deploy_status ?? "pending",
    metadata: JSON.stringify(token.metadata ?? existing?.metadata ?? {}),
    holders: JSON.stringify(token.holders ?? existing?.holders ?? []),
    synced_at: Date.now(),
  };

  db.prepare(`
    INSERT INTO tokens (token_id, owner, deploy_hash, minted_at, deploy_status, metadata, holders, synced_at)
    VALUES (@token_id, @owner, @deploy_hash, @minted_at, @deploy_status, @metadata, @holders, @synced_at)
    ON CONFLICT(token_id) DO UPDATE SET
      owner         = excluded.owner,
      deploy_hash   = CASE WHEN excluded.deploy_hash != '' THEN excluded.deploy_hash ELSE deploy_hash END,
      minted_at     = CASE WHEN excluded.minted_at  != 0   THEN excluded.minted_at  ELSE minted_at END,
      deploy_status = excluded.deploy_status,
      metadata      = CASE WHEN excluded.metadata   != '{}' THEN excluded.metadata  ELSE metadata END,
      holders       = CASE WHEN excluded.holders    != '[]' THEN excluded.holders   ELSE holders END,
      synced_at     = excluded.synced_at
  `).run(merged);
}

export function updateDeployStatus(
  deployHash: string,
  status: "pending" | "confirmed" | "failed"
): void {
  getDb()
    .prepare("UPDATE tokens SET deploy_status = ?, synced_at = ? WHERE deploy_hash = ?")
    .run(status, Date.now(), deployHash);
}

// ── Bulk upsert (used by sync) ────────────────────────────────────────────────

export function bulkUpsert(tokens: (Partial<TokenRecord> & { token_id: string })[]): number {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT INTO tokens (token_id, owner, deploy_hash, minted_at, deploy_status, metadata, holders, synced_at)
    VALUES (@token_id, @owner, @deploy_hash, @minted_at, @deploy_status, @metadata, @holders, @synced_at)
    ON CONFLICT(token_id) DO UPDATE SET
      owner         = excluded.owner,
      deploy_hash   = CASE WHEN excluded.deploy_hash != '' THEN excluded.deploy_hash ELSE deploy_hash END,
      minted_at     = CASE WHEN excluded.minted_at  != 0   THEN excluded.minted_at  ELSE minted_at END,
      deploy_status = excluded.deploy_status,
      metadata      = CASE WHEN excluded.metadata   != '{}' THEN excluded.metadata  ELSE metadata END,
      holders       = CASE WHEN excluded.holders    != '[]' THEN excluded.holders   ELSE holders END,
      synced_at     = excluded.synced_at
  `);

  const upsertMany = db.transaction((rows: TokenRow[]) => {
    for (const row of rows) stmt.run(row);
    return rows.length;
  });

  return upsertMany(
    tokens.map(t => ({
      token_id: t.token_id,
      owner: t.owner ?? "",
      deploy_hash: t.deploy_hash ?? "",
      minted_at: t.minted_at ?? 0,
      deploy_status: t.deploy_status ?? "pending",
      metadata: JSON.stringify(t.metadata ?? {}),
      holders: JSON.stringify(t.holders ?? []),
      synced_at: Date.now(),
    }))
  ) as number;
}

// ── Orders ────────────────────────────────────────────────────────────────────

export type OrderRow = {
  id: string;
  token_id: string;
  asset_name: string;
  order_type: "buy" | "sell";
  amount: number;
  price_usd: number;
  total_usd: number;
  status: "open" | "filled" | "cancelled";
  seller_wallet: string;
  buyer_wallet: string;
  bps: number;
  payment_hash: string;
  settle_hash: string;
  cspr_amount: number;
  created_at: number;
};

export function createOrder(order: Omit<OrderRow, "id" | "created_at">): OrderRow {
  const db = getDb();
  const id = `ORD-${Date.now().toString(36).toUpperCase()}`;
  const created_at = Date.now();
  db.prepare(`
    INSERT INTO orders (id, token_id, asset_name, order_type, amount, price_usd, total_usd,
      status, seller_wallet, buyer_wallet, bps, payment_hash, settle_hash, cspr_amount, created_at)
    VALUES (@id, @token_id, @asset_name, @order_type, @amount, @price_usd, @total_usd,
      @status, @seller_wallet, @buyer_wallet, @bps, @payment_hash, @settle_hash, @cspr_amount, @created_at)
  `).run({ id, created_at, ...order });
  return { id, created_at, ...order };
}

export function updateOrder(id: string, patch: Partial<Pick<OrderRow, "status" | "buyer_wallet" | "payment_hash" | "settle_hash">>): void {
  const sets = Object.keys(patch).map(k => `${k} = @${k}`).join(", ");
  getDb().prepare(`UPDATE orders SET ${sets} WHERE id = @id`).run({ id, ...patch });
}

export function getOrder(id: string): OrderRow | null {
  return getDb().prepare("SELECT * FROM orders WHERE id = ?").get(id) as OrderRow | null;
}

export function getOpenSellOrders(tokenId?: string): OrderRow[] {
  if (tokenId) {
    return getDb().prepare("SELECT * FROM orders WHERE order_type = 'sell' AND status = 'open' AND token_id = ? ORDER BY price_usd ASC").all(tokenId) as OrderRow[];
  }
  return getDb().prepare("SELECT * FROM orders WHERE order_type = 'sell' AND status = 'open' ORDER BY price_usd ASC").all() as OrderRow[];
}

export function getAllOrders(): OrderRow[] {
  return getDb().prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as OrderRow[];
}

export function updateOrderStatus(id: string, status: "filled" | "cancelled"): void {
  getDb().prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
}


// ── Sync log ──────────────────────────────────────────────────────────────────

export function startSyncLog(): number {
  const r = getDb()
    .prepare("INSERT INTO sync_log (started_at, tokens_upserted) VALUES (?, 0)")
    .run(Date.now());
  return r.lastInsertRowid as number;
}

export function finishSyncLog(id: number, tokensUpserted: number, error?: string): void {
  getDb()
    .prepare("UPDATE sync_log SET finished_at = ?, tokens_upserted = ?, error = ? WHERE id = ?")
    .run(Date.now(), tokensUpserted, error ?? null, id);
}

export function getLastSync(): { finished_at: number | null; tokens_upserted: number; error: string | null } | null {
  return getDb()
    .prepare("SELECT finished_at, tokens_upserted, error FROM sync_log ORDER BY id DESC LIMIT 1")
    .get() as { finished_at: number | null; tokens_upserted: number; error: string | null } | null;
}
