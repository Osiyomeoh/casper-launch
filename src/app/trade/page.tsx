"use client";
import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import Link from "next/link";
import { useWallet } from "@/lib/wallet-context";

type Asset = {
  tokenId: string;
  deployStatus: string;
  holders: { publicKey: string; bps: number }[];
  metadata: { asset_name?: string; name?: string; price_per_token?: number; total_tokens?: number; valuation_usd?: number };
};

type Listing = {
  id: string; token_id: string; asset_name: string;
  amount: number; price_usd: number; total_usd: number;
  seller_wallet: string; bps: number; cspr_amount: number;
  created_at: number;
};

type StepState = "idle" | "pending" | "done" | "error";

function StepRow({ label, state, detail }: { label: string; state: StepState; detail?: string }) {
  const icon = state === "done" ? "check_circle" : state === "error" ? "cancel" : state === "pending" ? "pending" : "radio_button_unchecked";
  const color = state === "done" ? "text-[#00C853]" : state === "error" ? "text-[#FF6B6B]" : state === "pending" ? "text-[#64FFDA] animate-pulse" : "text-[#abb9d6]/40";
  return (
    <div className="flex items-center gap-3">
      <span className={`material-symbols-outlined text-lg ${color}`} style={{ fontVariationSettings: state === "done" ? "'FILL' 1" : undefined }}>{icon}</span>
      <div>
        <p className={`text-xs font-bold ${state === "idle" ? "text-[#abb9d6]/40" : "text-[#d8e2ff]"}`}>{label}</p>
        {detail && <p className="text-[10px] font-mono text-[#abb9d6]">{detail}</p>}
      </div>
    </div>
  );
}

