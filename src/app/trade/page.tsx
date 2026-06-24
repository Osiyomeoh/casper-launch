"use client";
import { useState } from "react";
import AppLayout from "../components/AppLayout";

const SELLS = [
  { price: "4.2510", size: "12,400", total: "52,712.40" },
  { price: "4.2505", size: "8,200",  total: "34,854.10" },
  { price: "4.2500", size: "5,000",  total: "21,250.00" },
];
const BUYS = [
  { price: "4.2490", size: "22,000", total: "93,478.00" },
  { price: "4.2485", size: "15,000", total: "63,727.50" },
  { price: "4.2480", size: "9,800",  total: "41,590.40" },
];
const ACTIVITY = [
  { time: "14:02:11", price: "4.2490", size: "5,000",  side: "buy" },
  { time: "14:01:55", price: "4.2485", size: "12,000", side: "sell" },
  { time: "14:01:30", price: "4.2510", size: "3,200",  side: "buy" },
  { time: "14:00:58", price: "4.2480", size: "8,000",  side: "sell" },
  { time: "14:00:22", price: "4.2495", size: "6,500",  side: "buy" },
  { time: "13:59:48", price: "4.2470", size: "11,000", side: "sell" },
];

export default function TradePage() {
  const [tab, setTab]           = useState<"book" | "activity">("book");
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount]     = useState("");

  const received = amount
    ? (parseFloat(amount.replace(/,/g, "")) * 4.249).toFixed(2)
    : "0.00";

  return (
    <AppLayout title="Trade">
      <div className="p-4 md:p-8 space-y-6">

        {/* Top KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Last Price",   value: "$4.2490",  sub: "+1.24% today",    color: "text-[#00C853]" },
            { label: "24h Volume",   value: "$1.24M",   sub: "↑ 18% vs avg",    color: "text-[#64FFDA]" },
            { label: "24h High",     value: "$4.3120",  sub: "Session high",    color: "text-[#d8e2ff]" },
            { label: "24h Low",      value: "$4.1850",  sub: "Session low",     color: "text-[#ebbbb4]" },
          ].map((c) => (
            <div key={c.label} className="p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <p className="text-[10px] font-mono text-[#ebbbb4] uppercase tracking-widest mb-1">{c.label}</p>
              <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
              <p className="text-[10px] text-[#ebbbb4] mt-0.5">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Main two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left — chart + order book / activity */}
          <div className="space-y-4">
            {/* Chart placeholder */}
            <div className="h-48 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)] flex flex-col items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[#64FFDA]/30 text-4xl">candlestick_chart</span>
              <p className="text-xs font-mono text-[#ebbbb4]/50 uppercase tracking-widest">CS-ALP / USDC · 1h</p>
            </div>

            {/* Tab switcher */}
            <div className="flex gap-1 bg-[#112240] p-1 rounded-xl">
              {[["book", "Order Book"], ["activity", "Market Activity"]].map(([key, label]) => (
                <button key={key} onClick={() => setTab(key as any)}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors ${tab === key ? "bg-[#253453] text-[#d8e2ff]" : "text-[#ebbbb4] hover:text-[#d8e2ff]"}`}>
                  {label}
                </button>
              ))}
            </div>

            {tab === "book" && (
              <div className="rounded-xl overflow-hidden border border-[rgba(100,255,218,0.12)] bg-[#112240]">
                <div className="grid grid-cols-3 px-4 py-2 bg-[#000d27]/40 text-[#ebbbb4] text-[10px] font-mono uppercase tracking-widest">
                  <span>Price (USDC)</span><span className="text-center">Size</span><span className="text-right">Total</span>
                </div>
                {[...SELLS].reverse().map((o, i) => (
                  <div key={i} className="grid grid-cols-3 px-4 py-2.5 text-xs relative border-b border-[rgba(255,255,255,0.03)]">
                    <div className="absolute inset-0 bg-[#FF0000]/5" style={{ width: `${(i + 1) * 20}%` }} />
                    <span className="text-[#FF0000] font-mono relative z-10">{o.price}</span>
                    <span className="text-center text-[#d8e2ff] font-mono relative z-10">{o.size}</span>
                    <span className="text-right text-[#ebbbb4] font-mono relative z-10">{o.total}</span>
                  </div>
                ))}
                <div className="px-4 py-3 bg-[#253453]/60 flex items-center gap-3 border-y border-[rgba(100,255,218,0.15)]">
                  <span className="text-lg font-bold text-[#d8e2ff] font-mono">4.2490</span>
                  <span className="text-xs text-[#00C853] flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">arrow_upward</span>Last Trade
                  </span>
                  <span className="ml-auto text-[10px] font-mono text-[#ebbbb4]">Spread: 0.0010</span>
                </div>
                {BUYS.map((o, i) => (
                  <div key={i} className="grid grid-cols-3 px-4 py-2.5 text-xs relative border-b border-[rgba(255,255,255,0.03)] last:border-0">
                    <div className="absolute inset-0 bg-[#00C853]/5" style={{ width: `${(i + 1) * 20}%` }} />
                    <span className="text-[#00C853] font-mono relative z-10">{o.price}</span>
                    <span className="text-center text-[#d8e2ff] font-mono relative z-10">{o.size}</span>
                    <span className="text-right text-[#ebbbb4] font-mono relative z-10">{o.total}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "activity" && (
              <div className="rounded-xl overflow-hidden border border-[rgba(100,255,218,0.12)] bg-[#112240]">
                <div className="grid grid-cols-3 px-4 py-2 bg-[#000d27]/40 text-[#ebbbb4] text-[10px] font-mono uppercase tracking-widest">
                  <span>Time</span><span className="text-center">Price</span><span className="text-right">Size</span>
                </div>
                {ACTIVITY.map((t, i) => (
                  <div key={i} className="grid grid-cols-3 px-4 py-2.5 text-xs font-mono border-b border-[rgba(255,255,255,0.03)] last:border-0">
                    <span className="text-[#ebbbb4]">{t.time}</span>
                    <span className={`text-center ${t.side === "buy" ? "text-[#00C853]" : "text-[#FF0000]"}`}>{t.price}</span>
                    <span className="text-right text-[#d8e2ff]">{t.size}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right — order form */}
          <div className="space-y-4">
            {/* Pair info */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <div>
                <p className="text-base font-bold text-[#d8e2ff]">CS-ALP / USDC</p>
                <p className="text-[10px] font-mono text-[#ebbbb4] mt-0.5">Alpine Terrace — Fractional RWA Token</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-[#00C853]">$4.2490</p>
                <p className="text-[10px] font-mono text-[#00C853]">+1.24%</p>
              </div>
            </div>

            {/* Buy / Sell toggle */}
            <div className="flex gap-2 bg-[#112240] p-1 rounded-xl">
              {(["buy", "sell"] as const).map((t) => (
                <button key={t} onClick={() => setOrderType(t)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold capitalize transition-all ${
                    orderType === t
                      ? t === "buy" ? "bg-[#00C853] text-[#001a00] shadow-[0_0_12px_rgba(0,200,83,0.3)]"
                                    : "bg-[#FF0000] text-white shadow-[0_0_12px_rgba(255,0,0,0.3)]"
                      : "text-[#ebbbb4] hover:text-[#d8e2ff]"
                  }`}>
                  {t === "buy" ? "Buy" : "Sell"}
                </button>
              ))}
            </div>

            {/* Order type pills */}
            <div className="flex gap-2">
              {["Market", "Limit", "Stop"].map((ot, i) => (
                <button key={ot}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-mono border transition-colors ${i === 0 ? "border-[#64FFDA] text-[#64FFDA] bg-[#64FFDA]/5" : "border-[rgba(100,255,218,0.15)] text-[#ebbbb4] hover:border-[#64FFDA]/40"}`}>
                  {ot}
                </button>
              ))}
            </div>

            {/* Amount input */}
            <div className="space-y-3">
              <div className="flex items-center gap-3 bg-[#112240] border border-[rgba(100,255,218,0.15)] focus-within:border-[#64FFDA] rounded-xl px-4 py-3 transition-colors">
                <span className="text-[#ebbbb4] text-xs font-mono w-14 shrink-0">Amount</span>
                <input
                  className="flex-1 bg-transparent border-none focus:ring-0 text-right text-[#d8e2ff] font-mono text-lg outline-none placeholder:text-[#ebbbb4]/30"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
                <span className="text-[#64FFDA] font-mono text-xs shrink-0">CS-ALP</span>
              </div>

              {/* Quick % buttons */}
              <div className="flex gap-2">
                {["25%", "50%", "75%", "Max"].map((p) => (
                  <button key={p} className="flex-1 py-1.5 bg-[#253453] rounded-lg text-[10px] font-mono text-[#ebbbb4] hover:text-[#64FFDA] hover:bg-[#2d3d60] transition-colors">
                    {p}
                  </button>
                ))}
              </div>

              <div className="flex items-center justify-center">
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-[#253453] border border-[rgba(100,255,218,0.15)]">
                  <span className="material-symbols-outlined text-[#64FFDA] text-sm">swap_vert</span>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#112240] border border-[rgba(100,255,218,0.08)] rounded-xl px-4 py-3">
                <span className="text-[#ebbbb4] text-xs font-mono w-14 shrink-0">Receive</span>
                <span className="flex-1 text-right text-[#d8e2ff] font-mono text-lg">{received}</span>
                <span className="text-[#64FFDA] font-mono text-xs shrink-0">USDC</span>
              </div>
            </div>

            {/* Order summary */}
            <div className="p-4 rounded-xl bg-[#0a192f] border border-[rgba(100,255,218,0.08)] space-y-2 text-xs font-mono">
              {[
                { label: "Price",        value: "$4.2490 / CS-ALP" },
                { label: "Fee (0.1%)",   value: amount ? `$${(parseFloat(amount.replace(/,/g, "") || "0") * 4.249 * 0.001).toFixed(4)}` : "$0.00" },
                { label: "Slippage",     value: "~0.05%" },
                { label: "Settlement",   value: "Casper Mainnet" },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-[#ebbbb4]">{row.label}</span>
                  <span className="text-[#d8e2ff]">{row.value}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              className={`w-full py-4 rounded-xl font-bold text-base transition-all active:scale-95 ${
                orderType === "buy"
                  ? "bg-[#00C853] text-[#001a00] shadow-[0_0_20px_rgba(0,200,83,0.2)] hover:brightness-110"
                  : "bg-[#FF0000] text-white shadow-[0_0_20px_rgba(255,0,0,0.2)] hover:brightness-110"
              }`}>
              {orderType === "buy" ? "Buy CS-ALP" : "Sell CS-ALP"}
            </button>

            <p className="text-center text-[9px] font-mono text-[#ebbbb4]/50">
              Trades settle on Casper Mainnet via CEP-78 escrow contract
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
