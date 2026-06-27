import { NextResponse } from "next/server";
import { getAllTokens, upsertToken } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner") ?? undefined;
  const tokens = await getAllTokens(owner);

  // Shape matches the old JSON format so existing callers don't break
  return NextResponse.json(
    tokens.map(t => ({
      tokenId: t.token_id,
      owner: t.owner,
      deployHash: t.deploy_hash,
      mintedAt: Number(t.minted_at),
      deployStatus: t.deploy_status,
      metadata: t.metadata,
      holders: t.holders,
    }))
  );
}

export async function POST(req: Request) {
  const body = await req.json() as {
    tokenId?: string | number;
    owner?: string;
    deployHash?: string;
    mintedAt?: number;
    metadata?: Record<string, unknown>;
    holders?: { publicKey: string; bps: number }[];
  };

  if (!body?.tokenId) {
    return NextResponse.json({ error: "tokenId required" }, { status: 400 });
  }

  await upsertToken({
    token_id: String(body.tokenId),
    owner: body.owner,
    deploy_hash: body.deployHash,
    minted_at: body.mintedAt,
    metadata: body.metadata,
    holders: body.holders,
  });

  return NextResponse.json({ ok: true });
}
