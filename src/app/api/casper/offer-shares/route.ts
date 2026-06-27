/**
 * POST /api/casper/offer-shares
 * Streams Server-Sent Events so the UI can show live step progress.
 *
 * Steps:
 *   kyc-check   — read kyc_list on-chain, skip submit if already whitelisted
 *   kyc-submit  — submit set_kyc deploy(s) for wallets that need it
 *   kyc-confirm — poll until KYC deploys confirm
 *   shares      — submit register_holder for issuer + investor
 *   done        — persist cap table to SQLite, return deploy hashes
 */
import { getToken, upsertToken } from "@/lib/db";
import { getStateRootHash, getContractNamedKeys, getStateItem, waitForDeploy } from "@/lib/casper-rpc";
import {
  agentAccountHash,
  accountHashFromPublicKey,
  submitSetKyc,
  submitRegisterHolder,
} from "@/lib/casper-cli";

const YIELD_HASH = process.env.NEXT_PUBLIC_YIELD_HASH ?? "";
const RWA_HASH = process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "";

// ── KYC check via chain state ─────────────────────────────────────────────────

async function isKyc(accountHex: string): Promise<boolean> {
  if (!RWA_HASH) return false;
  try {
    const stateRoot = await getStateRootHash();
    const namedKeys = await getContractNamedKeys(RWA_HASH, stateRoot);
    const kycUref = namedKeys["kyc_list"];
    if (!kycUref) return false;
    const stored = await getStateItem(stateRoot, kycUref) as { CLValue?: { parsed?: Record<string, boolean> } } | null;
    const kycMap = stored?.CLValue?.parsed ?? {};
    return kycMap[`account-hash-${accountHex}`] === true;
  } catch { return false; }
}

// ── SSE stream ────────────────────────────────────────────────────────────────

type SSEEvent =
  | { step: "kyc-check";   message: string; skipped?: string[] }
  | { step: "kyc-submit";  message: string; hashes: string[] }
  | { step: "kyc-confirm"; message: string; elapsed?: number }
  | { step: "shares";      message: string; hash?: string; role?: string }
  | { step: "done";        success: true; issuerBps: number; investorBps: number; issuerDeployHash: string; investorDeployHash: string; onChain: boolean }
  | { step: "error";       message: string };

