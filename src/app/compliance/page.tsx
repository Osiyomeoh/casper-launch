"use client";
import { useEffect, useState } from "react";
import AppLayout from "../components/AppLayout";
import Link from "next/link";

type AuditEvent = {
  type: "mint" | "trade" | "listing";
  id: string;
  tokenId: string;
  assetName: string;
  actor: string;
  hash: string;
  status: string;
  ts: number;
  documentHash?: string;
  documentName?: string;
  meta?: { seller: string; buyer: string; bps: number; cspr: number };
};

const TYPE_ICON: Record<string, string> = { mint: "token", trade: "swap_horiz", listing: "sell" };
const TYPE_LABEL: Record<string, string> = { mint: "MINT", trade: "TRADE", listing: "LISTING" };
const TYPE_COLOR: Record<string, string> = { mint: "text-[#64FFDA] border-[#64FFDA]/20 bg-[#64FFDA]/10", trade: "text-[#00C853] border-[#00C853]/20 bg-[#00C853]/10", listing: "text-[#FFD600] border-[#FFD600]/20 bg-[#FFD600]/10" };

const statusColor = (s: string) =>
  s === "confirmed" ? "text-[#00C853] border-[#00C853]/20 bg-[#00C853]/10" :
  s === "pending"   ? "text-[#FFD600] border-[#FFD600]/20 bg-[#FFD600]/10" :
  s === "failed"    ? "text-[#FF0000] border-[#FF0000]/20 bg-[#FF0000]/10" :
                      "text-[#abb9d6] border-[#abb9d6]/20 bg-[#abb9d6]/10";

