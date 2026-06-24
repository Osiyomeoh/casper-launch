import { NextResponse } from "next/server";
import { PurseIdentifier, PublicKey } from "casper-js-sdk";
import { withFallback } from "@/lib/casper";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicKeyHex = searchParams.get("publicKey");

  if (!publicKeyHex) {
    return NextResponse.json({ error: "publicKey required" }, { status: 400 });
  }

  try {
    const pk = PublicKey.fromHex(publicKeyHex);
    const purse = PurseIdentifier.fromPublicKey(pk);
    const result = await withFallback((c) => c.queryLatestBalance(purse));

    // SDK returns typed result — access balance field
    const raw = result as unknown as Record<string, unknown>;
    const moteStr: string =
      String(
        (raw.balance_value as Record<string, unknown>)?.motes ??
        raw.motes ??
        raw.balance ??
        "0"
      );

    const motes = BigInt(moteStr);
    const cspr = Number(motes) / 1_000_000_000;

    return NextResponse.json({ publicKey: publicKeyHex, motes: moteStr, cspr });
  } catch {
    return NextResponse.json({ error: "Account lookup failed" }, { status: 503 });
  }
}
