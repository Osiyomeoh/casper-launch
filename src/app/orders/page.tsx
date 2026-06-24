"use client";
import { useState } from "react";
import AppLayout from "../components/AppLayout";

const ORDERS: {
  id: string; asset: string; type: string; amount: string;
  price: string; total: string; status: string; time: string; date: string;
}[] = [];

const STATUS_STYLES: Record<string, string> = {
  Filled:    "text-[#00C853] bg-[#00C853]/10 border-[#00C853]/20",
  Open:      "text-[#64FFDA] bg-[#64FFDA]/10 border-[#64FFDA]/20",
  Cancelled: "text-[#ebbbb4] bg-[#ebbbb4]/10 border-[#ebbbb4]/20",
};

export default function OrdersPage() {
  const [filter, setFilter] = useState("All");

  const filtered = filter === "All" ? ORDERS : ORDERS.filter((o) => o.status === filter);

  const totalVolume = ORDERS.reduce((s, o) => s + parseFloat(o.total.replace(/,/g, "")), 0);
  const filled    = ORDERS.filter((o) => o.status === "Filled").length;
  const open      = ORDERS.filter((o) => o.status === "Open").length;
  const cancelled = ORDERS.filter((o) => o.status === "Cancelled").length;

  return (
    <AppLayout title="Order History" action={
      <button className="hidden sm:flex items-center gap-1.5 bg-[#112240] border border-[rgba(100,255,218,0.15)] text-[#ebbbb4] px-4 py-2 rounded-lg text-xs font-mono hover:text-[#d8e2ff] transition-colors">
        <span className="material-symbols-outlined text-sm">download</span>
        Export CSV
      </button>
    }>
      <div className="p-4 md:p-8 space-y-6">

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Total Volume",  value: `$${(totalVolume / 1_000_000).toFixed(2)}M`, color: "text-[#d8e2ff]",  icon: "payments" },
            { label: "Filled Orders", value: String(filled),    color: "text-[#00C853]", icon: "check_circle" },
            { label: "Open Orders",   value: String(open),      color: "text-[#64FFDA]", icon: "pending_actions" },
            { label: "Cancelled",     value: String(cancelled), color: "text-[#ebbbb4]", icon: "cancel" },
          ].map((c) => (
            <div key={c.label} className="p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#64FFDA]/60 text-lg">{c.icon}</span>
                <p className="text-[10px] font-mono text-[#ebbbb4] uppercase tracking-widest">{c.label}</p>
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          ))}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2">
          {["All", "Filled", "Open", "Cancelled"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${filter === f ? "bg-[#64FFDA] text-[#001a00]" : "bg-[#112240] text-[#ebbbb4] hover:text-[#d8e2ff]"}`}>
              {f}
            </button>
          ))}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="py-16 flex flex-col items-center gap-3 text-center rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
            <span className="material-symbols-outlined text-[#64FFDA]/30 text-5xl">receipt_long</span>
            <p className="text-[#d8e2ff] font-semibold">No orders yet</p>
            <p className="text-xs text-[#ebbbb4] max-w-xs">Orders placed through the Trade page will appear here. Mint RWA tokens first, then trade them.</p>
          </div>
        )}

        {/* Desktop table */}
        <div className={`${filtered.length === 0 ? "hidden" : "hidden sm:block"} rounded-xl overflow-hidden border border-[rgba(100,255,218,0.12)] bg-[#112240]`}>
          <table className="w-full text-left">
            <thead className="bg-[#000d27]/40 text-[#ebbbb4] font-mono text-[10px] uppercase tracking-widest">
              <tr>
                {["Order ID", "Asset", "Type", "Amount", "Price", "Total", "Status", "Time", ""].map((h) => (
                  <th key={h} className="px-5 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[rgba(100,255,218,0.06)] text-sm">
              {filtered.map((o) => (
                <tr key={o.id} className="hover:bg-[#253453]/30 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-[#64FFDA]">{o.id}</td>
                  <td className="px-5 py-4 font-mono text-xs text-[#d8e2ff] font-bold">{o.asset}</td>
                  <td className="px-5 py-4">
                    <span className={`font-bold text-xs ${o.type === "Buy" ? "text-[#00C853]" : "text-[#FF0000]"}`}>{o.type}</span>
                  </td>
                  <td className="px-5 py-4 font-mono text-xs">{o.amount}</td>
                  <td className="px-5 py-4 font-mono text-xs">{o.price}</td>
                  <td className="px-5 py-4 font-mono text-xs font-bold">${o.total}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLES[o.status]}`}>{o.status}</span>
                  </td>
                  <td className="px-5 py-4 text-xs text-[#ebbbb4] font-mono whitespace-nowrap">{o.date} · {o.time}</td>
                  <td className="px-5 py-4">
                    {o.status === "Open" && (
                      <button className="px-3 py-1 rounded-lg border border-[#FF0000]/30 text-[#FF0000] text-[10px] font-bold hover:bg-[#FF0000]/5 transition-colors">
                        Cancel
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className={`${filtered.length === 0 ? "hidden" : "sm:hidden"} space-y-3`}>
          {filtered.map((o) => (
            <div key={o.id} className="p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs font-bold ${o.type === "Buy" ? "text-[#00C853]" : "text-[#FF0000]"}`}>{o.type}</span>
                    <span className="font-mono text-xs text-[#64FFDA]">{o.asset}</span>
                  </div>
                  <p className="text-[10px] text-[#ebbbb4] font-mono">{o.id} · {o.date} {o.time}</p>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLES[o.status]}`}>{o.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: "Amount", value: o.amount },
                  { label: "Price",  value: o.price },
                  { label: "Total",  value: `$${o.total}` },
                ].map((f) => (
                  <div key={f.label}>
                    <p className="text-[10px] text-[#ebbbb4] font-mono uppercase mb-0.5">{f.label}</p>
                    <p className="font-bold font-mono">{f.value}</p>
                  </div>
                ))}
              </div>
              {o.status === "Open" && (
                <button className="w-full mt-3 py-2 rounded-lg border border-[#FF0000]/30 text-[#FF0000] text-xs font-bold hover:bg-[#FF0000]/5 transition-colors">
                  Cancel Order
                </button>
              )}
            </div>
          ))}
        </div>

      </div>
    </AppLayout>
  );
}
