"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useWallet } from "@/lib/wallet-context";

const NAV = [
  { icon: "dashboard", label: "Overview", href: "/dashboard" },
  { icon: "apartment", label: "My Assets", href: "/assets" },
  { icon: "account_balance", label: "Yield", href: "/yield" },
  { icon: "verified_user", label: "Compliance", href: "/compliance" },
  { icon: "how_to_vote", label: "Governance", href: "/governance" },
  { icon: "stacked_bar_chart", label: "Staking", href: "/staking" },
  { icon: "swap_horiz", label: "Trade", href: "/trade" },
  { icon: "receipt_long", label: "Orders", href: "/orders" },
  { icon: "smart_toy", label: "AI Agent", href: "/agent" },
  { icon: "verified", label: "Verify Doc", href: "/verify" },
  { icon: "settings", label: "Settings", href: "/settings" },
  { icon: "article", label: "Whitepaper", href: "/docs" },
];

const BOTTOM_NAV = [
  { icon: "dashboard", label: "Overview", href: "/dashboard" },
  { icon: "apartment", label: "Assets", href: "/assets" },
  { icon: "account_balance", label: "Yield", href: "/yield" },
  { icon: "swap_horiz", label: "Trade", href: "/trade" },
  { icon: "settings", label: "Settings", href: "/settings" },
];