function fmt(n: number) {
  return n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(2)}M` : n >= 1_000 ? `$${(n / 1_000).toFixed(1)}K` : `$${n.toFixed(2)}`;
}

export default function TradePage() {
  const wallet = useWallet();
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [listings, setListings] = useState<Listing[]>([]);
  const [csprPrice, setCsprPrice] = useState(0.03);
  const [selectedId, setSelectedId] = useState("");
  const [sellBps, setSellBps] = useState("");
  const [sellPriceUsd, setSellPriceUsd] = useState("");
  const [buyListing, setBuyListing] = useState<Listing | null>(null);
  const [steps, setSteps] = useState<Record<string, StepState>>({});
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    fetch("/api/tokens").then(r => r.json()).then((d: Asset[]) => {
      const confirmed = d.filter(a => a.deployStatus === "confirmed");
      setAssets(confirmed);
      if (confirmed.length) setSelectedId(confirmed[0].tokenId);
    }).catch(() => {});
    fetch("/api/orders?listings=1").then(r => r.json()).then((d: Listing[]) => setListings(d)).catch(() => {});
    fetch("/api/price").then(r => r.json()).then((d: { price?: number }) => { if (d.price) setCsprPrice(d.price); }).catch(() => {});
  }, [wallet.publicKey]);

  const selected = assets.find(a => a.tokenId === selectedId);
  const myHolding = selected?.holders.find(h => h.publicKey === wallet.publicKey);
  const myOpenListings = listings.filter(
    l => l.seller_wallet === wallet.publicKey && l.token_id === selectedId
  );
  const alreadyListedBps = myOpenListings.reduce((sum, l) => sum + l.bps, 0);
  const maxSellBps = Math.max(0, (myHolding?.bps ?? 0) - alreadyListedBps);

  function step(key: string, state: StepState, detail?: string) {
    setSteps(prev => ({ ...prev, [key]: state }));
    if (detail) setError(state === "error" ? detail : "");
  }

  async function handleSell() {
    if (!wallet.isConnected) return;
    if (!selected || !sellBps || !sellPriceUsd) return;
    const bps = parseInt(sellBps);
    const priceUsd = parseFloat(sellPriceUsd);
    if (bps > maxSellBps) { setError(`You only hold ${maxSellBps / 100}% (${maxSellBps} bps)`); return; }

    setWorking(true); setError(""); setDone("");
    setSteps({ list: "pending" });
    try {
      // priceUsd is the total USD consideration for this listing (not per-token).
      // Keep CSPR ≤ 10,000 for testnet seeding constraints.
      const totalCspr = Math.min(priceUsd / csprPrice, 10_000);
      const csprMotes = BigInt(Math.ceil(totalCspr * 1_000_000_000)).toString();
      // Step 1: User signs authorization message — wallet popup confirms intent
      step("list", "pending", "Confirm listing in wallet popup…");
      const authMsg = `CasperLaunch sell authorization\nAsset: ${selected.metadata.asset_name ?? selected.tokenId}\nYield: ${bps / 100}% (${bps} bps)\nPrice: ${csprMotes} motes\nSeller: ${(wallet.publicKey ?? "").slice(0, 20)}…`;
      await wallet.signMessage(authMsg);

      // Step 2: Agent submits the escrow listing on-chain
      step("list", "pending", "Submitting listing to escrow contract…");
      const res = await fetch("/api/casper/escrow-list-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token_id: selected.tokenId,
          asset_name: selected.metadata.asset_name ?? selected.tokenId,
          bps, price_cspr: csprMotes, price_usd: priceUsd,
          seller_wallet: wallet.publicKey,
        }),
      });
      const data = await res.json() as { listing_id?: string; tx_hash?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed");
      step("list", "done", `Listing tx: ${data.tx_hash?.slice(0, 12)}…`);

      // Step 3: Mirror in SQLite for orders UI (escrow-list already does this, skip duplicate)
      const updated2 = await fetch("/api/orders?listings=1").then(r => r.json()) as Listing[];
      setListings(updated2);
      setDone(`Listed ${bps / 100}% yield rights on-chain — tx ${data.tx_hash?.slice(0, 12)}…`);
      setSellBps(""); setSellPriceUsd("");
      setTab("buy"); // switch to Buy tab so user sees their new listing
    } catch (e) {
      step("list", "error", e instanceof Error ? e.message : "Failed");
    } finally { setWorking(false); }
  }


  async function handleBuy(listing: Listing) {
    if (!wallet.isConnected) { setError("Connect wallet first"); return; }
    setBuyListing(listing);
    setWorking(true); setError(""); setDone("");
    setSteps({ transfer: "pending", confirm: "idle", settle: "idle" });
    let activeStep = "transfer";

    try {
      // Step 1: Buyer signs an authorization message proving wallet ownership.
      const authMsg = `CasperLaunch buy authorization\nAsset: ${listing.asset_name}\nYield: ${listing.bps / 100}% (${listing.bps} bps)\nPrice: ${listing.cspr_amount.toFixed(2)} CSPR\nBuyer: ${(wallet.publicKey ?? "").slice(0, 20)}…`;
      step("transfer", "pending", "Confirm purchase in wallet popup…");
      const authSig = await wallet.signMessage(authMsg);
      step("transfer", "done", "Purchase authorized");

      // Step 2: Agent submits CSPR payment on-chain (TransactionV1 native transfer)
      activeStep = "confirm";
      step("confirm", "pending", "Submitting CSPR payment on-chain…");
      const payRes = await fetch("/api/casper/make-x402-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          senderPublicKey: wallet.publicKey,
          authMessage: authMsg,
          authSignature: authSig,
        }),
      });
      const payData = await payRes.json() as { txHash?: string; error?: string };
      if (!payRes.ok) throw new Error(`Payment http ${payRes.status}: ${payData.error ?? JSON.stringify(payData)}`);
      if (!payData.txHash) throw new Error(`Payment returned no txHash: ${JSON.stringify(payData)}`);
      step("confirm", "done", `Payment confirmed on-chain (${payData.txHash.slice(0, 12)}…)`);

      // Step 3: Settle yield rights on-chain
      activeStep = "settle";
      step("settle", "pending", "Transferring yield rights on-chain…");
      const settleRes = await fetch("/api/casper/settle-trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: listing.id,
          buyerPublicKey: wallet.publicKey,
          paymentHash: payData.txHash,
        }),
      });
      const settleData = await settleRes.json() as { ok?: boolean; buyerSettleHash?: string; error?: string };
      if (!settleRes.ok || !settleData.ok) throw new Error(settleData.error ?? "Settlement failed");

      activeStep = "settle";
      step("confirm", "done", "Payment processed on-chain");
      step("settle", "done", `Yield rights transferred: ${settleData.buyerSettleHash?.slice(0, 12)}…`);
      setDone(`Trade complete — you now hold ${listing.bps / 100}% yield rights in ${listing.asset_name}`);

      const updated = await fetch("/api/orders?listings=1").then(r => r.json()) as Listing[];
      setListings(updated);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Trade failed";
      step(activeStep, "error", msg);
    } finally { setWorking(false); }
  }

  return (
    <AppLayout title="Trade">
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Trade</h1>
            <p className="text-sm text-[#abb9d6] mt-1">Buy and sell fractional RWA yield rights on Casper testnet — fully on-chain.</p>
          </div>
          <Link href="/orders" className="hidden sm:flex items-center gap-1.5 bg-[#112240] border border-[rgba(100,255,218,0.15)] text-[#64FFDA] px-4 py-2 rounded-lg text-xs font-mono hover:text-[#d8e2ff] transition-colors">
            <span className="material-symbols-outlined text-sm">receipt_long</span>
            Order History
          </Link>
        </div>

        {/* CSPR price chip */}
        <div className="flex items-center gap-2 text-[10px] font-mono text-[#abb9d6]">
          <span className="w-1.5 h-1.5 rounded-full bg-[#64FFDA] animate-pulse"></span>
          CSPR ≈ ${csprPrice.toFixed(4)} USD
        </div>

        {!wallet.isConnected ? (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.15)] rounded-xl p-5 flex items-center justify-between">
            <p className="text-sm text-[#abb9d6]">Connect your CasperWallet to buy or list yield rights.</p>
            <button onClick={wallet.connect} disabled={wallet.loading}
              className="px-4 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
              {wallet.loading ? "Connecting…" : "Connect Wallet"}
            </button>
          </div>
        ) : (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.08)] rounded-xl px-4 py-2.5 flex items-center justify-between">
            <span className="text-xs font-mono text-[#abb9d6]">
              <span className="text-[#64FFDA]">●</span> {wallet.shortKey}
            </span>
            <button
              onClick={async () => {
                await wallet.disconnect();
                window.location.reload();
              }}
              className="text-[10px] font-mono text-[#abb9d6] hover:text-[#ff6b6b] transition-colors underline underline-offset-2"
            >
              Disconnect
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: action panel */}
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-2">
              {(["buy", "sell"] as const).map(t => (
                <button key={t} onClick={() => { setTab(t); setError(""); setDone(""); setSteps({}); }}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-bold transition-all ${
                    tab === t
                      ? t === "buy" ? "bg-[#00C853] text-white" : "bg-[#FF6B6B] text-white"
                      : "bg-[#112240] text-[#abb9d6] hover:text-[#d8e2ff]"
                  }`}>
                  {t === "buy" ? "Buy Yield Rights" : "List Yield Rights"}
                </button>
              ))}
            </div>

            {tab === "sell" ? (
              <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-4">
                <p className="text-[10px] font-mono text-[#64FFDA] uppercase tracking-wider">List your yield rights for sale</p>

                {/* Asset selector */}
                <div>
                  <label className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">Asset</label>
                  <select value={selectedId} onChange={e => setSelectedId(e.target.value)}
                    className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2.5 text-[#d8e2ff] text-sm focus:outline-none focus:border-[#64FFDA]">
                    {assets.map(a => (
                      <option key={a.tokenId} value={a.tokenId}>
                        {a.metadata.asset_name ?? `Token #${a.tokenId}`}
                      </option>
                    ))}
                  </select>
                </div>

                {myHolding && (
                  <div className="text-[10px] font-mono text-[#abb9d6] bg-[#112240] px-3 py-2 rounded-lg">
                    Your holding: <span className="text-[#64FFDA]">{myHolding.bps / 100}%</span> ({myHolding.bps} bps)
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">
                    Yield % to sell (in basis points, 100 = 1%)
                  </label>
                  <input value={sellBps} onChange={e => setSellBps(e.target.value.replace(/\D/g, ""))}
                    placeholder={`max ${maxSellBps}`}
                    className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2.5 text-[#d8e2ff] text-sm focus:outline-none focus:border-[#64FFDA]" />
                </div>

                <div>
                  <label className="text-[10px] font-mono text-[#abb9d6] uppercase tracking-wider">Price per token (USD)</label>
                  <input value={sellPriceUsd} onChange={e => setSellPriceUsd(e.target.value)}
                    placeholder="0.12"
                    className="mt-1 w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2.5 text-[#d8e2ff] text-sm focus:outline-none focus:border-[#64FFDA]" />
                </div>

                {sellBps && sellPriceUsd && (
                  <div className="text-[10px] font-mono text-[#abb9d6] bg-[#112240] px-3 py-2 rounded-lg space-y-1">
                    <div>Yield stake: <span className="text-[#d8e2ff]">{(parseInt(sellBps || "0") / 100).toFixed(2)}%</span></div>
                    <div>Total price: <span className="text-[#64FFDA]">{fmt(parseFloat(sellPriceUsd || "0"))}</span></div>
                    <div>≈ CSPR: <span className="text-[#64FFDA]">{Math.min(parseFloat(sellPriceUsd || "0") / csprPrice, 10_000).toFixed(2)}</span></div>
                  </div>
                )}

                <button onClick={handleSell}
                  disabled={working || !wallet.isConnected || !sellBps || !sellPriceUsd || parseInt(sellBps || "0") > maxSellBps || !myHolding}
                  className="w-full py-3 rounded-lg text-sm font-bold bg-[#FF6B6B] text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
                  {working ? "Creating listing…" : "List for Sale →"}
                </button>
              </div>
            ) : (
              <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-4">
                <p className="text-[10px] font-mono text-[#64FFDA] uppercase tracking-wider">Open sell listings</p>
                {listings.length === 0 ? (
                  <div className="py-8 text-center space-y-2">
                    <span className="material-symbols-outlined text-[#abb9d6]/30 text-4xl">sell</span>
                    <p className="text-xs text-[#abb9d6]">No listings yet — switch to "List" tab to create one</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {listings.map(l => (
                      <div key={l.id} className="p-3 bg-[#112240] rounded-lg border border-[rgba(100,255,218,0.08)]">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <p className="text-xs font-bold text-[#d8e2ff]">{l.asset_name}</p>
                            <p className="text-[10px] font-mono text-[#abb9d6]">{l.bps / 100}% yield rights · {l.amount.toLocaleString()} tokens</p>
                            <p className="text-[10px] font-mono text-[#abb9d6] truncate">Seller: {l.seller_wallet.slice(0, 16)}…</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#64FFDA]">{fmt(l.total_usd)}</p>
                            <p className="text-[10px] text-[#abb9d6]">{l.cspr_amount.toFixed(2)} CSPR</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleBuy(l)}
                          disabled={working || !wallet.isConnected || l.seller_wallet === wallet.publicKey}
                          className="w-full py-2 rounded-lg text-xs font-bold bg-[#00C853] text-white hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
                          {l.seller_wallet === wallet.publicKey ? "Your listing" : working && buyListing?.id === l.id ? "Processing…" : "Buy →"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right: progress + info */}
          <div className="space-y-4">
            {/* On-chain steps */}
            {Object.keys(steps).length > 0 && (
              <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-3">
                <p className="text-[10px] font-mono text-[#64FFDA] uppercase tracking-wider">On-chain Progress</p>
                {tab === "buy" ? (
                  <>
                    <StepRow label="Sign CSPR transfer" state={steps.transfer ?? "idle"} detail={steps.transfer === "error" ? error : undefined} />
                    <StepRow label="Payment confirmed on-chain" state={steps.confirm ?? "idle"} />
                    <StepRow label="Yield rights transferred" state={steps.settle ?? "idle"} detail={steps.settle === "error" ? error : undefined} />
                  </>
                ) : (
                  <StepRow label="On-chain listing created" state={steps.list ?? "idle"} />
                )}
                {done && (
                  <div className="flex items-center gap-2 pt-2 border-t border-[rgba(100,255,218,0.08)]">
                    <span className="material-symbols-outlined text-[#00C853] text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <p className="text-xs text-[#00C853] font-bold">{done}</p>
                  </div>
                )}
                {error && !done && (
                  <p className="text-xs text-[#FF6B6B] pt-1">{error}</p>
                )}
              </div>
            )}

            {/* How it works */}
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-5 space-y-3">
              <p className="text-[10px] font-mono text-[#64FFDA] uppercase tracking-wider">How on-chain trading works</p>
              {[
                { icon: "sell", title: "Seller lists on escrow contract", desc: "An on-chain listing is created in the trade-escrow smart contract — specifying bps, price in CSPR, and the yield contract address." },
                { icon: "account_balance_wallet", title: "Buyer signs CSPR payment", desc: "CasperWallet popup — buyer signs a native CSPR transfer directly to the seller. No intermediary holds funds." },
                { icon: "swap_horiz", title: "Agent settles yield rights", desc: "Once payment confirms on-chain, the agent calls register_holder on the yield contract — transferring the exact bps to the buyer's account permanently." },
              ].map(s => (
                <div key={s.title} className="flex gap-3">
                  <div className="w-8 h-8 flex-shrink-0 rounded-lg bg-[#112240] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[#64FFDA] text-[16px]">{s.icon}</span>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[#d8e2ff]">{s.title}</p>
                    <p className="text-[10px] text-[#abb9d6] mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
// deploy bump Sun Jun 28 13:55:15 WAT 2026
