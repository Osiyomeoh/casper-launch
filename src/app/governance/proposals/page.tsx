"use client";
import Link from "next/link";
import { useState } from "react";

export default function ProposalDetailPage() {
  const [voted, setVoted] = useState<"for" | "against" | null>(null);

  return (
    <div className="bg-[#011230] text-[#d8e2ff] font-sans min-h-screen flex flex-col max-w-md mx-auto pb-8">
      {/* Header */}
      <header className="flex justify-between items-center px-4 py-3 border-b border-[rgba(100,255,218,0.15)] sticky top-0 bg-[#011230]/90 backdrop-blur z-20">
        <Link href="/governance">
          <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
            <span className="material-symbols-outlined text-[#b9c7e4]">arrow_back</span>
          </button>
        </Link>
        <div className="text-center">
          <p className="text-xs font-bold font-mono text-[#64FFDA]">CP-142</p>
          <p className="text-[10px] text-[#ebbbb4]">Proposal Detail</p>
        </div>
        <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
          <span className="material-symbols-outlined text-[#b9c7e4]">share</span>
        </button>
      </header>

      <div className="px-4 pt-4 space-y-4">
        {/* Status Banner */}
        <div className="flex items-center justify-between p-4 rounded-2xl" style={{ background: "rgba(100,255,218,0.05)", border: "1px solid rgba(100,255,218,0.2)" }}>
          <div>
            <p className="text-[10px] text-[#ebbbb4] font-mono uppercase">Status</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#64FFDA] animate-pulse"></span>
              <span className="text-sm font-bold text-[#64FFDA]">Active — Voting Open</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#ebbbb4] font-mono uppercase">Ends</p>
            <p className="text-sm font-bold">Nov 28, 2026</p>
          </div>
        </div>

        {/* Title */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] text-[#ebbbb4] font-mono uppercase mb-2">Proposal</p>
          <h1 className="text-lg font-bold leading-tight">Increase Reserve Fund Threshold from 5% to 10% of Total Asset Value</h1>
          <p className="text-xs text-[#ebbbb4] mt-3 leading-relaxed">
            This proposal aims to strengthen the protocol's liquidity buffer by doubling the reserve fund threshold. The increase would apply to all tokenized real estate assets under management, ensuring greater stability during market downturns.
          </p>
        </div>

        {/* Vote Breakdown */}
        <div className="p-4 rounded-2xl space-y-3" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
          <p className="text-[10px] text-[#ebbbb4] font-mono uppercase">Current Vote Tally</p>
          {[
            { label: "For", value: 68, color: "#00C853" },
            { label: "Against", value: 22, color: "#FF0000" },
            { label: "Abstain", value: 10, color: "#ebbbb4" },
          ].map((v) => (
            <div key={v.label} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-[#ebbbb4]">{v.label}</span>
                <span className="font-mono font-bold" style={{ color: v.color }}>{v.value}%</span>
              </div>
              <div className="w-full h-2 bg-[#253453] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${v.value}%`, background: v.color }}></div>
              </div>
            </div>
          ))}
          <div className="flex justify-between pt-2 border-t border-[rgba(100,255,218,0.15)]">
            <span className="text-[10px] text-[#ebbbb4] font-mono">Quorum: 82% / 66% required</span>
            <span className="text-[10px] text-[#00C853] font-mono font-bold">ON TRACK</span>
          </div>
        </div>

        {/* AI Recommendation */}
        <div className="p-4 rounded-2xl" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(100,255,218,0.2)" }}>
          <div className="flex items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[#64FFDA] text-lg">smart_toy</span>
            <p className="text-xs font-bold">AI Agent Recommendation</p>
          </div>
          <div className="font-mono text-[11px] text-[#64FFDA]/80 space-y-1">
            <p>&gt;&gt; Portfolio risk exposure: MODERATE</p>
            <p>&gt;&gt; Reserve health score: 72/100</p>
            <p className="text-[#00C853]">[RECOMMEND] Vote FOR — reserve increase reduces drawdown risk by est. 18%</p>
          </div>
        </div>

        {/* Vote Buttons */}
        {voted === null ? (
          <div className="flex gap-3">
            <button
              onClick={() => setVoted("for")}
              className="flex-1 py-4 bg-[#00C853] text-[#001a00] font-bold rounded-2xl text-sm active:scale-95 transition-all shadow-[0_0_20px_rgba(0,200,83,0.2)]"
            >
              Vote For
            </button>
            <button
              onClick={() => setVoted("against")}
              className="flex-1 py-4 bg-[#FF0000] text-white font-bold rounded-2xl text-sm active:scale-95 transition-all shadow-[0_0_20px_rgba(255,0,0,0.2)]"
            >
              Vote Against
            </button>
          </div>
        ) : (
          <div className="p-4 rounded-2xl text-center" style={{ background: voted === "for" ? "rgba(0,200,83,0.1)" : "rgba(255,0,0,0.1)", border: `1px solid ${voted === "for" ? "rgba(0,200,83,0.3)" : "rgba(255,0,0,0.3)"}` }}>
            <span className="material-symbols-outlined text-3xl mb-2 block" style={{ color: voted === "for" ? "#00C853" : "#FF0000" }}>
              {voted === "for" ? "thumb_up" : "thumb_down"}
            </span>
            <p className="font-bold text-sm">Vote Submitted — {voted === "for" ? "For" : "Against"}</p>
            <p className="text-[10px] text-[#ebbbb4] font-mono mt-1">42,500 VP allocated to CP-142</p>
          </div>
        )}
      </div>
    </div>
  );
}
