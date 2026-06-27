"use client";
import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { useWallet } from "@/lib/wallet-context";

type Proposal = {
  id: string; title: string; description: string;
  status: "Active" | "Passed" | "Failed";
  votes_for: number; votes_against: number; quorum: number;
  end_date: string; my_vote?: string;
};

const STATUS_STYLES: Record<string, string> = {
  Active: "text-[#64FFDA] border-[#64FFDA]/30 bg-[#64FFDA]/10",
  Passed: "text-[#00C853] border-[#00C853]/30 bg-[#00C853]/10",
  Failed: "text-[#FF0000] border-[#FF0000]/30 bg-[#FF0000]/10",
};

export default function GovernancePage() {
  const wallet = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function loadProposals() {
    const url = wallet.publicKey ? `/api/governance?voter=${wallet.publicKey}` : "/api/governance";
    fetch(url).then(r => r.json()).then(setProposals).catch(() => {}).finally(() => setLoading(false));
  }

  useEffect(() => { loadProposals(); }, [wallet.publicKey]);

  async function castVote(proposalId: string, choice: "for" | "against") {
    if (!wallet.isConnected || !wallet.publicKey) { wallet.connect(); return; }
    setVoting(proposalId); setVoteError(null);
    try {
      // Step 1: wallet signs authorization message (popup)
      await wallet.signMessage(
        `CasperLaunch governance vote\nProposal: ${proposalId}\nChoice: ${choice}\nVoter: ${wallet.publicKey.slice(0, 20)}…\nTimestamp: ${Date.now()}`
      );
      // Step 2: agent submits vote to on-chain governance contract
      const proposalIndex = proposals.findIndex(p => p.id === proposalId);
      const chainRes = await fetch("/api/governance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", proposalIndex, choice: choice === "for" ? 0 : 1 }),
      });
      const chainData = await chainRes.json() as { txHash?: string; error?: string };
      if (!chainRes.ok) throw new Error(chainData.error ?? "On-chain vote failed");
      // Step 3: mirror to SQLite for instant UI update
      const res = await fetch("/api/governance/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ proposalId, voter: wallet.publicKey, choice }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Vote recording failed");
      loadProposals();
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Vote failed");
    }
    setVoting(null);
  }

  async function submitProposal() {
    if (!newTitle || !newDesc || !wallet.isConnected) return;
    setSubmitting(true);
    try {
      // Wallet popup — user authorizes the proposal on-chain
      await wallet.signMessage(
        `CasperLaunch governance proposal\nTitle: ${newTitle}\nProposer: ${(wallet.publicKey ?? "").slice(0, 20)}…\nTimestamp: ${Date.now()}`
      );
      // Agent submits create_proposal to the on-chain governance contract
      const chainRes = await fetch("/api/governance/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "propose", title: newTitle, description: newDesc, deadlineDays: 14 }),
      });
      const chainData = await chainRes.json() as { txHash?: string; error?: string };
      if (!chainRes.ok) throw new Error(chainData.error ?? "On-chain submission failed");
      // Mirror to SQLite for display
      const endDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
      await fetch("/api/governance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle, description: newDesc, createdBy: wallet.publicKey ?? "anonymous", endDate }),
      });
      setNewTitle(""); setNewDesc(""); setShowNew(false);
      loadProposals();
    } catch (e) {
      setVoteError(e instanceof Error ? e.message : "Proposal failed");
    }
    setSubmitting(false);
  }

  const active = proposals.filter(p => p.status === "Active");
  const totalVotes = proposals.reduce((s, p) => s + p.votes_for + p.votes_against, 0);

  return (
    <AppLayout title="Governance" action={
      <button onClick={() => setShowNew(v => !v)}
        className="flex items-center gap-2 bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all active:scale-95">
        <span className="material-symbols-outlined text-sm">add</span>
        New Proposal
      </button>
    }>
      <div className="p-4 md:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-[#ebbbb4] text-sm">Vote on protocol changes. Token holdings determine voting power.</p>
          {!wallet.isConnected
            ? <button onClick={wallet.connect} className="px-3 py-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-xs font-mono rounded-lg">{wallet.loading ? "Connecting…" : "Connect Wallet to Vote"}</button>
            : <span className="text-[10px] font-mono text-[#00C853]">● {wallet.shortKey}</span>
          }
        </div>

        {voteError && <div className="p-2 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded text-xs text-[#FF0000] font-mono">{voteError}</div>}

        {/* New proposal form */}
        {showNew && (
          <div className="p-5 rounded-xl bg-[#112240] border border-[#64FFDA]/20 space-y-3">
            <h3 className="font-bold text-sm text-[#d8e2ff]">New Proposal</h3>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Proposal title…"
              className="w-full bg-[#0a192f] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] placeholder-[#abb9d6] focus:outline-none focus:border-[#64FFDA]" />
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Describe the proposal…" rows={3}
              className="w-full bg-[#0a192f] border border-[rgba(100,255,218,0.2)] rounded-lg px-3 py-2 text-sm text-[#d8e2ff] placeholder-[#abb9d6] focus:outline-none focus:border-[#64FFDA] resize-none" />
            <div className="flex gap-2">
              <button onClick={submitProposal} disabled={submitting || !newTitle || !newDesc}
                className="px-4 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-40 transition-all">
                {submitting ? "Submitting…" : "Submit Proposal"}
              </button>
              <button onClick={() => setShowNew(false)} className="px-4 py-2 text-xs text-[#abb9d6] hover:text-[#d8e2ff]">Cancel</button>
            </div>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: "Active Proposals", value: active.length.toString(), icon: "pending_actions", color: "text-[#64FFDA]" },
            { label: "Total Votes Cast", value: totalVotes.toString(), icon: "how_to_vote", color: "text-[#d8e2ff]" },
            { label: "Passed", value: proposals.filter(p => p.status === "Passed").length.toString(), icon: "verified", color: "text-[#00C853]" },
            { label: "Quorum Required", value: "66%", icon: "groups", color: "text-[#d8e2ff]" },
          ].map(card => (
            <div key={card.label} className="p-4 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <div className="flex items-center gap-2 mb-2">
                <span className="material-symbols-outlined text-[#64FFDA] text-lg">{card.icon}</span>
                <p className="font-mono text-[9px] text-[#ebbbb4] uppercase tracking-widest">{card.label}</p>
              </div>
              <span className={`text-xl font-bold ${card.color}`}>{card.value}</span>
            </div>
          ))}
        </div>

        {/* Proposals */}
        <div className="space-y-4">
          <h3 className="font-bold text-sm text-[#d8e2ff]">Active & Recent Proposals</h3>
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-[#64FFDA] border-t-transparent rounded-full animate-spin" /></div>
          ) : proposals.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)]">
              <span className="material-symbols-outlined text-[#64FFDA]/30 text-5xl">how_to_vote</span>
              <p className="text-[#d8e2ff] font-semibold">No proposals yet</p>
              <button onClick={() => setShowNew(true)} className="mt-2 px-4 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg hover:brightness-110">Create First Proposal</button>
            </div>
          ) : (
            <div className="space-y-4">
              {proposals.map(p => {
                const total = p.votes_for + p.votes_against || 1;
                const forPct = Math.round((p.votes_for / total) * 100);
                const myVote = p.my_vote;
                return (
                  <div key={p.id} className="p-5 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)] space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-mono text-[10px] text-[#64FFDA]">{p.id}</p>
                        <p className="font-bold text-sm mt-0.5">{p.title}</p>
                        <p className="text-[11px] text-[#abb9d6] mt-1 leading-relaxed">{p.description}</p>
                      </div>
                      <span className={`px-2 py-0.5 rounded border text-[10px] font-bold shrink-0 ${STATUS_STYLES[p.status]}`}>{p.status}</span>
                    </div>

                    {/* Vote bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] font-mono text-[#abb9d6]">
                        <span>For: {p.votes_for} ({forPct}%)</span>
                        <span>Against: {p.votes_against} ({100 - forPct}%)</span>
                      </div>
                      <div className="h-2 bg-[#253453] rounded-full overflow-hidden flex">
                        <div className="h-full bg-[#00C853] transition-all" style={{ width: `${forPct}%` }} />
                        <div className="h-full bg-[#FF0000] transition-all" style={{ width: `${100 - forPct}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[#abb9d6]">
                        <span>Quorum: {p.quorum}%</span>
                        <span>Closes: {p.end_date}</span>
                      </div>
                    </div>

                    {/* Vote action */}
                    {p.status === "Active" && (
                      myVote ? (
                        <p className={`text-xs font-bold ${myVote === "for" ? "text-[#00C853]" : "text-[#FF0000]"}`}>
                          ✓ You voted {myVote === "for" ? "For" : "Against"}
                        </p>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => castVote(p.id, "for")} disabled={voting === p.id || !wallet.isConnected}
                            className="flex-1 sm:flex-none px-4 py-2 bg-[#00C853] text-[#001a00] text-xs font-bold rounded-lg disabled:opacity-50 hover:brightness-110">
                            {voting === p.id ? "Signing…" : "✓ Vote For"}
                          </button>
                          <button onClick={() => castVote(p.id, "against")} disabled={voting === p.id || !wallet.isConnected}
                            className="flex-1 sm:flex-none px-4 py-2 bg-[#FF0000] text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:brightness-110">
                            {voting === p.id ? "Signing…" : "✗ Vote Against"}
                          </button>
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>
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
            {active.length === 0 ? (
              <p className="text-[#ebbbb4]">[IDLE] No active proposals. Monitoring chain for governance activity…</p>
            ) : (
              <>
                <p className="text-[#ebbbb4]">[ANALYSIS] {active.length} active proposal{active.length > 1 ? "s" : ""} detected.</p>
                {active.map(p => (
                  <p key={p.id}>&gt;&gt; {p.id}: {p.votes_for + p.votes_against} votes cast — quorum at {p.quorum}%</p>
                ))}
                <p className="text-[#00C853]">[READY] {wallet.isConnected ? "Cast your vote above." : "Connect wallet to vote."}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
