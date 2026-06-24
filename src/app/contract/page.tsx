"use client";
import Link from "next/link";

const NAV_ITEMS = [
  { icon: "business", label: "Entity Setup", href: "/chat" },
  { icon: "toll", label: "Asset Details", href: "#" },
  { icon: "gavel", label: "Legal Review", href: "/contract", active: true },
  { icon: "verified_user", label: "Compliance", href: "#" },
  { icon: "rocket_launch", label: "Launch", href: "/deploy" },
];

const CODE_LINES = [
  { num: "01", content: <><span className="text-[#64FFDA]">use</span> odra::prelude::*;</> },
  { num: "02", content: <><span className="text-[#64FFDA]">use</span> odra::casper_types::{"{U256, RuntimeArgs}"};</> },
  { num: "03", content: " " },
  { num: "04", content: <><span className="text-[#FF0000]">#[odra::module]</span></> },
  { num: "05", content: <><span className="text-[#64FFDA]">pub struct</span> AssetToken {"{"}</> },
  { num: "06", content: "    balances: Mapping<Address, U256>," },
  { num: "07", content: "    performance_fee: Variable<U256>," },
  { num: "08", content: "    owner: Variable<Address>," },
  { num: "09", content: "}" },
  { num: "10", content: " " },
  { num: "11", content: <><span className="text-[#64FFDA]">impl</span> AssetToken {"{"}</> },
  { num: "12", content: <><span className="text-[#FF0000]">    #[odra::init]</span></> },
  { num: "13", content: <><span className="text-[#64FFDA]">    pub fn</span> init(&amp;<span className="text-[#64FFDA]">mut self</span>, initial_supply: U256) {"{"}</> },
  { num: "14", content: <><span className="text-[#ebbbb4]">        // Set initial state</span></> },
  { num: "15", content: <><span className="text-[#64FFDA]">        self</span>.owner.set(Context::caller());</> },
  { num: "16", content: <><span className="text-[#64FFDA]">        self</span>.performance_fee.set(U256::from(50));</> },
  { num: "17", content: "    }" },
  { num: "18", content: " " },
];

export default function ContractPage() {
  return (
    <div className="bg-[#0A192F] text-[#d8e2ff] font-sans overflow-hidden min-h-screen flex">
      {/* Sidebar */}
      <aside className="flex flex-col fixed left-0 top-0 h-full z-40 bg-[#0e1f3d] border-r border-[rgba(100,255,218,0.15)] backdrop-blur-xl w-64">
        <div className="p-6">
          <Link href="/">
            <span className="text-2xl font-bold tracking-tight text-[#d8e2ff] cursor-pointer">CasperLaunch</span>
          </Link>
        </div>
        <div className="flex-1 px-2 space-y-1">
          {NAV_ITEMS.map((item) => (
            <Link href={item.href} key={item.label}>
              <div className={`py-3 px-4 flex items-center gap-3 transition-all cursor-pointer ${item.active ? "bg-[#3c4962]/30 text-[#64FFDA] border-l-4 border-[#64FFDA] translate-x-1" : "text-[#ebbbb4] hover:bg-[#253453]/50 hover:text-[#d8e2ff]"}`}>
                <span className="material-symbols-outlined" style={item.active ? { fontVariationSettings: "'FILL' 1" } : {}}>{item.icon}</span>
                <span className="font-mono text-xs">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
        <div className="p-4 border-t border-[rgba(100,255,218,0.15)] bg-[#091b39]/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-[#64FFDA]/20 flex items-center justify-center border border-[#64FFDA]/40">
                <span className="material-symbols-outlined text-[#64FFDA] text-[20px]">smart_toy</span>
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-[#64FFDA] rounded-full border-2 border-[#0e1f3d] animate-pulse"></span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[#64FFDA]">Contract Agent</p>
              <p className="text-[10px] uppercase tracking-widest text-[#ebbbb4]">Institutional Flow</p>
            </div>
          </div>
          <button className="w-full py-2 border border-[#64FFDA]/30 text-[#64FFDA] font-mono text-xs hover:bg-[#64FFDA]/10 transition-colors uppercase">View Logs</button>
        </div>
        <div className="px-2 pb-6 space-y-1">
          {[{ icon: "settings", label: "Settings" }, { icon: "contact_support", label: "Support" }].map((item) => (
            <div key={item.label} className="text-[#ebbbb4] py-2 px-4 flex items-center gap-3 hover:text-[#d8e2ff] transition-all cursor-pointer">
              <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
              <span className="font-mono text-[11px]">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* Main */}
      <main className="ml-64 h-screen flex flex-col relative w-full">
        <header className="flex justify-between items-center px-10 py-6 border-b border-[rgba(100,255,218,0.15)] backdrop-blur-md">
          <div>
            <h1 className="text-3xl font-semibold text-[#d8e2ff]">Contract Architecture Review</h1>
            <p className="font-mono text-xs text-[#ebbbb4] uppercase tracking-wider">Step 3 of 5: Intelligent Legal Verification</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="font-mono text-[10px] text-[#ebbbb4]">NETWORK</span>
              <span className="text-[#00C853] font-bold flex items-center gap-1 text-sm">
                <span className="w-2 h-2 rounded-full bg-[#00C853]"></span>
                Casper Testnet
              </span>
            </div>
            <div className="h-10 w-px bg-[rgba(100,255,218,0.15)] mx-2"></div>
            <button className="px-6 py-2 bg-[#FF0000] text-white font-mono text-xs rounded-lg hover:shadow-[0_0_15px_rgba(255,0,0,0.3)] transition-all">
              Connect Wallet
            </button>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Code Editor */}
          <section className="w-7/12 flex flex-col border-r border-[rgba(100,255,218,0.15)] bg-[#050C16]">
            <div className="flex items-center justify-between px-6 py-3 border-b border-[rgba(100,255,218,0.15)] bg-[#091b39]">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#64FFDA] text-[18px]">description</span>
                <span className="font-mono text-xs text-[#d8e2ff]">AssetTokenization.odra</span>
              </div>
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/50"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/50"></div>
              </div>
            </div>
            <div className="flex-1 overflow-auto code-scroll font-mono p-6">
              <div className="flex gap-6">
                <div className="text-[#ebbbb4]/30 text-right select-none space-y-1 text-xs leading-6">
                  {CODE_LINES.map((l) => <div key={l.num}>{l.num}</div>)}
                  {["19","20","21","22","23","24","25","26","27","28","29","30"].map((n) => <div key={n}>{n}</div>)}
                </div>
                <div className="text-[#D1D1D1] space-y-1 leading-6 text-xs">
                  {CODE_LINES.map((l) => <p key={l.num}>{l.content}</p>)}
                  <p><span className="text-[#64FFDA]">    pub fn</span> distribute_yield(&amp;<span className="text-[#64FFDA]">mut self</span>, amount: U256) {"{"}</p>
                  <div className="bg-[#64FFDA]/5 border-l-2 border-[#64FFDA] -mx-6 px-6 py-1 relative group">
                    <p>        <span className="text-[#64FFDA]">let</span> fee = amount * <span className="text-[#64FFDA]">self</span>.performance_fee.get() / 10000;</p>
                    <p>        <span className="text-[#64FFDA]">self</span>.transfer_internal(<span className="text-[#64FFDA]">self</span>.owner.get(), fee);</p>
                    <div className="absolute -right-4 top-0 translate-x-full w-64 glass-panel p-4 rounded-lg agent-glow z-10 border-[#64FFDA]/30 hidden group-hover:block">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-[#64FFDA] text-[14px]">info</span>
                        <span className="text-[#64FFDA] text-[10px] font-bold uppercase tracking-widest">Agent Annotation</span>
                      </div>
                      <p className="text-[12px] text-[#d8e2ff] leading-snug">
                        This section handles the 0.5% performance fee distribution automatically to the Treasury address.
                      </p>
                    </div>
                  </div>
                  <p>    {"}"}</p>
                  <p> </p>
                  <p><span className="text-[#64FFDA]">    pub fn</span> apply_compliance_hook(&amp;<span className="text-[#64FFDA]">self</span>, account: Address) {"{"}</p>
                  <p><span className="text-[#ebbbb4]">        // External regulatory check</span></p>
                  <p>        Compliance::verify(account);</p>
                  <p>    {"}"}</p>
                </div>
              </div>
            </div>
          </section>

          {/* Right Panel */}
          <section className="w-5/12 flex flex-col bg-[#091b39] overflow-y-auto">
            <div className="p-8 space-y-8">
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded bg-[#64FFDA]/10">
                    <span className="material-symbols-outlined text-[#64FFDA]">psychology</span>
                  </div>
                  <h2 className="text-2xl font-semibold text-[#d8e2ff]">Agent Reasoning</h2>
                </div>
                <div className="glass-panel p-6 rounded-xl border-[#64FFDA]/20">
                  <p className="text-[#d8e2ff]/90 italic leading-relaxed">
                    &quot;Based on your &apos;Interview&apos; inputs regarding institutional liquidity, I have structured this Odra contract to prioritize gas-efficient performance distributions. The choice of a 0.5% variable fee allows for future governance adjustments while maintaining Casper&apos;s native upgradability features.&quot;
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="font-mono text-xs text-[#ebbbb4] uppercase tracking-widest">Key Features</h3>
                <div className="grid gap-3">
                  {[
                    { icon: "upgrade", title: "Upgradability (Casper Native)", desc: "Contract state persists across version updates." },
                    { icon: "lock_person", title: "Compliance Hooks", desc: "Real-time whitelist validation for all transfers." },
                    { icon: "payments", title: "x402 Payment Integration", desc: "Direct settlement in native CSPR or standard stablecoins." },
                  ].map((f) => (
                    <div key={f.title} className="flex items-center justify-between p-4 bg-[#112240]/40 border border-[rgba(100,255,218,0.15)] rounded-lg">
                      <div className="flex items-center gap-4">
                        <span className="material-symbols-outlined text-[#64FFDA]">{f.icon}</span>
                        <div>
                          <p className="font-bold text-[#d8e2ff]">{f.title}</p>
                          <p className="text-[12px] text-[#ebbbb4]">{f.desc}</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[#00C853]">check_circle</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative h-48 rounded-xl overflow-hidden border border-[rgba(100,255,218,0.15)] bg-[#112240] flex items-end p-6">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F] to-transparent"></div>
                <div className="relative z-10">
                  <p className="font-mono text-[10px] text-[#64FFDA] uppercase tracking-tighter">Security Matrix Visualization</p>
                  <p className="text-2xl font-bold text-[#d8e2ff]">99.8% Reliability Score</p>
                </div>
              </div>
            </div>

            <div className="flex-1"></div>

            <div className="p-8 border-t border-[rgba(100,255,218,0.15)] bg-[#091b39]/80 sticky bottom-0 backdrop-blur-md">
              <div className="flex flex-col gap-4">
                <Link href="/deploy">
                  <button className="group w-full bg-[#FF0000] hover:bg-[#FF0000]/90 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-3 active:scale-[0.98]">
                    <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">rocket_launch</span>
                    Approve &amp; Submit to Testnet
                  </button>
                </Link>
                <button className="w-full border border-[#ebbbb4]/30 hover:border-[#ebbbb4] text-[#d8e2ff] font-mono py-4 rounded-lg transition-all active:scale-[0.98]">
                  Request Revision
                </button>
                <p className="text-center text-[11px] text-[#ebbbb4]">
                  By approving, you acknowledge that the Agent has generated this code based on your logic. Technical audit still recommended.
                </p>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Atmosphere */}
      <div className="fixed inset-0 pointer-events-none -z-10 opacity-20">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-[#64FFDA]/10 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-0 right-0 w-[600px] h-[600px] bg-[#FF0000]/5 blur-[150px] rounded-full"></div>
      </div>
    </div>
  );
}
