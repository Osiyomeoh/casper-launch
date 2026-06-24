"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const NAV_ITEMS = [
  { icon: "business", label: "Entity Setup", href: "/chat" },
  { icon: "toll", label: "Asset Details", href: "#" },
  { icon: "gavel", label: "Legal Review", href: "/contract" },
  { icon: "verified_user", label: "Compliance", href: "#" },
  { icon: "rocket_launch", label: "Launch", href: "/deploy", active: true },
];

const INITIAL_LOGS = [
  { time: "14:22:01", text: "Initializing Casper Virtual Machine...", color: "opacity-50" },
  { time: "14:22:03", text: "Optimizing byte-code for institutional-standard safety checks.", color: "opacity-50" },
  { time: "14:22:05", text: "Compilation complete. Build ID: casper-launch-v1.deploy", color: "text-[#00C853]" },
  { time: "14:22:07", text: "Gas limit calculated: 2.500000000 CSPR", color: "text-[#00C853]" },
  { time: "14:22:10", text: "Connecting to CSPR.click extension...", color: "animate-pulse" },
  { time: "14:22:12", text: "REQUEST: User authorization for Deploy Hash: b508...a2f1", color: "text-[#d8e2ff]" },
];

const PHRASES = [
  "Synchronizing with Casper global state...",
  "Validating signature integrity...",
  "Awaiting consensus on block height 2,149,022...",
  "Agent analyzing peer response times...",
  "Optimizing gas consumption parameters...",
];

