"use client";
import Link from "next/link";
import { useEffect, useState } from "react";

const ASSETS = [
  { id: "CS-9921-A", name: "1248 Alpine Terrace", value: "$4.25M", change: "+12.4%", changeUp: true, status: "LIVE", statusColor: "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20", barColor: "bg-[#64FFDA] shadow-[0_0_8px_rgba(100,255,218,0.5)]", barWidth: "w-2/3", icon: "apartment" },
  { id: "AU-7712-B", name: "Vaulted Gold #0042", value: "$892K", change: "+2.1%", changeUp: true, status: "AUDIT", statusColor: "bg-[#3c4962] text-[#abb9d6] border-[rgba(100,255,218,0.15)]", barColor: "bg-[#3c4962]", barWidth: "w-full", icon: "diamond" },
  { id: "AG-4402-V", name: "GreenVine Estates", value: "$1.18M", change: "0.0%", changeUp: false, status: "PENDING", statusColor: "bg-[#FF0000]/10 text-[#FF0000] border-[#FF0000]/20", barColor: "bg-[#FF0000]", barWidth: "w-1/4", icon: "eco" },
  { id: "CS-2210-P", name: "Orizon Tech Plaza", value: "$12.5M", change: "+18.7%", changeUp: true, status: "LIVE", statusColor: "bg-[#00C853]/10 text-[#00C853] border-[#00C853]/20", barColor: "bg-[#64FFDA] shadow-[0_0_8px_rgba(100,255,218,0.5)]", barWidth: "w-4/5", icon: "domain" },
];

const AGENT_LOGS_INIT = [
  "> Monitoring 14 asset oracles...",
  "> Real-time valuation update complete.",
  "> No anomalies detected in current block.",
];

const EXTRA_LOGS = [
  "> Verifying proof-of-reserve for Gold #0042...",
  "> Fetching market price for Alpine Terrace...",
  "> Block consensus achieved (Block #8,212,104).",
  "> Re-balancing asset performance indicators...",
  "> Security audit for 'GreenVine' initiated.",
];

export default function PortfolioPage() {
  const [agentLogs, setAgentLogs] = useState(AGENT_LOGS_INIT);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const interval = setInterval(() => {
      setAgentLogs((prev) => {
        const next = [...prev, EXTRA_LOGS[Math.floor(Math.random() * EXTRA_LOGS.length)]];
        return next.length > 4 ? next.slice(-4) : next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = ASSETS.filter((a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.id.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex flex-col min-h-screen bg-[#011230] text-[#d8e2ff] font-sans" style={{ minHeight: "max(884px, 100dvh)" }}>
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-[#011230]/80 backdrop-blur-md flex justify-between items-center px-4 border-b border-[rgba(100,255,218,0.15)]">
        <Link href="/">
          <h1 className="text-2xl font-semibold font-sans tracking-tight text-[#d8e2ff] cursor-pointer">Portfolio</h1>
        </Link>
        <Link href="/chat">
          <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#ff5540] text-white active:scale-95 transition-transform">
            <span className="material-symbols-outlined">add</span>
          </button>
        </Link>
      </header>

      <main className="mt-16 mb-20 px-4 flex-grow">
        {/* Search */}
        <section className="py-4 sticky top-16 bg-[#011230] z-40">
          <div className="relative mb-4">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[#ebbbb4] text-sm">search</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-4 bg-[#000d27] border border-[rgba(100,255,218,0.15)] rounded-lg text-base focus:outline-none focus:border-[#64FFDA] focus:ring-1 focus:ring-[#64FFDA] transition-all placeholder:text-[#ebbbb4]/50 text-[#d8e2ff]"
              placeholder="Search assets, IDs..."
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            {["All", "Real Estate", "Gold", "Agriculture"].map((tag, i) => (
              <button key={tag} className={`whitespace-nowrap px-4 py-1.5 rounded-full font-mono text-xs border transition-colors ${i === 0 ? "bg-[#3c4962] text-[#64FFDA] border-[#64FFDA]/30" : "bg-[#091b39] text-[#ebbbb4] border-[rgba(100,255,218,0.15)] hover:text-[#64FFDA]"}`}>
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* Asset List */}
        <div className="space-y-4 pb-8">
          {filtered.map((asset) => (
            <div key={asset.id} className="glass-panel rounded-xl overflow-hidden active:scale-[0.98] transition-transform" style={{ border: "1px solid rgba(100,255,218,0.1)" }}>
              <div className="flex items-center p-3 gap-3">
                <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-[#253453] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#64FFDA] text-3xl">{asset.icon}</span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex justify-between items-start">
                    <h3 className="text-[#d8e2ff] font-semibold truncate leading-tight pr-2">{asset.name}</h3>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${asset.statusColor}`}>{asset.status}</span>
                  </div>
                  <p className="font-mono text-xs text-[#ebbbb4] mt-1">ID: {asset.id}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[#d8e2ff] font-bold text-lg">{asset.value}</span>
                    <span className={`text-sm font-semibold flex items-center ${asset.changeUp ? "text-[#00C853]" : "text-[#ebbbb4]"}`}>
                      <span className="material-symbols-outlined text-sm mr-0.5">{asset.changeUp ? "trending_up" : "horizontal_rule"}</span>
                      {asset.change}
                    </span>
                  </div>
                </div>
              </div>
              <div className="bg-[#64FFDA]/5 h-1 w-full relative">
                <div className={`absolute top-0 left-0 h-full ${asset.barColor} ${asset.barWidth}`}></div>
              </div>
            </div>
          ))}
        </div>

        {/* Agent Status */}
        <div className="mt-4 p-4 border border-[rgba(100,255,218,0.15)] bg-[#091b39]/50 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-[#64FFDA]" style={{ animation: "pulse-cyan 2s infinite" }}></div>
            <span className="text-sm font-semibold text-[#64FFDA] uppercase tracking-widest">Agent Active</span>
          </div>
          <div className="font-mono text-xs text-[#ebbbb4]/80 space-y-1">
            {agentLogs.map((log, i) => <p key={i} className="transition-opacity duration-500">{log}</p>)}
          </div>
        </div>
      </main>

      {/* Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 h-16 bg-[#0e1f3d]/90 backdrop-blur-xl border-t border-[rgba(100,255,218,0.15)] flex items-center justify-around px-4 z-50 md:hidden">
        {[
          { icon: "dashboard", label: "Home", href: "/" },
          { icon: "account_balance_wallet", label: "Assets", href: "/portfolio", active: true },
          { icon: "swap_horiz", label: "Trade", href: "#" },
          { icon: "insights", label: "Oracle", href: "#" },
          { icon: "person", label: "Profile", href: "#" },
        ].map((item) => (
          <Link href={item.href} key={item.label}>
            <button className={`flex flex-col items-center gap-1 transition-all ${item.active ? "text-[#64FFDA]" : "text-[#abb9d6]"}`}>
              <span className="material-symbols-outlined" style={item.active ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
              <span className="font-mono text-[10px]">{item.label}</span>
            </button>
          </Link>
        ))}
      </nav>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-64 h-32 bg-[#64FFDA]/10 blur-[60px] pointer-events-none -z-10"></div>
    </div>
  );
}
