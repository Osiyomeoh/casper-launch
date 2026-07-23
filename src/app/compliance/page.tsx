"use client";
import { useEffect, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import type { ComplianceState, ComplianceFlag } from "@/lib/compliance-store";

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
const TYPE_COLOR: Record<string, string> = {
  mint: "text-[#64FFDA] border-[#64FFDA]/20 bg-[#64FFDA]/10",
  trade: "text-[#00C853] border-[#00C853]/20 bg-[#00C853]/10",
  listing: "text-[#FFD600] border-[#FFD600]/20 bg-[#FFD600]/10",
};

const LEVEL_COLOR: Record<string, string> = {
  info: "#abb9d6", success: "#64FFDA", warn: "#FFD600", error: "#FF6B6B",
};
const LEVEL_ICON: Record<string, string> = {
  info: "info", success: "check_circle", warn: "warning", error: "error",
};
const REASON_LABEL: Record<string, string> = {
  kyc_expired: "KYC Expired",
  kyc_missing: "KYC Missing",
  kyc_revoked: "KYC Revoked",
};
const REASON_COLOR: Record<string, string> = {
  kyc_expired: "text-[#FF6B6B] bg-[#FF6B6B]/10 border-[#FF6B6B]/20",
  kyc_missing: "text-[#FFD600] bg-[#FFD600]/10 border-[#FFD600]/20",
  kyc_revoked: "text-[#abb9d6] bg-[#abb9d6]/10 border-[#abb9d6]/20",
};

function fmt(ts: number) {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
function fmtDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function shortKey(k: string) { return k.slice(0, 8) + "…" + k.slice(-6); }

export default function CompliancePage() {
  const [agent, setAgent] = useState<ComplianceState | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const fetchAgent = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/compliance-status");
      if (res.ok) setAgent(await res.json());
    } catch {}
  }, []);

  const fetchAudit = useCallback(async () => {
    try {
      const res = await fetch("/api/compliance/audit");
      if (res.ok) setAuditEvents(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchAgent();
    fetchAudit();
    const agentInterval = setInterval(fetchAgent, 5000);
    return () => clearInterval(agentInterval);
  }, [fetchAgent, fetchAudit]);

  async function handleToggle() {
    if (!agent) return;
    setActionLoading(true);
    try {
      const action = agent.running ? "stop" : "start";
      const res = await fetch("/api/agent/compliance-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setAgent(await res.json());
    } finally {
      setActionLoading(false);
    }
  }

  async function handleScanNow() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/agent/compliance-monitor");
      if (res.ok) setAgent(await res.json());
    } finally {
      setActionLoading(false);
    }
  }

  const openFlags = (agent?.flags ?? []).filter((f: ComplianceFlag) => !f.resolvedAt);
  const resolvedFlags = (agent?.flags ?? []).filter((f: ComplianceFlag) => f.resolvedAt);
  const logs = agent?.logs ?? [];

  return (
    <AppLayout title="Compliance">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Compliance Agent</h1>
          <p className="text-sm text-[#abb9d6] mt-1">
            Autonomous KYC monitor — scans all token holders every 60s, flags expired or missing attestations, and autonomously revokes on-chain access for non-compliant wallets.
          </p>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${agent?.running ? "bg-[#00C853] animate-pulse" : "bg-[#FF6B6B]"}`} />
              <span className="text-sm font-bold text-[#d8e2ff]">{agent?.running ? "Running" : "Stopped"}</span>
            </div>
          </div>

          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Scans</div>
            <div className="text-sm font-bold text-[#d8e2ff]">{agent?.totalRuns ?? 0}</div>
          </div>

          <div className="bg-[#091b39] border border-[rgba(255,107,107,0.3)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Open Flags</div>
            <div className="text-sm font-bold text-[#FF6B6B]">{openFlags.length}</div>
          </div>

          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Revocations</div>
            <div className="text-sm font-bold text-[#64FFDA]">{agent?.totalRevocations ?? 0}</div>
          </div>
        </div>

        {/* How it works banner */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.15)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#64FFDA] text-[20px] mt-0.5">policy</span>
            <div>
              <div className="text-sm font-bold text-[#64FFDA] mb-1">Autonomous KYC Enforcement</div>
              <div className="text-xs text-[#abb9d6] leading-relaxed">
                Every 60 seconds the agent queries all on-chain token holders, verifies their KYC attestation timestamp, and autonomously calls{" "}
                <code className="font-mono text-[#d8e2ff]">set_kyc(approved=false)</code> for any wallet whose attestation has expired (90-day window) or is missing. No human approval required.
              </div>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={handleToggle}
            disabled={actionLoading}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
              agent?.running
                ? "bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 text-[#FF6B6B] hover:bg-[#FF6B6B]/20"
                : "bg-[#64FFDA]/10 border border-[#64FFDA]/30 text-[#64FFDA] hover:bg-[#64FFDA]/20"
            }`}
          >
            {actionLoading ? "..." : agent?.running ? "Stop Agent" : "Start Agent"}
          </button>

          <button
            onClick={handleScanNow}
            disabled={actionLoading}
            className="px-5 py-2.5 rounded-lg text-sm font-bold bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#d8e2ff] hover:bg-[#253458] transition-all active:scale-95 disabled:opacity-50"
          >
            Scan Now
          </button>
        </div>

        {/* Open flags */}
        {openFlags.length > 0 && (
          <div className="bg-[#091b39] border border-[rgba(255,107,107,0.2)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(255,107,107,0.1)]">
              <span className="material-symbols-outlined text-[#FF6B6B] text-[18px]">flag</span>
              <span className="text-sm font-bold text-[#FF6B6B]">Active Compliance Flags</span>
              <span className="ml-auto text-xs font-mono bg-[#FF6B6B]/10 text-[#FF6B6B] px-2 py-0.5 rounded">{openFlags.length}</span>
            </div>
            <div className="divide-y divide-[rgba(255,107,107,0.08)]">
              {openFlags.map((f, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#FF6B6B] text-[16px]">gpp_bad</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-[#d8e2ff]">{shortKey(f.wallet)}</div>
                    <div className="text-xs text-[#abb9d6] mt-0.5">Flagged {fmtDate(f.flaggedAt)}</div>
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${REASON_COLOR[f.reason]}`}>
                    {REASON_LABEL[f.reason]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Resolved flags */}
        {resolvedFlags.length > 0 && (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(100,255,218,0.08)]">
              <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">verified</span>
              <span className="text-sm font-bold text-[#d8e2ff]">Resolved — KYC Revoked On-Chain</span>
            </div>
            <div className="divide-y divide-[rgba(100,255,218,0.05)]">
              {resolvedFlags.map((f, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-3">
                  <span className="material-symbols-outlined text-[#64FFDA] text-[16px]">check_circle</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-mono text-[#d8e2ff]">{shortKey(f.wallet)}</div>
                    {f.txHash && (
                      <a
                        href={`https://testnet.cspr.live/deploy/${f.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="text-[10px] font-mono text-[#64FFDA] hover:underline"
                      >
                        {f.txHash.slice(0, 16)}…
                      </a>
                    )}
                  </div>
                  <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${REASON_COLOR[f.reason]}`}>
                    {REASON_LABEL[f.reason]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Agent log */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(100,255,218,0.08)]">
            <span className="text-sm font-bold text-[#d8e2ff]">Agent Log</span>
            <span className="text-xs font-mono text-[#abb9d6]">live • refreshes every 5s</span>
          </div>
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#abb9d6] text-sm">
              No activity yet — start the agent or click Scan Now
            </div>
          ) : (
            <div className="divide-y divide-[rgba(100,255,218,0.05)] max-h-[380px] overflow-y-auto">
              {logs.map((entry, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-2.5">
                  <span
                    className="material-symbols-outlined text-[16px] mt-0.5 shrink-0"
                    style={{ color: LEVEL_COLOR[entry.level] }}
                  >
                    {LEVEL_ICON[entry.level]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs text-[#abb9d6] font-mono mr-2">{fmt(entry.ts)}</span>
                    <span className="text-sm" style={{ color: LEVEL_COLOR[entry.level] }}>{entry.message}</span>
                    {entry.wallet && (
                      <div className="text-xs font-mono text-[#abb9d6] mt-0.5">{shortKey(entry.wallet)}</div>
                    )}
                    {entry.txHash && (
                      <a
                        href={`https://testnet.cspr.live/deploy/${entry.txHash}`}
                        target="_blank" rel="noopener noreferrer"
                        className="block text-xs font-mono text-[#64FFDA] hover:underline mt-0.5 truncate"
                      >
                        {entry.txHash}
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit trail */}
        {auditEvents.length > 0 && (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(100,255,218,0.08)]">
              <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">receipt_long</span>
              <span className="text-sm font-bold text-[#d8e2ff]">On-Chain Audit Trail</span>
            </div>
            <div className="divide-y divide-[rgba(100,255,218,0.05)] max-h-[360px] overflow-y-auto">
              {auditEvents.map((ev) => (
                <div key={ev.id} className="px-4 py-3 flex items-start gap-3">
                  <span className="material-symbols-outlined text-[16px] mt-0.5 text-[#64FFDA]">{TYPE_ICON[ev.type]}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${TYPE_COLOR[ev.type]}`}>
                        {TYPE_LABEL[ev.type]}
                      </span>
                      <span className="text-xs text-[#d8e2ff] font-medium truncate">{ev.assetName}</span>
                      <span className="text-[10px] text-[#abb9d6] font-mono ml-auto">{fmtDate(ev.ts)}</span>
                    </div>
                    <div className="text-xs text-[#abb9d6] mt-1 font-mono">{shortKey(ev.actor)}</div>
                    <a
                      href={`https://testnet.cspr.live/deploy/${ev.hash}`}
                      target="_blank" rel="noopener noreferrer"
                      className="text-[10px] font-mono text-[#64FFDA] hover:underline truncate block"
                    >
                      {ev.hash.slice(0, 16)}…
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </AppLayout>
  );
}
