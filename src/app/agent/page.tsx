"use client";
import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/app/components/AppLayout";
import type { AgentState } from "@/lib/agent-store";

const LEVEL_COLOR: Record<string, string> = {
  info: "#abb9d6",
  success: "#64FFDA",
  warn: "#FFD600",
  error: "#FF6B6B",
};

const LEVEL_ICON: Record<string, string> = {
  info: "info",
  success: "check_circle",
  warn: "warning",
  error: "error",
};

function fmt(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function fmtCountdown(ms: number | null): string {
  if (!ms) return "—";
  const diff = ms - Date.now();
  if (diff <= 0) return "now";
  return `${Math.ceil(diff / 1000)}s`;
}

export default function AgentPage() {
  const [state, setState] = useState<AgentState | null>(null);
  const [countdown, setCountdown] = useState<string>("—");
  const [actionLoading, setActionLoading] = useState(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/status");
      if (res.ok) setState(await res.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    const pollInterval = setInterval(fetchStatus, 5000);
    const cdInterval = setInterval(() => {
      setState((s) => {
        if (s?.nextCheck) setCountdown(fmtCountdown(s.nextCheck));
        return s;
      });
    }, 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(cdInterval);
    };
  }, [fetchStatus]);

  async function handleToggle() {
    if (!state) return;
    setActionLoading(true);
    try {
      const action = state.running ? "stop" : "start";
      const res = await fetch("/api/agent/yield-monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) setState(await res.json());
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTick() {
    setActionLoading(true);
    try {
      const res = await fetch("/api/agent/yield-monitor");
      if (res.ok) setState(await res.json());
    } finally {
      setActionLoading(false);
    }
  }

  const logs = state?.logs ?? [];

  return (
    <AppLayout title="AI Yield Agent">
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 md:py-10 space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Autonomous Yield Agent</h1>
          <p className="text-sm text-[#abb9d6] mt-1">
            Monitors the on-chain yield pool every 30s and autonomously distributes CSPR to token holders when the balance crosses the threshold — no human clicks required.
          </p>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Status</div>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${state?.running ? "bg-[#00C853] animate-pulse" : "bg-[#FF6B6B]"}`}></span>
              <span className="text-sm font-bold text-[#d8e2ff]">{state?.running ? "Running" : "Stopped"}</span>
            </div>
          </div>

          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Next Check</div>
            <div className="text-sm font-bold text-[#64FFDA] font-mono">{state?.running ? countdown : "—"}</div>
          </div>

          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Total Checks</div>
            <div className="text-sm font-bold text-[#d8e2ff]">{state?.totalRuns ?? 0}</div>
          </div>

          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
            <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-1">Distributions</div>
            <div className="text-sm font-bold text-[#64FFDA]">{state?.totalDistributions ?? 0}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3">
          <button
            onClick={handleToggle}
            disabled={actionLoading}
            className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all active:scale-95 disabled:opacity-50 ${
              state?.running
                ? "bg-[#FF6B6B]/10 border border-[#FF6B6B]/30 text-[#FF6B6B] hover:bg-[#FF6B6B]/20"
                : "bg-[#64FFDA]/10 border border-[#64FFDA]/30 text-[#64FFDA] hover:bg-[#64FFDA]/20"
            }`}
          >
            {actionLoading ? "..." : state?.running ? "Stop Agent" : "Start Agent"}
          </button>

          <button
            onClick={handleTick}
            disabled={actionLoading}
            className="px-5 py-2.5 rounded-lg text-sm font-bold bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#d8e2ff] hover:bg-[#253458] transition-all active:scale-95 disabled:opacity-50"
          >
            Run Now
          </button>
        </div>

        {/* x402 info */}
        <div className="bg-[#091b39] border border-[rgba(255,214,0,0.2)] rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="material-symbols-outlined text-[#FFD600] text-[20px] mt-0.5">payments</span>
            <div>
              <div className="text-sm font-bold text-[#FFD600] mb-1">x402 Payment Protocol Active</div>
              <div className="text-xs text-[#abb9d6] leading-relaxed">
                The AI tokenization endpoint (<code className="font-mono text-[#d8e2ff]">/api/ai/tokenize</code>) is protected by Casper-native x402 micropayments.
                Each AI analysis costs <strong className="text-[#d8e2ff]">3 CSPR</strong> — paid on-chain before the request is processed.
                Payment is verified by querying the Casper testnet RPC before any AI compute runs.
              </div>
            </div>
          </div>
        </div>

        {/* Agent log */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(100,255,218,0.08)]">
            <span className="text-sm font-bold text-[#d8e2ff]">Agent Log</span>
            <span className="text-xs font-mono text-[#abb9d6]">live • refreshes every 5s</span>
          </div>

          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[#abb9d6] text-sm">
              No activity yet — start the agent or click Run Now
            </div>
          ) : (
            <div className="divide-y divide-[rgba(100,255,218,0.05)] max-h-[420px] overflow-y-auto">
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
                    <span className="text-sm" style={{ color: LEVEL_COLOR[entry.level] }}>
                      {entry.message}
                    </span>
                    {entry.txHash && (
                      <a
                        href={`https://testnet.cspr.live/deploy/${entry.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
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

        {/* How it works */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-3">
          <div className="text-sm font-bold text-[#d8e2ff]">How the Agent Works</div>
          <ol className="space-y-2 text-sm text-[#abb9d6]">
            {[
              "Every 30 seconds, the agent queries the yield distributor contract's pool balance on Casper testnet",
              "If the balance exceeds 1 CSPR, the agent signs and submits a distribute() transaction using the server-side keypair — no human approval needed",
              "Token holders can then call claim() to withdraw their pro-rata share of the distributed CSPR",
              "All activity is logged here in real time with on-chain transaction links",
            ].map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="text-xs font-mono text-[#64FFDA] mt-0.5 shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

      </div>
    </AppLayout>
  );
}