export default function CompliancePage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "mint" | "trade" | "listing">("all");

  useEffect(() => {
    fetch("/api/compliance")
      .then(r => r.json()).then(setEvents).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function copyHash(hash: string) {
    navigator.clipboard.writeText(hash);
    setCopied(hash); setTimeout(() => setCopied(null), 2000);
  }

  const filtered = filter === "all" ? events : events.filter(e => e.type === filter);
  const confirmed = events.filter(e => e.status === "confirmed").length;
  const trades = events.filter(e => e.type === "trade").length;
  const verRate = events.length ? Math.round((confirmed / events.length) * 100) : null;

  return (
    <AppLayout title="Compliance & Audit">
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Compliance & Audit</h1>
          <p className="text-sm text-[#abb9d6] mt-1">Every agent action is recorded on-chain and auditable in real time.</p>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          {[
            { label: "Events Logged", value: loading ? "…" : events.length.toString(), sub: `${confirmed} confirmed`, icon: "visibility", color: "" },
            { label: "Mints", value: loading ? "…" : events.filter(e => e.type === "mint").length.toString(), sub: "CEP-78 tokens", icon: "token", color: "text-[#64FFDA]" },
            { label: "Trades Settled", value: loading ? "…" : trades.toString(), sub: "yield transfers", icon: "swap_horiz", color: "text-[#00C853]" },
            { label: "Verification Rate", value: loading ? "…" : verRate !== null ? `${verRate}%` : "—", sub: "on-chain confirmed", icon: "verified_user", color: "" },
          ].map(card => (
            <div key={card.label} className="rounded-xl p-5 relative overflow-hidden bg-[#112240] border border-[rgba(255,255,255,0.05)]">
              <div className="absolute top-3 right-3 opacity-10">
                <span className="material-symbols-outlined text-5xl text-[#ffb4a8]">{card.icon}</span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#ebbbb4]">{card.label}</p>
              <h3 className={`text-3xl font-bold mt-2 ${card.color || "text-[#d8e2ff]"}`}>{card.value}</h3>
              <p className="mt-3 text-xs text-[#abb9d6]">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {(["all", "mint", "trade", "listing"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold border transition-all ${filter === f ? "border-[#64FFDA] bg-[#64FFDA]/10 text-[#64FFDA]" : "border-[rgba(100,255,218,0.15)] text-[#abb9d6] hover:border-[#64FFDA]/30"}`}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Audit log */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[rgba(100,255,218,0.1)] flex justify-between items-center">
            <h4 className="font-bold text-sm text-[#d8e2ff]">Audit Log</h4>
            <span className="bg-[#64FFDA]/10 text-[#64FFDA] text-[10px] px-2 py-0.5 rounded font-mono border border-[#64FFDA]/20">LIVE</span>
          </div>

          {loading ? (
            <div className="p-10 text-center text-sm text-[#abb9d6]">Loading…</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <span className="material-symbols-outlined text-[#abb9d6] text-4xl">receipt_long</span>
              <div className="text-sm text-[#abb9d6]">No {filter === "all" ? "" : filter} events yet — mint an asset or complete a trade.</div>
            </div>
          ) : (
            <div className="divide-y divide-[rgba(100,255,218,0.06)]">
              {filtered.map(e => (
                <div key={e.id} className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="material-symbols-outlined text-[#64FFDA] text-[16px] shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>{TYPE_ICON[e.type]}</span>
                      <div className="min-w-0">
                        <Link href={`/assets/${e.tokenId}`} className="text-sm font-bold text-[#d8e2ff] hover:underline truncate block">{e.assetName}</Link>
                        <p className="text-[10px] font-mono text-[#abb9d6]">{new Date(e.ts).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded ${TYPE_COLOR[e.type]}`}>{TYPE_LABEL[e.type]}</span>
                      <span className={`text-[9px] font-mono border px-1.5 py-0.5 rounded-full ${statusColor(e.status)}`}>{e.status.toUpperCase()}</span>
                    </div>
                  </div>

                  {/* Trade details */}
                  {e.meta && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-mono text-[#abb9d6]">
                      <span>Yield: <span className="text-[#64FFDA]">{e.meta.bps / 100}%</span></span>
                      <span>CSPR: <span className="text-[#64FFDA]">{e.meta.cspr.toFixed(2)}</span></span>
                      {e.meta.seller && <span>Seller: <span className="text-[#d8e2ff]">{e.meta.seller.slice(0, 10)}…</span></span>}
                      {e.meta.buyer && <span>Buyer: <span className="text-[#d8e2ff]">{e.meta.buyer.slice(0, 10)}…</span></span>}
                    </div>
                  )}

                  {/* Hash row */}
                  {e.hash && (
                    <div className="flex items-center gap-2 text-[10px] font-mono text-[#abb9d6]">
                      <span className="material-symbols-outlined text-[12px]">tag</span>
                      <a href={`https://testnet.cspr.live/deploy/${e.hash}`} target="_blank" rel="noopener noreferrer"
                        className="text-[#64FFDA] hover:underline">{e.hash.slice(0, 14)}…{e.hash.slice(-8)}</a>
                    </div>
                  )}

                  {/* Document hash */}
                  {e.documentHash && (
                    <div className="flex items-center gap-2 text-[10px] font-mono bg-[#112240] rounded-lg px-3 py-2">
                      <span className="material-symbols-outlined text-[#64FFDA] text-[12px]">fingerprint</span>
                      <span className="text-[#abb9d6] truncate flex-1">{e.documentHash.slice(0, 24)}…</span>
                      <button onClick={() => copyHash(e.documentHash!)} className="shrink-0 text-[#abb9d6] hover:text-[#64FFDA]">
                        <span className="material-symbols-outlined text-[13px]">{copied === e.documentHash ? "check" : "content_copy"}</span>
                      </button>
                      <Link href={`/verify?hash=${e.documentHash}`} className="shrink-0 text-[#64FFDA] hover:underline">verify →</Link>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#64FFDA] text-[20px] mt-0.5">info</span>
          <p className="text-xs text-[#abb9d6] leading-relaxed">
            All mint, trade, and yield events are verifiable on{" "}
            <a href="https://testnet.cspr.live" target="_blank" rel="noopener noreferrer" className="text-[#64FFDA] hover:underline">testnet.cspr.live</a>.
            Document hashes are SHA-256 fingerprints anchored at mint time.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
