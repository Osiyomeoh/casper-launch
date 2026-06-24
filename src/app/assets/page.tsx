"use client";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { CONTRACT_HASHES } from "@/lib/contracts";

const contractDeployed = !!CONTRACT_HASHES.rwaNft;

export default function AssetsPage() {
  return (
    <AppLayout
      title="My Assets"
      action={
        <Link href="/chat">
          <button className="bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all active:scale-95 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">add</span>
            Tokenize Asset
          </button>
        </Link>
      }
    >
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-[#d8e2ff]">Tokenized Assets</h1>
          <p className="text-sm text-[#abb9d6] mt-1">
            CEP-78 NFTs minted on Casper testnet representing real-world assets.
          </p>
        </div>

        {!contractDeployed ? (
          <div className="bg-[#091b39] border border-[rgba(255,100,100,0.2)] rounded-xl p-6 text-center space-y-3">
            <span className="material-symbols-outlined text-[#FF6B6B] text-4xl">apartment</span>
            <div className="text-sm font-bold text-[#FF6B6B]">RWA NFT contract not configured</div>
            <div className="text-xs text-[#abb9d6]">Set NEXT_PUBLIC_RWA_NFT_HASH in .env.local after deploying the contract.</div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Contract info */}
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4">
              <div className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider mb-2">RWA NFT Contract (CEP-78)</div>
              <a
                href={`https://testnet.cspr.live/contract/${CONTRACT_HASHES.rwaNft}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[#64FFDA] hover:underline break-all"
              >
                {CONTRACT_HASHES.rwaNft}
              </a>
            </div>

            {/* Empty state */}
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-10 text-center space-y-3">
              <span className="material-symbols-outlined text-[#abb9d6] text-5xl">apartment</span>
              <div className="text-sm font-bold text-[#d8e2ff]">No assets tokenized yet</div>
              <div className="text-xs text-[#abb9d6]">
                Use the AI tokenization wizard to mint your first CEP-78 RWA token on Casper testnet.
              </div>
              <Link href="/chat">
                <button className="mt-2 bg-[#FF0000] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all active:scale-95">
                  + Tokenize Your First Asset
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
