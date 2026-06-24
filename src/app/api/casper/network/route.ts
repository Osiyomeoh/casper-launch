import { NextResponse } from "next/server";
import { withFallback } from "@/lib/casper";

export const revalidate = 10;

export async function GET() {
  try {
    const [statusRaw, blockRaw] = await Promise.all([
      withFallback((c) => c.getStatus()),
      withFallback((c) => c.getLatestBlock()),
    ]);

    // Cast to unknown first to avoid overlap errors
    const status = statusRaw as unknown as Record<string, unknown>;
    const blockWrapper = blockRaw as unknown as Record<string, unknown>;
    const block: Record<string, unknown> =
      (blockWrapper.block as Record<string, unknown>) ?? blockWrapper;
    const header: Record<string, unknown> =
      (block.header as Record<string, unknown>) ?? {};

    return NextResponse.json({
      blockHeight: (header.height as number) ?? 0,
      eraId: (header.era_id as number) ?? 0,
      blockHash: (block.hash as string) ?? "",
      chainName: (status.chainspec_name as string) ?? "casper",
      peerCount: Array.isArray(status.peers) ? (status.peers as unknown[]).length : 0,
      buildVersion: (status.build_version as string) ?? "",
      timestamp: (header.timestamp as string) ?? new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Casper RPC unavailable" }, { status: 503 });
  }
}
