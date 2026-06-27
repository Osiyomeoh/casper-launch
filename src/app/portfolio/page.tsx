"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { useWallet } from "@/lib/wallet-context";

type Holder = { publicKey: string; bps: number };
type TokenData = {
  tokenId: string; deployStatus: string; deployHash: string; mintedAt: number; owner: string;
  metadata: { asset_name?: string; asset_type?: string; location?: string; valuation_usd?: number; yield_apy?: number };
  holders: Holder[];
};

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export default function PortfolioPage() {
  const wallet = useWallet();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/tokens")
      .then(r => r.json())
      .then((d: TokenData[]) => setTokens(Array.isArray(d) ? d.filter(t => t.deployStatus === "confirmed") : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, [wallet.publicKey]);

  const myHoldings = tokens.map(t => {
    const holder = t.holders?.find(h => h.publicKey === wallet.publicKey);
    const bps = holder?.bps ?? (t.owner === wallet.publicKey ? 10000 : 0);
    return { ...t, bps };
  }).filter(t => t.bps > 0);

  const totalValue = myHoldings.reduce((s, t) => s + (t.metadata.valuation_usd ?? 0) * t.bps / 10000, 0);
  const totalYield = myHoldings.reduce((s, t) => s + (t.metadata.valuation_usd ?? 0) * (t.metadata.yield_apy ?? 0) / 100 * t.bps / 10000, 0);

  return (
    <AppLayout title="Portfolio">
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Portfolio</h1>
            <p className="text-sm text-[#abb9d6] mt-1">Your fractional RWA positions on Casper testnet.</p>
          </div>
          {wallet.isConnected && <span className="text-[10px] font-mono text-[#00C853]">● {wallet.shortKey}</span>}
        </div>

        {!wallet.isConnected ? (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.15)] rounded-xl p-8 text-center space-y-3">
            <span className="material-symbols-outlined text-[#64FFDA]/40 text-5xl">account_balance_wallet</span>
            <p className="text-sm font-bold text-[#d8e2ff]">Connect your wallet to see your holdings</p>
            <button onClick={wallet.connect} className="mt-2 bg-[#FF0000] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all">Connect Wallet</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: "Portfolio Value", value: loading ? "…" : fmt(totalValue), sub: "across all positions", icon: "monitoring", color: "text-[#64FFDA]" },
                { label: "Annual Yield", value: loading ? "…" : fmt(totalYield), sub: "projected income", icon: "payments", color: "text-[#00C853]" },
                { label: "Positions", value: loading ? "…" : myHoldings.length.toString(), sub: "tokenized assets", icon: "token", color: "text-[#d8e2ff]" },
              ].map(card => (
                <div key={card.label} className="rounded-xl p-5 bg-[#112240] border border-[rgba(100,255,218,0.08)] relative overflow-hidden">
                  <div className="absolute top-3 right-3 opacity-10"><span className="material-symbols-outlined text-5xl text-[#64FFDA]">{card.icon}</span></div>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#ebbbb4]">{card.label}</p>
                  <p className={`text-3xl font-bold mt-2 ${card.color}`}>{card.value}</p>
                  <p className="text-xs text-[#abb9d6] mt-2">{card.sub}</p>
                </div>
              ))}
            </div>

            {loading ? (
              <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#64FFDA] border-t-transparent rounded-full animate-spin" /></div>
            ) : myHoldings.length === 0 ? (
              <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-10 text-center space-y-3">
                <span className="material-symbols-outlined text-[#abb9d6] text-5xl">account_balance_wallet</span>
                <p className="text-sm font-bold text-[#d8e2ff]">No positions yet</p>
                <p className="text-xs text-[#abb9d6]">Tokenize an asset or buy yield rights on the Trade page.</p>
                <div className="flex gap-3 justify-center mt-2">
                  <Link href="/chat"><button className="bg-[#FF0000] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:brightness-110">+ Tokenize Asset</button></Link>
                  <Link href="/trade"><button className="border border-[#64FFDA]/30 text-[#64FFDA] px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#64FFDA]/5">Buy Yield Rights</button></Link>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h3 className="font-bold text-sm text-[#d8e2ff]">Your Holdings</h3>
                {myHoldings.map(t => {
                  const stake = t.bps / 100;
                  const positionValue = (t.metadata.valuation_usd ?? 0) * t.bps / 10000;
                  const annualYield = positionValue * (t.metadata.yield_apy ?? 0) / 100;
                  return (
                    <Link href={`/assets/${t.tokenId}`} key={t.tokenId}>
                      <div className="p-5 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)] hover:border-[#64FFDA]/30 transition-all cursor-pointer">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-[#64FFDA]/10 flex items-center justify-center shrink-0">
                              <span className="material-symbols-outlined text-[#64FFDA] text-xl">apartment</span>
                            </div>
                            <div>
                              <p className="font-bold text-sm text-[#d8e2ff]">{t.metadata.asset_name ?? `Token #${t.tokenId}`}</p>
                              <p className="text-[10px] font-mono text-[#abb9d6]">{t.metadata.asset_type ?? "Real Estate"} · {t.metadata.location ?? "—"}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="font-bold text-sm text-[#64FFDA]">{fmt(positionValue)}</p>
                            <p className="text-[10px] text-[#abb9d6]">{stake.toFixed(2)}% stake</p>
                          </div>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-4 text-center border-t border-[rgba(100,255,218,0.06)] pt-3">
                          {[["STAKE", `${stake.toFixed(2)}%`, "text-[#d8e2ff]"], ["APY", `${t.metadata.yield_apy ?? 0}%`, "text-[#00C853]"], ["ANNUAL", fmt(annualYield), "text-[#d8e2ff]"]].map(([l, v, c]) => (
                            <div key={l}><p className="text-[10px] font-mono text-[#ebbbb4]">{l}</p><p className={`text-sm font-bold ${c}`}>{v}</p></div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                          <a href={`https://testnet.cspr.live/deploy/${t.deployHash}`} target="_blank" rel="noopener noreferrer"
                            onClick={e => e.stopPropagation()} className="text-[#64FFDA] hover:underline flex items-center gap-1">
                            <span className="material-symbols-outlined text-[11px]">open_in_new</span>{t.deployHash.slice(0, 12)}…
                          </a>
                          <span className="text-[#00C853]">● On-chain confirmed</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
