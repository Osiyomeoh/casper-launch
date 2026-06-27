import { NextResponse } from "next/server";
import { buildPaymentRequirement, parsePaymentHeader, verifyPayment } from "@/lib/x402";

const SYSTEM_PROMPT = `You are a real-world asset (RWA) tokenization specialist for CasperLaunch.
Given a description of an asset, extract structured metadata for CEP-78 NFT minting on Casper blockchain.
Respond ONLY with a valid JSON object — no markdown, no code fences, no explanation.

JSON schema:
{
  "asset_name": string,           // Short official name
  "asset_type": "residential" | "commercial" | "industrial" | "treasury",
  "location": string,             // City, State/Country
  "valuation_usd": number,        // Estimated USD value (integer)
  "yield_apy": number,            // Expected annual yield % (e.g. 6.5)
  "total_tokens": number,         // Total fractional tokens to issue (e.g. 1000000)
  "description": string,          // One sentence description for on-chain metadata
  "ipfs_cid": ""                  // Always empty string — filled after IPFS upload
}`;

export async function POST(req: Request) {
  // ── x402 Payment Gate ──────────────────────────────────────────────────────
  const paymentHeader = req.headers.get("X-PAYMENT");

  if (!paymentHeader) {
    const requirement = buildPaymentRequirement("/api/ai/tokenize");
    return NextResponse.json(
      { x402Version: 1, error: "Payment Required", accepts: [requirement] },
      { status: 402, headers: { "X-ACCEPTS-PAYMENT": "casper-exact" } }
    );
  }

  const payment = parsePaymentHeader(paymentHeader);
  if (!payment) {
    return NextResponse.json({ error: "Invalid X-PAYMENT header" }, { status: 400 });
  }

  // UI clients send a bypass token — skip on-chain verification for browser demo.
  // API/agent clients must send a real Casper deploy hash.
  const isUiBypass = payment.payload.deployHash === "demo-ui-bypass";
  if (!isUiBypass) {
    const verification = await verifyPayment(payment);
    if (!verification.valid) {
      return NextResponse.json(
        { x402Version: 1, error: verification.reason ?? "Payment verification failed" },
        { status: 402 }
      );
    }
  }
  // ── Payment verified ───────────────────────────────────────────────────────

  const { description } = await req.json();
  if (!description?.trim()) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Extract CEP-78 metadata from this asset description:\n\n${description}` },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Groq error: ${err}`);
    }

    const data = await res.json();
    const text: string = data.choices?.[0]?.message?.content ?? "{}";

    const metadata = JSON.parse(text);
    const required = ["asset_name", "asset_type", "location", "valuation_usd", "yield_apy", "total_tokens"];
    for (const key of required) {
      if (metadata[key] === undefined) throw new Error(`Missing field: ${key}`);
    }

    return NextResponse.json(
      { metadata },
      { headers: { "X-PAYMENT-RESPONSE": payment.payload.deployHash } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
