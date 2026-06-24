"use client";
import AppLayout from "../components/AppLayout";
import { CONTRACT_HASHES } from "@/lib/contracts";

const contractDeployed = !!CONTRACT_HASHES.rwaNft;

export default function CompliancePage() {
  return (
    <AppLayout title="Compliance & Audit">
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Compliance & Audit</h1>
          <p className="text-sm text-[#abb9d6] mt-1">
            Every action the AI agent takes is recorded on-chain and auditable in real time.
          </p>
        </div>

        {/* Status cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: "Events Logged", value: "—", sub: "No assets yet", icon: "visibility" },
            { label: "Issues Detected", value: "0", sub: "System secure", icon: "warning", valueColor: "text-[#00C853]" },
            { label: "Verification Rate", value: "—", icon: "verified_user", sub: "Mint assets to begin" },
          ].map((card) => (
            <div key={card.label} className="rounded-xl p-5 relative overflow-hidden" style={{ background: "rgba(17,34,64,0.7)", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div className="absolute top-3 right-3 opacity-10">
                <span className="material-symbols-outlined text-5xl text-[#ffb4a8]">{card.icon}</span>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#ebbbb4]">{card.label}</p>
              <h3 className={`text-3xl font-bold mt-2 ${card.valueColor ?? "text-[#d8e2ff]"}`}>{card.value}</h3>
              <p className="mt-3 text-xs text-[#abb9d6]">{card.sub}</p>
            </div>
          ))}
        </div>

        {/* Audit log empty state */}
        {!contractDeployed ? (
          <div className="bg-[#091b39] border border-[rgba(255,100,100,0.2)] rounded-xl p-6 text-center space-y-2">
            <span className="material-symbols-outlined text-[#FF6B6B] text-3xl">gavel</span>
            <div className="text-sm font-bold text-[#FF6B6B]">Contracts not deployed</div>
            <div className="text-xs text-[#abb9d6]">Deploy contracts and mint assets to generate a real audit trail.</div>
          </div>
        ) : (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[rgba(100,255,218,0.1)] flex justify-between items-center">
              <h4 className="font-bold text-sm text-[#d8e2ff]">Audit Log</h4>
              <span className="bg-[#64FFDA]/10 text-[#64FFDA] text-[10px] px-2 py-0.5 rounded font-mono border border-[#64FFDA]/20">LIVE</span>
            </div>
            <div className="p-10 text-center space-y-3">
              <span className="material-symbols-outlined text-[#abb9d6] text-4xl">receipt_long</span>
              <div className="text-sm text-[#abb9d6]">No audit events yet — events will appear here once assets are minted and the AI agent starts acting on-chain.</div>
            </div>
          </div>
        )}

        {/* On-chain proof note */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 flex items-start gap-3">
          <span className="material-symbols-outlined text-[#64FFDA] text-[20px] mt-0.5">info</span>
          <div className="text-xs text-[#abb9d6] leading-relaxed">
            Compliance events are generated automatically when the AI agent mints tokens, distributes yield, or updates CEP-78 metadata. All actions are verifiable on{" "}
            <a href="https://testnet.cspr.live" target="_blank" rel="noopener noreferrer" className="text-[#64FFDA] hover:underline">testnet.cspr.live</a>.
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
