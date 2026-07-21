import { NextResponse } from "next/server";
import { getAccount, getAccountTransfers, getAccountDeploys } from "@/lib/cspr-cloud";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const publicKey = searchParams.get("publicKey");
  if (!publicKey) return NextResponse.json({ error: "publicKey required" }, { status: 400 });

  try {
    const [account, transfers, deploys] = await Promise.all([
      getAccount(publicKey),
      getAccountTransfers(publicKey, 5),
      getAccountDeploys(publicKey, 5),
    ]);
    return NextResponse.json({ account, transfers: transfers.data, deploys: deploys.data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
