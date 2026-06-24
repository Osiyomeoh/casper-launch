"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { useWallets } from "@privy-io/react-auth";

const EXPLORER = "https://cspr.live";

type Validator = {
  publicKey: string;
  stakedAmount: string;
  delegationRate: number;
  delegatorCount: number;
  inactive: boolean;
};

// Format CSPR from motes
function motesToCspr(motes: string) {
  const n = Number(BigInt(motes) / BigInt(1_000_000_000));
  return n.toLocaleString();
}

// Estimate APY: base 6% + bonus for smaller delegation rate
function estimateApy(delegationRate: number) {
  return (8.5 - delegationRate * 0.01).toFixed(1);
}

export default function StakingPage() {
  const { wallets } = useWallets();
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stakeAmount, setStakeAmount] = useState("");
  const [selectedValidator, setSelectedValidator] = useState(0);

  useEffect(() => {
    fetch("/api/casper/validators")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) { setError(d.error); } else { setValidators(d.validators); }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const topValidators = validators.slice(0, 10);
  const walletAddress = wallets[0]?.address;

  const monthlyEarnings = stakeAmount
    ? (parseFloat(stakeAmount.replace(/,/g, "")) * 0.007).toFixed(2)
    : "0.00";

  return (
    <AppLayout
      title="Staking"
      action={
        <a
          href={`${EXPLORER}/validators`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-2 border border-[rgba(100,255,218,0.3)] text-[#64FFDA] px-4 py-2 rounded-lg text-xs font-mono hover:bg-[#64FFDA]/5 transition-all"
        >
          <span className="material-symbols-outlined text-sm">open_in_new</span>
          cspr.live
        </a>
      }
    >
      <div className="p-4 md:p-8 space-y-6">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Validators Found", value: loading ? "..." : validators.length.toString(), sub: "Active on mainnet", icon: "hub", valueColor: "text-[#64FFDA]" },
            { label: "Top APY", value: topValidators.length ? `${estimateApy(topValidators[0]?.delegationRate ?? 10)}%` : "—", sub: "Lowest commission", icon: "percent", valueColor: "text-[#00C853]" },
            { label: "Avg Commission", value: topValidators.length ? `${Math.round(topValidators.slice(0, 10).reduce((a, v) => a + v.delegationRate, 0) / 10)}%` : "—", icon: "tune" },
            { label: "Network Stake", value: topValidators.length ? `${motesToCspr(topValidators[0]?.stakedAmount ?? "0")} CSPR` : "—", sub: "Top validator", icon: "account_balance_wallet" },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-xl relative overflow-hidden" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="absolute top-2 right-2 opacity-10">
                <span className="material-symbols-outlined text-4xl text-[#64FFDA]">{card.icon}</span>
              </div>
              <p className="font-mono text-[9px] text-[#ebbbb4] uppercase tracking-widest mb-2">{card.label}</p>
              <span className={`text-lg font-bold ${(card as any).valueColor || "text-[#d8e2ff]"}`}>{card.value}</span>
              {card.sub && <p className="text-[10px] mt-1 text-[#ebbbb4]">{card.sub}</p>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Validator list */}
          <div className="lg:col-span-2 rounded-xl overflow-hidden border border-[rgba(100,255,218,0.2)]" style={{ background: "rgba(17,34,64,0.7)" }}>
            <div className="px-4 py-3 border-b border-[rgba(100,255,218,0.15)] flex items-center justify-between">
              <h3 className="font-bold text-sm">Live Validators — Casper Mainnet</h3>
              {loading && <span className="text-[9px] font-mono text-[#ebbbb4] animate-pulse">Loading from RPC...</span>}
              {error && <span className="text-[9px] font-mono text-[#FF0000]">RPC unavailable</span>}
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-[rgba(100,255,218,0.08)]">
              {loading ? (
                Array(4).fill(0).map((_, i) => (
                  <div key={i} className="p-4 animate-pulse space-y-2">
                    <div className="h-3 bg-[#253453] rounded w-3/4"></div>
                    <div className="h-2 bg-[#253453] rounded w-1/2"></div>
                  </div>
                ))
              ) : topValidators.map((v, i) => (
                <div key={v.publicKey} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-[#64FFDA]/10 flex items-center justify-center text-[10px] font-mono text-[#64FFDA]">{i + 1}</div>
                      <a href={`${EXPLORER}/validator/${v.publicKey}`} target="_blank" rel="noopener noreferrer"
                        className="font-mono text-[10px] text-[#64FFDA] hover:underline">
                        {v.publicKey.slice(0, 10)}...{v.publicKey.slice(-6)}
                      </a>
                    </div>
                    <span className="text-[10px] text-[#00C853] font-bold">{estimateApy(v.delegationRate)}% APY</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-[10px]">
                    <div><p className="text-[#ebbbb4]">Staked</p><p className="font-mono">{motesToCspr(v.stakedAmount)}</p></div>
                    <div><p className="text-[#ebbbb4]">Commission</p><p className="font-mono">{v.delegationRate}%</p></div>
                    <div><p className="text-[#ebbbb4]">Delegators</p><p className="font-mono">{v.delegatorCount}</p></div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#000d27]/30 text-[#ebbbb4] font-mono text-[9px] uppercase tracking-widest">
                  <tr>
                    {["#", "Public Key", "Staked (CSPR)", "Commission", "Delegators", "Est. APY", ""].map((h) => (
                      <th key={h} className="px-4 py-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(100,255,218,0.08)] text-xs">
                  {loading ? (
                    Array(5).fill(0).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array(7).fill(0).map((_, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-3 bg-[#253453] rounded w-20"></div></td>
                        ))}
                      </tr>
                    ))
                  ) : topValidators.map((v, i) => (
                    <tr key={v.publicKey} className={`hover:bg-[#253453]/30 transition-colors ${selectedValidator === i ? "bg-[#192a48]" : ""}`}>
                      <td className="px-4 py-3 font-mono text-[#ebbbb4]">{i + 1}</td>
                      <td className="px-4 py-3">
                        <a href={`${EXPLORER}/validator/${v.publicKey}`} target="_blank" rel="noopener noreferrer"
                          className="font-mono text-[10px] text-[#64FFDA] hover:underline">
                          {v.publicKey.slice(0, 12)}...{v.publicKey.slice(-8)}
                        </a>
                      </td>
                      <td className="px-4 py-3 font-mono">{motesToCspr(v.stakedAmount)}</td>
                      <td className="px-4 py-3 font-mono">{v.delegationRate}%</td>
                      <td className="px-4 py-3 font-mono">{v.delegatorCount}</td>
                      <td className="px-4 py-3 text-[#00C853] font-bold">{estimateApy(v.delegationRate)}%</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setSelectedValidator(i)}
                          className="px-2 py-1 bg-[#253453] text-[10px] text-[#d8e2ff] rounded hover:bg-[#293958] transition-colors"
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Stake Panel */}
          <div className="p-5 rounded-xl space-y-4 border border-[#64FFDA]/20" style={{ background: "rgba(17,34,64,0.7)" }}>
            <h3 className="font-bold text-sm">Delegate CSPR</h3>

            {walletAddress ? (
              <div className="p-2 bg-[#011230]/50 rounded-lg border border-[rgba(100,255,218,0.15)] text-[9px] font-mono text-[#64FFDA]">
                {walletAddress.slice(0, 14)}...{walletAddress.slice(-8)}
              </div>
            ) : (
              <div className="p-2 bg-[#FF0000]/10 rounded-lg border border-[#FF0000]/20 text-[9px] font-mono text-[#FF0000]">
                Connect wallet to delegate
              </div>
            )}

            <div>
              <label className="text-[10px] text-[#ebbbb4] font-mono uppercase mb-1 block">Amount (CSPR)</label>
              <input
                type="text"
                placeholder="0.00"
                value={stakeAmount}
                onChange={(e) => setStakeAmount(e.target.value)}
                className="w-full bg-[#000d27] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2.5 font-mono text-[#d8e2ff] focus:outline-none focus:ring-1 focus:ring-[#64FFDA] text-sm"
              />
            </div>

            <div>
              <label className="text-[10px] text-[#ebbbb4] font-mono uppercase mb-1 block">Validator</label>
              <select
                value={selectedValidator}
                onChange={(e) => setSelectedValidator(Number(e.target.value))}
                className="w-full bg-[#000d27] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2.5 font-mono text-[#d8e2ff] focus:outline-none focus:ring-1 focus:ring-[#64FFDA] text-xs"
              >
                {topValidators.map((v, i) => (
                  <option key={v.publicKey} value={i}>
                    {v.publicKey.slice(0, 10)}... — {estimateApy(v.delegationRate)}% APY
                  </option>
                ))}
                {!topValidators.length && <option>Loading validators...</option>}
              </select>
            </div>

            <div className="p-3 bg-[#64FFDA]/5 rounded-lg border border-[#64FFDA]/20 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#ebbbb4]">Est. Monthly Earnings</span>
                <span className="text-[#64FFDA] font-mono font-bold">${monthlyEarnings}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#ebbbb4]">Commission Rate</span>
                <span className="text-[#d8e2ff] font-mono">{topValidators[selectedValidator]?.delegationRate ?? "—"}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#ebbbb4]">Unbonding Period</span>
                <span className="text-[#d8e2ff] font-mono">14 days</span>
              </div>
            </div>

            {topValidators[selectedValidator] && (
              <a
                href={`${EXPLORER}/validator/${topValidators[selectedValidator].publicKey}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 w-full py-2 border border-[rgba(100,255,218,0.2)] rounded-lg text-[10px] font-mono text-[#64FFDA] hover:bg-[#64FFDA]/5 transition-colors"
              >
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                View Validator on cspr.live
              </a>
            )}

            <button className="w-full py-3 bg-[#FF0000] text-white font-bold rounded-xl text-sm active:scale-95 transition-all hover:brightness-110">
              Delegate Stake
            </button>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
