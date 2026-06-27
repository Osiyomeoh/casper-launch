/**
 * POST /api/casper/sync
 *
 * Rebuilds the SQLite token store entirely from on-chain contract state.
 * Safe to call at any time — idempotent upserts, never deletes.
 *
 * What it does:
 *  1. Reads total_supply from the CEP-78 contract (how many tokens exist)
 *  2. For each tokenId 0..total_supply-1:
 *     - Reads token_metadata dictionary → asset metadata
 *     - Reads token_owners dictionary   → owner account-hash
 *  3. Checks deploy status for all known deploy hashes in the DB
 *  4. Bulk-upserts everything into SQLite
 *
 * The DB is the fast read cache. The chain is the write-ahead log.
 * If the DB is ever wiped, run this endpoint to reconstruct it.
 *
 * GET /api/casper/sync — returns last sync result and current DB stats
 */

import { NextResponse } from "next/server";
import {
  getStateRootHash,
  getContractNamedKeys,
  getTotalSupply,
  getDictItem,
  batchDeployStatus,
} from "@/lib/casper-rpc";
import {
  bulkUpsert,
  getAllTokens,
  getTokenCount,
  startSyncLog,
  finishSyncLog,
  getLastSync,
  type TokenRecord,
} from "@/lib/db";

const CONTRACT_HASH = process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "";

function expandMeta(raw: Record<string, unknown>): Record<string, unknown> {
  // If already using full keys, pass through
  if (raw.asset_name !== undefined) return raw;
  return {
    asset_name:    raw.n ?? raw.asset_name ?? "",
    asset_type:    raw.t ?? raw.asset_type ?? "",
    valuation_usd: Number(raw.v ?? raw.valuation_usd ?? 0),
    ipfs_cid:      raw.c ?? raw.ipfs_cid ?? "",
    // Preserve any extra fields already stored
    ...Object.fromEntries(
      Object.entries(raw).filter(([k]) => !["n","t","v","c"].includes(k))
    ),
  };
}

// Prevent concurrent syncs
let syncInProgress = false;

export async function POST() {
  if (!CONTRACT_HASH) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_RWA_NFT_HASH not configured" },
      { status: 500 }
    );
  }

  if (syncInProgress) {
    return NextResponse.json({ error: "Sync already in progress" }, { status: 409 });
  }

  syncInProgress = true;
  const logId = await startSyncLog();

  try {
    // ── Step 1: On-chain state ────────────────────────────────────────────────
    const stateRoot = await getStateRootHash();
    const namedKeys = await getContractNamedKeys(CONTRACT_HASH, stateRoot);
    const totalSupply = await getTotalSupply(CONTRACT_HASH, stateRoot, namedKeys);

    const chainTokens: (Partial<TokenRecord> & { token_id: string })[] = [];

    // ── Step 2: Walk token IDs ────────────────────────────────────────────────
    // CEP-78 dictionaries are keyed by string token_id
    for (let id = 0; id < totalSupply; id++) {
      const tokenId = String(id);

      const [rawMeta, rawOwner] = await Promise.all([
        getDictItem(stateRoot, CONTRACT_HASH, "metadata", tokenId),
        getDictItem(stateRoot, CONTRACT_HASH, "token_owners", tokenId),
      ]);

      // metadata is stored as a JSON string in the CLValue
      // On-chain format uses short keys {n,t,v,c} — expand to full field names
      let metadata: Record<string, unknown> = {};
      if (typeof rawMeta === "string") {
        try {
          const raw = JSON.parse(rawMeta) as Record<string, unknown>;
          metadata = expandMeta(raw);
        } catch {}
      } else if (rawMeta && typeof rawMeta === "object") {
        metadata = expandMeta(rawMeta as Record<string, unknown>);
      }

      chainTokens.push({
        token_id: tokenId,
        owner: typeof rawOwner === "string" ? rawOwner : "",
        metadata,
        // deploy_hash / minted_at stay from DB if we already have them
      });
    }

    // ── Step 3: Merge with existing DB records ────────────────────────────────
    // Preserve deploy hashes and minted_at that we stored at mint time
    const existing = await getAllTokens();
    const existingMap = new Map(existing.map(t => [t.token_id, t]));

    const toUpsert = chainTokens.map(ct => {
      const ex = existingMap.get(ct.token_id);
      return {
        ...ct,
        deploy_hash: ex?.deploy_hash ?? ct.deploy_hash ?? "",
        minted_at: ex?.minted_at ?? ct.minted_at ?? 0,
        holders: ex?.holders ?? ct.holders ?? [],
      };
    });

    // Also carry forward any local-only tokens (submitted but not yet on-chain)
    existing.forEach(ex => {
      const alreadyInChain = chainTokens.some(ct => ct.token_id === ex.token_id);
      if (!alreadyInChain) {
        toUpsert.push({ ...ex, token_id: ex.token_id });
      }
    });

    // ── Step 4: Check deploy statuses (bounded concurrency) ──────────────────
    const hashes = [...new Set(toUpsert.map(t => t.deploy_hash).filter(Boolean))];
    const statusMap = await batchDeployStatus(hashes as string[], 5);

    const final = toUpsert.map(t => ({
      ...t,
      deploy_status: t.deploy_hash
        ? (statusMap[t.deploy_hash as string] ?? t.deploy_status ?? "pending")
        : (t.deploy_status ?? "unknown"),
    })) as (Partial<TokenRecord> & { token_id: string })[];

    // ── Step 5: Bulk upsert ───────────────────────────────────────────────────
    const upserted = await bulkUpsert(final);
    await finishSyncLog(logId, upserted);

    return NextResponse.json({
      ok: true,
      totalSupplyOnChain: totalSupply,
      tokensUpserted: upserted,
      stateRoot,
      contractHash: CONTRACT_HASH,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sync failed";
    await finishSyncLog(logId, 0, msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    syncInProgress = false;
  }
}

export async function GET() {
  const lastSync = await getLastSync();
  const tokenCount = await getTokenCount();
  return NextResponse.json({
    tokenCount,
    lastSync: lastSync
      ? {
          finishedAt: lastSync.finished_at,
          tokensUpserted: lastSync.tokens_upserted,
          error: lastSync.error,
        }
      : null,
    contractHash: CONTRACT_HASH,
  });
}