export default function AppLayout({
  children,
  title,
  action,
}: {
  children: React.ReactNode;
  title?: string;
  action?: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const casperWallet = useWallet();

  const displayName = casperWallet.shortKey ?? "Guest";

  return (
    <div className="bg-[#011230] text-[#d8e2ff] font-sans min-h-screen flex">
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex flex-col h-screen sticky top-0 bg-[#091b39] border-r border-[rgba(100,255,218,0.12)] shrink-0 z-40 transition-all duration-300 ${sidebarCollapsed ? "w-16" : "w-56 lg:w-64"}`}>
        {/* Logo + collapse toggle */}
        <div className={`flex items-center border-b border-[rgba(100,255,218,0.12)] py-5 ${sidebarCollapsed ? "justify-center px-2" : "justify-between px-5"}`}>
          {!sidebarCollapsed && (
            <Link href="/">
              <div>
                <span className="text-xl font-bold text-[#FF0000] cursor-pointer">CasperLaunch</span>
                <p className="text-[10px] font-mono text-[#abb9d6] mt-0.5 uppercase tracking-widest">Asset Manager</p>
              </div>
            </Link>
          )}
          <button
            onClick={() => setSidebarCollapsed(v => !v)}
            className="w-7 h-7 rounded-lg bg-[#112240] hover:bg-[#1a2f52] border border-[rgba(100,255,218,0.1)] flex items-center justify-center transition-all shrink-0"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="material-symbols-outlined text-[#64FFDA] text-sm">
              {sidebarCollapsed ? "chevron_right" : "chevron_left"}
            </span>
          </button>
        </div>

        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link key={item.label} href={item.href} title={sidebarCollapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-2 py-2.5 rounded-lg text-sm transition-colors ${active ? "text-[#64FFDA] font-bold bg-[#192a48] border-r-2 border-[#64FFDA]" : "text-[#abb9d6] hover:bg-[#192a48]/60 hover:text-[#d8e2ff]"} ${sidebarCollapsed ? "justify-center" : ""}`}>
                <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </nav>

        <div className={`py-4 border-t border-[rgba(100,255,218,0.12)] ${sidebarCollapsed ? "px-2 flex flex-col items-center gap-2" : "px-4 space-y-3"}`}>
          {sidebarCollapsed ? (
            <Link href="/chat" title="Tokenize Asset">
              <button className="w-9 h-9 bg-[#FF0000] text-white rounded-lg hover:brightness-110 transition-all flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </Link>
          ) : (
            <>
              <Link href="/chat">
                <button className="w-full bg-[#FF0000] text-white py-2.5 text-sm font-bold rounded-lg hover:brightness-110 transition-all active:scale-95 shadow-[0_0_15px_rgba(255,0,0,0.15)]">
                  + Tokenize Asset
                </button>
              </Link>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#ebbbb4]">
                <span>MAINNET</span>
                <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>Live</span>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Overlay */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-[#091b39] border-r border-[rgba(100,255,218,0.12)] flex flex-col z-10">
            <div className="flex items-center justify-between px-5 py-5 border-b border-[rgba(100,255,218,0.12)]">
              <Link href="/" onClick={() => setDrawerOpen(false)}>
                <span className="text-xl font-bold text-[#FF0000]">CasperLaunch</span>
              </Link>
              <button onClick={() => setDrawerOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
                <span className="material-symbols-outlined text-[#ebbbb4]">close</span>
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
              {NAV.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link key={item.label} href={item.href} onClick={() => setDrawerOpen(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-lg text-sm transition-colors ${active ? "text-[#64FFDA] font-bold bg-[#192a48]" : "text-[#abb9d6] hover:bg-[#192a48]/60 hover:text-[#d8e2ff]"}`}>
                    <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
            <div className="px-4 py-5 border-t border-[rgba(100,255,218,0.12)]">
              <Link href="/chat" onClick={() => setDrawerOpen(false)}>
                <button className="w-full bg-[#FF0000] text-white py-3 text-sm font-bold rounded-lg">
                  + Tokenize New Asset
                </button>
              </Link>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <header className="sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 h-14 md:h-16 bg-[#0A192F]/90 backdrop-blur-md border-b border-[rgba(100,255,218,0.12)]">
          <div className="flex items-center gap-3">
            {/* Hamburger (mobile only) */}
            <button onClick={() => setDrawerOpen(true)} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
              <span className="material-symbols-outlined text-[#ebbbb4]">menu</span>
            </button>
            {title && <h1 className="text-base md:text-lg font-semibold text-[#d8e2ff] truncate">{title}</h1>}
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            {action}
            {/* Wallet connect — CSPR.click handles all wallet options */}
            {casperWallet.isConnected ? (
              <button onClick={casperWallet.disconnect}
                className="hidden sm:flex items-center gap-1.5 bg-[#00C853]/10 border border-[#00C853]/20 px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#00C853]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853]"></span>
                {casperWallet.shortKey}
              </button>
            ) : (
              <button onClick={casperWallet.connect}
                className="hidden sm:flex items-center gap-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] px-3 py-1.5 rounded-lg text-[10px] font-mono text-[#64FFDA] hover:bg-[#253458] transition-colors">
                Connect Wallet
              </button>
            )}
            <div className="hidden sm:flex items-center gap-2 bg-[#091b39] px-3 py-1.5 rounded-lg border border-[rgba(100,255,218,0.15)] text-xs font-mono text-[#d8e2ff]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>
              <span className="hidden md:inline">{displayName}</span>
              <span className="md:hidden">Connected</span>
            </div>
            <Link href="/chat">
              <button className="bg-[#FF0000] text-white px-3 md:px-5 py-2 rounded-lg text-xs md:text-sm font-bold hover:brightness-110 transition-all active:scale-95 whitespace-nowrap">
                + New Asset
              </button>
            </Link>
            <button onClick={casperWallet.disconnect} title="Sign out" className="hidden md:flex w-8 h-8 items-center justify-center rounded-lg bg-[#112240] hover:bg-[#192a48] transition-colors">
              <span className="material-symbols-outlined text-[#ebbbb4] text-[18px]">logout</span>
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#091b39]/95 backdrop-blur-md border-t border-[rgba(100,255,218,0.12)] grid grid-cols-5 py-1 z-30">
        {BOTTOM_NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.label} href={item.href}
              className={`flex flex-col items-center gap-0.5 py-2 transition-colors ${active ? "text-[#64FFDA]" : "text-[#ebbbb4]"}`}>
              <span className="material-symbols-outlined text-[22px]">{item.icon}</span>
              <span className="text-[9px] font-mono">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
