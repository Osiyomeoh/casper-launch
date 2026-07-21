import { NextResponse } from "next/server";
import { getLatestBlock, getValidators } from "@/lib/cspr-cloud";

export async function GET() {
  try {
    const [block, validators] = await Promise.all([
      getLatestBlock(),
      getValidators(),
    ]);
    return NextResponse.json({ block, validators: validators.data });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
