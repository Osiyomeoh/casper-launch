"use client";
import AppLayout from "../components/AppLayout";
import { useState } from "react";

const SECTIONS = [
  {
    id: "abstract",
    title: "1. Abstract",
    icon: "description",
    content: `CasperLaunch is a blockchain-based platform for the tokenization, trading, and yield distribution of real-world assets — built on the Casper Network. It enables fractional ownership of physical assets including real estate, commodities, treasury instruments, and invoices, making them accessible to any investor globally regardless of technical background or capital size.

The platform combines an AI agent for metadata extraction and autonomous yield distribution, a CEP-78 NFT standard for on-chain asset representation, an x402 micropayment protocol for AI service monetization, and Privy embedded wallets for web2 user onboarding — all deployed on the Casper blockchain.`,
  },
  {
    id: "problem",
    title: "2. The Problem",
    icon: "error_outline",
    content: `An estimated $326 trillion in real-world assets exists globally. The vast majority is inaccessible to ordinary investors. Real estate, commercial property, farmland, and infrastructure assets require minimum investments ranging from $50,000 to several million dollars, complex legal processes involving lawyers and notaries, long settlement periods of 30 to 90 days, and zero liquidity once invested.

Across Africa — from Ghana and Kenya to Egypt and South Africa — high-value real estate exists in abundance but the mechanisms to invest in it at scale do not. A diaspora investor who wants to own African real estate must navigate local agents, title disputes, foreign currency restrictions, and a lack of transparent pricing.

Traditional real estate investment vehicles — REITs, property funds, SPV syndicates — require investors to trust a fund manager, a custodian, a law firm, and an auditor simultaneously. In many markets that trust is routinely violated. Yield is misreported. Capital is misappropriated. Investors have no independent verification mechanism.`,
  },
  {
    id: "solution",
    title: "3. The Solution",
    icon: "lightbulb",
    content: `CasperLaunch addresses each problem with a layered approach:

• High minimum investment → Fractional CEP-78 tokens — own from 0.01% of any asset
• Complex legal process → AI agent extracts metadata, SPV structure handles legal title
• No liquidity → On-chain secondary marketplace with instant settlement
• Zero transparency → Every transaction on public Casper blockchain, independently verifiable
• Trust in intermediaries → Smart contracts enforce all rules — no human discretion in distributions
• Crypto knowledge required → Privy embedded wallets — sign in with email or Google, no extension needed
• Geographic barriers → Any wallet, anywhere, subject only to jurisdiction-specific eligibility rules`,
  },
  {
    id: "market",
    title: "4. Market Opportunity",
    icon: "trending_up",
    content: `The tokenized RWA market is projected to reach $10 trillion by 2030 according to Boston Consulting Group estimates. Real estate represents the largest segment — approximately 60% of the total addressable market.

Africa has a housing deficit of over 50 million units. Urban real estate across the continent — from Nairobi and Accra to Cairo and Johannesburg — consistently delivers 8–15% annual rental yields, significantly above returns available in developed markets. Yet foreign and diaspora investment is structurally constrained by opacity and legal friction.

Casper's enterprise-grade blockchain — with predictable gas costs, formal verification support, and a permissioned account model — is uniquely positioned for regulated asset tokenization.`,
  },
  {
    id: "contracts",
    title: "5. Smart Contracts",
    icon: "code",
    content: `All contracts are written in Rust, compiled to WebAssembly, and deployed on the Casper Network.

RWA NFT Contract (CEP-78)
The core asset representation contract. Each minted token represents fractional or whole ownership of a real-world asset. Key entry points: mint(), transfer(), add_to_whitelist(), update_metadata(), register_holder().

Yield Distributor Contract
Manages yield pool collection and proportional distribution to all registered holders. Distribution formula: holder_share = (holder_bps / 10000) × pool_balance × (1 - platform_fee). Key entry points: deposit(), distribute(), claim(), register_holder().

Governance Contract
On-chain proposal and voting system. Standard proposals require 51% quorum. Parameter changes require 66% supermajority. Asset sales require 75% supermajority. All passed proposals enter a 48-hour time-lock before execution.`,
  },
  {
    id: "ai",
    title: "6. AI Agent Layer",
    icon: "smart_toy",
    content: `Asset Tokenization Agent
Powered by Google Gemini 2.0 Flash. When a user describes an asset in natural language, the agent extracts structured CEP-78 metadata, validates it against a schema, checks KYC status on-chain, constructs a mint transaction, and submits it to the Casper network. Access is gated by the x402 micropayment protocol — 3 CSPR on-chain before AI processing begins.

Autonomous Yield Distribution Agent
Runs as a persistent server-side process booted automatically on server start. Every 30 seconds it queries the yield distributor contract. When the pool balance exceeds the threshold, it autonomously signs and submits a distribute() transaction — no human approval required. The agent's authority is limited by the smart contract.`,
  },
  {
    id: "wallets",
    title: "7. Wallet Infrastructure",
    icon: "account_balance_wallet",
    content: `Privy — Web2 Onboarding
CasperLaunch integrates Privy for embedded wallet creation. A user with no blockchain experience signs in with their Google account or email, receives an embedded Casper wallet created silently by Privy, and can immediately buy fractional property, earn yield, and vote on governance proposals. The embedded wallet is non-custodial — Privy uses threshold cryptography so no single party holds the full key.

In production, Privy connects to fiat on-ramps so users top up with a credit card and Privy handles CSPR conversion. A user who has never heard of blockchain can buy fractional real estate in under three minutes.

CasperWallet — Native Crypto Users
Users with existing CasperWallet installations connect directly. Switching accounts updates all page data in real time without a refresh.`,
  },
  {
    id: "trading",
    title: "8. Marketplace & Trading",
    icon: "swap_horiz",
    content: `Listing
A token holder creates a listing by specifying basis points to sell, asking price in USD, and minimum buyer holding period. The listing is recorded on-chain via the escrow contract. The seller's stake is locked until the listing expires or is filled.

Buy Flow — Production
Buyer signs and submits CSPR directly to the escrow contract. Escrow holds funds atomically. On confirmation, escrow calls transfer on the NFT contract. NFT transfer triggers register_holder on yield distributor via cross-contract call. Escrow releases CSPR to seller. Entire flow is atomic.

Transfer Restrictions
The NFT contract enforces eligibility class checks, holding period locks, investor caps, and jurisdiction blocks — in contract code, not UI.`,
  },
  {
    id: "yield",
    title: "9. Yield Distribution",
    icon: "account_balance",
    content: `Yield Sources
In production, yield enters the distributor contract from verified, whitelisted sources only. Residential real estate yield comes from rental income collected by the property manager and converted to CSPR. Every deposit is accompanied by a signed receipt — the contract validates the signature before accepting.

Distribution Mechanics
The autonomous agent triggers distribute() when pool balance exceeds the threshold. Distribution is proportional to registered basis points. Gas costs are paid by the agent and recovered from the platform fee. Holders receive net yield with no gas burden.

Yield Reporting
Every distribution generates an on-chain event log. In production, quarterly yield reports are auto-generated from on-chain data and delivered via email through Privy's notification layer.`,
  },
  {
    id: "legal",
    title: "10. Legal & Compliance",
    icon: "gavel",
    content: `Special Purpose Vehicle Structure
Every tokenized asset is held inside an SPV — a limited liability company created for that asset. The SPV holds legal title. The CEP-78 token represents beneficial ownership of the SPV. This provides legally enforceable investor rights, clear regulatory classification, and platform bankruptcy protection.

KYC / AML
Identity verification via licensed KYC provider. AML screening against OFAC, UN, EU, and local sanctions lists. KYC approval is written on-chain by the provider's verified key. Only the approval hash and expiry date are stored — no personal data on-chain.

Securities Regulation
• Africa: Ghana SEC, Kenya CMA, South Africa FSCA, Egypt FSA
• UK: FCA Appointed Representative arrangement
• EU: MiCA compliance
• US: Regulation D 506(c) — accredited investors only`,
  },
  {
    id: "assetmgmt",
    title: "11. Asset Management",
    icon: "apartment",
    content: `Property Management
Each real estate asset is managed by an accredited local property management company. The property manager handles tenant sourcing, rent collection, maintenance within a defined capex threshold, and annual inspections. Decisions above the threshold require a token holder governance vote.

Valuation
Asset valuations are updated annually by independent licensed valuers. Reports are pinned to IPFS. The platform's oracle key (requiring 2-of-3 multisig approval) calls update_metadata() with the IPFS hash as evidence. Full valuation history is permanently auditable on-chain.

Asset Sale & Exit
Token holders can vote to sell the underlying asset. Sale proceeds are paid out proportionally to all holders, CEP-78 tokens are burned, and the SPV is wound down.

Insurance
Every production asset carries property insurance, smart contract cover, agent key custodian insurance, and D&O insurance — all certificates stored on IPFS.`,
  },
  {
    id: "security",
    title: "12. Security Model",
    icon: "security",
    content: `Agent Key Security
In production, the agent key is held by a licensed digital asset custodian under a 2-of-3 threshold scheme. Any agent-initiated transaction requires reconstruction from at least 2 shards. Key rotation requires a community governance vote.

Smart Contract Security
All contracts undergo automated Rust static analysis, manual audit by a specialist security firm, formal verification of the yield distribution math, and a bug bounty programme of up to $50,000 for critical vulnerabilities.

Oracle Security
Pyth Network's on-chain price feed with time-weighted average price. Maximum 5% price deviation per block. 2-of-3 oracle key signatures required for any off-chain price submission.

Governance Security
Snapshot voting, 48-hour time-lock, 5-member multisig council veto, and 100 CSPR proposal deposit.`,
  },
  {
    id: "roadmap",
    title: "13. Roadmap",
    icon: "map",
    content: `Phase 1 — Testnet (Current)
CEP-78 RWA NFT, yield distributor, and governance contracts deployed. AI tokenization with x402 payment gate. Privy + CasperWallet dual authentication. Secondary marketplace operational.

Phase 2 — Mainnet Beta (Q3 2026)
Mainnet deployment with full security audit. First three assets tokenized — African residential properties. Real KYC via Fractal ID. Pyth Network oracle. Fiat on-ramp via MoonPay.

Phase 3 — Regulated Launch (Q4 2026)
Ghana SEC and Kenya CMA registration. UK FCA Appointed Representative status. Multi-asset support — treasury bills and trade invoices.

Phase 4 — Scale (2027)
Pan-African expansion. Cross-chain bridge — Ethereum and Polygon. Asset-backed lending. Progressive governance decentralization. $100M total assets tokenized target.`,
  },
];

