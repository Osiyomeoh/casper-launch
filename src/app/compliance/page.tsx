"use client";
import { useState } from "react";
import AppLayout from "../components/AppLayout";

const AUDIT_ROWS = [
  { time: "2026-11-24 14:02:11", asset: "RE-MIA-4022", event: "Income Distribution", agent: "YLD-AUDIT-04", status: "Verified", tx: "0x7a2...f3b9" },
  { time: "2026-11-24 13:58:45", asset: "TB-US-G10-90D", event: "Price Update", agent: "ORC-SENT-01", status: "Verified", tx: "0xb42...11d2" },
  { time: "2026-11-24 13:45:12", asset: "KYC-USER-9921", event: "Identity Check", agent: "KYC-VAL-02", status: "Pending", tx: "0x9c4...a04e" },
  { time: "2026-11-24 13:30:00", asset: "RE-LON-1002", event: "Price Update", agent: "ORC-SENT-01", status: "Verified", tx: "0x12f...ee81" },
];

export default function CompliancePage() {
  const [activeRow, setActiveRow] = useState(0);

  return (
    <AppLayout
      title="Compliance & Audit"
      action={
        <button className="hidden sm:flex items-center gap-2 bg-[#253453] px-4 py-2 rounded-lg text-xs font-bold text-[#d8e2ff] hover:bg-[#293958] transition-colors">
          <span className="material-symbols-outlined text-sm">download</span>
          Export Report
        </button>
      }
    >
      <div className="p-4 md:p-8 space-y-6">
        {/* Subtitle */}
        <p className="text-[#ebbbb4] text-sm">Every action your AI agent takes is recorded on-chain and auditable in real time.</p>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Last 24 Hours", options: ["Last 24 Hours", "Last 7 Days", "This Quarter"] },
            { label: "All Assets", options: ["All Assets", "Real Estate", "T-Bills"] },
            { label: "All Agents", options: ["All Agents", "Oracle Sentinel", "KYC Validator"] },
          ].map((f) => (
            <div key={f.label} className="flex items-center gap-2 bg-[#112240] px-3 py-2 rounded-lg border border-[rgba(100,255,218,0.15)] text-xs">
              <select className="bg-transparent border-none text-[#d8e2ff] focus:ring-0 cursor-pointer font-mono text-xs">
                {f.options.map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Total Events Logged", value: "1,284,092", sub: "+12.5% vs last period", subColor: "text-[#00C853]", icon: "visibility" },
            { label: "Issues Detected", value: "0", sub: "System secure", dot: true, icon: "warning", labelColor: "text-[#FF0000]", valueColor: "text-[#FF0000]" },
            { label: "Verification Rate", value: "100%", icon: "verified_user", bar: true, valueColor: "text-[#64FFDA]" },
          ].map((card) => (
            <div key={card.label} className="rounded-xl p-5 relative overflow-hidden group" style={{ background: "rgba(17,34,64,0.7)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="absolute top-3 right-3 opacity-10 group-hover:opacity-20 transition-opacity">
                <span className="material-symbols-outlined text-5xl text-[#ffb4a8]">{card.icon}</span>
              </div>
              <p className={`font-mono text-[10px] uppercase tracking-wider ${card.labelColor || "text-[#ebbbb4]"}`}>{card.label}</p>
              <h3 className={`text-3xl font-bold mt-2 ${card.valueColor || "text-[#d8e2ff]"}`}>{card.value}</h3>
              {card.bar && <div className="mt-3 w-full bg-[#253453] h-1 rounded-full overflow-hidden"><div className="bg-[#64FFDA] h-full w-full"></div></div>}
              {card.dot && <div className="mt-3 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse"></span><span className="text-[#ebbbb4] text-[10px]">No issues found</span></div>}
              {card.sub && !card.dot && <p className={`mt-3 text-xs ${card.subColor}`}>{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* Table + Proof — stacks on mobile */}
        <div className="flex flex-col xl:flex-row gap-6">
          {/* Table */}
          <div className="flex-1 rounded-xl overflow-hidden border border-[rgba(100,255,218,0.2)] min-w-0" style={{ background: "rgba(17,34,64,0.7)" }}>
            <div className="px-5 py-3 border-b border-[rgba(100,255,218,0.15)] bg-[#112240]/50 flex justify-between items-center">
              <h4 className="font-bold text-sm text-[#d8e2ff]">Audit Log</h4>
              <span className="bg-[#64FFDA]/10 text-[#64FFDA] text-[10px] px-2 py-0.5 rounded font-mono border border-[#64FFDA]/20">LIVE</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-[#000d27]/30 text-[#ebbbb4] font-mono text-[10px] uppercase tracking-widest">
                  <tr>
                    {["Time", "Asset", "Event", "Agent", "Status", "Tx"].map((h) => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(100,255,218,0.1)] text-sm">
                  {AUDIT_ROWS.map((row, i) => (
                    <tr key={i} onClick={() => setActiveRow(i)}
                      className={`cursor-pointer transition-colors ${i === activeRow ? "bg-[#64FFDA]/5 border-l-2 border-l-[#64FFDA]" : "hover:bg-[#253453]/30"}`}>
                      <td className="px-4 py-3 font-mono text-[10px] text-[#ebbbb4] whitespace-nowrap">{row.time.split(" ")[1]}</td>
                      <td className="px-4 py-3 font-mono text-xs text-[#ffb4a8] whitespace-nowrap">{row.asset}</td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">{row.event}</td>
                      <td className="px-4 py-3 font-mono text-[10px] text-[#ebbbb4] whitespace-nowrap">{row.agent}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${row.status === "Verified" ? "bg-[#00C853] text-white" : "bg-[#253453] text-[#ebbbb4]"}`}>{row.status}</span>
                      </td>
                      <td className="px-4 py-3"><a href="#" className="text-[#64FFDA] hover:underline font-mono text-[10px]">{row.tx}</a></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 bg-[#000d27]/20 flex items-center justify-between">
              <p className="text-[10px] text-[#ebbbb4] font-mono">1–4 of 1,284,092</p>
              <div className="flex gap-2">
                <button className="w-7 h-7 flex items-center justify-center rounded bg-[#112240] border border-[rgba(100,255,218,0.2)] text-[#ebbbb4] disabled:opacity-40" disabled>
                  <span className="material-symbols-outlined text-sm">chevron_left</span>
                </button>
                <button className="w-7 h-7 flex items-center justify-center rounded bg-[#112240] border border-[rgba(100,255,218,0.2)] text-[#d8e2ff]">
                  <span className="material-symbols-outlined text-sm">chevron_right</span>
                </button>
              </div>
            </div>
          </div>

          {/* Proof Panel */}
          <div className="w-full xl:w-80 rounded-xl overflow-hidden border border-[#64FFDA]/20" style={{ background: "rgba(17,34,64,0.7)" }}>
            <div className="p-4 border-b border-[rgba(100,255,218,0.15)] bg-[#112240]/80 flex items-center justify-between">
              <h4 className="font-bold text-sm">Proof of Compliance</h4>
              <span className="material-symbols-outlined text-[#64FFDA] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
            </div>
            <div className="p-4 font-mono text-[11px] text-[#64FFDA]/80 space-y-1.5 bg-[#000d27] min-h-[200px]">
              <p className="text-[#ebbbb4]">[ANALYSIS] {AUDIT_ROWS[activeRow].event} — {AUDIT_ROWS[activeRow].asset}</p>
              <p>&gt;&gt; Querying contract state for {AUDIT_ROWS[activeRow].tx}</p>
              <p>&gt;&gt; Fetching income data from oracle: Verified</p>
              <p>&gt;&gt; Running calculation cross-check...</p>
              <p className="text-[#00C853]">[MATCH] Values align within 0.001% tolerance</p>
              <p>&gt;&gt; Generating cryptographic proof for audit trail.</p>
              <p className="text-[#00C853]">[FINAL] Compliance verified. Committing on-chain.</p>
            </div>
            <div className="p-4 space-y-2 border-t border-[rgba(100,255,218,0.15)]">
              {[
                { label: "Oracle Latency", value: "14ms", color: "text-[#00C853]" },
                { label: "Confidence", value: "99.98%", color: "text-[#d8e2ff]" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between text-[11px] font-mono">
                  <span className="text-[#ebbbb4]">{item.label}</span>
                  <span className={item.color}>{item.value}</span>
                </div>
              ))}
              <button className="w-full mt-2 bg-[#253453] border border-[rgba(100,255,218,0.2)] py-2 rounded text-[11px] font-bold text-[#d8e2ff] hover:bg-[#293958] transition-all">
                View Raw Proof
              </button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
