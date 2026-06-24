"use client";
import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { useCasperWallet } from "@/lib/casper-wallet";
import { buildDistributeTransaction, buildClaimTransaction } from "@/lib/contracts";
import { PublicKey } from "casper-js-sdk";

import { CONTRACT_HASHES } from "@/lib/contracts";

const contractDeployed = !!CONTRACT_HASHES.yield;

export default function YieldPage() {
  const wallet = useCasperWallet();
  const [reserve, setReserve] = useState(15);
  const [autoReinvest, setAutoReinvest] = useState(true);
  const [distributing, setDistributing] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [txMsg, setTxMsg] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  async function handleDistribute() {
    if (!wallet.isConnected || !wallet.publicKey) { wallet.connect(); return; }
    setDistributing(true); setTxError(null); setTxMsg(null);
    try {
      const pk = PublicKey.fromHex(wallet.publicKey);
      const tx = buildDistributeTransaction({ sender: pk, chainName: "casper" });
      const hash = await wallet.signAndSubmit(tx);
      setTxMsg(`Distribution triggered — deploy hash: ${hash}`);
    } catch (e) { setTxError(e instanceof Error ? e.message : "Failed"); }
    setDistributing(false);
  }

  async function handleClaim() {
    if (!wallet.isConnected || !wallet.publicKey) { wallet.connect(); return; }
    setClaiming(true); setTxError(null); setTxMsg(null);
    try {
      const pk = PublicKey.fromHex(wallet.publicKey);
      const tx = buildClaimTransaction({ sender: pk, chainName: "casper" });
      const hash = await wallet.signAndSubmit(tx);
      setTxMsg(`Yield claimed — deploy hash: ${hash}`);
    } catch (e) { setTxError(e instanceof Error ? e.message : "Failed"); }
    setClaiming(false);
  }

  return (
    <AppLayout
      title="Yield Distribution"
      action={
        <div className="flex gap-2">
          <button onClick={handleClaim} disabled={claiming}
            className="hidden sm:flex items-center gap-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] px-4 py-2 rounded-lg text-xs font-bold hover:bg-[#253458] transition-all active:scale-95 disabled:opacity-40">
            <span className="material-symbols-outlined text-sm">savings</span>
            {claiming ? "Signing..." : "Claim My Yield"}
          </button>
          <button onClick={handleDistribute} disabled={distributing}
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
          {!wallet.isConnected && (
            <button onClick={wallet.connect} className="px-3 py-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-xs font-mono rounded-lg">
              {wallet.loading ? "Connecting..." : "Connect Wallet"}
            </button>
          )}
          {wallet.isConnected && <span className="text-[10px] font-mono text-[#00C853]">Connected: {wallet.shortKey}</span>}
        </div>
        {txMsg && <div className="mb-4 p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg text-xs text-[#00C853] font-mono break-all">{txMsg}</div>}
        {txError && <div className="mb-4 p-3 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-lg text-xs text-[#FF0000] font-mono">{txError}</div>}

        <div className="space-y-6">
          {/* Contract not deployed warning */}
          {!contractDeployed && (
            <div className="p-4 rounded-xl border border-[#FF0000]/20 bg-[#FF0000]/5 flex items-start gap-3">
              <span className="material-symbols-outlined text-[#FF0000] text-lg shrink-0">warning</span>
              <div>
                <p className="text-sm font-bold text-[#FF0000]">Yield Distributor contract not deployed</p>
                <p className="text-xs text-[#ebbbb4] mt-1">Set <code className="font-mono bg-[#0a192f] px-1 rounded">NEXT_PUBLIC_YIELD_HASH</code> in <code className="font-mono bg-[#0a192f] px-1 rounded">.env.local</code> after deploying.</p>
                <p className="text-[10px] font-mono text-[#ebbbb4] mt-1">Run: <code className="text-[#64FFDA]">cd contracts && make deploy-testnet</code></p>
              </div>
            </div>
          )}

          {/* Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { label: "Available Yield", value: contractDeployed ? "Loading..." : "—", sub: contractDeployed ? "From contract pool" : "Deploy contract first", icon: "payments", subColor: "text-[#ebbbb4]" },
              { label: "Pending Payouts", value: contractDeployed ? "Loading..." : "—", sub: contractDeployed ? "On-chain claims" : "Deploy contract first", icon: "schedule", subColor: "text-[#ebbbb4]" },
              { label: "Engine State", value: contractDeployed ? "READY" : "OFFLINE", sub: contractDeployed ? "Contract deployed" : "Awaiting deployment", icon: null, valueColor: contractDeployed ? "text-[#64FFDA]" : "text-[#ebbbb4]", active: contractDeployed },
            ].map((card) => (
              <div key={card.label} className="p-6 rounded-xl flex flex-col justify-between h-36 bg-[#112240] border border-[rgba(100,255,218,0.08)]" style={card.active ? { borderColor: "rgba(100,255,218,0.3)" } : {}}>
                <div className="flex justify-between items-start">
                  <span className="font-mono text-[11px] text-[#ebbbb4] uppercase">{card.label}</span>
                  {card.icon ? <span className="material-symbols-outlined text-[#64FFDA]/40">{card.icon}</span> : <div className={`w-2 h-2 rounded-full ${contractDeployed ? "bg-[#64FFDA] animate-pulse" : "bg-[#ebbbb4]"}`}></div>}
                </div>
                <div>
                  <div className={`text-2xl font-bold ${card.valueColor || "text-[#d8e2ff]"}`}>{card.value}</div>
                  <div className={`text-xs mt-1 ${card.subColor || "text-[#ebbbb4]"}`}>{card.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Distribution config */}
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
                  type="range" min="0" max="100" value={reserve} onChange={(e) => setReserve(Number(e.target.value))} />
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="font-mono text-[11px] uppercase text-[#ebbbb4]">Payout Threshold</label>
                  <span className="text-[#64FFDA] font-bold">$10.00</span>
                </div>
                <div className="relative">
                  <input className="w-full bg-[#0A192F] border border-[rgba(100,255,218,0.3)] rounded-lg px-4 py-3 focus:border-[#64FFDA] text-[#d8e2ff] font-mono outline-none" type="text" defaultValue="10.00" />
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
            <div className="rounded-xl overflow-hidden border border-[rgba(100,255,218,0.2)] bg-[#112240]">
              <div className="px-4 py-3 border-b border-[rgba(100,255,218,0.15)] bg-[#0a192f]/60 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#64FFDA] text-sm">terminal</span>
                <span className="font-mono text-[11px] text-[#d8e2ff] font-bold uppercase tracking-widest">Monitor Agent Log</span>
                <span className="ml-auto text-[9px] font-mono text-[#64FFDA] animate-pulse">LIVE</span>
              </div>
              <div className="p-4 font-mono text-[10px] leading-relaxed text-[#ebbbb4]/80 space-y-1.5 min-h-[140px]">
                {contractDeployed ? (
                  <>
                    <div><span className="text-[#64FFDA]">[now]</span> Connecting to yield contract...</div>
                    <div className="animate-pulse flex gap-1 mt-2"><div className="w-1 h-3 bg-[#64FFDA]"></div><span>Awaiting contract data...</span></div>
                  </>
                ) : (
                  <>
                    <div><span className="text-[#64FFDA]">[--:--:--]</span> <span className="text-[#FF0000]">Contract not found. Yield distributor offline.</span></div>
                    <div><span className="text-[#64FFDA]">[--:--:--]</span> Deploy contracts and set env vars to activate.</div>
                    <div className="mt-2 flex gap-1 text-[#ebbbb4]/40"><div className="w-1 h-3 bg-[#ebbbb4]/30"></div><span>Idle...</span></div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Recipient Breakdown */}
          <div className="rounded-xl overflow-hidden border border-[rgba(100,255,218,0.08)] bg-[#112240]">
            <div className="px-5 py-4 border-b border-[rgba(100,255,218,0.1)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[#64FFDA]">group</span>
              <h2 className="font-semibold text-[#d8e2ff]">Recipient Breakdown</h2>
            </div>
            {!contractDeployed ? (
              <div className="py-14 flex flex-col items-center gap-3 text-center">
                <span className="material-symbols-outlined text-[#64FFDA]/30 text-5xl">account_tree</span>
                <p className="text-[#d8e2ff] font-semibold">No holders registered</p>
                <p className="text-xs text-[#ebbbb4] max-w-xs">Deploy the yield distributor contract and mint RWA tokens. Token holders will appear here once registered on-chain.</p>
              </div>
            ) : (
              <div className="py-14 flex flex-col items-center gap-3 text-center">
                <div className="w-6 h-6 border-2 border-[#64FFDA] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-xs text-[#ebbbb4]">Loading holders from contract...</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
