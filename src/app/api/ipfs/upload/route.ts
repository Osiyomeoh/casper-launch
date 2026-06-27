import { NextResponse } from "next/server";

const PINATA_JWT = process.env.PINATA_JWT;
const PINATA_GATEWAY = process.env.NEXT_PUBLIC_PINATA_GATEWAY ?? "https://gateway.pinata.cloud/ipfs";

export async function POST(req: Request) {
  try {
    if (!PINATA_JWT) {
      return NextResponse.json({ error: "PINATA_JWT not configured" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const tokenId = formData.get("tokenId") as string | null;
    const assetName = formData.get("assetName") as string | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Forward to Pinata
    const pinataForm = new FormData();
    pinataForm.append("file", file);
    pinataForm.append("pinataMetadata", JSON.stringify({
      name: `CasperLaunch-${assetName ?? "asset"}-${tokenId ?? Date.now()}`,
      keyvalues: {
        platform: "casperlaunch",
        tokenId: tokenId ?? "",
        assetName: assetName ?? "",
        uploadedAt: new Date().toISOString(),
      },
    }));
    pinataForm.append("pinataOptions", JSON.stringify({ cidVersion: 1 }));

    const res = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", {
      method: "POST",
      headers: { Authorization: `Bearer ${PINATA_JWT}` },
      body: pinataForm,
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Pinata error: ${err.slice(0, 200)}`);
    }

    const data = await res.json() as { IpfsHash: string; PinSize: number };
    const cid = data.IpfsHash;
    const url = `${PINATA_GATEWAY}/${cid}`;

    return NextResponse.json({ cid, url, size: data.PinSize });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    console.error("[ipfs/upload]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
