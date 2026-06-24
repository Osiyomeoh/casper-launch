"use client";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";

export default function ProposalDetailPage() {
  return (
    <AppLayout title="Proposal Detail">
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/governance">
            <button className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#112240]">
              <span className="material-symbols-outlined text-[#abb9d6]">arrow_back</span>
            </button>
          </Link>
          <h1 className="text-xl font-bold text-[#d8e2ff]">Proposal Detail</h1>
        </div>

        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-10 text-center space-y-3">
          <span className="material-symbols-outlined text-[#abb9d6] text-5xl">how_to_vote</span>
          <div className="text-sm font-bold text-[#d8e2ff]">No proposals on-chain yet</div>
          <div className="text-xs text-[#abb9d6]">
            Governance proposals are created by the admin via the governance contract on Casper testnet.
          </div>
          <Link href="/governance">
            <button className="mt-2 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-[#253458] transition-all">
              Back to Governance
            </button>
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}
