"use client";
import { useState } from "react";
import AppLayout from "../components/AppLayout";
import { CONTRACT_HASHES } from "@/lib/contracts";

const contractDeployed = !!CONTRACT_HASHES.rwaNft;

export default function TradePage() {
  const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");

  return (
    <AppLayout title="Trade">
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Trade</h1>
          <p className="text-sm text-[#abb9d6] mt-1">Buy and sell fractional RWA tokens on Casper testnet.</p>
        </div>

        {!contractDeployed ? (
          <div className="bg-[#091b39] border border-[rgba(255,100,100,0.2)] rounded-xl p-6 text-center space-y-2">
            <span className="material-symbols-outlined text-[#FF6B6B] text-3xl">swap_horiz</span>
            <div className="text-sm font-bold text-[#FF6B6B]">No tradeable assets</div>
            <div className="text-xs text-[#abb9d6]">Tokenize a real-world asset first to enable trading.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Order form */}
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-4">
              <div className="flex gap-2">
                {(["buy", "sell"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${
                      orderType === t
                        ? t === "buy" ? "bg-[#00C853] text-white" : "bg-[#FF6B6B] text-white"
                        : "bg-[#112240] text-[#abb9d6] hover:text-[#d8e2ff]"
                    }`}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider">Amount (tokens)</label>
                <input
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2.5 text-[#d8e2ff] text-sm focus:outline-none focus:border-[#64FFDA]"
                />
              </div>
              <button className="w-full py-3 rounded-lg text-sm font-bold bg-[#FF0000] text-white hover:brightness-110 transition-all active:scale-95 disabled:opacity-40" disabled>
                No assets available to trade
              </button>
            </div>

            {/* Order book empty state */}
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-10 text-center space-y-3">
              <span className="material-symbols-outlined text-[#abb9d6] text-4xl">book</span>
              <div className="text-sm text-[#abb9d6]">Order book is empty — no tokenized assets listed yet.</div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
