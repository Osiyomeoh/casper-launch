"use client";
import Link from "next/link";

export default function ValidatorDetailPage() {
  return (
    <div className="bg-[#011230] text-[#d8e2ff] font-sans min-h-screen flex flex-col max-w-md mx-auto pb-8">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-3 border-b border-[rgba(100,255,218,0.15)] sticky top-0 bg-[#011230]/90 backdrop-blur z-20">
        <Link href="/staking">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
            <span className="material-symbols-outlined text-[#b9c7e4]">arrow_back</span>
          </button>
        </Link>
        <div className="text-center">
          <p className="text-xs font-bold font-mono">Validator_Prime</p>
          <p className="text-[10px] text-[#ebbbb4]">Validator Detail</p>
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
          <span className="material-symbols-outlined text-[#b9c7e4]">more_vert</span>
        </button>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Validator Profile */}
        <div className="p-5 rounded-2xl flex items-center gap-4" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(100,255,218,0.15)" }}>
          <div className="w-16 h-16 rounded-2xl bg-[#64FFDA]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[#64FFDA] text-4xl">hub</span>
          </div>
          <div>
            <h1 className="text-lg font-bold">Validator_Prime</h1>
            <p className="text-[10px] font-mono text-[#ebbbb4]">0x5A2...Validator_Prime_Key</p>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>
              <span className="text-[10px] text-[#00C853]">Active — 99% Uptime</span>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Your Stake", value: "250,000 CSPR", color: "text-[#64FFDA]" },
            { label: "APY", value: "8.4%", color: "text-[#00C853]" },
            { label: "Monthly Rewards", value: "$1,750.00", color: "text-[#d8e2ff]" },
            { label: "Commission", value: "5%", color: "text-[#ebbbb4]" },
            { label: "Total Delegated", value: "12.4M CSPR", color: "text-[#d8e2ff]" },
            { label: "Rank", value: "#3 / 100", color: "text-[#64FFDA]" },
          ].map((stat) => (
            <div key={stat.label} className="p-4 rounded-xl" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <p className="text-[10px] text-[#ebbbb4] font-mono uppercase mb-1">{stat.label}</p>
              <p className={`text-base font-bold ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Network Health */}
        <div className="p-4 rounded-2xl space-y-3" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs font-bold">Network Health Analytics</p>
          {[
            { label: "Uptime (30D)", value: 99, color: "#00C853" },
            { label: "Block Participation", value: 98, color: "#00C853" },
            { label: "Slash Risk", value: 2, color: "#00C853", invert: true },
          ].map((metric) => (
            <div key={metric.label} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-[#ebbbb4]">{metric.label}</span>
                <span className="font-mono font-bold" style={{ color: metric.color }}>{metric.value}%</span>
              </div>
              <div className="w-full h-1.5 bg-[#253453] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${metric.invert ? metric.value : metric.value}%`, background: metric.color }}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Rewards History */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-xs font-bold mb-3">Rewards History</p>
          <div className="space-y-2">
            {[
              { period: "Nov 2026", amount: "$1,750.00" },
              { period: "Oct 2026", amount: "$1,680.00" },
              { period: "Sep 2026", amount: "$1,710.00" },
            ].map((r) => (
              <div key={r.period} className="flex justify-between items-center text-xs">
                <span className="text-[#ebbbb4] font-mono">{r.period}</span>
                <span className="text-[#00C853] font-bold">{r.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          <button className="flex-1 py-4 bg-[#FF0000] text-white font-bold rounded-2xl text-sm active:scale-95 transition-all shadow-[0_0_20px_rgba(255,0,0,0.2)]">
            Add Stake
          </button>
          <button className="flex-1 py-4 border border-[#FF0000]/30 text-[#FF0000] font-bold rounded-2xl text-sm active:scale-95 transition-colors hover:bg-[#FF0000]/5">
            Undelegate
          </button>
        </div>
      </div>
    </div>
  );
}
