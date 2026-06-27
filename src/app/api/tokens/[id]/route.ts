import { NextResponse } from "next/server";
import { getToken, upsertToken } from "@/lib/db";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = getToken(id);
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    tokenId: token.token_id,
    owner: token.owner,
    deployHash: token.deploy_hash,
    mintedAt: token.minted_at,
    deployStatus: token.deploy_status,
    metadata: token.metadata,
    holders: token.holders,
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = getToken(id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const patch = await req.json() as {
    owner?: string;
    deployHash?: string;
    mintedAt?: number;
    deployStatus?: "pending" | "confirmed" | "failed" | "unknown";
    metadata?: Record<string, unknown>;
    holders?: { publicKey: string; bps: number }[];
  };

  upsertToken({
    token_id: id,
    owner: patch.owner,
    deploy_hash: patch.deployHash,
    minted_at: patch.mintedAt,
    deploy_status: patch.deployStatus,
    metadata: patch.metadata,
    holders: patch.holders,
  });

  return NextResponse.json({ ok: true });
}
