/**
 * GET /api/casper/chain-assets
 *
 * Fast read: returns tokens from SQLite, enriched with live on-chain
 * deploy status from the Casper node. The DB is kept in sync via
 * POST /api/casper/sync — that's the authoritative rebuild path.
 */
import { NextResponse } from "next/server";
import { getAllTokens } from "@/lib/db";
import { getStateRootHash, getTotalSupply, getContractNamedKeys, batchDeployStatus } from "@/lib/casper-rpc";

const CONTRACT_HASH = process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ownerKey = searchParams.get("owner") ?? undefined;

  try {
    const tokens = await getAllTokens(ownerKey);

    // Fetch live deploy statuses and total supply in parallel
    const hashes = [...new Set(tokens.map(t => t.deploy_hash).filter(Boolean))];
    const stateRoot = await getStateRootHash();

    const namedKeys = CONTRACT_HASH
      ? await getContractNamedKeys(CONTRACT_HASH, stateRoot)
      : {};

    const [statusMap, totalSupply] = await Promise.all([
      batchDeployStatus(hashes, 5),
      getTotalSupply(CONTRACT_HASH, stateRoot, namedKeys),
    ]);

    const enriched = tokens.map(t => ({
      tokenId: t.token_id,
      owner: t.owner,
      deployHash: t.deploy_hash,
      mintedAt: Number(t.minted_at),
      metadata: t.metadata,
      holders: t.holders,
      onChain: {
        deployStatus: t.deploy_hash ? (statusMap[t.deploy_hash] ?? t.deploy_status) : t.deploy_status,
        explorerUrl: `https://testnet.cspr.live/deploy/${t.deploy_hash}`,
        contractUrl: `https://testnet.cspr.live/contract/${CONTRACT_HASH}`,
      },
    }));

    return NextResponse.json({
      tokens: enriched,
      totalSupplyOnChain: totalSupply,
      contractHash: CONTRACT_HASH,
      stateRoot,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 }
    );
  }
}
