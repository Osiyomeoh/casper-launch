"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const TERMINAL_LINES = [
  { text: "> Analyzing real estate deed: Alpine_Terrace_SF.pdf...", color: "text-[#38debb]", delay: 0 },
  { text: "> Extracting: 12 units · $4.25M valuation · 98% occupancy.", color: "text-[#ebbbb4]", delay: 900 },
  { text: "> Matching ERC-20 structure with Casper CEP-78 standard.", color: "text-[#ebbbb4]", delay: 1900 },
  { text: "> Injecting x402 payment module for rent distributions.", color: "text-[#ebbbb4]", delay: 2800 },
  { text: "> WARNING: Manual gas estimation required — optimizing...", color: "text-[#FF0000]", delay: 3700 },
  { text: "> Optimization complete. Estimated gas: 0.82 CSPR.", color: "text-[#38debb]", delay: 4600 },
  { text: "> Contract compiled. 1,000,000 CS-ALP tokens ready.", color: "text-[#ebbbb4]", delay: 5400 },
  { text: "READY FOR DEPLOYMENT ✓", color: "text-white font-bold", delay: 6200 },
];

function TypewriterLine({ text, color, onDone }: { text: string; color: string; onDone?: () => void }) {
  const [displayed, setDisplayed] = useState("");
  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) { clearInterval(interval); onDone?.(); }
    }, 18);
    return () => clearInterval(interval);
  }, [text]);
  return <p className={color}>{displayed}<span className="animate-pulse">▌</span></p>;
}