export async function POST(req: Request) {
  const encoder = new TextEncoder();
  let controller!: ReadableStreamDefaultController<Uint8Array>;

  const stream = new ReadableStream<Uint8Array>({
    start(c) { controller = c; },
  });

  function send(event: SSEEvent) {
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }

  // Run the async work in the background so we can return the stream immediately
  (async () => {
    try {
      const { tokenId, issuerPublicKey, investorPublicKey, offerBps } = await req.json() as {
        tokenId: string;
        issuerPublicKey: string;
        investorPublicKey: string;
        offerBps: number;
      };

      if (!issuerPublicKey || !investorPublicKey) throw new Error("issuerPublicKey and investorPublicKey required");
      if (!offerBps || offerBps <= 0 || offerBps >= 10_000) throw new Error("offerBps must be 1–9999");

      const issuerBps = 10_000 - offerBps;

      // Off-chain fallback
      if (!YIELD_HASH) {
        if (tokenId) {
          const token = getToken(tokenId);
          if (token) {
            const holders = [
              { publicKey: issuerPublicKey, bps: issuerBps },
              ...token.holders.filter(h => h.publicKey !== issuerPublicKey && h.publicKey !== investorPublicKey),
              { publicKey: investorPublicKey, bps: offerBps },
            ].filter(h => h.bps > 0);
            upsertToken({ ...token, holders });
          }
        }
        send({ step: "done", success: true, issuerBps, investorBps: offerBps, issuerDeployHash: "", investorDeployHash: "", onChain: false });
        controller.close();
        return;
      }

      // Derive account hashes
      const agentH = agentAccountHash();
      const issuerH = accountHashFromPublicKey(issuerPublicKey);
      const investorH = accountHashFromPublicKey(investorPublicKey);

      // ── Step 1: KYC pre-check ─────────────────────────────────────────────
      send({ step: "kyc-check", message: "Checking KYC status on-chain…" });
      const [agentKyc, issuerKyc, investorKyc] = await Promise.all([
        isKyc(agentH),
        isKyc(issuerH),
        isKyc(investorH),
      ]);

      const needsKyc: { hash: string; label: string }[] = [];
      if (!agentKyc)   needsKyc.push({ hash: agentH,    label: "agent" });
      if (!issuerKyc)  needsKyc.push({ hash: issuerH,   label: "issuer" });
      if (!investorKyc) needsKyc.push({ hash: investorH, label: "investor" });

      const skipped = [
        agentKyc    ? "agent"    : "",
        issuerKyc   ? "issuer"   : "",
        investorKyc ? "investor" : "",
      ].filter(Boolean);

      if (needsKyc.length === 0) {
        send({ step: "kyc-check", message: "All wallets already KYC-verified ✓ — skipping whitelist", skipped: ["agent", "issuer", "investor"] });
      } else {
        send({ step: "kyc-check", message: `${skipped.length > 0 ? `${skipped.join(", ")} already verified. ` : ""}Whitelisting: ${needsKyc.map(n => n.label).join(", ")}`, skipped });

        // ── Step 2: Submit KYC ──────────────────────────────────────────────
        send({ step: "kyc-submit", message: `Submitting KYC whitelist deploy${needsKyc.length > 1 ? "s" : ""} on-chain…`, hashes: [] });
        const kycHashes = needsKyc.map(n => ({ ...n, deployHash: submitSetKyc(RWA_HASH, n.hash) }));
        send({ step: "kyc-submit", message: `KYC deploy${kycHashes.length > 1 ? "s" : ""} submitted — waiting for block confirmation…`, hashes: kycHashes.map(k => k.deployHash) });

        // ── Step 3: Wait for KYC ────────────────────────────────────────────
        const start = Date.now();
        send({ step: "kyc-confirm", message: "Waiting for KYC to confirm on-chain (up to 4 min)…" });
        await Promise.all(kycHashes.map(k =>
          waitForDeploy(k.deployHash, 240_000, (sec) => {
            send({ step: "kyc-confirm", message: `Waiting for block confirmation… ${sec}s elapsed` });
          })
        ));
        send({ step: "kyc-confirm", message: "KYC confirmed ✓", elapsed: Math.round((Date.now() - start) / 1000) });
      }

      // ── Step 4: Register holder shares ────────────────────────────────────
      send({ step: "shares", message: `Registering issuer share (${(issuerBps / 100).toFixed(0)}%) on yield contract…`, role: "issuer" });
      const hash1 = submitRegisterHolder(YIELD_HASH, issuerH, issuerBps);
      send({ step: "shares", message: `Issuer share submitted — registering investor share (${(offerBps / 100).toFixed(0)}%)…`, hash: hash1, role: "investor" });
      const hash2 = submitRegisterHolder(YIELD_HASH, investorH, offerBps);
      send({ step: "shares", message: "Investor share submitted ✓", hash: hash2 });

      // ── Step 5: Persist cap table ─────────────────────────────────────────
      if (tokenId) {
        const token = getToken(tokenId);
        if (token) {
          const holders = [
            { publicKey: issuerPublicKey, bps: issuerBps },
            ...token.holders.filter(h => h.publicKey !== issuerPublicKey && h.publicKey !== investorPublicKey),
            { publicKey: investorPublicKey, bps: offerBps },
          ].filter(h => h.bps > 0);
          upsertToken({ ...token, holders });
        }
      }

      send({ step: "done", success: true, issuerBps, investorBps: offerBps, issuerDeployHash: hash1, investorDeployHash: hash2, onChain: true });
    } catch (e) {
      send({ step: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      controller.close();
    }
  })();

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
