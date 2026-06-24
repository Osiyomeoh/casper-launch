"use client";
import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { useCasperWallet } from "@/lib/casper-wallet";
import { buildVoteTransaction, CONTRACT_HASHES } from "@/lib/contracts";
import { PublicKey } from "casper-js-sdk";

type Proposal = {
  id: string;
  title: string;
  status: "Active" | "Passed" | "Failed";
  quorum: number;
  endDate: string;
  votes: { for: number; against: number; abstain: number };
};

const STATUS_STYLES: Record<string, string> = {
  Active: "text-[#64FFDA] border-[#64FFDA]/30 bg-[#64FFDA]/10",
  Passed: "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/10",
  Failed: "text-[#FF0000] border-[#FF0000]/30 bg-[#FF0000]/10",
};

const contractDeployed = !!CONTRACT_HASHES.governance;

export default function GovernancePage() {
  const wallet = useCasperWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(contractDeployed);
  const [voted, setVoted] = useState<Record<string, "for" | "against">>({});
  const [voting, setVoting] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  useEffect(() => {
    if (!contractDeployed) return;
    // TODO: fetch proposals from governance contract via RPC
    // For now resolves empty until contract is deployed and read methods are wired
    setLoading(false);
    setProposals([]);
  }, []);

  async function castVote(proposalId: string, proposalIndex: number, choice: "for" | "against") {
    if (!wallet.isConnected || !wallet.publicKey) { wallet.connect(); return; }
    setVoting(proposalId);
    setVoteError(null);
    try {
      const pk = PublicKey.fromHex(wallet.publicKey);
      const tx = buildVoteTransaction({ sender: pk, proposalId: proposalIndex, choice: choice === "for" ? 0 : 1, chainName: "casper" });
      await wallet.signAndSubmit(tx);
      setVoted((v) => ({ ...v, [proposalId]: choice }));
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Vote failed");
    }
    setVoting(null);
  }

  return (
    <AppLayout
      title="Governance"
      action={
        <button className="hidden sm:flex items-center gap-2 bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold shadow-[0_0_10px_rgba(255,0,0,0.2)] hover:brightness-110 transition-all active:scale-95">
          <span className="material-symbols-outlined text-sm">add</span>
          New Proposal
        </button>
      }
    >
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[#ebbbb4] text-sm">Vote on protocol changes. Your token holdings determine your voting power.</p>
          {!wallet.isConnected ? (
            <button onClick={wallet.connect} className="px-3 py-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-xs font-mono rounded-lg">
              {wallet.loading ? "Connecting..." : "Connect Wallet to Vote"}
            </button>
          ) : (
            <span className="text-[10px] font-mono text-[#00C853]">Connected: {wallet.shortKey}</span>
          )}
        </div>

        {voteError && <div className="p-2 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded text-xs text-[#FF0000] font-mono">{voteError}</div>}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Your Voting Power", value: wallet.isConnected ? "—" : "0 VP", icon: "how_to_vote", valueColor: "text-[#64FFDA]" },
            { label: "Active Proposals", value: proposals.filter(p => p.status === "Active").length.toString(), icon: "pending_actions" },
            { label: "Participation Rate", value: proposals.length ? "—" : "0%", icon: "groups", valueColor: "text-[#00C853]" },
            { label: "Quorum Required", value: "66%", icon: "verified", sub: "to pass" },
          ].map((card) => (
            <div key={card.label} className="p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#64FFDA] text-lg">{card.icon}</span>
                <p className="font-mono text-[9px] text-[#ebbbb4] uppercase tracking-widest leading-tight">{card.label}</p>
              </div>
              <span className={`text-xl font-bold ${card.valueColor || "text-[#d8e2ff]"}`}>{card.value}</span>
              {card.sub && <p className="text-[10px] text-[#ebbbb4] mt-0.5">{card.sub}</p>}
            </div>
          ))}
        </div>

        {/* Contract not deployed warning */}
        {!contractDeployed && (
          <div className="p-4 rounded-xl border border-[#FF0000]/20 bg-[#FF0000]/5 flex items-start gap-3">
            <span className="material-symbols-outlined text-[#FF0000] text-lg shrink-0">warning</span>
            <div>
              <p className="text-sm font-bold text-[#FF0000]">Governance contract not deployed</p>
              <p className="text-xs text-[#ebbbb4] mt-1">Deploy the contracts first, then set <code className="font-mono bg-[#0a192f] px-1 rounded">NEXT_PUBLIC_GOVERNANCE_HASH</code> in <code className="font-mono bg-[#0a192f] px-1 rounded">.env.local</code>.</p>
              <p className="text-[10px] font-mono text-[#ebbbb4] mt-1">Run: <code className="text-[#64FFDA]">cd contracts && make deploy-testnet</code></p>
            </div>
          </div>
        )}

        {/* Proposals */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-[#d8e2ff]">Active & Recent Proposals</h3>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-[#64FFDA] border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : proposals.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <span className="material-symbols-outlined text-[#64FFDA]/30 text-5xl">how_to_vote</span>
              <p className="text-[#d8e2ff] font-semibold">No proposals yet</p>
              <p className="text-xs text-[#ebbbb4] max-w-xs">Once the governance contract is deployed and proposals are created on-chain, they will appear here.</p>
              <button className="mt-2 px-4 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg hover:brightness-110 transition-all">
                Create First Proposal
              </button>
            </div>
          ) : (
            <>
              {/* Mobile cards */}
              <div className="sm:hidden space-y-3">
                {proposals.map((p) => (
                  <div key={p.id} className="p-4 rounded-xl space-y-3 bg-[#112240] border border-[rgba(100,255,218,0.08)]">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-mono text-xs text-[#64FFDA]">{p.id}</p>
                        <p className="font-semibold text-sm mt-0.5 leading-tight">{p.title}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-[#253453] rounded-full overflow-hidden">
                        <div className="h-full bg-[#64FFDA]" style={{ width: `${p.quorum}%` }}></div>
                      </div>
                      <span className="font-mono text-[10px] text-[#ebbbb4]">{p.quorum}% quorum</span>
                    </div>
                    {p.status === "Active" && !voted[p.id] && (
                      <div className="flex gap-2">
                        <button onClick={() => castVote(p.id, proposals.indexOf(p), "for")} disabled={voting === p.id} className="flex-1 py-2 bg-[#00C853] text-[#001a00] text-xs font-bold rounded-lg disabled:opacity-50">{voting === p.id ? "Signing..." : "Vote For"}</button>
                        <button onClick={() => castVote(p.id, proposals.indexOf(p), "against")} disabled={voting === p.id} className="flex-1 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg disabled:opacity-50">{voting === p.id ? "Signing..." : "Vote Against"}</button>
                      </div>
                    )}
                    {voted[p.id] && (
                      <p className={`text-xs font-bold ${voted[p.id] === "for" ? "text-[#00C853]" : "text-[#FF0000]"}`}>
                        ✓ Voted {voted[p.id] === "for" ? "For" : "Against"}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden sm:block rounded-xl overflow-hidden border border-[rgba(100,255,218,0.2)] bg-[#112240]">
                <table className="w-full text-left">
                  <thead className="bg-[#000d27]/30 text-[#ebbbb4] font-mono text-[10px] uppercase tracking-widest">
                    <tr>{["ID", "Title", "Status", "Quorum", "Closes", "Action"].map((h) => <th key={h} className="px-5 py-3">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[rgba(100,255,218,0.1)] text-sm">
                    {proposals.map((p) => (
                      <tr key={p.id} className="hover:bg-[#253453]/30 transition-colors">
                        <td className="px-5 py-4 font-mono text-xs text-[#64FFDA]">{p.id}</td>
                        <td className="px-5 py-4 font-semibold max-w-xs">{p.title}</td>
                        <td className="px-5 py-4"><span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${STATUS_STYLES[p.status]}`}>{p.status}</span></td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-[#253453] rounded-full overflow-hidden"><div className="h-full bg-[#64FFDA]" style={{ width: `${p.quorum}%` }}></div></div>
                            <span className="font-mono text-xs">{p.quorum}%</span>
                          </div>
                        </td>
                        <td className="px-5 py-4 text-[#ebbbb4] text-xs">{p.endDate}</td>
                        <td className="px-5 py-4">
                          {p.status === "Active" ? (
                            voted[p.id] ? (
                              <span className={`text-xs font-bold ${voted[p.id] === "for" ? "text-[#00C853]" : "text-[#FF0000]"}`}>✓ Voted</span>
                            ) : (
                              <div className="flex gap-2">
                                <button onClick={() => castVote(p.id, proposals.indexOf(p), "for")} disabled={voting === p.id} className="px-3 py-1.5 bg-[#00C853] text-[#001a00] text-xs font-bold rounded disabled:opacity-50">{voting === p.id ? "..." : "For"}</button>
                                <button onClick={() => castVote(p.id, proposals.indexOf(p), "against")} disabled={voting === p.id} className="px-3 py-1.5 bg-[#FF0000] text-white text-xs font-bold rounded disabled:opacity-50">{voting === p.id ? "..." : "Against"}</button>
                              </div>
                            )
                          ) : <span className="text-[#ebbbb4] text-xs">Closed</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* AI Voting Assistant */}
        <div className="rounded-xl overflow-hidden border border-[#64FFDA]/20 bg-[#112240]">
          <div className="p-4 border-b border-[rgba(100,255,218,0.15)] bg-[#0a192f]/60 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#64FFDA] text-lg">smart_toy</span>
            <h4 className="font-bold text-sm">AI Voting Assistant</h4>
            <span className="ml-auto text-[10px] text-[#64FFDA] font-mono animate-pulse">LIVE</span>
          </div>
          <div className="p-4 font-mono text-[11px] text-[#64FFDA]/80 space-y-1.5">
            {proposals.length === 0 ? (
              <p className="text-[#ebbbb4]">[IDLE] No active proposals to analyze. Monitoring chain for new governance activity...</p>
            ) : (
              <>
                <p className="text-[#ebbbb4]">[ANALYSIS] Scanning active proposals...</p>
                <p>&gt;&gt; Quorum tracking and risk model evaluation in progress.</p>
                <p className="text-[#00C853]">[READY] Connect wallet to receive personalized voting recommendations.</p>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
