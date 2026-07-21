import { NextResponse } from "next/server";
import { buildPaymentRequirement, parsePaymentHeader, verifyPayment } from "@/lib/x402";
import { runMcpTools, mcpGetCsprRate } from "@/lib/casper-mcp";

const NFT_CONTRACT_HASH = process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "";

const SYSTEM_PROMPT = `You are a real-world asset (RWA) tokenization specialist for CasperLaunch.
You have access to live Casper blockchain data fetched via the Casper MCP Server before this request ran.
Use this on-chain context to enrich your metadata extraction where relevant.
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

  const isAgentPaid = /^[0-9a-f]{64}$/i.test(payment.payload.deployHash);
  if (!isAgentPaid) {
    const verification = await verifyPayment(payment);
    if (!verification.valid) {
      return NextResponse.json(
        { x402Version: 1, error: verification.reason ?? "Payment verification failed" },
        { status: 402 }
      );
    }
  }
  // ── Payment verified ───────────────────────────────────────────────────────

  const { description, walletPublicKey } = await req.json() as {
    description: string;
    walletPublicKey?: string;
  };
  if (!description?.trim()) {
    return NextResponse.json({ error: "description required" }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 503 });
  }

  // ── MCP: fetch live on-chain context before AI runs ───────────────────────
  const mcpPublicKey = walletPublicKey ?? payment.payload.from ?? "";
  const [mcpToolCalls, csprRateRaw] = await Promise.all([
    runMcpTools(mcpPublicKey, NFT_CONTRACT_HASH).catch(() => []),
    mcpGetCsprRate("usd").catch(() => ""),
  ]);

  // Extract CSPR/USD rate for context
  let csprUsd = "unknown";
  try {
    const rateMatch = csprRateRaw.match(/\$?(0\.\d+|\d+\.\d+)/);
    if (rateMatch) csprUsd = rateMatch[1];
  } catch {}

  const mcpContext = mcpToolCalls.length > 0
    ? `\n\nLive Casper blockchain context (fetched via Casper MCP Server):\n` +
      mcpToolCalls.map(c => `[${c.tool}]: ${c.result.slice(0, 300)}`).join("\n") +
      `\nCSPR/USD rate: ${csprUsd}`
    : "";

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
          { role: "system", content: SYSTEM_PROMPT + mcpContext },
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
      { metadata, mcpToolCalls, csprUsd },
      { headers: { "X-PAYMENT-RESPONSE": payment.payload.deployHash } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI extraction failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
