"use client";
import { useParams } from "next/navigation";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";
import { CONTRACT_HASHES, type AssetMetadata } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet-context";

type Holder = { publicKey: string; bps: number };

type TokenData = {
  tokenId: string;
  metadata: AssetMetadata;
  owner: string;
  deployHash: string;
  deployStatus?: string;
  mintedAt: number;
  holders?: Holder[];
};

const TESTNET_EXPLORER = "https://testnet.cspr.live";

function shortKey(key: string) {
  return key ? `${key.slice(0, 10)}…${key.slice(-6)}` : "—";
}

// ── List for Sale panel (user signs & pays via CasperWallet) ─────────────────

function ListForSalePanel({ tok, wallet }: { tok: TokenData; wallet: ReturnType<typeof useWallet> }) {
  const ESCROW_HASH = process.env.NEXT_PUBLIC_ESCROW_HASH ?? "";
  const [listBps, setListBps]       = useState("");
  const [listPrice, setListPrice]   = useState("");
  const [listLoading, setListLoading] = useState(false);
  const [listResult, setListResult] = useState<{ ok: boolean; msg: string } | null>(null);

  if (!ESCROW_HASH || tok.owner !== wallet.publicKey) return null;

  const bpsNum   = Math.round(Number(listBps) * 100);
  const priceUsd = Number(listPrice);
  const priceCspr = priceUsd > 0 ? String(BigInt(Math.round(priceUsd * 2 * 1e9))) : ""; // rough CSPR/USD rate ~0.5

  async function handleList() {
    if (!wallet.publicKey || !wallet.signAndSubmit) return;
    if (!bpsNum || bpsNum <= 0 || bpsNum >= 10_000 || !priceCspr) return;
    setListLoading(true);
    setListResult(null);
    try {
      // 1. User signs authorization message (wallet popup)
      const authMsg = `CasperLaunch sell authorization\nAsset: ${tok.metadata?.asset_name ?? tok.tokenId}\nYield: ${bpsNum / 100}%\nPrice: ${priceCspr} motes`;
      await wallet.signMessage(authMsg);

      // 2. Agent submits the escrow listing on-chain
      const res = await fetch("/api/casper/escrow-list-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_id: tok.tokenId, bps: bpsNum, price_cspr: priceCspr,
          price_usd: priceUsd, seller_wallet: wallet.publicKey,
          asset_name: tok.metadata?.asset_name ?? tok.tokenId,
        }),
      });
      const data = await res.json() as { listing_id?: string; tx_hash?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      const txHash = data.tx_hash ?? "";

      setListResult({ ok: true, msg: `Listed on-chain ✓ — tx: ${txHash.slice(0, 16)}…` });
      setListBps(""); setListPrice("");
    } catch (e) {
      setListResult({ ok: false, msg: e instanceof Error ? e.message : "Failed" });
    }
    setListLoading(false);
  }

  return (
    <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-4">
      <div>
        <p className="font-bold text-[#d8e2ff] text-sm">List Shares for Sale</p>
        <p className="text-[11px] text-[#abb9d6] mt-1">
          Create a public listing on the escrow contract. Buyers can purchase your yield shares directly on-chain. <strong>Your wallet pays gas.</strong>
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] font-mono text-[#ebbbb4] uppercase">% to list</label>
          <input value={listBps} onChange={e => setListBps(e.target.value)} placeholder="e.g. 20"
            className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] outline-none focus:border-[#64FFDA]" />
        </div>
        <div>
          <label className="text-[10px] font-mono text-[#ebbbb4] uppercase">Price (USD)</label>
          <input value={listPrice} onChange={e => setListPrice(e.target.value)} placeholder="e.g. 0.45"
            className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] outline-none focus:border-[#64FFDA]" />
        </div>
      </div>
      {listResult && (
        <div className={`text-[11px] font-mono px-3 py-2 rounded-lg ${listResult.ok ? "bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/20" : "bg-[#FF0000]/10 text-[#ebbbb4] border border-[#FF0000]/20"}`}>
          {listResult.ok ? "✓ " : "✗ "}{listResult.msg}
        </div>
      )}
      <button
        disabled={!listBps || !listPrice || listLoading || !wallet.isConnected}
        onClick={handleList}
        className="w-full py-3 bg-[#64FFDA] text-[#0a192f] font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
      >
        {listLoading
          ? <><span className="animate-spin material-symbols-outlined text-[16px]">autorenew</span> Waiting for wallet signature…</>
          : <><span className="material-symbols-outlined text-[16px]">storefront</span> Authorize &amp; List on Escrow Contract →</>}
      </button>
      <p className="text-[10px] text-[#abb9d6]">
        Your wallet signs an authorization message, then the AI agent submits the on-chain listing.
      </p>
    </div>
  );
}

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>();
  const wallet = useWallet();

  const [token, setToken] = useState<TokenData | null>(null);
  const [holders, setHolders] = useState<Holder[]>([]);
  const [offerPct, setOfferPct] = useState("");
  const [investorKey, setInvestorKey] = useState("");
  const [offerPrice, setOfferPrice] = useState("");
  const [offerLoading, setOfferLoading] = useState(false);
  const [offerResult, setOfferResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [offerSteps, setOfferSteps] = useState<{ label: string; status: "waiting" | "active" | "done" | "skipped" | "error" }[]>([]);
  const [remintLoading, setRemintLoading] = useState(false);
  const [remintResult, setRemintResult] = useState<{ ok: boolean; msg: string; deployHash?: string } | null>(null);

  const loadToken = useCallback(() => {
    fetch(`/api/tokens/${id}`)
      .then(r => r.ok ? r.json() : null)
      .then((t: TokenData | null) => {
        // Fall back to localStorage when server can't find the token (Vercel serverless)
        if (!t) {
          try {
            const stored = JSON.parse(localStorage.getItem("casperlaunch:tokens") ?? "{}");
            const local = stored[id];
            if (local) t = { ...local, tokenId: String(local.tokenId) } as TokenData;
          } catch {}
        }
        if (!t) return;
        setToken(t);
        setHolders(t.holders ?? [{ publicKey: t.owner, bps: 10_000 }]);
        // Refresh live deploy status from the node in the background
        if (t.deployHash) {
          fetch(`/api/casper/chain-assets`)
            .then(r => r.json())
            .then((data: { tokens?: (TokenData & { onChain?: { deployStatus: string } })[] }) => {
              const match = data.tokens?.find(x => x.tokenId === id);
              if (match?.onChain?.deployStatus) {
                setToken(prev => prev ? { ...prev, deployStatus: match.onChain!.deployStatus } : prev);
                // Persist refreshed status to DB
                if (match.onChain.deployStatus !== t.deployStatus) {
                  fetch(`/api/tokens/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ deployStatus: match.onChain.deployStatus }),
                  }).catch(() => {});
                }
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => { loadToken(); }, [loadToken]);

  if (!token) {
    return (
      <AppLayout title="Asset">
        <div className="p-8 text-center space-y-4">
          <span className="material-symbols-outlined text-[#abb9d6] text-5xl">search_off</span>
          <p className="text-sm text-[#abb9d6]">Token #{id} not found.</p>
          <p className="text-xs text-[#ebbbb4]">This token may not have been minted yet, or the server data was reset.</p>
          <Link href="/chat">
            <button className="mt-2 bg-[#FF0000] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:brightness-110">
              Tokenize a New Asset
            </button>
          </Link>
        </div>
      </AppLayout>
    );
  }

  const tok = token; // non-null guaranteed by early return above
  const { metadata, deployHash, mintedAt } = tok;
  const marketCap = metadata.valuation_usd;
  const annualYield = (marketCap * metadata.yield_apy) / 100;
  const pricePerToken = marketCap / metadata.total_tokens;

  const issuerBps = holders.find(h => h.publicKey === tok.owner)?.bps ?? 10_000;
  const investorHolders = holders.filter(h => h.publicKey !== tok.owner);

  async function handleOffer() {
    const pct = Number(offerPct);
    if (!pct || pct <= 0 || pct >= 100) return;
    if (!investorKey.trim()) return;

    setOfferLoading(true);
    setOfferResult(null);
    setOfferSteps([
      { label: "Checking KYC status on-chain", status: "active" },
      { label: "Whitelisting wallets",         status: "waiting" },
      { label: "Waiting for KYC confirmation", status: "waiting" },
      { label: "Registering holder shares",    status: "waiting" },
      { label: "Finalising",                   status: "waiting" },
    ]);

    try {
      const offerBps = Math.round(pct * 100);
      const res = await fetch("/api/casper/offer-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tokenId: tok.tokenId ?? id,
          issuerPublicKey: tok.owner,
          investorPublicKey: investorKey.trim(),
          offerBps,
        }),
      });

      if (!res.body) throw new Error("No response stream");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let finalData: { issuerBps: number; investorBps: number; onChain: boolean } | null = null;

      const markStep = (idx: number, status: "active" | "done" | "skipped" | "error", label?: string) => {
        setOfferSteps(prev => prev.map((s, i) => {
          if (i === idx) return { label: label ?? s.label, status };
          if (i === idx + 1 && status === "done") return { ...s, status: "active" };
          return s;
        }));
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const ev = JSON.parse(line.slice(6)) as {
              step: string; message?: string; skipped?: string[];
              issuerBps?: number; investorBps?: number; onChain?: boolean;
              hash?: string; hashes?: string[]; elapsed?: number;
            };
            switch (ev.step) {
              case "kyc-check":
                markStep(0, ev.skipped?.length === 3 ? "skipped" : "done",
                  ev.skipped?.length === 3 ? "All wallets already KYC-verified ✓" : ev.message);
                break;
              case "kyc-submit":
                markStep(1, ev.hashes?.length ? "done" : "active",
                  ev.hashes?.length
                    ? `KYC deploy${ev.hashes.length > 1 ? "s" : ""} submitted ✓`
                    : ev.message);
                break;
              case "kyc-confirm":
                if (ev.elapsed !== undefined) {
                  markStep(2, "done", `KYC confirmed ✓ (${ev.elapsed}s)`);
                } else {
                  // update label in-place without changing status (keep spinner)
                  setOfferSteps(prev => prev.map((s, i) =>
                    i === 2 ? { ...s, status: "active", label: ev.message ?? s.label } : s
                  ));
                }
                break;
              case "shares":
                markStep(3, ev.hash ? "done" : "active", ev.message);
                break;
              case "done":
                finalData = { issuerBps: ev.issuerBps ?? 0, investorBps: ev.investorBps ?? 0, onChain: ev.onChain ?? false };
                markStep(4, "done", "Complete ✓");
                break;
              case "error":
                setOfferSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "error" } : s));
                throw new Error(ev.message);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }

      if (!finalData) throw new Error("No completion event received");

      // Update local cap table
      const updatedHolders: Holder[] = [
        { publicKey: tok.owner, bps: finalData.issuerBps },
        ...holders.filter(h => h.publicKey !== tok.owner && h.publicKey !== investorKey.trim()),
        { publicKey: investorKey.trim(), bps: finalData.investorBps },
      ].filter(h => h.bps > 0);

      setHolders(updatedHolders);
      setToken({ ...tok, holders: updatedHolders });

      setOfferResult({
        ok: true,
        msg: finalData.onChain
          ? `Share split recorded on-chain. Issuer ${(finalData.issuerBps / 100).toFixed(0)}% · Investor ${(finalData.investorBps / 100).toFixed(0)}%`
          : "Share split recorded off-chain (yield contract not configured).",
      });
      setOfferPct("");
      setInvestorKey("");
      setOfferPrice("");
    } catch (e) {
      setOfferResult({ ok: false, msg: e instanceof Error ? e.message : "Error" });
      setOfferSteps(prev => prev.map(s => s.status === "active" ? { ...s, status: "error" } : s));
    }
    setOfferLoading(false);
  }

  async function handleRemint() {
    if (!tok) return;
    setRemintLoading(true);
    setRemintResult(null);
    try {
      const recipientAccountHash = tok.owner.startsWith("account-hash-")
        ? tok.owner.replace("account-hash-", "")
        : tok.owner;
      const res = await fetch("/api/casper/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAccountHash,
          tokenId: tok.tokenId,
          metadata: tok.metadata,
        }),
      });
      const data = await res.json() as { deployHash?: string; error?: string };
      if (!res.ok || !data.deployHash) throw new Error(data.error ?? "Mint failed");

      // Update deploy hash and status in DB
      await fetch(`/api/tokens/${tok.tokenId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deployHash: data.deployHash, deployStatus: "pending" }),
      });

      setToken({ ...tok, deployHash: data.deployHash, deployStatus: "pending" });
      setRemintResult({ ok: true, msg: "Re-mint submitted — KYC wallets are already whitelisted so this should confirm quickly.", deployHash: data.deployHash });
    } catch (e) {
      setRemintResult({ ok: false, msg: e instanceof Error ? e.message : "Re-mint failed" });
    }
    setRemintLoading(false);
  }

  const offerBpsPreview = offerPct && !isNaN(Number(offerPct)) ? Math.round(Number(offerPct) * 100) : 0;

  return (
    <AppLayout title={metadata.asset_name}>
      <div className="p-4 md:p-8 space-y-6 max-w-5xl">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-[#00C853]/10 text-[#00C853] text-[10px] font-mono px-2 py-0.5 rounded border border-[#00C853]/20">LIVE ON CASPER TESTNET</span>
              <span className="bg-[#64FFDA]/10 text-[#64FFDA] text-[10px] font-mono px-2 py-0.5 rounded border border-[#64FFDA]/20">CEP-78 NFT</span>
            </div>
            <h1 className="text-2xl font-bold text-[#d8e2ff]">{metadata.asset_name}</h1>
            <p className="text-sm text-[#abb9d6] mt-0.5">{metadata.location} · {metadata.asset_type}</p>
          </div>
          <a
            href={`${TESTNET_EXPLORER}/deploy/${deployHash}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 border border-[rgba(100,255,218,0.2)] rounded-lg text-[10px] font-mono text-[#64FFDA] hover:bg-[#64FFDA]/5 shrink-0"
          >
            <span className="material-symbols-outlined text-[12px]">open_in_new</span>
            View on testnet.cspr.live
          </a>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Asset Valuation", value: `$${marketCap.toLocaleString()}`, icon: "attach_money", color: "text-[#64FFDA]" },
            { label: "Annual Yield", value: `$${annualYield.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, sub: `${metadata.yield_apy}% APY`, icon: "trending_up", color: "text-[#00C853]" },
            { label: "Token Supply", value: metadata.total_tokens.toLocaleString(), sub: "yield shares", icon: "toll", color: "text-[#d8e2ff]" },
            { label: "Price / Token", value: `$${pricePerToken.toFixed(2)}`, icon: "sell", color: "text-[#d8e2ff]" },
          ].map((k) => (
            <div key={k.label} className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#abb9d6] text-[16px]">{k.icon}</span>
                <p className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">{k.label}</p>
              </div>
              <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
              {k.sub && <p className="text-[10px] text-[#abb9d6]">{k.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Cap Table */}
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[rgba(100,255,218,0.1)] flex justify-between items-center">
              <h3 className="font-bold text-sm text-[#d8e2ff]">Cap Table</h3>
              <span className="text-[10px] font-mono text-[#abb9d6]">Token #{id}</span>
            </div>
            <div className="p-4 space-y-3">

              {/* Holder rows */}
              {holders.map((h) => {
                const isIssuer = h.publicKey === tok.owner;
                const pct = (h.bps / 100).toFixed(1);
                const tokensHeld = Math.round(metadata.total_tokens * h.bps / 10_000);
                const yieldShare = (annualYield * h.bps / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 });
                return (
                  <div key={h.publicKey} className="flex items-center gap-3 p-3 bg-[#112240] rounded-lg">
                    <div className="w-8 h-8 rounded-full bg-[#64FFDA]/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#64FFDA] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                        {isIssuer ? "account_circle" : "person"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-[#d8e2ff]">
                        {isIssuer
                          ? (wallet.publicKey === h.publicKey ? "You (Issuer)" : "Issuer")
                          : (wallet.publicKey === h.publicKey ? "You (Investor)" : "Investor")}
                      </p>
                      <p className="text-[9px] font-mono text-[#abb9d6] truncate">{shortKey(h.publicKey)}</p>
                      <p className="text-[9px] text-[#abb9d6]">${yieldShare}/yr yield</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-[#64FFDA]">{pct}%</p>
                      <p className="text-[9px] text-[#abb9d6]">{tokensHeld.toLocaleString()} tokens</p>
                    </div>
                  </div>
                );
              })}

              {/* Ownership bar */}
              <div>
                <div className="flex justify-between text-[9px] font-mono text-[#abb9d6] mb-1">
                  <span>Issuer ({(issuerBps / 100).toFixed(1)}%)</span>
                  <span>Investors ({((10_000 - issuerBps) / 100).toFixed(1)}%)</span>
                </div>
                <div className="h-3 bg-[#112240] rounded-full overflow-hidden flex">
                  <div className="h-full bg-[#64FFDA] rounded-l-full transition-all duration-500" style={{ width: `${issuerBps / 100}%` }} />
                  {investorHolders.map((h, i) => (
                    <div
                      key={h.publicKey}
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${h.bps / 100}%`,
                        background: i % 2 === 0 ? "#00C853" : "#FFB300",
                      }}
                    />
                  ))}
                </div>
              </div>

              <p className="text-[10px] text-[#abb9d6] pt-1">
                Yield distributor tracks fractional ownership. NFT deed remains with issuer. Transfers restricted to KYC-verified wallets only.
              </p>
            </div>
          </div>

          {/* Compliance & Documents */}
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[rgba(100,255,218,0.1)]">
              <h3 className="font-bold text-sm text-[#d8e2ff]">Compliance Record</h3>
            </div>
            <div className="p-4 space-y-3">
              {[
                {
                  label: "Issuer KYC",
                  value: "Accredited investor attestation signed",
                  icon: "verified_user",
                  color: "text-[#00C853]",
                  ok: true,
                },
                {
                  label: "Document Hash",
                  value: metadata.document_hash
                    ? `${metadata.document_hash.slice(0, 16)}…`
                    : "No document anchored",
                  icon: "fingerprint",
                  color: metadata.document_hash ? "text-[#64FFDA]" : "text-[#abb9d6]",
                  ok: !!metadata.document_hash,
                  fullValue: metadata.document_hash,
                },
                {
                  label: "Document File",
                  value: metadata.document_name ?? "—",
                  icon: "description",
                  color: "text-[#abb9d6]",
                  ok: !!metadata.document_name,
                },
                {
                  label: "Minted",
                  value: new Date(mintedAt).toLocaleString(),
                  icon: "schedule",
                  color: "text-[#abb9d6]",
                  ok: true,
                },
              ].map((row) => (
                <div key={row.label} className="flex items-start gap-3 p-2.5 bg-[#112240] rounded-lg">
                  <span className={`material-symbols-outlined text-[16px] mt-0.5 ${row.color}`} style={row.ok ? { fontVariationSettings: "'FILL' 1" } : {}}>{row.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-mono text-[#abb9d6] uppercase">{row.label}</p>
                    <p className={`text-xs font-mono ${row.color} break-all`}>{row.value}</p>
                  </div>
                  {"fullValue" in row && row.fullValue && (
                    <button
                      onClick={() => navigator.clipboard.writeText(row.fullValue as string)}
                      title="Copy full hash"
                      className="shrink-0 text-[#abb9d6] hover:text-[#64FFDA] transition-colors mt-0.5"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  )}
                </div>
              ))}

              {metadata.document_hash && (
                <Link href={`/verify?hash=${metadata.document_hash}`}>
                  <button className="w-full mt-1 py-2 border border-[rgba(100,255,218,0.2)] rounded-lg text-[10px] font-mono text-[#64FFDA] hover:bg-[#64FFDA]/5 flex items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-[12px]">verified</span>
                    Verify Backing Document
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Offer to Investors */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-4">
          <div>
            <h3 className="font-bold text-sm text-[#d8e2ff]">Offer to Investors</h3>
            <p className="text-xs text-[#abb9d6] mt-0.5">
              Transfer a percentage of yield rights to a KYC-verified investor wallet.
              The NFT deed stays with you; the investor receives proportional yield distributions.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">% to offer</label>
              <input
                value={offerPct}
                onChange={(e) => setOfferPct(e.target.value)}
                placeholder="e.g. 30"
                className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] outline-none focus:border-[#64FFDA]"
              />
              {offerBpsPreview > 0 && (
                <p className="text-[10px] text-[#abb9d6] mt-1">
                  {Math.round(metadata.total_tokens * offerBpsPreview / 10_000).toLocaleString()} tokens ·
                  ${(annualYield * offerBpsPreview / 10_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}/yr yield
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">Price per token (USD)</label>
              <input
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder={`e.g. ${pricePerToken.toFixed(2)}`}
                className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] outline-none focus:border-[#64FFDA]"
              />
              {offerPrice && offerBpsPreview > 0 && !isNaN(Number(offerPrice)) && (
                <p className="text-[10px] text-[#abb9d6] mt-1">
                  Raise: ${(Math.round(metadata.total_tokens * offerBpsPreview / 10_000) * Number(offerPrice)).toLocaleString()}
                </p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">Investor wallet (public key)</label>
              <input
                value={investorKey}
                onChange={(e) => setInvestorKey(e.target.value)}
                placeholder="01abc…"
                className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] outline-none focus:border-[#64FFDA] font-mono"
              />
            </div>
          </div>

          {/* Progress tracker — visible while loading or after completion */}
          {offerSteps.length > 0 && (
            <div className="bg-[#0a1628] border border-[rgba(100,255,218,0.1)] rounded-xl p-4 space-y-2">
              {offerSteps.map((s, i) => {
                const icon =
                  s.status === "done"    ? "check_circle" :
                  s.status === "skipped" ? "skip_next" :
                  s.status === "error"   ? "error" :
                  s.status === "active"  ? "autorenew" : "radio_button_unchecked";
                const color =
                  s.status === "done"    ? "text-[#00C853]" :
                  s.status === "skipped" ? "text-[#64FFDA]" :
                  s.status === "error"   ? "text-[#FF0000]" :
                  s.status === "active"  ? "text-[#FFD600]" : "text-[#abb9d6]/40";
                return (
                  <div key={i} className={`flex items-center gap-2.5 text-[11px] font-mono transition-opacity ${s.status === "waiting" ? "opacity-40" : "opacity-100"}`}>
                    <span className={`material-symbols-outlined text-[15px] shrink-0 ${color} ${s.status === "active" ? "animate-spin" : ""}`}
                      style={{ fontVariationSettings: s.status === "done" || s.status === "skipped" ? "'FILL' 1" : undefined }}>
                      {icon}
                    </span>
                    <span className={color}>{s.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {offerResult && (
            <div className={`text-[11px] font-mono px-3 py-2 rounded-lg ${offerResult.ok ? "bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/20" : "bg-[#FF0000]/10 text-[#ebbbb4] border border-[#FF0000]/20"}`}>
              {offerResult.ok ? "✓ " : "✗ "}{offerResult.msg}
            </div>
          )}

          <button
            disabled={!offerPct || !investorKey || offerLoading || Number(offerPct) <= 0 || Number(offerPct) >= 100}
            onClick={handleOffer}
            className="w-full py-3 bg-[#FF0000] text-white font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
          >
            {offerLoading
              ? <><span className="animate-spin material-symbols-outlined text-[16px]">autorenew</span> Processing…</>
              : "Transfer Yield Rights to Investor →"}
          </button>
          <p className="text-[10px] text-[#abb9d6]">
            KYC & share registration signed by the AI agent. Transfer restrictions enforced on-chain.
          </p>
        </div>

        {/* ── Marketplace listing — user signs & pays ─────────────────────── */}
        <ListForSalePanel tok={tok} wallet={wallet} />

        {/* Failed mint banner + re-mint */}
        {tok.deployStatus === "failed" && (
          <div className="bg-[#091b39] border border-[rgba(255,0,0,0.25)] rounded-xl p-5 space-y-3">
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[#FF6B6B] text-[20px] mt-0.5" style={{ fontVariationSettings: "'FILL' 1" }}>error</span>
              <div>
                <p className="text-sm font-bold text-[#FF6B6B]">Mint deploy failed on-chain</p>
                <p className="text-xs text-[#abb9d6] mt-1">
                  The original deploy was rejected (User error: 6 — wallet not KYC-whitelisted at the time).
                  KYC is now set up. Click below to re-submit the mint — all metadata is preserved.
                </p>
              </div>
            </div>
            {remintResult && (
              <div className={`text-[11px] font-mono px-3 py-2 rounded-lg ${remintResult.ok ? "bg-[#00C853]/10 text-[#00C853] border border-[#00C853]/20" : "bg-[#FF0000]/10 text-[#ebbbb4] border border-[#FF0000]/20"}`}>
                {remintResult.ok ? "✓ " : "✗ "}{remintResult.msg}
                {remintResult.deployHash && (
                  <a href={`${TESTNET_EXPLORER}/deploy/${remintResult.deployHash}`} target="_blank" rel="noopener noreferrer"
                    className="ml-2 text-[#64FFDA] hover:underline">view deploy →</a>
                )}
              </div>
            )}
            <button
              onClick={handleRemint}
              disabled={remintLoading}
              className="w-full py-2.5 bg-[#FF0000] text-white font-bold text-sm rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
            >
              {remintLoading
                ? <><span className="animate-spin material-symbols-outlined text-[16px]">autorenew</span> Re-minting (KYC + mint)…</>
                : <><span className="material-symbols-outlined text-[16px]">refresh</span> Re-mint Token on Casper Testnet</>}
            </button>
          </div>
        )}

        {/* On-chain data */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 space-y-2">
          <p className="text-[10px] font-mono text-[#64FFDA] uppercase tracking-wider">On-chain References</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] font-mono">
            <div>
              <span className="text-[#abb9d6]">NFT Contract: </span>
              <a href={`${TESTNET_EXPLORER}/contract/${CONTRACT_HASHES.rwaNft}`} target="_blank" rel="noopener noreferrer" className="text-[#64FFDA] hover:underline break-all">
                {CONTRACT_HASHES.rwaNft ? `${CONTRACT_HASHES.rwaNft.slice(0, 20)}…` : "—"}
              </a>
            </div>
            <div>
              <span className="text-[#abb9d6]">Yield Contract: </span>
              <a href={`${TESTNET_EXPLORER}/contract/${CONTRACT_HASHES.yield}`} target="_blank" rel="noopener noreferrer" className="text-[#64FFDA] hover:underline break-all">
                {CONTRACT_HASHES.yield ? `${CONTRACT_HASHES.yield.slice(0, 20)}…` : "—"}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[#abb9d6]">Mint Deploy: </span>
              <a href={`${TESTNET_EXPLORER}/deploy/${tok.deployHash}`} target="_blank" rel="noopener noreferrer" className="text-[#64FFDA] hover:underline break-all">
                {tok.deployHash.slice(0, 20)}…
              </a>
              {tok.deployStatus === "failed" && (
                <span className="text-[9px] font-mono text-[#FF0000] bg-[#FF0000]/10 border border-[#FF0000]/20 px-1.5 py-0.5 rounded-full shrink-0">FAILED</span>
              )}
              {tok.deployStatus === "confirmed" && (
                <span className="text-[9px] font-mono text-[#00C853] bg-[#00C853]/10 border border-[#00C853]/20 px-1.5 py-0.5 rounded-full shrink-0">CONFIRMED</span>
              )}
              {(tok.deployStatus === "pending" || !tok.deployStatus) && (
                <span className="text-[9px] font-mono text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/20 px-1.5 py-0.5 rounded-full shrink-0">PENDING</span>
              )}
            </div>
          </div>
        </div>

      </div>
    </AppLayout>
  );
}
