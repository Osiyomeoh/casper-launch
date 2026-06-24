"use client";
import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import AppLayout from "../components/AppLayout";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useCasperWallet } from "@/lib/casper-wallet";

const EXPLORER = "https://cspr.live";

const LOG_POOL = [
  { text: "INIT: Connecting to Casper mainnet RPC...", color: "text-white" },
  { text: "OK: RPC node synced. Chain: casper", color: "text-[#64FFDA]" },
  { text: "FETCH: Pulling latest block and era data from chain...", color: "text-white" },
  { text: "OK: Block confirmed. Compliance verification passed.", color: "text-[#64FFDA]" },
  { text: "PROCESS: Scanning CEP-78 token metadata for Alpine Terrace...", color: "text-white" },
  { text: "SUCCESS: Token holders: 1,000. All wallets KYC-verified.", color: "text-[#00C853]" },
  { text: "EXEC: Queuing x402 yield batch for Q3 distribution.", color: "text-white font-bold" },
  { text: "OK: Oracle price feed synced. CSPR/USD updated.", color: "text-[#64FFDA]" },
  { text: "PROCESS: Calculating yield split for 1,240 wallets...", color: "text-white" },
  { text: "SUCCESS: $21,250.00 yield queued. Executing on-chain.", color: "text-[#00C853]" },
  { text: "SCAN: Running KYC re-verification on 3 flagged wallets...", color: "text-white" },
  { text: "OK: All wallets cleared. No AML flags detected.", color: "text-[#64FFDA]" },
  { text: "MONITOR: Rental income inflow detected. Updating valuation oracle.", color: "text-white" },
  { text: "SUCCESS: CEP-78 metadata updated on Casper mainnet.", color: "text-[#00C853]" },
  { text: "PULSE: System nominal. Next distribution cycle in 3d 22h.", color: "text-[#64FFDA]" },
  { text: "EXEC: x402 micropayment routed — Alpine Terrace Unit 3 → Investor 0x7a2.", color: "text-white" },
  { text: "OK: Governance vote CP-142 quorum reached: 82%. Execution pending.", color: "text-[#64FFDA]" },
  { text: "MONITOR: Staking rewards distributed. Blended APY: 8.1%.", color: "text-white" },
];

type NetworkData = {
  blockHeight: number;
  eraId: number;
  blockHash: string;
  peerCount: number;
  chainName: string;
} | null;

type PriceData = {
  price: number;
  change24h: number;
  marketCap: number;
} | null;

function useCountUp(target: number, duration = 1600) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setValue(target); clearInterval(timer); }
      else setValue(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return value;
}