export default function DeployPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const [logs, setLogs] = useState(INITIAL_LOGS);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        const now = new Date();
        const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}:${now.getSeconds().toString().padStart(2,"0")}`;
        setLogs((prev) => {
          const next = [...prev, { time, text: PHRASES[Math.floor(Math.random() * PHRASES.length)], color: "opacity-30 italic" }];
          return next.length > 20 ? next.slice(-20) : next;
        });
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  return (
    <div className="bg-[#011230] text-[#d8e2ff] font-sans min-h-screen flex">
      {/* Sidebar */}
      <aside className="flex flex-col fixed left-0 top-0 h-full z-40 bg-[#0e1f3d] border-r border-[rgba(100,255,218,0.15)] backdrop-blur-xl w-64">
        <div className="p-6">
          <Link href="/"><h1 className="text-2xl font-bold text-[#d8e2ff] cursor-pointer">CasperLaunch</h1></Link>
          <div className="mt-8 flex items-center gap-3 p-3 glass-panel rounded-lg border-[#64FFDA]/20">
            <div className="relative">
              <span className="material-symbols-outlined text-[#64FFDA] text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-[#64FFDA] rounded-full animate-pulse border-2 border-[#0e1f3d]"></span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#d8e2ff] leading-tight">Deploy Agent</p>
              <p className="font-mono text-xs text-[#64FFDA]/60 uppercase">Institutional Flow</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 mt-4">
          {NAV_ITEMS.map((item) => (
            <Link href={item.href} key={item.label}>
              <div className={`py-3 px-4 flex items-center gap-3 transition-all cursor-pointer ${item.active ? "bg-[#3c4962]/30 text-[#64FFDA] border-l-4 border-[#64FFDA] translate-x-1" : "text-[#ebbbb4] hover:bg-[#253453]/50 hover:text-[#d8e2ff]"}`}>
                <span className="material-symbols-outlined" style={item.active ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                <span className="font-mono text-xs">{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-[rgba(100,255,218,0.15)] mt-auto">
          <button className="w-full text-center py-2 px-4 rounded border border-[#64FFDA] text-[#64FFDA] font-mono text-xs hover:bg-[#64FFDA]/10 transition-colors uppercase">View Logs</button>
          <div className="flex flex-col gap-2 mt-4">
            {[{ icon: "settings", label: "Settings" }, { icon: "contact_support", label: "Support" }].map((i) => (
              <a key={i.label} className="text-[#ebbbb4] text-sm flex items-center gap-2 hover:text-[#d8e2ff]" href="#">
                <span className="material-symbols-outlined text-sm">{i.icon}</span> {i.label}
              </a>
            ))}
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 min-h-screen flex flex-col bg-[#0A192F] relative w-full">
        <header className="w-full px-10 py-6 flex justify-between items-center border-b border-[rgba(100,255,218,0.15)] sticky top-0 bg-[#011230]/80 backdrop-blur-md z-30">
          <div>
            <h2 className="text-3xl font-semibold text-[#d8e2ff] tracking-tight">Contract Deployment Hub</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="w-2 h-2 rounded-full bg-[#64FFDA]"></span>
              <span className="font-mono text-xs text-[#64FFDA]">CASPER TESTNET</span>
              <span className="text-[#ebbbb4]/40 font-mono text-xs ml-4">VERSION 1.5.2</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0e1f3d] border border-[rgba(100,255,218,0.15)]">
              <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">account_balance_wallet</span>
              <span className="font-mono text-xs text-[#d8e2ff]">0202...8f3c</span>
            </div>
            <button className="text-[#ebbbb4] hover:text-[#d8e2ff]">
              <span className="material-symbols-outlined">notifications</span>
            </button>
          </div>
        </header>

        <div className="flex-1 flex p-6 gap-6">
          <div className="flex-1 flex flex-col gap-6">
            {/* Deployment Sequence */}
            <section className="glass-panel rounded-xl p-8 overflow-hidden relative">
              <div className="relative z-10">
                <h3 className="font-mono text-xs text-[#ebbbb4] uppercase tracking-widest mb-8">Deployment Sequence</h3>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { icon: "check_circle", label: "Compiling Wasm", sub: "SUCCESS", color: "border-[#00C853]", iconColor: "text-[#00C853]", bg: "bg-[#00C853]/10", spin: false },
                    { icon: "check_circle", label: "Estimating Gas", sub: "2.5 CSPR", color: "border-[#00C853]", iconColor: "text-[#00C853]", bg: "bg-[#00C853]/10", spin: false },
                    { icon: "sync", label: "Signing Transaction", sub: "AWAITING SIGNATURE...", color: "border-[#64FFDA]", iconColor: "text-[#64FFDA]", bg: "bg-[#64FFDA]/10", spin: true, bold: true },
                    { icon: "send", label: "Broadcasting", sub: "PENDING", color: "border-[#ebbbb4]/30", iconColor: "text-[#ebbbb4]", bg: "", dim: true },
                  ].map((step) => (
                    <div key={step.label} className={`flex flex-col items-center gap-4 ${step.dim ? "opacity-40" : ""}`}>
                      <div className={`w-12 h-12 rounded-full border-2 ${step.color} flex items-center justify-center ${step.bg}`}>
                        <span className={`material-symbols-outlined ${step.iconColor} ${step.spin ? "animate-spin" : ""}`}>{step.icon}</span>
                      </div>
                      <div className="text-center">
                        <p className={`font-mono text-xs text-[#d8e2ff] ${step.bold ? "font-bold" : ""}`}>{step.label}</p>
                        <span className={`text-[10px] font-mono ${step.iconColor}`}>{step.sub}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div ref={terminalRef} className="mt-8 bg-black/40 rounded-lg p-4 font-mono text-xs text-[#64FFDA]/80 border border-[rgba(100,255,218,0.15)] h-32 overflow-y-auto terminal-scroll">
                  {logs.map((log, i) => (
                    <p key={i} className={log.color}>[{log.time}] {log.text}</p>
                  ))}
                </div>
              </div>
            </section>

            {/* Wallet Interaction */}
            <div className="flex-1 flex gap-6">
              <div className="flex-1 glass-panel rounded-xl flex flex-col overflow-hidden">
                <div className="bg-[#253453] p-4 border-b border-[rgba(100,255,218,0.15)] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-[#FF0000] flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-sm">key</span>
                    </div>
                    <span className="font-mono text-xs text-[#d8e2ff]">CSPR.click Signature Request</span>
                  </div>
                  <span className="text-[#ebbbb4]/60 font-mono text-[10px]">ENCRYPTED SECURE CHANNEL</span>
                </div>
                <div className="p-8 flex-1 flex flex-col items-center justify-center text-center">
                  <div className="p-6 bg-[#011230] rounded-lg border border-[rgba(100,255,218,0.15)] w-full max-w-md text-left">
                    <label className="font-mono text-[10px] text-[#ebbbb4] uppercase mb-2 block">Transaction Hash</label>
                    <code className="block bg-black/30 p-2 rounded text-[#64FFDA] text-[11px] mb-4 break-all">
                      b508f3a9e1d52a2f1c8b9d0e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b2c1d0e9f8a
                    </code>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="font-mono text-[10px] text-[#ebbbb4] uppercase block">Gas Fee</label>
                        <p className="text-[#d8e2ff] font-semibold text-xl">2.5 CSPR</p>
                      </div>
                      <div>
                        <label className="font-mono text-[10px] text-[#ebbbb4] uppercase block">Action</label>
                        <p className="text-[#d8e2ff] font-semibold text-xl">Contract Deploy</p>
                      </div>
                    </div>
                    <div className="mt-6 flex items-center gap-2 p-2 bg-[#FF0000]/10 border border-[#FF0000]/30 rounded text-[11px] text-[#FF0000]">
                      <span className="material-symbols-outlined text-[14px]">info</span>
                      This action will deploy a permanent smart contract to the network.
                    </div>
                  </div>
                  <div className="mt-10 flex gap-4 w-full max-w-md">
                    <button className="flex-1 py-4 px-6 border border-[rgba(100,255,218,0.15)] rounded-lg text-[#d8e2ff] font-mono text-xs hover:bg-[#253453] transition-all uppercase tracking-widest">
                      Reject
                    </button>
                    <Link href="/dashboard" className="flex-1">
                      <button
                        onClick={() => setConfirming(true)}
                        className="w-full py-4 px-6 bg-[#FF0000] text-white font-mono text-xs font-bold rounded-lg hover:shadow-[0_0_20px_rgba(255,0,0,0.4)] transition-all uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95"
                      >
                        {confirming ? (
                          <><span className="material-symbols-outlined text-[18px] animate-spin">sync</span> PROCESSING...</>
                        ) : (
                          <>Confirm &amp; Sign <span className="material-symbols-outlined text-[18px]">gesture</span></>
                        )}
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right metadata */}
          <aside className="w-80 flex flex-col gap-6">
            <div className="glass-panel rounded-xl p-6 flex flex-col gap-6">
              <h4 className="font-mono text-xs text-[#ebbbb4] uppercase tracking-widest">Transaction Metadata</h4>
              <div className="space-y-6">
                {[
                  { label: "Contract Hash", value: "hash-f84a...92de", mono: true },
                  { label: "Chain ID", value: "casper-test", mono: true },
                  { label: "Payment Method", value: "Standard Transfer", mono: true },
                ].map((m) => (
                  <div key={m.label}>
                    <label className="font-mono text-[10px] text-[#ebbbb4] uppercase block mb-1">{m.label}</label>
                    <p className="text-[#d8e2ff] font-mono text-xs">{m.value}</p>
                  </div>
                ))}
                <div>
                  <label className="font-mono text-[10px] text-[#ebbbb4] uppercase block mb-1">Deploy Hash (Pending)</label>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#64FFDA] animate-spin text-sm">autorenew</span>
                    <p className="text-[#64FFDA] font-mono text-xs italic">Generating...</p>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-6 border-t border-[rgba(100,255,218,0.15)]">
                <div className="p-4 bg-[#0e1f3d] rounded-lg border border-[rgba(100,255,218,0.15)]">
                  <h5 className="font-mono text-xs text-[#d8e2ff] mb-2 font-bold">Network Health</h5>
                  <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden mb-2">
                    <div className="bg-[#00C853] h-full w-[94%]"></div>
                  </div>
                  <div className="flex justify-between font-mono text-[10px] text-[#ebbbb4]">
                    <span>LIVENESS</span>
                    <span className="text-[#00C853]">94.8%</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-panel rounded-xl p-6 flex-1 flex flex-col">
              <h4 className="font-mono text-xs text-[#ebbbb4] uppercase tracking-widest mb-4">Node Latency</h4>
              <div className="w-full h-32 bg-[#0e1f3d] rounded border border-[rgba(100,255,218,0.15)] mb-4 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#64FFDA] text-4xl">ssid_chart</span>
              </div>
              <div className="mt-auto space-y-2">
                <p className="font-mono text-[11px] text-[#ebbbb4]">Connected Peers: <span className="text-[#d8e2ff]">12</span></p>
                <p className="font-mono text-[11px] text-[#ebbbb4]">Average Block: <span className="text-[#d8e2ff]">32.4s</span></p>
              </div>
            </div>
          </aside>
        </div>

        <footer className="h-10 bg-[#000d27] border-t border-[rgba(100,255,218,0.15)] px-10 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00C853]"></span>
              <span className="font-mono text-[10px] text-[#ebbbb4] uppercase">Network: Online</span>
            </div>
            <span className="font-mono text-[10px] text-[#ebbbb4] uppercase">Latency: 42ms</span>
          </div>
          <p className="font-mono text-[10px] text-[#ebbbb4]/60">© 2026 CasperLaunch. Institutional-grade tokenization engine.</p>
        </footer>
      </main>

      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-[#FF0000]/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-[#64FFDA]/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
    </div>
  );
}
