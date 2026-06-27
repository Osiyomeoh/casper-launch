"use client";
import { useState, useEffect, useRef } from "react";
import AppLayout from "../components/AppLayout";
import { useWallet } from "@/lib/wallet-context";
import { CONTRACT_HASHES } from "@/lib/contracts";

type Holder = { publicKey: string; bps: number };
type TokenData = {
  tokenId: string; metadata: { asset_name?: string; valuation_usd?: number; yield_apy?: number; total_tokens?: number };
  owner: string; deployHash: string; mintedAt: number; holders: Holder[];
};

const contractDeployed = !!CONTRACT_HASHES.yield;

function shortKey(pk: string) { return `${pk.slice(0, 10)}…${pk.slice(-6)}`; }

export default function YieldPage() {
  const wallet = useWallet();
  const [reserve, setReserve] = useState(15);
  const [autoReinvest, setAutoReinvest] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txMsg, setTxMsg] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [logs, setLogs] = useState<{ t: string; msg: string; color?: string }[]>([]);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/tokens")
      .then(r => r.json())
      .then((data: TokenData[]) => setTokens(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  // Simulated agent log
  useEffect(() => {
    if (!contractDeployed) {
      setLogs([
        { t: now(), msg: "Yield distributor contract not found.", color: "text-[#FF0000]" },
        { t: now(), msg: "Set NEXT_PUBLIC_YIELD_HASH and restart." },
      ]);
      return;
    }
    const entries = [
      { t: now(), msg: `Connected to yield distributor: ${CONTRACT_HASHES.yield!.slice(0, 16)}...`, color: "text-[#64FFDA]" },
      { t: now(), msg: `Reserve fund: ${15}% withheld from each distribution.` },
    ];
    if (tokens.length > 0) {
      entries.push({ t: now(), msg: `${tokens.length} asset(s) registered. Scanning holders...` });
      const totalHolders = tokens.reduce((s, t) => s + (t.holders?.length ?? 1), 0);
      entries.push({ t: now(), msg: `${totalHolders} holder(s) on cap table. Engine READY.`, color: "text-[#00C853]" });
    } else {
      entries.push({ t: now(), msg: "No minted tokens found. Mint an RWA token to register holders." });
    }
    setLogs(entries);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens.length, contractDeployed]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [logs]);

  function now() { return new Date().toLocaleTimeString(); }

  function addLog(msg: string, color?: string) {
    setLogs(prev => [...prev, { t: now(), msg, color }]);
  }

  async function handleDistribute() {
    if (!wallet.isConnected || !wallet.publicKey) { wallet.connect(); return; }
    setDistributing(true); setTxError(null); setTxMsg(null);
    addLog("Confirm distribution in wallet popup...");
    try {
      await wallet.signMessage(`CasperLaunch distribute authorization\nCaller: ${wallet.publicKey.slice(0, 20)}…\nTimestamp: ${Date.now()}`);
      addLog("Authorization confirmed — agent submitting distribute()...");
      const res = await fetch("/api/agent/yield-monitor", { method: "GET" });
      const data = await res.json() as { logs?: { message: string }[] };
      const lastLog = data.logs?.[0]?.message ?? "Distribution triggered";
      setTxMsg(lastLog);
      addLog(lastLog, "text-[#00C853]");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setTxError(msg); addLog(`Error: ${msg}`, "text-[#FF0000]");
    }
    setDistributing(false);
  }

  async function handleClaim() {
    if (!wallet.isConnected || !wallet.publicKey) { wallet.connect(); return; }
    setClaiming(true); setTxError(null); setTxMsg(null);
    addLog("Confirm yield claim in wallet popup...");
    try {
      await wallet.signMessage(`CasperLaunch claim authorization\nClaimer: ${wallet.publicKey.slice(0, 20)}…\nTimestamp: ${Date.now()}`);
      addLog("Authorization confirmed — agent submitting claim()...");
      const res = await fetch("/api/casper/yield-claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claimerPublicKey: wallet.publicKey }),
      });
      const data = await res.json() as { txHash?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Claim failed");
      setTxMsg(`Yield claimed — tx: ${data.txHash?.slice(0, 16)}…`);
      addLog(`Claim submitted: ${data.txHash?.slice(0, 16)}…`, "text-[#00C853]");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed";
      setTxError(msg); addLog(`Error: ${msg}`, "text-[#FF0000]");
    }
    setClaiming(false);
  }

  // Aggregate all holders across all tokens
  const allHolders: { publicKey: string; bps: number; assetName: string; yieldApy: number; valuation: number }[] = [];
  for (const token of tokens) {
    for (const h of token.holders ?? [{ publicKey: token.owner, bps: 10000 }]) {
      const yieldApy = token.metadata?.yield_apy ?? 0;
      const valuation = token.metadata?.valuation_usd ?? 0;
      allHolders.push({
        publicKey: h.publicKey,
        bps: h.bps,
        assetName: token.metadata?.asset_name ?? `Token #${token.tokenId}`,
        yieldApy,
        valuation,
      });
    }
  }

  // Estimate annual yield per holder (valuation × apy% × share%)
  const totalYieldEstimate = allHolders.reduce((s, h) => {
    return s + (h.valuation * h.yieldApy / 100) * (h.bps / 10000);
  }, 0);

  const availableYieldCspr = contractDeployed
    ? tokens.length > 0 ? `~${(totalYieldEstimate / 100).toFixed(0)} CSPR / yr` : "0 CSPR"
    : "—";

  const pendingPayouts = contractDeployed
    ? tokens.length > 0 ? `${allHolders.length} holder${allHolders.length !== 1 ? "s" : ""}` : "0 claims"
    : "—";

  return (
    <AppLayout
      title="Yield Distribution"
      action={
        <div className="flex gap-2">
          <button onClick={handleClaim} disabled={claiming || !contractDeployed}
            className="hidden sm:flex items-center gap-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#253458] transition-all active:scale-95 disabled:opacity-40">
            <span className="material-symbols-outlined text-sm">savings</span>
            {claiming ? "Signing..." : "Claim My Yield"}
          </button>
          <button onClick={handleDistribute} disabled={distributing || !contractDeployed}
            className="bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all active:scale-95 flex items-center gap-1.5 disabled:opacity-40">
            <span className="material-symbols-outlined text-sm">bolt</span>
            {distributing ? "Signing..." : "Distribute Now"}
          </button>
        </div>
      }
    >
      <div className="p-4 md:p-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[#ebbbb4] text-sm">Automatically split and distribute rental income to all token holders.</p>
          {!wallet.isConnected ? (
            <button onClick={wallet.connect} className="px-3 py-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-xs font-mono rounded-lg">
              {wallet.loading ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <span className="text-[10px] font-mono text-[#00C853]">Connected: {wallet.shortKey}</span>
          )}
        </div>

        {txMsg && <div className="mb-4 p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg text-xs text-[#00C853] font-mono break-all">{txMsg}</div>}
        {txError && <div className="mb-4 p-3 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-lg text-xs text-[#FF0000] font-mono">{txError}</div>}

        <div className="space-y-6">
          {!contractDeployed && (
            <div className="p-4 rounded-xl border border-[#FF0000]/20 bg-[#FF0000]/5 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#FF0000] text-lg shrink-0">warning</span>
              <div>
                <p className="text-sm font-bold text-[#FF0000]">Yield Distributor contract not deployed</p>
                <p className="text-xs text-[#ebbbb4] mt-1">Set <code className="font-mono bg-[#0a192f] px-1 rounded">NEXT_PUBLIC_YIELD_HASH</code> in <code className="font-mono bg-[#0a192f] px-1 rounded">.env.local</code>.</p>
              </div>
            </div>
          )}

          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Available Yield", value: availableYieldCspr, sub: contractDeployed ? "Estimated annual pool" : "Deploy contract first", icon: "payments" },
              { label: "Pending Payouts", value: pendingPayouts, sub: contractDeployed ? "Registered on cap table" : "Deploy contract first", icon: "schedule" },
              { label: "Engine State", value: contractDeployed ? "READY" : "OFFLINE", sub: contractDeployed ? "Contract deployed" : "Awaiting deployment", icon: null, valueColor: contractDeployed ? "text-[#64FFDA]" : "text-[#ebbbb4]", active: contractDeployed },
            ].map((card) => (
              <div key={card.label} className="p-6 rounded-xl flex flex-col justify-between h-36 bg-[#112240] border border-[rgba(100,255,218,0.08)]" style={card.active ? { borderColor: "rgba(100,255,218,0.3)" } : {}}>
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[11px] text-[#ebbbb4] uppercase">{card.label}</span>
                  {card.icon ? <span className="material-symbols-outlined text-[#64FFDA]/40">{card.icon}</span> : <div className={`w-2 h-2 rounded-full ${contractDeployed ? "bg-[#64FFDA] animate-pulse" : "bg-[#ebbbb4]"}`} />}
                </div>
                <div>
                  <div className={`text-2xl font-bold ${(card as { valueColor?: string }).valueColor || "text-[#d8e2ff]"}`}>{card.value}</div>
                  <div className="text-xs mt-1 text-[#ebbbb4]">{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Distribution config + Agent log */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)] space-y-5">
              <h2 className="font-semibold text-[#d8e2ff] flex items-center gap-2">
                <span className="material-symbols-outlined text-[#64FFDA]">tune</span>
                Distribution Logic
              </h2>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-mono text-[11px] uppercase text-[#ebbbb4]">Reserve Fund %</label>
                  <span className="text-[#64FFDA] font-bold">{reserve}%</span>
                </div>
                <input className="w-full h-1.5 bg-[#253453] rounded-lg appearance-none cursor-pointer accent-[#64FFDA]"
                  type="range" min="0" max="50" value={reserve} onChange={(e) => setReserve(Number(e.target.value))} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-mono text-[11px] uppercase text-[#ebbbb4]">Payout Threshold</label>
                  <span className="text-[#64FFDA] font-bold">10 CSPR</span>
                </div>
                <div className="relative">
                  <input className="w-full bg-[#0A192F] border border-[rgba(100,255,218,0.3)] rounded-lg px-4 py-3 focus:border-[#64FFDA] text-[#d8e2ff] font-mono outline-none" type="text" defaultValue="10" />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[#ebbbb4]/40 text-sm">CSPR</span>
                </div>
              </div>
              <div className="pt-3 border-t border-[rgba(100,255,218,0.1)] flex items-center justify-between">
                <div>
                  <span className="block text-[#d8e2ff] font-medium text-sm">Auto-Reinvest</span>
                  <span className="text-xs text-[#ebbbb4]">Agent-driven yield compounding</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" checked={autoReinvest} onChange={(e) => setAutoReinvest(e.target.checked)} className="sr-only peer" />
                  <div className="w-11 h-6 bg-[#253453] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#64FFDA]"></div>
                </label>
              </div>
            </div>

            {/* Agent log */}
            <div className="rounded-xl overflow-hidden border border-[rgba(100,255,218,0.2)] bg-[#112240] flex flex-col">
              <div className="px-4 py-3 border-b border-[rgba(100,255,218,0.15)] bg-[#0a192f]/60 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#64FFDA] text-sm">terminal</span>
                <span className="font-mono text-[11px] text-[#d8e2ff] font-bold uppercase tracking-widest">Monitor Agent Log</span>
                <span className="ml-auto text-[9px] font-mono text-[#64FFDA] animate-pulse">LIVE</span>
              </div>
              <div ref={logRef} className="p-4 font-mono text-[10px] leading-relaxed space-y-1.5 min-h-[160px] max-h-[220px] overflow-y-auto flex-1">
                {logs.map((l, i) => (
                  <div key={i}>
                    <span className="text-[#64FFDA]">[{l.t}]</span>{" "}
                    <span className={l.color ?? "text-[#ebbbb4]/80"}>{l.msg}</span>
                  </div>
                ))}
                {logs.length === 0 && (
                  <div className="flex gap-1 text-[#ebbbb4]/40 mt-2">
                    <div className="w-1 h-3 bg-[#64FFDA] animate-pulse" />
                    <span>Initializing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Recipient Breakdown */}
          <div className="rounded-xl overflow-hidden border border-[rgba(100,255,218,0.08)] bg-[#112240]">
            <div className="px-5 py-4 border-b border-[rgba(100,255,218,0.1)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#64FFDA]">group</span>
              <h2 className="font-semibold text-[#d8e2ff]">Recipient Breakdown</h2>
              <span className="ml-auto text-[10px] font-mono text-[#ebbbb4]">{allHolders.length} holder{allHolders.length !== 1 ? "s" : ""}</span>
            </div>

            {allHolders.length === 0 ? (
              <div className="py-14 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-[#64FFDA]/30 text-5xl">account_tree</span>
                <p className="text-[#d8e2ff] font-semibold">No holders registered</p>
                <p className="text-xs text-[#ebbbb4] max-w-xs">Mint an RWA token and complete the tokenization flow. Holders will appear here once registered in the yield distributor.</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(100,255,218,0.06)]">
                <div className="grid grid-cols-4 px-5 py-2 text-[9px] font-mono uppercase text-[#ebbbb4]">
                  <span>Wallet</span><span>Asset</span><span className="text-right">Share</span><span className="text-right">Est. $/yr</span>
                </div>
                {allHolders.map((h, i) => {
                  const sharePct = (h.bps / 10000) * 100;
                  const annualUsd = (h.valuation * h.yieldApy / 100) * (h.bps / 10000);
                  return (
                    <div key={i} className="grid grid-cols-4 px-5 py-3 text-xs items-center hover:bg-[#0a192f]/30 transition-colors">
                      <span className="font-mono text-[#64FFDA]">{shortKey(h.publicKey)}</span>
                      <span className="text-[#d8e2ff] truncate pr-2">{h.assetName}</span>
                      <div className="text-right">
                        <span className="text-[#d8e2ff] font-bold">{sharePct.toFixed(2)}%</span>
                        <div className="w-full bg-[#253453] rounded-full h-1 mt-1">
                          <div className="bg-[#64FFDA] h-1 rounded-full" style={{ width: `${sharePct}%` }} />
                        </div>
                      </div>
                      <span className="text-right font-mono text-[#00C853]">${annualUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </div>
                  );
                })}
                <div className="px-5 py-3 bg-[#0a192f]/40 flex justify-between items-center text-xs">
                  <span className="text-[#ebbbb4]">Total estimated annual yield</span>
                  <span className="font-bold text-[#00C853]">${totalYieldEstimate.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
