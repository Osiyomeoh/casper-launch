"use client";
import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import Link from "next/link";

type Order = {
  id: string; token_id: string; asset_name: string;
  order_type: "buy" | "sell"; amount: number;
  price_usd: number; total_usd: number;
  status: "open" | "filled" | "cancelled"; created_at: number;
};

const STATUS_STYLES: Record<string, string> = {
  filled:    "text-[#00C853] bg-[#00C853]/10 border-[#00C853]/20",
  open:      "text-[#64FFDA] bg-[#64FFDA]/10 border-[#64FFDA]/20",
  cancelled: "text-[#ebbbb4] bg-[#ebbbb4]/10 border-[#ebbbb4]/20",
};

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K`
    : `$${n.toFixed(2)}`;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState("all");
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/orders")
      .then(r => r.json())
      .then((data: Order[]) => setOrders(data))
      .catch(() => {});
  }, []);

  async function cancel(id: string) {
    setCancelling(id);
    try {
      await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: "cancelled" } : o));
    } finally {
      setCancelling(null);
    }
  }

  function exportCsv() {
    const header = "ID,Asset,Type,Amount,Price,Total,Status,Date";
    const rows = orders.map(o =>
      [o.id, o.asset_name, o.order_type, o.amount, o.price_usd, o.total_usd, o.status,
       new Date(o.created_at).toISOString()].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "orders.csv"; a.click();
  }

  const filtered = filter === "all" ? orders : orders.filter(o => o.status === filter);
  const totalVolume = orders.filter(o => o.status === "filled").reduce((s, o) => s + o.total_usd, 0);
  const filled    = orders.filter(o => o.status === "filled").length;
  const open      = orders.filter(o => o.status === "open").length;
  const cancelled = orders.filter(o => o.status === "cancelled").length;

  return (
    <AppLayout title="Order History" action={
      <button onClick={exportCsv} className="hidden sm:flex items-center gap-1.5 bg-[#112240] border border-[rgba(100,255,218,0.15)] text-[#ebbbb4] px-4 py-2 rounded-lg text-xs font-mono hover:text-[#d8e2ff] transition-colors">
        <span className="material-symbols-outlined text-sm">download</span>
        Export CSV
      </button>
    }>
      <div className="p-4 md:p-8 space-y-6">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Volume (Filled)", value: fmt(totalVolume), color: "text-[#d8e2ff]",  icon: "payments" },
            { label: "Filled",          value: String(filled),   color: "text-[#00C853]",  icon: "check_circle" },
            { label: "Open",            value: String(open),     color: "text-[#64FFDA]",  icon: "pending_actions" },
            { label: "Cancelled",       value: String(cancelled),color: "text-[#ebbbb4]",  icon: "cancel" },
          ].map(c => (
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
        <div className="flex gap-2 flex-wrap">
          {["all", "open", "filled", "cancelled"].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors capitalize ${
                filter === f ? "bg-[#64FFDA] text-[#001a00]" : "bg-[#112240] text-[#ebbbb4] hover:text-[#d8e2ff]"
              }`}>
              {f}
            </button>
          ))}
          <Link href="/trade" className="ml-auto px-4 py-1.5 rounded-full text-xs font-bold bg-[#FF0000]/80 text-white hover:brightness-110 transition-all">
            + New Order
          </Link>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center gap-3 text-center rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
            <span className="material-symbols-outlined text-[#64FFDA]/30 text-5xl">receipt_long</span>
            <p className="text-[#d8e2ff] font-semibold">No orders yet</p>
            <p className="text-xs text-[#ebbbb4] max-w-xs">Orders placed through the Trade page will appear here.</p>
            <Link href="/trade" className="mt-2 px-4 py-2 rounded-lg bg-[#FF0000] text-white text-xs font-bold hover:brightness-110 transition-all">
              Go to Trade →
            </Link>
          </div>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden sm:block rounded-xl overflow-hidden border border-[rgba(100,255,218,0.12)] bg-[#112240]">
              <table className="w-full text-left">
                <thead className="bg-[#000d27]/40 text-[#ebbbb4] font-mono text-[10px] uppercase tracking-widest">
                  <tr>
                    {["Order ID", "Asset", "Type", "Amount", "Price", "Total", "Status", "Date", ""].map(h => (
                      <th key={h} className="px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[rgba(100,255,218,0.06)] text-sm">
                  {filtered.map(o => (
                    <tr key={o.id} className="hover:bg-[#253453]/30 transition-colors">
                      <td className="px-4 py-4 font-mono text-xs text-[#64FFDA]">{o.id}</td>
                      <td className="px-4 py-4 font-mono text-xs text-[#d8e2ff] font-bold max-w-[140px] truncate">{o.asset_name}</td>
                      <td className="px-4 py-4">
                        <span className={`font-bold text-xs ${o.order_type === "buy" ? "text-[#00C853]" : "text-[#FF6B6B]"}`}>
                          {o.order_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 font-mono text-xs">{o.amount.toLocaleString()}</td>
                      <td className="px-4 py-4 font-mono text-xs">${o.price_usd}</td>
                      <td className="px-4 py-4 font-mono text-xs font-bold">{fmt(o.total_usd)}</td>
                      <td className="px-4 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLES[o.status]}`}>
                          {o.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-xs text-[#ebbbb4] font-mono whitespace-nowrap">
                        {new Date(o.created_at).toLocaleDateString()} · {new Date(o.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-4">
                        {o.status === "open" && (
                          <button onClick={() => cancel(o.id)} disabled={cancelling === o.id}
                            className="px-3 py-1 rounded-lg border border-[#FF0000]/30 text-[#FF0000] text-[10px] font-bold hover:bg-[#FF0000]/5 transition-colors disabled:opacity-40">
                            {cancelling === o.id ? "…" : "Cancel"}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-3">
              {filtered.map(o => (
                <div key={o.id} className="p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-xs font-bold ${o.order_type === "buy" ? "text-[#00C853]" : "text-[#FF6B6B]"}`}>
                          {o.order_type.toUpperCase()}
                        </span>
                        <span className="font-mono text-xs text-[#64FFDA] truncate max-w-[140px]">{o.asset_name}</span>
                      </div>
                      <p className="text-[10px] text-[#ebbbb4] font-mono">{o.id} · {new Date(o.created_at).toLocaleDateString()}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${STATUS_STYLES[o.status]}`}>
                      {o.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "Amount", value: o.amount.toLocaleString() },
                      { label: "Price",  value: `$${o.price_usd}` },
                      { label: "Total",  value: fmt(o.total_usd) },
                    ].map(f => (
                      <div key={f.label}>
                        <p className="text-[10px] text-[#ebbbb4] font-mono uppercase mb-0.5">{f.label}</p>
                        <p className="font-bold font-mono">{f.value}</p>
                      </div>
                    ))}
                  </div>
                  {o.status === "open" && (
                    <button onClick={() => cancel(o.id)} disabled={cancelling === o.id}
                      className="w-full mt-3 py-2 rounded-lg border border-[#FF0000]/30 text-[#FF0000] text-xs font-bold hover:bg-[#FF0000]/5 transition-colors disabled:opacity-40">
                      {cancelling === o.id ? "Cancelling…" : "Cancel Order"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