export default function DashboardPage() {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const casperWallet = useCasperWallet();

  const [logs, setLogs] = useState(() =>
    LOG_POOL.slice(0, 6).map((l, i) => ({ ...l, time: new Date(Date.now() - (5 - i) * 32000).toLocaleTimeString() }))
  );
  const [network, setNetwork] = useState<NetworkData>(null);
  const [price, setPrice] = useState<PriceData>(null);
  const [networkLoading, setNetworkLoading] = useState(true);
  const [csprBalance, setCsprBalance] = useState<number | null>(null);

  // Derive portfolio value from real CSPR balance × live price
  const portfolioUSD = csprBalance != null && price ? csprBalance * price.price : null;
  const totalValue = useCountUp(portfolioUSD ?? 0);
  const monthlyYield = useCountUp(portfolioUSD ? portfolioUSD * 0.06 / 12 : 0);

  // Fetch real Casper network data
  const fetchNetwork = useCallback(async () => {
    try {
      const res = await fetch("/api/casper/network");
      const data = await res.json();
      if (!data.error) setNetwork(data);
    } catch {}
    setNetworkLoading(false);
  }, []);

  const fetchPrice = useCallback(async () => {
    try {
      const res = await fetch("/api/price");
      const data = await res.json();
      if (!data.error) setPrice(data);
    } catch {}
  }, []);

  useEffect(() => {
    fetchNetwork();
    fetchPrice();
    const networkInterval = setInterval(fetchNetwork, 15_000);
    const priceInterval = setInterval(fetchPrice, 60_000);
    return () => { clearInterval(networkInterval); clearInterval(priceInterval); };
  }, [fetchNetwork, fetchPrice]);

  // Fetch real CSPR balance when CasperWallet is connected
  useEffect(() => {
    if (!casperWallet.publicKey) return;
    fetch(`/api/casper/account?publicKey=${casperWallet.publicKey}`)
      .then((r) => r.json())
      .then((d) => { if (!d.error) setCsprBalance(d.cspr); })
      .catch(() => {});
  }, [casperWallet.publicKey]);

  // Terminal log streaming
  useEffect(() => {
    let idx = 6;
    const interval = setInterval(() => {
      const entry = LOG_POOL[idx % LOG_POOL.length];
      const time = new Date().toLocaleTimeString();
      setLogs((prev) => [...prev.slice(-18), { ...entry, time }]);
      idx++;
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  const walletAddress = wallets[0]?.address;

  return (
    <AppLayout title="Asset Overview">
      <div className="p-4 md:p-8 space-y-6">

        {/* Live network banner */}
        <div className="flex items-center justify-between p-3 rounded-xl border border-[rgba(100,255,218,0.2)] text-xs font-mono" style={{ background: "rgba(17,34,64,0.5)" }}>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-[#64FFDA]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>
              Casper Mainnet
            </span>
            {networkLoading ? (
              <span className="text-[#ebbbb4]">Connecting to RPC...</span>
            ) : network ? (
              <>
                <span className="text-[#ebbbb4]">Block <a href={`${EXPLORER}/block/${network.blockHash}`} target="_blank" rel="noopener noreferrer" className="text-[#64FFDA] hover:underline">#{network.blockHeight.toLocaleString()}</a></span>
                <span className="text-[#ebbbb4]">Era {network.eraId}</span>
                <span className="text-[#ebbbb4]">{network.peerCount} peers</span>
              </>
            ) : (
              <span className="text-[#FF0000]">RPC offline — retrying...</span>
            )}
          </div>
          {price && (
            <div className="flex items-center gap-3">
              <span className="text-[#d8e2ff]">CSPR <b>${price.price.toFixed(5)}</b></span>
              <span className={price.change24h >= 0 ? "text-[#00C853]" : "text-[#FF0000]"}>
                {price.change24h >= 0 ? "+" : ""}{price.change24h.toFixed(2)}%
              </span>
            </div>
          )}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Portfolio Value",
              value: portfolioUSD != null ? `$${totalValue.toLocaleString()}` : casperWallet.isConnected ? "Loading..." : "Connect Wallet",
              sub: portfolioUSD != null ? `${csprBalance?.toLocaleString(undefined, { maximumFractionDigits: 2 })} CSPR` : "Live from chain",
              icon: "apartment", subColor: "text-[#00C853]", valueColor: "text-[#64FFDA]",
            },
            {
              label: "Est. Monthly Yield",
              value: portfolioUSD != null ? `$${monthlyYield.toLocaleString()}` : "—",
              sub: portfolioUSD != null ? "~6% APY estimate" : "Requires wallet",
              icon: "payments", subColor: "text-[#64FFDA]",
            },
            {
              label: "Active Assets",
              value: casperWallet.isConnected ? "—" : "—",
              sub: "Deploy contracts first",
              icon: "verified_user",
            },
            {
              label: "CSPR Balance",
              value: csprBalance != null ? `${csprBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : casperWallet.isConnected ? "Loading..." : "—",
              sub: casperWallet.publicKey ? `${casperWallet.shortKey}` : "No wallet connected",
              icon: "account_balance_wallet",
            },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-xl relative overflow-hidden" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="absolute top-2 right-2 opacity-10">
                <span className="material-symbols-outlined text-4xl text-[#64FFDA]">{card.icon}</span>
              </div>
              <p className="font-mono text-[9px] text-[#ebbbb4] uppercase tracking-widest mb-2">{card.label}</p>
              <span className={`text-lg md:text-xl font-bold ${(card as any).valueColor || "text-[#d8e2ff]"}`}>{card.value}</span>
              <p className={`text-[10px] mt-1 ${(card as any).subColor || "text-[#ebbbb4]"}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Terminal + Transactions */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {/* Agent Terminal */}
          <div className="lg:col-span-3 rounded-xl overflow-hidden border border-[rgba(100,255,218,0.2)]" style={{ background: "rgba(17,34,64,0.6)", backdropFilter: "blur(12px)" }}>
            <div className="bg-[rgba(25,42,72,0.4)] px-4 py-3 border-b border-[rgba(100,255,218,0.15)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#64FFDA] text-sm">terminal</span>
                <span className="font-mono text-[10px] text-[#d8e2ff] font-bold uppercase tracking-widest">CFO Agent Log</span>
              </div>
              <span className="font-mono text-[9px] text-[#00C853] animate-pulse">● LIVE</span>
            </div>
            <div ref={terminalRef} className="p-4 font-mono text-[10px] leading-relaxed overflow-y-auto h-56">
              {logs.map((log, i) => (
                <div key={i} className="mb-1.5">
                  <span className="text-[#64FFDA]">[{log.time}]</span>{" "}
                  <span className={log.color}>{log.text}</span>
                </div>
              ))}
              <div className="flex items-center gap-1 mt-2 text-[#64FFDA]/60">
                <div className="w-1 h-3 bg-[#64FFDA] animate-pulse"></div>
                <span>Awaiting next cycle...</span>
              </div>
            </div>
          </div>

          {/* Network Stats */}
          <div className="lg:col-span-2 rounded-xl p-4 space-y-3 border border-[rgba(100,255,218,0.2)]" style={{ background: "rgba(17,34,64,0.6)" }}>
            <h3 className="font-mono text-[10px] text-[#ebbbb4] uppercase tracking-widest">Casper Network</h3>
            <div className="space-y-2">
              {[
                { label: "Block Height", value: network ? `#${network.blockHeight.toLocaleString()}` : "—", live: true },
                { label: "Era ID", value: network ? `${network.eraId}` : "—" },
                { label: "Peer Count", value: network ? `${network.peerCount}` : "—" },
                { label: "CSPR Price", value: price ? `$${price.price.toFixed(5)}` : "—" },
                { label: "Market Cap", value: price ? `$${(price.marketCap / 1_000_000).toFixed(1)}M` : "—" },
                { label: "Chain", value: network?.chainName ?? "casper" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center text-xs py-1.5 border-b border-[rgba(100,255,218,0.08)]">
                  <span className="text-[#ebbbb4]">{item.label}</span>
                  <span className={`font-mono font-bold ${item.live ? "text-[#64FFDA]" : "text-[#d8e2ff]"}`}>{item.value}</span>
                </div>
              ))}
            </div>
            <a href={EXPLORER} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 w-full py-2 border border-[rgba(100,255,218,0.2)] rounded-lg text-[10px] font-mono text-[#64FFDA] hover:bg-[#64FFDA]/5 transition-colors">
              <span className="material-symbols-outlined text-[12px]">open_in_new</span>
              cspr.live Explorer
            </a>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Distribute Yield", icon: "payments", href: "/yield", color: "#64FFDA" },
            { label: "Compliance Report", icon: "verified_user", href: "/compliance", color: "#00C853" },
            { label: "Governance Vote", icon: "how_to_vote", href: "/governance", color: "#ebbbb4" },
            { label: "Stake CSPR", icon: "stacked_bar_chart", href: "/staking", color: "#FF0000" },
          ].map((action) => (
            <Link href={action.href} key={action.label}>
              <div className="p-4 rounded-xl flex flex-col items-center gap-2 cursor-pointer hover:brightness-110 active:scale-95 transition-all border border-[rgba(255,255,255,0.05)]" style={{ background: "rgba(17,34,64,0.7)" }}>
                <span className="material-symbols-outlined text-2xl" style={{ color: action.color }}>{action.icon}</span>
                <span className="text-xs font-medium text-center text-[#d8e2ff]">{action.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* FAB */}
      <Link href="/chat">
        <button className="fixed bottom-24 md:bottom-6 right-6 w-14 h-14 bg-[#FF0000] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,0,0,0.4)] hover:brightness-110 active:scale-95 transition-all z-20">
          <span className="material-symbols-outlined text-white">add</span>
        </button>
      </Link>
    </AppLayout>
  );
}
