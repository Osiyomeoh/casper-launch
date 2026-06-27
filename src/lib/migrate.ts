/**
 * One-time migration: seeds SQLite from the legacy data/tokens.json.
 * Runs at server startup via instrumentation.ts.
 * Safe to call repeatedly — skips if the DB already has records.
 */

import { readFileSync } from "fs";
import { join } from "path";
import { getTokenCount, bulkUpsert } from "@/lib/db";

type LegacyToken = {
  tokenId?: string | number;
  owner?: string;
  deployHash?: string;
  mintedAt?: number;
  metadata?: Record<string, unknown>;
  holders?: { publicKey: string; bps: number }[];
};

export async function migrateJsonToDb(): Promise<void> {
  // Skip if SQLite already has data
  if (await getTokenCount() > 0) return;

  const jsonPath = join(process.cwd(), "data", "tokens.json");
  let legacy: LegacyToken[] = [];
  try {
    legacy = JSON.parse(readFileSync(jsonPath, "utf8"));
  } catch {
    return; // No legacy file — nothing to migrate
  }

  if (!Array.isArray(legacy) || legacy.length === 0) return;

  bulkUpsert(
    legacy.map(t => ({
      token_id: String(t.tokenId ?? ""),
      owner: t.owner ?? "",
      deploy_hash: t.deployHash ?? "",
      minted_at: t.mintedAt ?? 0,
      metadata: t.metadata ?? {},
      holders: t.holders ?? [],
    }))
  );

  console.log(`[migrate] Seeded ${legacy.length} tokens from tokens.json into SQLite`);
}