function useTVLCounter(target: number) {
  const [value, setValue] = useState(380_000_000);
  useEffect(() => {
    const interval = setInterval(() => {
      setValue((v) => {
        const next = v + Math.floor(Math.random() * 50000 + 10000);
        return next >= target ? target : next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [target]);
  return value;
}

export default function LandingPage() {
  const [visibleLines, setVisibleLines] = useState<number[]>([]);
  const [currentLine, setCurrentLine] = useState(0);
  const [cycleKey, setCycleKey] = useState(0);
  const tvl = useTVLCounter(420_000_000);

  useEffect(() => {
    setVisibleLines([]);
    setCurrentLine(0);
    const timers = TERMINAL_LINES.map((line, i) =>
      setTimeout(() => setVisibleLines((prev) => [...prev, i]), line.delay)
    );
    const restart = setTimeout(() => {
      setCycleKey((k) => k + 1);
    }, 10000);
    return () => { timers.forEach(clearTimeout); clearTimeout(restart); };
  }, [cycleKey]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("opacity-100", "translate-y-0");
          e.target.classList.remove("opacity-0", "translate-y-8");
        }
      }),
      { threshold: 0.1 }
    );
    document.querySelectorAll(".reveal-panel").forEach((el) => {
      el.classList.add("transition-all", "duration-700", "opacity-0", "translate-y-8");
      observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="bg-[#011230] text-[#d8e2ff] font-sans selection:bg-[#FF0000]/30 min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 bg-[#0A192F]/80 backdrop-blur-xl border-b border-white/5 h-20">
        <div className="max-w-[1440px] mx-auto px-10 h-full flex justify-between items-center">
          <div className="flex items-center gap-12">
            <span className="text-2xl font-bold tracking-tighter text-[#FF0000]">CasperLaunch</span>
            <div className="hidden md:flex items-center gap-8">
              {[
                { label: "Agents", href: "/chat", active: true },
                { label: "Dashboard", href: "/dashboard" },
                { label: "Whitepaper", href: "/whitepaper" },
              ].map((l) => (
                <Link key={l.label} href={l.href}>
                  <span className={`font-medium text-base transition-colors ${l.active ? "text-[#38debb] font-bold border-b-2 border-[#38debb] pb-1" : "text-[#d8e2ff]/70 hover:text-[#d8e2ff]"}`}>{l.label}</span>
                </Link>
              ))}
            </div>
          </div>
          <Link href="/dashboard">
            <button className="bg-[#FF0000] text-white px-6 py-2.5 font-semibold text-base rounded-lg hover:shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all active:scale-95 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]">account_balance_wallet</span>
              Open Dashboard
            </button>
          </Link>
        </div>
      </nav>

      <main className="pt-20">
        {/* Hero */}
        <section className="relative min-h-[921px] flex items-center overflow-hidden" style={{ background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(255,0,0,0.07) 0%, transparent 70%)" }}>
          <div className="relative max-w-[1440px] mx-auto px-10 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center py-20">
            <div className="z-10">
              <div className="inline-flex items-center gap-2 bg-[#112240] border border-[#38debb]/20 px-4 py-2 rounded-full mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>
                <span className="font-mono text-xs text-[#38debb] uppercase tracking-widest">Live on Casper Mainnet</span>
              </div>
              <h1 className="text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight tracking-tight">
                Tokenize Real-World Assets in{" "}
                <span className="text-[#FF0000]">20 Minutes.</span>
              </h1>
              <p className="text-[#ebbbb4] text-xl mb-10 max-w-xl leading-relaxed">
                No blockchain knowledge required. Our AI agents handle everything from asset gathering to deployment on Casper&apos;s upgradable infrastructure.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/chat">
                  <button className="bg-[#FF0000] text-white px-8 py-4 rounded-lg font-bold text-lg hover:brightness-110 hover:shadow-[0_0_30px_rgba(255,0,0,0.4)] transition-all flex items-center gap-2 cursor-pointer active:scale-95">
                    Launch Agent <span className="material-symbols-outlined">rocket_launch</span>
                  </button>
                </Link>
                <Link href="/dashboard">
                  <button className="border border-[#38debb]/40 text-[#38debb] px-8 py-4 rounded-lg font-bold text-lg hover:bg-[#38debb]/5 transition-all">
                    View Live Dashboard
                  </button>
                </Link>
              </div>
              <div className="mt-12 flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-[#38debb] uppercase tracking-widest">Total Value Protected</span>
                  <span className="text-2xl font-bold text-white tabular-nums">${(tvl / 1_000_000).toFixed(1)}M+</span>
                </div>
                <div className="h-10 w-px bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-[#38debb] uppercase tracking-widest">Assets Tokenized</span>
                  <span className="text-2xl font-bold text-white">1,284</span>
                </div>
                <div className="h-10 w-px bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="font-mono text-xs text-[#38debb] uppercase tracking-widest">Avg. Time to Deploy</span>
                  <span className="text-2xl font-bold text-white">18 min</span>
                </div>
              </div>
            </div>

            {/* Animated Terminal */}
            <div className="relative hidden lg:block">
              <div className="p-6 rounded-xl border border-[#38debb]/20 shadow-2xl relative overflow-hidden" style={{ background: "rgba(17,34,64,0.8)", backdropFilter: "blur(20px)" }}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-[#FF0000]/70"></div>
                      <div className="w-3 h-3 rounded-full bg-yellow-500/70"></div>
                      <div className="w-3 h-3 rounded-full bg-[#00C853]/70"></div>
                    </div>
                    <span className="font-mono text-[11px] text-[#ebbbb4] ml-2">contract_agent_v4 — tokenize</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38debb] animate-pulse"></span>
                    <span className="font-mono text-[10px] text-[#38debb] uppercase">Running</span>
                  </div>
                </div>
                <div className="bg-black/50 p-5 rounded-lg font-mono text-[13px] leading-7 h-[300px] overflow-hidden relative">
                  <div className="space-y-0.5" key={cycleKey}>
                    {TERMINAL_LINES.map((line, i) =>
                      visibleLines.includes(i) ? (
                        <TypewriterLine key={i} text={line.text} color={line.color} />
                      ) : null
                    )}
                  </div>
                  {visibleLines.includes(7) && (
                    <div className="mt-4 flex gap-2">
                      <div className="h-1 flex-1 bg-[#38debb] rounded shadow-[0_0_8px_rgba(56,222,187,0.8)]"></div>
                      <div className="h-1 flex-1 bg-[#38debb] rounded shadow-[0_0_8px_rgba(56,222,187,0.8)]"></div>
                      <div className="h-1 flex-1 bg-[#38debb]/30 rounded"></div>
                    </div>
                  )}
                </div>
                {visibleLines.includes(7) && (
                  <Link href="/deploy">
                    <button className="w-full mt-4 bg-[#FF0000] text-white py-3 rounded-lg font-bold text-sm hover:brightness-110 transition-all active:scale-95 shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                      Deploy to Casper Mainnet →
                    </button>
                  </Link>
                )}
              </div>
              <div className="absolute -top-12 -right-12 w-64 h-64 bg-[#FF0000]/10 blur-[100px] rounded-full pointer-events-none"></div>
              <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-[#38debb]/10 blur-[100px] rounded-full pointer-events-none"></div>
            </div>
          </div>
        </section>

        {/* Agent Pipeline */}
        <section className="py-24 max-w-[1440px] mx-auto px-10">
          <div className="mb-16">
            <span className="font-mono text-xs text-[#FF0000] uppercase tracking-widest block mb-2">Automated Lifecycle</span>
            <h2 className="text-3xl font-semibold text-white">The AI Agent Pipeline</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: "forum", title: "Interview Agent", desc: "Gathers asset details via plain conversation. Natural language processing turns physical deeds into digital data points.", status: "LISTENING", href: "/chat" },
              { icon: "terminal", title: "Contract Agent", desc: "Generates & explains upgradable Odra contracts for your approval. No black-box code; every line is explained.", status: "COMPILING", href: "/contract" },
              { icon: "publish", title: "Deploy Agent", desc: "Signs & submits to Casper Mainnet via CSPR.click. Manages gas estimations and secure key interactions automatically.", status: "BROADCASTING", href: "/deploy" },
              { icon: "monitoring", title: "Monitor Agent", desc: "Sets up x402 payment rails and manages autonomous upgrades. Ensuring long-term compliance and yield flow.", status: "WATCHING", href: "/dashboard" },
            ].map((agent, i) => (
              <Link href={agent.href} key={agent.title}>
                <div className="reveal-panel p-8 rounded-lg border-l-4 border-l-[#38debb] hover:bg-[#112240] transition-all duration-300 h-full cursor-pointer" style={{ background: "rgba(17,34,64,0.5)", border: "1px solid rgba(255,255,255,0.05)", borderLeft: "4px solid #38debb" }}>
                  <div className="flex items-center justify-between mb-6">
                    <span className="material-symbols-outlined text-[#38debb] text-4xl">{agent.icon}</span>
                    <span className="font-mono text-[10px] text-[#38debb]/50 uppercase bg-[#38debb]/5 px-2 py-1 rounded">{i + 1}/4</span>
                  </div>
                  <h3 className="text-xl font-bold text-white mb-4">{agent.title}</h3>
                  <p className="text-[#ebbbb4] mb-6 text-sm leading-relaxed">{agent.desc}</p>
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>
                    <span className="font-mono text-[10px] text-[#38debb]/60 uppercase">{agent.status}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Stats Band */}
        <section className="py-16 bg-[#000d27] border-y border-white/5">
          <div className="max-w-[1440px] mx-auto px-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { label: "Assets Under Management", value: "$420M+" },
              { label: "x402 Payments Processed", value: "1.28M+" },
              { label: "Avg Deployment Time", value: "18 min" },
              { label: "Uptime SLA", value: "99.97%" },
            ].map((stat) => (
              <div key={stat.label} className="reveal-panel">
                <p className="text-3xl font-bold text-white mb-2">{stat.value}</p>
                <p className="font-mono text-xs text-[#ebbbb4] uppercase tracking-wider">{stat.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Whitepaper CTA */}
        <section className="py-20 max-w-[1440px] mx-auto px-10">
          <div className="reveal-panel rounded-2xl border border-[#38debb]/20 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(17,34,64,0.9) 0%, rgba(10,25,47,0.9) 100%)" }}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
              {/* Left */}
              <div className="p-10 lg:p-14 flex flex-col justify-center">
                <div className="inline-flex items-center gap-2 bg-[#FF0000]/10 border border-[#FF0000]/20 px-3 py-1.5 rounded-full mb-6 self-start">
                  <span className="material-symbols-outlined text-[#FF0000] text-sm">article</span>
                  <span className="font-mono text-[10px] text-[#FF0000] uppercase tracking-widest">Whitepaper v1.0</span>
                </div>
                <h2 className="text-3xl font-bold text-white mb-4 leading-tight">
                  Read the Technical <br />& Legal Blueprint
                </h2>
                <p className="text-[#ebbbb4] text-base leading-relaxed mb-8 max-w-md">
                  Everything behind CasperLaunch — smart contract architecture, SPV legal structure, KYC/AML framework, yield mechanics, governance model, and the full production roadmap.
                </p>
                <div className="flex flex-wrap gap-4">
                  <Link href="/whitepaper">
                    <button className="bg-[#FF0000] text-white px-7 py-3 rounded-lg font-bold text-sm hover:brightness-110 hover:shadow-[0_0_25px_rgba(255,0,0,0.35)] transition-all active:scale-95 flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">menu_book</span>
                      Read Whitepaper
                    </button>
                  </Link>
                  <a href="https://github.com/Osiyomeoh/cfo" target="_blank" rel="noopener noreferrer">
                    <button className="border border-[#38debb]/30 text-[#38debb] px-7 py-3 rounded-lg font-bold text-sm hover:bg-[#38debb]/5 transition-all flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px]">code</span>
                      View Source
                    </button>
                  </a>
                </div>
              </div>

              {/* Right — section list */}
              <div className="border-t lg:border-t-0 lg:border-l border-[rgba(100,255,218,0.08)] p-10 lg:p-14">
                <p className="font-mono text-[10px] uppercase tracking-widest text-[#38debb] mb-6">13 Sections covering</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { icon: "lightbulb", label: "Problem & Solution" },
                    { icon: "trending_up", label: "Market Opportunity" },
                    { icon: "code", label: "Smart Contracts" },
                    { icon: "smart_toy", label: "AI Agent Layer" },
                    { icon: "account_balance_wallet", label: "Wallet Infrastructure" },
                    { icon: "swap_horiz", label: "Marketplace & Trading" },
                    { icon: "account_balance", label: "Yield Distribution" },
                    { icon: "how_to_vote", label: "Governance Model" },
                    { icon: "gavel", label: "Legal & Compliance" },
                    { icon: "apartment", label: "Asset Management" },
                    { icon: "security", label: "Security Model" },
                    { icon: "map", label: "Roadmap to Scale" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-2 text-[#abb9d6] text-xs">
                      <span className="material-symbols-outlined text-[#38debb] text-sm">{item.icon}</span>
                      {item.label}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Casper Advantage */}
        <section className="py-24 bg-[#000d27] overflow-hidden">
          <div className="max-w-[1440px] mx-auto px-10 flex flex-col lg:flex-row items-center gap-16">
            <div className="lg:w-1/2 reveal-panel">
              <span className="font-mono text-xs text-[#FF0000] uppercase tracking-widest block mb-2">Institutional Advantage</span>
              <h2 className="text-3xl font-semibold text-white mb-8">Built on Casper: The Trust Layer for the Agent Economy.</h2>
              <p className="text-[#ebbbb4] text-lg mb-8 leading-relaxed">
                Traditional blockchains are static. When your real-world business logic evolves, your smart contracts usually can&apos;t. Casper&apos;s native upgradability is the only infrastructure capable of supporting the multi-year lifecycle of RWAs.
              </p>
              <ul className="space-y-6">
                {[
                  { title: "Upgradable Smart Contracts", desc: "Update business logic without migrating data — impossible on Ethereum or Solana without complex proxies." },
                  { title: "Deterministic Gas Fees", desc: "Predictable costs for enterprise forecasting. No more bidding wars against NFT mints." },
                  { title: "Native x402 Payment Rails", desc: "HTTP-native micropayments built into the protocol — yield flows automatically to token holders." },
                ].map((item) => (
                  <li key={item.title} className="flex items-start gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-[#38debb]/10 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[#38debb] text-sm">check</span>
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{item.title}</h4>
                      <p className="text-[#ebbbb4] text-sm">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="lg:w-1/2 w-full reveal-panel">
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-[#112240] p-8 space-y-4">
                <p className="font-mono text-xs text-[#38debb] uppercase tracking-widest mb-6">Live Network Stats</p>
                {[
                  { label: "Block Height", value: "2,948,821", live: true },
                  { label: "Active Validators", value: "100 / 100", color: "text-[#00C853]" },
                  { label: "Avg Block Time", value: "32.5s" },
                  { label: "Transactions (24h)", value: "142,840", color: "text-[#64FFDA]" },
                  { label: "Network Uptime", value: "99.97%", color: "text-[#00C853]" },
                ].map((stat) => (
                  <div key={stat.label} className="flex items-center justify-between py-3 border-b border-white/5">
                    <span className="font-mono text-xs text-[#ebbbb4]">{stat.label}</span>
                    <span className={`font-mono text-sm font-bold ${stat.color || "text-white"} ${stat.live ? "animate-pulse" : ""}`}>{stat.value}</span>
                  </div>
                ))}
                <div className="pt-4 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#38debb] animate-pulse"></span>
                  <span className="font-mono text-[11px] text-white">CASPER MAINNET — LIVE FEED</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Who */}
        <section className="py-24 max-w-[1440px] mx-auto px-10 text-center">
          <h2 className="text-3xl font-semibold text-white mb-4">Who is CasperLaunch for?</h2>
          <p className="text-[#ebbbb4] mb-16 max-w-xl mx-auto">From individual landlords to institutional asset managers — if you own real-world value, we can put it on-chain.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              { icon: "holiday_village", title: "Landlords", desc: "Fractionalize equity and automate rent distributions without legal headaches." },
              { icon: "receipt_long", title: "Invoice Traders", desc: "Turn accounts receivable into liquid on-chain assets with automated x402 payment rails." },
              { icon: "groups", title: "Cooperatives", desc: "Manage collective ownership with governance-enabled smart contracts that grow with you." },
            ].map((item) => (
              <div key={item.title} className="reveal-panel flex flex-col items-center">
                <div className="w-20 h-20 rounded-full bg-[#112240] border border-white/5 flex items-center justify-center mb-6">
                  <span className="material-symbols-outlined text-[#FF0000] text-4xl">{item.icon}</span>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{item.title}</h3>
                <p className="text-[#ebbbb4]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section className="py-24 bg-[#0A192F] relative">
          <div className="max-w-[1440px] mx-auto px-10 relative z-10">
            <div className="text-center mb-16">
              <span className="font-mono text-xs text-[#FF0000] uppercase tracking-widest block mb-2">Transparent Economics</span>
              <h2 className="text-3xl font-semibold text-white">Scale With Your Success</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
              {[
                { title: "Onboarding", price: "$299", unit: "one-time", features: ["AI Interview Session", "Legal Framework Drafting", "Initial Token Launch"], highlight: false, cta: "Get Started", href: "/chat" },
                { title: "Performance", price: "0.5%", unit: "per payment", features: ["Automated x402 Rails", "Global Payout Automation", "Tax Compliance Exports"], highlight: true, cta: "Select Model", href: "/yield" },
                { title: "Management", price: "$49", unit: "/month SaaS", features: ["Continuous Monitoring", "Autonomous Upgrades", "Advanced Analytics"], highlight: false, cta: "View Dashboard", href: "/dashboard" },
              ].map((plan) => (
                <div key={plan.title} className={`reveal-panel p-10 rounded-xl flex flex-col transition-all ${plan.highlight ? "border-2 border-[#38debb] lg:-translate-y-4 shadow-[0_20px_50px_rgba(56,222,187,0.1)]" : "border border-white/5 hover:border-[#38debb]/30"}`} style={{ background: "rgba(17,34,64,0.6)", backdropFilter: "blur(12px)" }}>
                  {plan.highlight && <div className="bg-[#38debb] text-[#0A192F] text-[10px] font-bold font-mono py-1 px-3 rounded-full self-start mb-6 uppercase">Most Popular</div>}
                  <div className="mb-8">
                    <h3 className="text-white font-bold text-lg mb-2">{plan.title}</h3>
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold text-white">{plan.price}</span>
                      <span className="text-[#ebbbb4]">{plan.unit}</span>
                    </div>
                  </div>
                  <ul className="space-y-4 mb-10 flex-grow">
                    {plan.features.map((f) => (
                      <li key={f} className={`flex items-center gap-3 ${plan.highlight ? "text-white" : "text-[#ebbbb4]"}`}>
                        <span className="material-symbols-outlined text-[#38debb] text-sm">check_circle</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                  <Link href={plan.href}>
                    <button className={`w-full py-3 rounded-lg transition-all ${plan.highlight ? "bg-[#38debb] text-[#0A192F] font-bold hover:brightness-110" : "border border-white/10 text-white hover:bg-white/5"}`}>
                      {plan.cta}
                    </button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 max-w-[1440px] mx-auto px-10 text-center">
          <h2 className="text-4xl font-bold text-white mb-6">Ready to tokenize your first asset?</h2>
          <p className="text-[#ebbbb4] text-xl mb-10 max-w-lg mx-auto">Join 1,284 asset owners already running on CasperLaunch. Your AI agent is standing by.</p>
          <Link href="/chat">
            <button className="bg-[#FF0000] text-white px-12 py-5 rounded-lg font-bold text-xl hover:brightness-110 hover:shadow-[0_0_40px_rgba(255,0,0,0.4)] transition-all active:scale-95">
              Start Now — Free Onboarding
            </button>
          </Link>
        </section>
      </main>

      <footer className="bg-[#000d27] border-t border-white/5">
        <div className="max-w-[1440px] mx-auto px-10 py-12 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col gap-4">
            <span className="text-3xl font-semibold text-[#FF0000]">CasperLaunch</span>
            <p className="font-mono text-xs text-[#ebbbb4] max-w-sm">© 2026 CasperLaunch. Built on Casper Network. Institutional RWA infrastructure for the AI era.</p>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            {[
              { label: "Whitepaper", href: "/whitepaper" },
              { label: "GitHub", href: "https://github.com/Osiyomeoh/cfo" },
              { label: "Terms", href: "#" },
              { label: "Privacy", href: "#" },
            ].map((link) => (
              <a key={link.label} className="font-mono text-xs text-[#ebbbb4] hover:text-[#FF0000] transition-all" href={link.href}>{link.label}</a>
            ))}
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/5 bg-[#011230]">
            <span className="material-symbols-outlined text-[#64FFDA] text-sm">verified</span>
            <span className="font-mono text-[10px] text-white tracking-widest">CSPR.CLICK COMPATIBLE</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