export default function DocsPage() {
  const [active, setActive] = useState("abstract");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const current = SECTIONS.find(s => s.id === active) ?? SECTIONS[0];
  const idx = SECTIONS.findIndex(s => s.id === active);

  return (
    <AppLayout title="Whitepaper">
      <div className="flex h-full min-h-screen">
        {/* Collapsible TOC sidebar */}
        <aside className={`hidden lg:flex flex-col shrink-0 border-r border-[rgba(100,255,218,0.08)] bg-[#091b39] sticky top-0 h-screen overflow-y-auto transition-all duration-300 ${sidebarOpen ? "w-64" : "w-14"}`}>
          <div className={`flex items-center border-b border-[rgba(100,255,218,0.08)] py-3 px-2 gap-2`}>
            {sidebarOpen && <p className="text-[10px] font-mono uppercase tracking-widest text-[#ebbbb4] flex-1 pl-1">Contents</p>}
            <button onClick={() => setSidebarOpen(v => !v)}
              className="w-7 h-7 rounded-lg bg-[#112240] hover:bg-[#1a2f52] border border-[rgba(100,255,218,0.1)] flex items-center justify-center transition-all shrink-0 ml-auto"
              title={sidebarOpen ? "Collapse" : "Expand"}>
              <span className="material-symbols-outlined text-[#64FFDA] text-sm">
                {sidebarOpen ? "chevron_left" : "chevron_right"}
              </span>
            </button>
          </div>
          <nav className="p-2 space-y-0.5 flex-1">
            {SECTIONS.map(s => (
              <button key={s.id}
                onClick={() => { setActive(s.id); if (!sidebarOpen) setSidebarOpen(true); }}
                title={!sidebarOpen ? s.title : undefined}
                className={`w-full text-left px-2 py-2.5 rounded-lg text-xs transition-all flex items-center gap-2 ${
                  active === s.id
                    ? "bg-[#FF0000]/10 text-[#FF0000] font-semibold border border-[#FF0000]/20"
                    : "text-[#abb9d6] hover:text-[#d8e2ff] hover:bg-[#112240]"
                } ${!sidebarOpen ? "justify-center" : ""}`}>
                <span className="material-symbols-outlined text-sm shrink-0">{s.icon}</span>
                {sidebarOpen && <span className="leading-tight truncate">{s.title}</span>}
              </button>
            ))}
          </nav>
          {sidebarOpen && (
            <div className="p-4 border-t border-[rgba(100,255,218,0.08)]">
              <p className="text-[9px] font-mono text-[#abb9d6] leading-relaxed">Version 1.0 — June 2026<br />Casper Agentic Buildathon</p>
            </div>
          )}
        </aside>

        {/* Main content */}
        <div className="flex-1 p-4 md:p-8 max-w-3xl w-full">
          {/* Mobile section picker */}
          <div className="lg:hidden mb-6">
            <select value={active} onChange={e => setActive(e.target.value)}
              className="w-full bg-[#112240] border border-[rgba(100,255,218,0.2)] text-[#d8e2ff] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#64FFDA]">
              {SECTIONS.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>

          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-[#FF0000]/10 border border-[#FF0000]/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#FF0000] text-xl">{current.icon}</span>
            </div>
            <div>
              <p className="font-mono text-[10px] text-[#64FFDA]/60 uppercase tracking-widest">Section {String(idx + 1).padStart(2, "0")} of {SECTIONS.length}</p>
              <h2 className="text-lg font-bold text-[#d8e2ff]">{current.title}</h2>
            </div>
          </div>

          {/* Content card */}
          <div className="rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)] p-6 space-y-4">
            {current.content.split("\n\n").map((para, i) => (
              <div key={i}>
                {para.includes("\n•") || para.startsWith("•") ? (
                  <ul className="space-y-2">
                    {para.split("\n").map((line, j) =>
                      line.startsWith("•") ? (
                        <li key={j} className="flex items-start gap-2 text-sm text-[#abb9d6] leading-relaxed">
                          <span className="text-[#FF0000] shrink-0 mt-0.5">▸</span>
                          <span>{line.slice(2)}</span>
                        </li>
                      ) : <p key={j} className="text-sm text-[#abb9d6] leading-relaxed">{line}</p>
                    )}
                  </ul>
                ) : para.split("\n").length > 1 ? (
                  <div className="space-y-1.5">
                    {para.split("\n").map((line, j) =>
                      j === 0
                        ? <p key={j} className="text-sm font-semibold text-[#64FFDA]">{line}</p>
                        : <p key={j} className="text-sm text-[#abb9d6] leading-relaxed">{line}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-[#abb9d6] leading-relaxed">{para}</p>
                )}
              </div>
            ))}
          </div>

          {/* Prev / Next */}
          <div className="flex justify-between mt-6 gap-4">
            {SECTIONS[idx - 1] ? (
              <button onClick={() => setActive(SECTIONS[idx - 1].id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#112240] border border-[rgba(100,255,218,0.08)] text-xs text-[#abb9d6] hover:text-[#d8e2ff] hover:border-[#64FFDA]/20 transition-all">
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                {SECTIONS[idx - 1].title}
              </button>
            ) : <div />}
            {SECTIONS[idx + 1] ? (
              <button onClick={() => setActive(SECTIONS[idx + 1].id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#112240] border border-[rgba(100,255,218,0.08)] text-xs text-[#abb9d6] hover:text-[#d8e2ff] hover:border-[#64FFDA]/20 transition-all ml-auto">
                {SECTIONS[idx + 1].title}
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FF0000]/10 border border-[#FF0000]/20 text-xs text-[#FF0000] font-bold ml-auto">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                End of Whitepaper
              </div>
            )}
          </div>

          <p className="text-[10px] font-mono text-[#abb9d6]/40 text-center mt-10 leading-relaxed">
            This whitepaper is for informational purposes only and does not constitute an offer to sell or solicitation to buy any security.<br />
            CasperLaunch is currently deployed on Casper testnet.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}
