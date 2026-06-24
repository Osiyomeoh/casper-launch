"use client";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { CONTRACT_HASHES } from "@/lib/contracts";

const contractDeployed = !!CONTRACT_HASHES.rwaNft;

export default function PortfolioPage() {
  return (
    <AppLayout title="Portfolio">
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Portfolio</h1>
          <p className="text-sm text-[#abb9d6] mt-1">All tokenized RWA positions across your connected wallet.</p>
        </div>

        {!contractDeployed ? (
          <div className="bg-[#091b39] border border-[rgba(255,100,100,0.2)] rounded-xl p-6 text-center space-y-2">
            <span className="material-symbols-outlined text-[#FF6B6B] text-3xl">account_balance_wallet</span>
            <div className="text-sm font-bold text-[#FF6B6B]">Contracts not deployed</div>
            <div className="text-xs text-[#abb9d6]">Deploy the RWA NFT contract first, then tokenize assets to see them here.</div>
          </div>
        ) : (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-10 text-center space-y-3">
            <span className="material-symbols-outlined text-[#abb9d6] text-5xl">account_balance_wallet</span>
            <div className="text-sm font-bold text-[#d8e2ff]">No positions yet</div>
            <div className="text-xs text-[#abb9d6]">Tokenize an asset to see it appear here.</div>
            <Link href="/chat">
              <button className="mt-2 bg-[#FF0000] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all active:scale-95">
                + Tokenize Asset
              </button>
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
