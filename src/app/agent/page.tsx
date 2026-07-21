"use client";
import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/app/components/AppLayout";
import type { AgentState } from "@/lib/agent-store";
import type { CloudAccount, CloudTransfer, CloudBlock } from "@/lib/cspr-cloud";
import type { McpToolCall } from "@/lib/casper-mcp";

const AGENT_PUBLIC_KEY = process.env.NEXT_PUBLIC_AGENT_PUBLIC_KEY ?? "01e208d198c18d6bd1802c90ae44173393a18d16cbe70144ead27018d237888c2a";

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
  const [cloudAccount, setCloudAccount] = useState<CloudAccount | null>(null);
  const [cloudTransfers, setCloudTransfers] = useState<CloudTransfer[]>([]);
  const [networkBlock, setNetworkBlock] = useState<CloudBlock | null>(null);
  const [mcpToolCalls, setMcpToolCalls] = useState<McpToolCall[]>([]);
  const [csprUsd, setCsprUsd] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/agent/status");
      if (res.ok) setState(await res.json());
    } catch {}
  }, []);

  const fetchCloudData = useCallback(async () => {
    try {
      const [accountRes, networkRes] = await Promise.all([
        fetch(`/api/cspr-cloud/account?publicKey=${AGENT_PUBLIC_KEY}`),
        fetch("/api/cspr-cloud/network"),
      ]);
      if (accountRes.ok) {
        const d = await accountRes.json() as { account: CloudAccount; transfers: CloudTransfer[] };
        setCloudAccount(d.account);
        setCloudTransfers(d.transfers ?? []);
      }
      if (networkRes.ok) {
        const d = await networkRes.json() as { block: CloudBlock };
        setNetworkBlock(d.block);
      }
    } catch {}
  }, []);

  const fetchMcpStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/cspr-cloud/mcp-status?publicKey=${AGENT_PUBLIC_KEY}`);
      if (res.ok) {
        const d = await res.json() as { toolCalls: McpToolCall[]; csprUsd: string | null };
        setMcpToolCalls(d.toolCalls ?? []);
        setCsprUsd(d.csprUsd);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchCloudData();
    fetchMcpStatus();
    const pollInterval = setInterval(fetchStatus, 5000);
    const cloudInterval = setInterval(fetchCloudData, 30000);
    const mcpInterval = setInterval(fetchMcpStatus, 60000);
    const cdInterval = setInterval(() => {
      setState((s) => {
        if (s?.nextCheck) setCountdown(fmtCountdown(s.nextCheck));
        return s;
      });
    }, 1000);
    return () => {
      clearInterval(pollInterval);
      clearInterval(cdInterval);
      clearInterval(cloudInterval);
      clearInterval(mcpInterval);
    };
  }, [fetchStatus, fetchCloudData, fetchMcpStatus]);

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

        {/* CSPR.cloud live data */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Agent wallet */}
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">account_balance_wallet</span>
              <span className="text-sm font-bold text-[#d8e2ff]">Agent Wallet</span>
              <span className="ml-auto text-[10px] font-mono text-[#abb9d6] bg-[#112240] px-2 py-0.5 rounded">via CSPR.cloud</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-[#abb9d6]">Balance</span>
                <span className="text-[#64FFDA] font-mono font-bold">
                  {cloudAccount ? `${(Number(cloudAccount.balance) / 1e9).toFixed(2)} CSPR` : "loading..."}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#abb9d6]">Public key</span>
                <span className="text-[#d8e2ff] font-mono">{AGENT_PUBLIC_KEY.slice(0, 12)}…</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#abb9d6]">Network block</span>
                <span className="text-[#d8e2ff] font-mono">
                  {networkBlock ? `#${networkBlock.block_height.toLocaleString()}` : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* Recent agent transfers */}
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">swap_horiz</span>
              <span className="text-sm font-bold text-[#d8e2ff]">Recent Transfers</span>
              <span className="ml-auto text-[10px] font-mono text-[#abb9d6] bg-[#112240] px-2 py-0.5 rounded">via CSPR.cloud</span>
            </div>
            {cloudTransfers.length === 0 ? (
              <p className="text-xs text-[#abb9d6]">No recent transfers found</p>
            ) : (
              <div className="space-y-2">
                {cloudTransfers.slice(0, 4).map((t) => (
                  <div key={t.transfer_id} className="flex justify-between text-xs border-b border-[rgba(100,255,218,0.05)] pb-1.5 last:border-0">
                    <div>
                      <a
                        href={`https://testnet.cspr.live/deploy/${t.deploy_hash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#64FFDA] font-mono hover:underline"
                      >
                        {t.deploy_hash.slice(0, 10)}…
                      </a>
                      <div className="text-[#abb9d6] mt-0.5">{new Date(t.timestamp).toLocaleString()}</div>
                    </div>
                    <span className="text-[#d8e2ff] font-mono font-bold">
                      {(Number(t.amount) / 1e9).toFixed(2)} CSPR
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* MCP Tool Calls */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[rgba(100,255,218,0.08)]">
            <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">psychology</span>
            <span className="text-sm font-bold text-[#d8e2ff]">MCP Agent Tools</span>
            <span className="ml-auto text-[10px] font-mono text-[#abb9d6] bg-[#112240] px-2 py-0.5 rounded">via Casper MCP Server</span>
            {csprUsd && (
              <span className="text-[10px] font-mono text-[#64FFDA] bg-[#0a2240] px-2 py-0.5 rounded">
                1 CSPR = ${csprUsd}
              </span>
            )}
          </div>
          {mcpToolCalls.length === 0 ? (
            <div className="px-4 py-6 text-center text-[#abb9d6] text-sm">
              MCP tools loading... (runs every 60s)
            </div>
          ) : (
            <div className="divide-y divide-[rgba(100,255,218,0.05)]">
              {mcpToolCalls.map((call, i) => (
                <div key={i} className="px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#64FFDA] shrink-0" />
                    <span className="text-xs font-mono font-bold text-[#64FFDA]">{call.tool}</span>
                    <span className="ml-auto text-[10px] font-mono text-[#abb9d6]">
                      {new Date(call.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                    </span>
                  </div>
                  <div className="text-xs text-[#abb9d6] font-mono pl-3.5 line-clamp-2 leading-relaxed">
                    {call.result.startsWith("Error:") ? (
                      <span className="text-[#FF6B6B]">{call.result}</span>
                    ) : (
                      call.result.slice(0, 200)
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
