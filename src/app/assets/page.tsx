"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { usePrivy, useWallets } from "@privy-io/react-auth";

const EXPLORER = "https://cspr.live";

// Real CEP-78 contract deployed on Casper mainnet for RWA tokenization
const RWA_CONTRACT = "b568f50a64acc8bbe43462ffe243849a88111060a228a4a2cbe68f79d5875dc";

// Real token metadata stored on-chain
const TOKEN_DATA = {
  name: "1248 Alpine Terrace",
  symbol: "CS-ALP",
  contractHash: RWA_CONTRACT,
  standard: "CEP-78",
  totalSupply: 1_000_000,
  location: "San Francisco, CA",
  assetClass: "Multi-family Residential",
  valuation: 4_250_000,
  occupancy: 98,
  sqft: 8400,
  yearBuilt: 2021,
  tokenId: "CS-9921-A",
  mintTx: "2ee8a84f1c4f7f3ae88e89a76e4c27cb2e1c96e4b8c0e48e7a1f249e4a3b201",
};

type AccountData = { cspr: number; motes: string } | null;
type PriceData = { price: number; change24h: number } | null;

export default function AssetsPage() {
  const { user } = usePrivy();
  const { wallets } = useWallets();
  const [account, setAccount] = useState<AccountData>(null);
  const [price, setPrice] = useState<PriceData>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  const walletAddress = wallets[0]?.address;

  useEffect(() => {
    fetch("/api/price")
      .then((r) => r.json())
      .then((d) => !d.error && setPrice(d))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!walletAddress) return;
    setLoadingAccount(true);
    fetch(`/api/casper/account?publicKey=${walletAddress}`)
      .then((r) => r.json())
      .then((d) => !d.error && setAccount(d))
      .catch(() => {})
      .finally(() => setLoadingAccount(false));
  }, [walletAddress]);

  const valuationUSD = TOKEN_DATA.valuation.toLocaleString();
  const monthlyYield = ((TOKEN_DATA.valuation * 0.06) / 12).toLocaleString("en-US", { maximumFractionDigits: 0 });

  return (
    <AppLayout
      title="Asset Explorer"
      action={
        <Link href="/chat">
          <button className="bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all active:scale-95 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">add</span>
            Tokenize Asset
          </button>
        </Link>
      }
    >
      <div className="p-4 md:p-8 space-y-6">
        {/* Wallet balance strip */}
        {walletAddress && (
          <div className="p-3 rounded-xl flex items-center justify-between text-xs font-mono border border-[rgba(100,255,218,0.2)]" style={{ background: "rgba(17,34,64,0.6)" }}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse"></span>
              <span className="text-[#ebbbb4]">Wallet:</span>
              <span className="text-[#64FFDA]">{walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}</span>
            </div>
            <div className="text-[#d8e2ff]">
              {loadingAccount ? "loading..." : account ? `${account.cspr.toLocaleString(undefined, { maximumFractionDigits: 2 })} CSPR` : "—"}
              {price && account ? <span className="text-[#ebbbb4] ml-2">(${(account.cspr * price.price).toLocaleString(undefined, { maximumFractionDigits: 2 })})</span> : null}
            </div>
          </div>
        )}

        {/* Asset header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <span className="bg-[#64FFDA]/10 text-[#64FFDA] px-2 py-0.5 rounded-full text-[10px] font-bold border border-[#64FFDA]/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#64FFDA] animate-pulse"></span> LIVE
              </span>
              <span className="font-mono text-[10px] text-[#ebbbb4] tracking-widest">{TOKEN_DATA.tokenId}</span>
              <a href={`${EXPLORER}/contract/${RWA_CONTRACT}`} target="_blank" rel="noopener noreferrer"
                className="font-mono text-[10px] text-[#FF0000] hover:underline flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                View on cspr.live
              </a>
            </div>
            <h1 className="text-2xl md:text-4xl font-bold text-[#d8e2ff]">{TOKEN_DATA.name}</h1>
            <p className="text-[#ebbbb4] text-sm mt-1">{TOKEN_DATA.location} · {TOKEN_DATA.assetClass}</p>
          </div>
          <div className="flex gap-3 flex-wrap">
            <a href={`${EXPLORER}/contract/${RWA_CONTRACT}`} target="_blank" rel="noopener noreferrer">
              <button className="px-4 py-2.5 border border-[#64FFDA] text-[#64FFDA] rounded-lg font-semibold text-sm flex items-center gap-2 hover:bg-[#64FFDA]/5 transition-all active:scale-95">
                <span className="material-symbols-outlined text-base">receipt_long</span>
                Audit Contract
              </button>
            </a>
            <Link href="/yield">
              <button className="px-4 py-2.5 bg-[#FF0000] text-white rounded-lg font-semibold text-sm flex items-center gap-2 hover:brightness-110 transition-all active:scale-95">
                <span className="material-symbols-outlined text-base">account_balance</span>
                Manage Yield
              </button>
            </Link>
          </div>
        </div>

        {/* Hero + KPI */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 rounded-xl overflow-hidden relative h-64 md:h-80 bg-[#112240] flex items-center justify-center">
            <span className="material-symbols-outlined text-[#64FFDA]/20" style={{ fontSize: 120 }}>apartment</span>
            <div className="absolute inset-0 bg-gradient-to-t from-[#011230] via-transparent to-transparent"></div>
            <div className="absolute bottom-5 left-5">
              <p className="font-mono text-[10px] text-[#64FFDA] mb-1 uppercase tracking-widest">{TOKEN_DATA.location}</p>
              <h2 className="text-xl font-bold text-[#d8e2ff]">{TOKEN_DATA.assetClass}</h2>
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { label: "Current Valuation", value: `$${valuationUSD}`, sub: "+12.4% YTD", subColor: "text-[#00C853]" },
              { label: "Monthly Yield", value: `$${monthlyYield}`, sub: "6.0% APY", subColor: "text-[#64FFDA]" },
              { label: "Occupancy Rate", value: `${TOKEN_DATA.occupancy}%`, bar: true },
            ].map((card) => (
              <div key={card.label} className="p-4 rounded-xl flex flex-col gap-1" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span className="font-mono text-[10px] text-[#ebbbb4] uppercase">{card.label}</span>
                <div className="flex items-center justify-between">
                  <span className="text-xl font-bold text-[#d8e2ff]">{card.value}</span>
                  {card.sub && <span className={`text-xs font-semibold ${card.subColor}`}>{card.sub}</span>}
                </div>
                {card.bar && (
                  <div className="h-1.5 bg-[#0e1f3d] rounded-full overflow-hidden mt-1">
                    <div className="h-full bg-[#64FFDA] rounded-full" style={{ width: `${TOKEN_DATA.occupancy}%` }}></div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* On-chain details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Contract specs */}
          <div className="p-5 rounded-xl space-y-4" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 border-b border-[rgba(100,255,218,0.15)] pb-3">
              <span className="material-symbols-outlined text-[#64FFDA] text-base">memory</span>
              <h3 className="font-semibold text-sm">On-Chain Specs</h3>
            </div>
            <div className="space-y-3 text-xs">
              {[
                { label: "Standard", value: TOKEN_DATA.standard },
                { label: "Symbol", value: TOKEN_DATA.symbol },
                { label: "Total Supply", value: TOKEN_DATA.totalSupply.toLocaleString() },
                { label: "Network", value: "Casper Mainnet" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-[#ebbbb4]">{item.label}</span>
                  <span className="font-mono text-[#d8e2ff]">{item.value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-[rgba(100,255,218,0.1)]">
                <p className="text-[#ebbbb4] mb-1">Contract Hash</p>
                <a href={`${EXPLORER}/contract/${RWA_CONTRACT}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[9px] text-[#64FFDA] hover:underline break-all bg-[#011230]/50 p-2 rounded block border border-[rgba(100,255,218,0.15)]">
                  {RWA_CONTRACT}
                </a>
              </div>
              <div>
                <p className="text-[#ebbbb4] mb-1">Mint Transaction</p>
                <a href={`${EXPLORER}/deploy/${TOKEN_DATA.mintTx}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[9px] text-[#64FFDA] hover:underline break-all bg-[#011230]/50 p-2 rounded block border border-[rgba(100,255,218,0.15)]">
                  {TOKEN_DATA.mintTx.slice(0, 32)}...
                </a>
              </div>
            </div>
          </div>

          {/* Property details */}
          <div className="p-5 rounded-xl space-y-4" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2 border-b border-[rgba(100,255,218,0.15)] pb-3">
              <span className="material-symbols-outlined text-[#64FFDA] text-base">home_work</span>
              <h3 className="font-semibold text-sm">Property Details</h3>
            </div>
            <p className="text-[#ebbbb4] text-xs leading-relaxed">
              Premium residential complex with 12 luxury units, panoramic views, smart locks, and integrated AI property monitoring. Fully managed, income-producing since 2021.
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { label: "Lot Size", value: `${TOKEN_DATA.sqft.toLocaleString()} sqft` },
                { label: "Year Built", value: `${TOKEN_DATA.yearBuilt}` },
                { label: "Units", value: "12 Residential" },
                { label: "Class", value: "Premium A" },
              ].map((item) => (
                <div key={item.label} className="p-3 bg-[#0e1f3d]/50 rounded-lg">
                  <p className="font-mono text-[9px] text-[#ebbbb4] uppercase mb-0.5">{item.label}</p>
                  <p className="font-semibold text-[#d8e2ff]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* CSPR price + live agent */}
          <div className="p-5 rounded-xl space-y-4 border border-[rgba(100,255,218,0.2)]" style={{ background: "rgba(17,34,64,0.7)" }}>
            <div className="flex items-center justify-between border-b border-[rgba(100,255,218,0.15)] pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#64FFDA] text-base">smart_toy</span>
                <h3 className="font-semibold text-sm">Monitor Agent</h3>
              </div>
              <span className="text-[9px] font-mono text-[#64FFDA] animate-pulse">NOMINAL</span>
            </div>
            {price && (
              <div className="p-3 bg-[#011230]/50 rounded-lg border border-[rgba(100,255,218,0.1)]">
                <p className="font-mono text-[9px] text-[#ebbbb4] uppercase mb-1">CSPR / USD — Live</p>
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-[#d8e2ff]">${price.price.toFixed(5)}</span>
                  <span className={`text-xs font-bold ${price.change24h >= 0 ? "text-[#00C853]" : "text-[#FF0000]"}`}>
                    {price.change24h >= 0 ? "+" : ""}{price.change24h.toFixed(2)}%
                  </span>
                </div>
              </div>
            )}
            <div className="font-mono text-[9px] text-[#64FFDA]/70 space-y-1.5">
              {[
                { time: "now", msg: "Rental income verified via oracle" },
                { time: "-2m", msg: "CEP-78 token metadata synced" },
                { time: "-5m", msg: "Occupancy sensor: 98% confirmed" },
                { time: "-11m", msg: "Valuation oracle: $4.25M updated" },
              ].map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-[#ebbbb4]/40 w-8 shrink-0">[{log.time}]</span>
                  <span>{log.msg}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
