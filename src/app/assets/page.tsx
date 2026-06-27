"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppLayout from "../components/AppLayout";
import { CONTRACT_HASHES } from "@/lib/contracts";
import { useWallet } from "@/lib/wallet-context";

const contractDeployed = !!CONTRACT_HASHES.rwaNft;

type TokenData = {
  tokenId: string;
  metadata: {
    asset_name?: string;
    asset_type?: string;
    location?: string;
    valuation_usd?: number;
    yield_apy?: number;
    total_tokens?: number;
    description?: string;
  };
  owner: string;
  deployHash: string;
  mintedAt: number;
  holders: { publicKey: string; bps: number }[];
  onChain?: { deployStatus: string; explorerUrl: string; contractUrl: string };
};

const TYPE_ICON: Record<string, string> = {
  residential: "home",
  commercial: "business",
  industrial: "factory",
  treasury: "account_balance",
};

function AssetCard({ token, stakeBps }: { token: TokenData; stakeBps?: number }) {
  const m = token.metadata;
  const icon = TYPE_ICON[m.asset_type ?? ""] ?? "apartment";
  const holders = token.holders?.length ?? 1;
  const mintDate = new Date(token.mintedAt).toLocaleDateString();
  return (
    <Link href={`/assets/${token.tokenId}`}>
      <div className="group bg-[#091b39] border border-[rgba(100,255,218,0.12)] hover:border-[rgba(100,255,218,0.35)] rounded-xl p-5 space-y-4 cursor-pointer transition-all hover:bg-[#0d2040]">
        <div className="flex items-start justify-between gap-2">
          <div className="w-10 h-10 rounded-lg bg-[#112240] border border-[rgba(100,255,218,0.15)] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#64FFDA] text-xl">{icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-[#d8e2ff] text-sm leading-tight truncate">{m.asset_name ?? `Token #${token.tokenId}`}</p>
            <p className="text-[10px] text-[#abb9d6] capitalize mt-0.5">{m.asset_type ?? "asset"} · {m.location ?? "Unknown"}</p>
            {stakeBps !== undefined && (
              <span className="inline-block mt-1 text-[9px] font-mono font-bold text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/20 px-2 py-0.5 rounded-full">
                {stakeBps >= 1000
                  ? `${(stakeBps / 100).toFixed(0)}% stake`
                  : stakeBps >= 10
                  ? `${(stakeBps / 100).toFixed(1)}% stake`
                  : `${(stakeBps / 100).toFixed(2)}% stake`}
              </span>
            )}
          </div>
          {token.onChain?.deployStatus === "confirmed"
            ? <span className="text-[9px] font-mono text-[#00C853] bg-[#00C853]/10 border border-[#00C853]/20 px-2 py-0.5 rounded-full shrink-0">CONFIRMED</span>
            : token.onChain?.deployStatus === "pending"
            ? <span className="text-[9px] font-mono text-[#FFD600] bg-[#FFD600]/10 border border-[#FFD600]/20 px-2 py-0.5 rounded-full shrink-0">PENDING</span>
            : token.onChain?.deployStatus === "failed"
            ? <span className="text-[9px] font-mono text-[#FF0000] bg-[#FF0000]/10 border border-[#FF0000]/20 px-2 py-0.5 rounded-full shrink-0">FAILED</span>
            : <span className="text-[9px] font-mono text-[#64FFDA] bg-[#64FFDA]/10 border border-[#64FFDA]/20 px-2 py-0.5 rounded-full shrink-0">LIVE</span>
          }
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Valuation", value: m.valuation_usd ? `$${(m.valuation_usd / 1000).toFixed(0)}K` : "—" },
            { label: "Yield APY", value: m.yield_apy ? `${m.yield_apy}%` : "—" },
            { label: "Holders", value: String(holders) },
          ].map((s) => (
            <div key={s.label} className="bg-[#112240] rounded-lg p-2 text-center">
              <p className="text-[9px] font-mono text-[#ebbbb4] uppercase">{s.label}</p>
              <p className="text-sm font-bold text-[#64FFDA] mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between pt-1 border-t border-[rgba(100,255,218,0.06)]">
          <div className="flex flex-col gap-0.5">
            <span className="text-[9px] font-mono text-[#abb9d6]">Minted {mintDate}</span>
            {token.onChain?.explorerUrl && (
              <button
                onClick={e => { e.preventDefault(); e.stopPropagation(); window.open(token.onChain!.explorerUrl, "_blank", "noopener,noreferrer"); }}
                className="text-[9px] font-mono text-[#64FFDA]/60 hover:text-[#64FFDA] flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                cspr.live
              </button>
            )}
          </div>
          <span className="text-[9px] font-mono text-[#64FFDA] group-hover:underline flex items-center gap-1">
            Cap Table <span className="material-symbols-outlined text-[11px]">arrow_forward</span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function AssetsPage() {
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const { publicKey } = useWallet();

  useEffect(() => {
    fetch("/api/casper/chain-assets")
      .then(r => r.json())
      .then((data: { tokens?: TokenData[] }) => {
        const rawTokens: TokenData[] = Array.isArray(data.tokens) ? data.tokens : [];
        // Deduplicate by deployHash — sync may create on-chain-index records alongside timestamp-ID records
        const seenHashes = new Set<string>();
        const serverTokens = rawTokens.filter(t => {
          if (!t.deployHash) return true;
          if (seenHashes.has(t.deployHash)) return false;
          seenHashes.add(t.deployHash);
          return true;
        });
        const serverIds = new Set(serverTokens.map(t => String(t.tokenId)));

        // Merge in localStorage tokens that aren't in the server DB (pre-migration)
        // Skip empty ones — those are failed mints with no metadata
        let localTokens: TokenData[] = [];
        try {
          const stored = JSON.parse(localStorage.getItem("casperlaunch:tokens") ?? "{}") as Record<string, TokenData>;
          localTokens = Object.values(stored)
            .filter(t => !serverIds.has(String(t.tokenId)))
            .filter(t => t.metadata?.asset_name || t.metadata?.valuation_usd)
            .map(t => ({ ...t, tokenId: String(t.tokenId), mintedAt: Number(t.mintedAt) }));
        } catch {}

        setTokens([...serverTokens, ...localTokens]);
      })
      .catch(() => {
        // If server fails entirely, fall back to localStorage
        try {
          const stored = JSON.parse(localStorage.getItem("casperlaunch:tokens") ?? "{}") as Record<string, TokenData>;
          setTokens(Object.values(stored).map(t => ({ ...t, tokenId: String(t.tokenId), mintedAt: Number(t.mintedAt) })));
        } catch {}
      });
  }, []);

  const ownedAssets = publicKey
    ? tokens.filter(t => t.owner === publicKey)
    : [];
  const stakedAssets = publicKey
    ? tokens.filter(t => t.owner !== publicKey && t.holders?.some(h => h.publicKey === publicKey))
    : [];
  const otherAssets = publicKey
    ? tokens.filter(t => t.owner !== publicKey && !t.holders?.some(h => h.publicKey === publicKey))
    : tokens;

  return (
    <AppLayout
      title="Assets"
      action={
        <Link href="/chat">
          <button className="bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all active:scale-95 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">add</span>
            Tokenize Asset
          </button>
        </Link>
      }
    >
      <div className="p-4 md:p-8 space-y-8">

        {!contractDeployed && (
          <div className="bg-[#091b39] border border-[rgba(255,100,100,0.2)] rounded-xl p-6 text-center space-y-3">
            <span className="material-symbols-outlined text-[#FF6B6B] text-4xl">warning</span>
            <div className="text-sm font-bold text-[#FF6B6B]">RWA NFT contract not configured</div>
            <div className="text-xs text-[#abb9d6]">Set NEXT_PUBLIC_RWA_NFT_HASH in .env.local.</div>
          </div>
        )}

        {contractDeployed && (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-3 flex items-center gap-3">
            <span className="material-symbols-outlined text-[#64FFDA] text-sm shrink-0">verified</span>
            <div className="min-w-0">
              <span className="text-[9px] font-mono text-[#ebbbb4] uppercase">RWA NFT Contract</span>
              <a href={`https://testnet.cspr.live/contract/${CONTRACT_HASHES.rwaNft}`} target="_blank" rel="noopener noreferrer"
                className="block font-mono text-[10px] text-[#64FFDA] hover:underline truncate">{CONTRACT_HASHES.rwaNft}</a>
            </div>
          </div>
        )}

        {/* My Assets */}
        {!publicKey ? (
          <section className="space-y-3">
            <h2 className="text-lg font-bold text-[#d8e2ff]">My Assets</h2>
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.08)] rounded-xl p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-[#abb9d6] text-4xl">account_balance_wallet</span>
              <p className="text-sm text-[#abb9d6]">Connect your CasperWallet to see your assets</p>
            </div>
          </section>
        ) : (
          <>
            {/* Owned — minted by this wallet */}
            <section className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-[#d8e2ff]">Owned</h2>
                <p className="text-xs text-[#abb9d6] mt-0.5">Assets you minted — you hold the NFT deed</p>
              </div>
              {ownedAssets.length === 0 ? (
                <div className="bg-[#091b39] border border-[rgba(100,255,218,0.08)] rounded-xl p-8 text-center space-y-3">
                  <span className="material-symbols-outlined text-[#abb9d6] text-4xl">apartment</span>
                  <p className="text-sm text-[#d8e2ff] font-bold">No owned assets</p>
                  <p className="text-xs text-[#abb9d6]">Tokenize a real-world asset to become the deed holder.</p>
                  <Link href="/chat">
                    <button className="mt-1 bg-[#FF0000] text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:brightness-110 transition-all active:scale-95">
                      + Tokenize Asset
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {ownedAssets.map(t => <AssetCard key={t.tokenId} token={t} />)}
                </div>
              )}
            </section>

            {/* Positions — investor stakes */}
            {stakedAssets.length > 0 && (
              <section className="space-y-4">
                <div>
                  <h2 className="text-lg font-bold text-[#d8e2ff]">My Positions</h2>
                  <p className="text-xs text-[#abb9d6] mt-0.5">Assets where you hold a fractional yield stake</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stakedAssets.map(t => {
                    const bps = t.holders?.find(h => h.publicKey === publicKey)?.bps;
                    return <AssetCard key={t.tokenId} token={t} stakeBps={bps} />;
                  })}
                </div>
              </section>
            )}
          </>
        )}

        {/* All Assets on CasperLaunch */}
        <section className="space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#d8e2ff]">All Assets on CasperLaunch</h2>
            <p className="text-xs text-[#abb9d6] mt-0.5">Every CEP-78 RWA token minted on Casper testnet</p>
          </div>

          {tokens.length === 0 ? (
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.08)] rounded-xl p-8 text-center space-y-2">
              <span className="material-symbols-outlined text-[#abb9d6] text-4xl">token</span>
              <p className="text-sm text-[#abb9d6]">No assets have been tokenized yet</p>
            </div>
          ) : otherAssets.length === 0 && publicKey ? (
            <div className="bg-[#091b39] border border-[rgba(100,255,218,0.08)] rounded-xl p-6 text-center">
              <p className="text-sm text-[#abb9d6]">You hold a stake in all tokenized assets on the platform.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {(publicKey ? otherAssets : tokens).map(t => <AssetCard key={t.tokenId} token={t} />)}

            </div>
          )}
        </section>

      </div>
    </AppLayout>
  );
}
