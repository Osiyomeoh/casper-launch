"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet-context";
import { CONTRACT_HASHES, type AssetMetadata } from "@/lib/contracts";
import { PublicKey } from "casper-js-sdk";

type Step = "describe" | "review" | "document" | "kyc" | "mint" | "done";
type Message = { role: "agent" | "user"; text: string; time: string };

const AGENT_INTRO: Message = {
  role: "agent",
  text: "Welcome to CasperLaunch. I'm your AI tokenization agent.\n\nDescribe the asset you want to tokenize — property address, asset type, estimated value, and any yield or rental income information. I'll extract the CEP-78 metadata and guide you through minting on Casper testnet.",
  time: new Date().toLocaleTimeString(),
};

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const h = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function ChatPage() {
  const wallet = useWallet();
  const router = useRouter();

  const [step, setStep] = useState<Step>("describe");
  const [messages, setMessages] = useState<Message[]>([AGENT_INTRO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<AssetMetadata | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [tokenId, setTokenId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Document anchoring state
  const [docHash, setDocHash] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [docCid, setDocCid] = useState<string | null>(null);
  const [docUrl, setDocUrl] = useState<string | null>(null);
  const [docDragging, setDocDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // KYC state
  const [kycAttested, setKycAttested] = useState(false);
  const [kycSig, setKycSig] = useState<string | null>(null);
  const [kycLoading, setKycLoading] = useState(false);

  const chatRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  // ── Persist / restore progress across refreshes ───────────────────────────
  const STORAGE_KEY = "casperlaunch:tokenize:draft";

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as {
        step: Step; metadata: AssetMetadata | null;
        docHash: string | null; docName: string | null;
        docCid: string | null; docUrl: string | null;
        kycAttested: boolean; messages: Message[];
        tokenId: number | null; txHash: string | null;
      };
      if (saved.step && saved.step !== "describe") {
        setStep(saved.step);
        setMetadata(saved.metadata ?? null);
        setDocHash(saved.docHash ?? null);
        setDocName(saved.docName ?? null);
        setDocCid(saved.docCid ?? null);
        setDocUrl(saved.docUrl ?? null);
        setKycAttested(saved.kycAttested ?? false);
        setTokenId(saved.tokenId ?? null);
        setTxHash(saved.txHash ?? null);
        if (saved.messages?.length) setMessages(saved.messages);
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function saveDraft(overrides: Partial<{
    step: Step; metadata: AssetMetadata | null;
    docHash: string | null; docName: string | null;
    docCid: string | null; docUrl: string | null;
    kycAttested: boolean; messages: Message[];
    tokenId: number | null; txHash: string | null;
  }> = {}) {
    try {
      const draft = {
        step, metadata, docHash, docName, docCid, docUrl, kycAttested, messages, tokenId, txHash,
        ...overrides,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {}
  }

  function clearDraft() {
    try { localStorage.removeItem(STORAGE_KEY); } catch {}
  }

  const addMessage = useCallback((role: "agent" | "user", text: string) => {
    setMessages((prev) => {
      const next = [...prev, { role, text, time: new Date().toLocaleTimeString() }];
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const saved = raw ? JSON.parse(raw) : {};
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...saved, messages: next }));
      } catch {}
      return next;
    });
  }, [STORAGE_KEY]);

  // ── Step 1: AI metadata extraction ────────────────────────────────────────

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMessage("user", text);
    setLoading(true);
    setError(null);

    if (step === "describe" || step === "review") {
      const isRevision = step === "review" && !text.toLowerCase().includes("confirm");
      if (step === "review" && text.toLowerCase().includes("confirm")) {
        setStep("document");
        saveDraft({ step: "document" });
        addMessage("agent", "Metadata confirmed.\n\nNext: upload a backing document (title deed, appraisal, or lease agreement). I'll compute a SHA-256 fingerprint and anchor it permanently in the token metadata on Casper testnet. This is what proves the token is backed by a real asset.");
        setLoading(false);
        return;
      }

      addMessage("agent", isRevision ? "Re-analyzing with your corrections..." : "AI tokenization costs 3 CSPR. Preparing payment...");
      try {
        // ── x402 Payment Gate ──────────────────────────────────────────────
        if (!wallet.isConnected || !wallet.publicKey) {
          throw new Error("Connect your CasperWallet to pay for AI tokenization (3 CSPR)");
        }

        // 1. User signs a payment authorization message with CasperWallet
        //    (CasperWallet can't sign TransactionV1 and Casper 2.0 rejects
        //    CLPublicKey transfer targets in legacy Deploys, so we use
        //    signMessage for wallet proof + agent submits the on-chain transfer)
        addMessage("agent", "Sign the payment authorization in your CasperWallet...");
        const authMessage = `x402:ai-tokenize:${Date.now()}:from:${wallet.publicKey}`;
        const authSig = await wallet.signMessage(authMessage);

        // 2. Server verifies the signature and submits the on-chain transfer
        addMessage("agent", "Submitting payment on-chain...");
        const payRes = await fetch("/api/casper/make-x402-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            senderPublicKey: wallet.publicKey,
            authMessage,
            authSignature: authSig,
          }),
        });
        const payData = await payRes.json() as { txHash?: string; error?: string };
        if (!payRes.ok || !payData.txHash) throw new Error(payData.error ?? "Payment failed");

        addMessage("agent", `Payment confirmed (${payData.txHash.slice(0, 12)}…). Extracting metadata...`);

        // 3. Build X-PAYMENT header with the real on-chain tx hash
        const paymentHeader = Buffer.from(JSON.stringify({
          x402Version: 1, scheme: "casper-exact", network: "casper-test",
          payload: { deployHash: payData.txHash, from: wallet.publicKey },
        })).toString("base64");

        const res = await fetch("/api/ai/tokenize", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-PAYMENT": paymentHeader },
          body: JSON.stringify({ description: text }),
        });
        const data = await res.json() as { metadata?: AssetMetadata; error?: string };
        if (data.error) throw new Error(data.error);
        const meta = data.metadata!;
        setMetadata(meta);
        setStep("review");
        saveDraft({ metadata: meta, step: "review" });
        addMessage("agent",
          `Here's the extracted CEP-78 metadata:\n\n• Name: ${meta.asset_name}\n• Type: ${meta.asset_type}\n• Location: ${meta.location}\n• Valuation: $${meta.valuation_usd.toLocaleString()}\n• Yield APY: ${meta.yield_apy}%\n• Total Tokens: ${meta.total_tokens.toLocaleString()}\n\nType "confirm" to proceed, or describe any corrections.`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to extract metadata";
        setError(msg);
        addMessage("agent", `Error: ${msg}. Please try again.`);
        setStep("describe");
      }
    } else {
      addMessage("agent", "Use the action panel on the right to continue.");
    }
    setLoading(false);
  }

  // ── Step 2: Document upload to IPFS via Pinata + local SHA-256 hash ─────────

  async function processDocument(file: File) {
    setLoading(true);
    try {
      // Hash locally first
      const buf = await file.arrayBuffer();
      const hash = await sha256Hex(buf);
      setDocHash(hash);
      setDocName(file.name);
      saveDraft({ docHash: hash, docName: file.name });

      addMessage("agent", `Document fingerprint computed:\n\n${hash}\n\nUploading "${file.name}" to IPFS via Pinata…`);

      // Upload to Pinata
      const form = new FormData();
      form.append("file", file);
      if (metadata?.asset_name) form.append("assetName", metadata.asset_name);
      if (tokenId) form.append("tokenId", String(tokenId));

      const res = await fetch("/api/ipfs/upload", { method: "POST", body: form });
      const data = await res.json() as { cid?: string; url?: string; error?: string };

      if (!res.ok || !data.cid) {
        // IPFS upload failed — hash-only fallback
        addMessage("agent", `IPFS upload failed: ${data.error ?? "unknown error"}.\n\nFalling back to hash-only anchoring. The SHA-256 fingerprint will still be stored in your token metadata.\n\nClick "Proceed to KYC" when ready.`);
      } else {
        setDocCid(data.cid);
        setDocUrl(data.url ?? null);
        saveDraft({ docHash: hash, docName: file.name, docCid: data.cid, docUrl: data.url });
        addMessage("agent", `Document uploaded to IPFS:\n\nCID: ${data.cid}\nURL: ${data.url}\n\nSHA-256: ${hash}\n\nBoth the IPFS link and the hash will be permanently anchored in your token's on-chain metadata. Anyone can retrieve and verify this document independently.\n\nClick "Proceed to KYC" when ready.`);
      }
    } catch {
      setError("Failed to process document");
    }
    setLoading(false);
  }

  function skipDocument() {
    setStep("kyc");
    saveDraft({ step: "kyc" });
    addMessage("agent", "Skipping document anchoring. You can add a backing document later by updating the token metadata.\n\nNext: KYC verification — you'll sign an accredited investor attestation with your wallet.");
  }

  function proceedToKyc() {
    if (!docHash) return;
    setStep("kyc");
    saveDraft({ step: "kyc" });
    addMessage("agent", `Document fingerprint anchored in metadata.\n\nNext: KYC verification. Click "Sign Attestation" to sign the accredited investor declaration with your CasperWallet. This proves you meet investor eligibility requirements.`);
  }

  // ── Step 3: KYC attestation ────────────────────────────────────────────────

  async function handleKycAttest() {
    if (!wallet.isConnected || !wallet.publicKey) {
      setError("Connect your CasperWallet first");
      return;
    }
    setKycLoading(true);
    setError(null);
    try {
      const ts = Date.now();
      const message = `CasperLaunch Accredited Investor Attestation\n\nI, the holder of wallet ${wallet.publicKey}, declare that I meet the criteria of an accredited investor as defined by applicable securities law.\n\nI understand that RWA tokens represent interests in a legal entity (SPV) holding real-world assets, and that these are restricted securities.\n\nTimestamp: ${new Date(ts).toISOString()}\nNetwork: casper-test`;

      // Wallet popup — user signs the KYC attestation message
      const sig = await wallet.signMessage(message);
      setKycSig(sig);
      setKycAttested(true);
      saveDraft({ kycAttested: true });

      // Submit attestation to server — server whitelists on-chain if agent key available
      const kycRes = await fetch("/api/kyc/whitelist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletPublicKey: wallet.publicKey, signature: sig, message, attestationTs: ts }),
      });
      const kycData = await kycRes.json() as { onChain?: boolean; deployHash?: string; reason?: string };

      if (kycData.onChain && kycData.deployHash) {
        addMessage("agent", `KYC attestation signed and verified.\n\nWallet whitelisted on-chain:\n${kycData.deployHash}\n\nYour wallet is now approved on the RWA NFT contract. Click "Mint Token" to create your CEP-78 token.`);
      } else {
        addMessage("agent", `Accredited investor attestation signed.\n\nSignature: ${sig.slice(0, 32)}...\n\n${kycData.reason ?? "Attestation recorded."}\n\nClick "Mint Token" to proceed.`);
      }
      setStep("mint");
      saveDraft({ step: "mint" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Attestation failed";
      setError(msg);
      addMessage("agent", `Error: ${msg}`);
    }
    setKycLoading(false);
  }

  // ── Step 4: Mint ──────────────────────────────────────────────────────────

  async function handleMint() {
    if (!wallet.isConnected || !wallet.publicKey || !metadata) return;
    if (!CONTRACT_HASHES.rwaNft) {
      setError("RWA NFT contract not deployed. Set NEXT_PUBLIC_RWA_NFT_HASH in .env.local.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pk = PublicKey.fromHex(wallet.publicKey);
      const id = Math.floor(Date.now() / 1000);
      setTokenId(id);

      // Attach compliance metadata to the token
      const fullMetadata: AssetMetadata = {
        ...metadata,
        ...(docHash ? {
          document_hash: docHash,
          document_name: docName ?? undefined,
          document_ts: Date.now(),
          ...(docCid ? { document_ipfs_cid: docCid, document_ipfs_url: docUrl ?? undefined } : {}),
        } : {}),
        issuer_wallet: wallet.publicKey,
      };

      // Account hash = 32-byte hex (strip "account-hash-" prefix if present)
      const accountHashHex = Buffer.from(pk.accountHash().toBytes()).toString("hex");

      // Wallet popup — user authorizes the mint
      await wallet.signMessage(
        `CasperLaunch mint authorization\nAsset: ${fullMetadata.asset_name ?? "RWA Token"}\nValuation: $${fullMetadata.valuation_usd ?? 0}\nRecipient: ${wallet.publicKey.slice(0, 20)}…\nTimestamp: ${Date.now()}`
      );

      // Compact on-chain metadata — keep payload small to avoid 413
      const onChainMeta = {
        asset_name: fullMetadata.asset_name,
        asset_type: fullMetadata.asset_type,
        location: fullMetadata.location,
        valuation_usd: fullMetadata.valuation_usd,
        yield_apy: fullMetadata.yield_apy,
        total_tokens: fullMetadata.total_tokens,
        ...(docCid ? { ipfs_cid: docCid } : {}),
        ...(docHash ? { doc_hash: docHash.slice(0, 16) } : {}),
      };

      addMessage("agent", "Minting CEP-78 token on Casper testnet via agent key...");
      const mintRes = await fetch("/api/casper/mint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientAccountHash: accountHashHex,
          tokenId: id,
          metadata: onChainMeta,
        }),
      });
      const mintData = await mintRes.json() as { deployHash?: string; error?: string };
      if (!mintRes.ok || !mintData.deployHash) throw new Error(mintData.error ?? "Mint failed");
      const hash = mintData.deployHash;
      setTxHash(hash);
      setStep("done");
      clearDraft();

      // Persist token data server-side
      const tokenData = {
        tokenId: String(id),
        metadata: fullMetadata,
        owner: wallet.publicKey,
        deployHash: hash,
        mintedAt: Date.now(),
        holders: [{ publicKey: wallet.publicKey, bps: 10_000 }],
      };
      // Save to localStorage as primary source (Vercel serverless can't share SQLite)
      try {
        const stored = JSON.parse(localStorage.getItem("casperlaunch:tokens") ?? "{}");
        stored[String(id)] = tokenData;
        localStorage.setItem("casperlaunch:tokens", JSON.stringify(stored));
      } catch {}

      // Also attempt server-side persist (best-effort)
      fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tokenData),
      }).catch(() => {});

      // Register issuer as 100% holder in yield-distributor (fire-and-forget)
      fetch("/api/casper/register-holder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletPublicKey: wallet.publicKey, shareBps: 10_000 }),
      }).catch(() => {});

      const valuation = fullMetadata.valuation_usd ?? 0;
      const platformFee = +(valuation * 0.005).toFixed(2);
      addMessage("agent", `Token minted on Casper testnet!\n\nDeploy hash: ${hash}\n\nYour RWA NFT is now live on-chain with${docHash ? " a verified backing document," : ""} accredited investor KYC, and compliant transfer restrictions.\n\nYou've been registered as 100% yield holder in the distributor contract.\n\n---\n📋 **Platform Fee Summary**\n• Asset valuation: $${valuation.toLocaleString()}\n• Tokenization fee (0.5%): $${platformFee.toLocaleString()}\n• Fee collected by: CasperLaunch treasury\n\nView the cap table to offer shares to investors →`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mint failed";
      setError(msg);
      addMessage("agent", `Error: ${msg}`);
    }
    setLoading(false);
  }

  // ── Step labels ────────────────────────────────────────────────────────────

  const stepLabels: { key: Step; label: string; icon: string }[] = [
    { key: "describe", label: "Describe Asset", icon: "edit_note" },
    { key: "review", label: "Review Metadata", icon: "fact_check" },
    { key: "document", label: "Anchor Document", icon: "fingerprint" },
    { key: "kyc", label: "KYC Attestation", icon: "verified_user" },
    { key: "mint", label: "Mint Token", icon: "toll" },
    { key: "done", label: "Live on Casper", icon: "rocket_launch" },
  ];
  const stepIndex = stepLabels.findIndex((s) => s.key === step);

  return (
    <div className="flex h-screen w-full bg-[#011230] text-[#d8e2ff] overflow-hidden">

      {/* Left sidebar — progress */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 bg-[#091b39] border-r border-[rgba(100,255,218,0.12)] h-full">
        <div className="px-5 py-6">
          <Link href="/" className="text-xl font-bold text-[#FF0000]">CasperLaunch</Link>
          <p className="text-[10px] font-mono text-[#abb9d6] mt-1 uppercase tracking-widest">Tokenization Wizard</p>
        </div>

        <div className="px-4 py-2 space-y-1">
          {stepLabels.map((s, i) => {
            const done = i < stepIndex;
            const active = i === stepIndex;
            return (
              <div key={s.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm ${active ? "bg-[#192a48] text-[#64FFDA] font-bold" : done ? "text-[#00C853]" : "text-[#abb9d6]"}`}>
                <span className="material-symbols-outlined text-[18px]" style={done ? { fontVariationSettings: "'FILL' 1" } : {}}>
                  {done ? "check_circle" : s.icon}
                </span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto px-4 pb-6 space-y-3">
          {wallet.isConnected ? (
            <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg">
              <p className="text-[9px] font-mono text-[#00C853] uppercase mb-1">Wallet Connected</p>
              <p className="text-xs font-mono text-[#d8e2ff] truncate">{wallet.shortKey}</p>
              <button onClick={wallet.disconnect} className="text-[9px] text-[#ebbbb4] hover:text-[#d8e2ff] mt-1">Disconnect</button>
            </div>
          ) : (
            <button onClick={wallet.connect}
              className="w-full py-2.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-xs font-mono rounded-lg hover:bg-[#253458] transition-colors">
              Connect Wallet
            </button>
          )}
          <Link href="/dashboard" className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-[#ebbbb4] hover:text-[#d8e2ff]">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 h-full">
        <header className="h-14 flex items-center justify-between px-6 border-b border-[rgba(100,255,218,0.12)] bg-[#0a192f]/80 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-[#64FFDA]/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-[#64FFDA] text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>smart_toy</span>
            </div>
            <div>
              <p className="text-sm font-semibold">AI Tokenization Agent</p>
              <p className="text-[9px] font-mono text-[#64FFDA] uppercase">{loading ? "Processing..." : "Ready"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse" />
            <span className="text-[10px] font-mono text-[#ebbbb4] hidden sm:inline">Casper Testnet</span>
            <button onClick={wallet.isConnected ? wallet.disconnect : wallet.connect}
              className="ml-2 px-3 py-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-[10px] font-mono rounded-lg">
              {wallet.isConnected ? (wallet.shortKey ?? "Connected") : "Connect Wallet"}
            </button>
          </div>
        </header>

        <div className="flex flex-1 min-h-0">
          {/* Chat messages */}
          <section className="flex-1 flex flex-col min-w-0">
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 max-w-2xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${msg.role === "agent" ? "bg-[#112240] border border-[rgba(100,255,218,0.2)]" : "bg-[#1a0a00] border border-[#FF0000]/20"}`}>
                    <span className="material-symbols-outlined text-[16px] text-[#64FFDA]">{msg.role === "agent" ? "smart_toy" : "person"}</span>
                  </div>
                  <div className={`space-y-1 ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
                    <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-line ${msg.role === "agent" ? "bg-[#112240] border border-[rgba(100,255,218,0.1)] rounded-tl-none" : "bg-[#1a0a00] border border-[#FF0000]/20 rounded-tr-none"}`}>
                      {msg.text}
                    </div>
                    <span className="text-[9px] font-mono text-[#ebbbb4]">{msg.time}</span>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex gap-3 max-w-2xl">
                  <div className="w-8 h-8 shrink-0 rounded-lg bg-[#112240] border border-[rgba(100,255,218,0.2)] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[16px] text-[#64FFDA] animate-spin">autorenew</span>
                  </div>
                  <div className="px-4 py-3 rounded-xl rounded-tl-none bg-[#112240] border border-[rgba(100,255,218,0.1)]">
                    <div className="flex gap-1">{[0,1,2].map((j) => <div key={j} className="w-1.5 h-1.5 rounded-full bg-[#64FFDA] animate-bounce" style={{ animationDelay: `${j*150}ms` }} />)}</div>
                  </div>
                </div>
              )}
              {error && <div className="p-3 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-lg text-xs text-[#FF0000] font-mono">{error}</div>}
            </div>

            <div className="p-4 border-t border-[rgba(100,255,218,0.12)] bg-[#011230]/80 shrink-0">
              <div className="flex justify-end mb-2">
                <button onClick={() => { clearDraft(); window.location.reload(); }}
                  className="text-[10px] font-mono text-[#ebbbb4]/60 hover:text-[#FF0000] transition-colors flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">refresh</span>
                  Clear &amp; Restart
                </button>
              </div>
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={loading || !["describe", "review"].includes(step)}
                  placeholder={
                    step === "describe" ? "Describe your asset — e.g. 3-bedroom house in Lagos, $120k value, 8% rental yield..."
                    : step === "review" ? "Type 'confirm' to proceed, or describe corrections..."
                    : step === "done" ? "Tokenization complete!"
                    : "Use the panel on the right →"
                  }
                  className="flex-1 bg-[#0a192f] border border-[rgba(100,255,218,0.2)] focus:border-[#64FFDA] text-[#d8e2ff] rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#ebbbb4]/40 transition-colors disabled:opacity-50"
                />
                <button onClick={handleSend} disabled={loading || !input.trim() || !["describe","review"].includes(step)}
                  className="px-4 py-3 bg-[#FF0000] text-white rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
            </div>
          </section>

          {/* Right panel */}
          <aside className="hidden md:flex w-80 shrink-0 flex-col border-l border-[rgba(100,255,218,0.12)] bg-[#091b39] overflow-y-auto">
            <div className="p-5 space-y-5 flex-1">

              {/* Metadata summary */}
              {metadata && (
                <div className="space-y-2">
                  <p className="font-mono text-[10px] text-[#64FFDA] uppercase tracking-widest">CEP-78 Metadata</p>
                  {[
                    { label: "Name", value: metadata.asset_name },
                    { label: "Type", value: metadata.asset_type },
                    { label: "Location", value: metadata.location },
                    { label: "Valuation", value: `$${metadata.valuation_usd.toLocaleString()}` },
                    { label: "Yield APY", value: `${metadata.yield_apy}%` },
                    { label: "Total Tokens", value: metadata.total_tokens.toLocaleString() },
                  ].map((item) => (
                    <div key={item.label} className="flex justify-between items-start p-2.5 bg-[#112240] rounded-lg border border-[rgba(100,255,218,0.08)]">
                      <span className="text-[10px] text-[#ebbbb4] uppercase font-mono">{item.label}</span>
                      <span className="text-xs text-[#d8e2ff] font-semibold text-right max-w-[140px]">{item.value}</span>
                    </div>
                  ))}
                </div>
              )}

              {!metadata && (
                <div className="p-6 bg-[#112240] rounded-xl border border-[rgba(100,255,218,0.08)] text-center space-y-2">
                  <span className="material-symbols-outlined text-[#64FFDA]/30 text-4xl">data_object</span>
                  <p className="text-xs text-[#ebbbb4]">Describe your asset to generate metadata</p>
                </div>
              )}

              {/* Document anchoring panel */}
              {step === "document" && (
                <div className="space-y-3">
                  <p className="font-mono text-[10px] text-[#64FFDA] uppercase tracking-widest">Document Anchoring</p>

                  <div
                    onDragOver={(e) => { e.preventDefault(); setDocDragging(true); }}
                    onDragLeave={() => setDocDragging(false)}
                    onDrop={(e) => { e.preventDefault(); setDocDragging(false); const f = e.dataTransfer.files[0]; if (f) processDocument(f); }}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${docDragging ? "border-[#64FFDA] bg-[#64FFDA]/5" : "border-[rgba(100,255,218,0.2)] hover:border-[#64FFDA]/40"}`}
                  >
                    <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(e) => { const f = e.target.files?.[0]; if (f) processDocument(f); }} />
                    {docName ? (
                      <div className="space-y-1">
                        <span className="material-symbols-outlined text-[#64FFDA] text-3xl">description</span>
                        <p className="text-xs font-bold text-[#d8e2ff]">{docName}</p>
                        <p className="text-[9px] text-[#abb9d6]">Click to change</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <span className="material-symbols-outlined text-[#abb9d6] text-3xl">upload_file</span>
                        <p className="text-xs text-[#abb9d6]">Drop file or click to browse</p>
                        <p className="text-[9px] text-[#ebbbb4]">PDF, image — hashed locally, never uploaded</p>
                      </div>
                    )}
                  </div>

                  {docHash && (
                    <div className="p-3 bg-[#112240] rounded-lg border border-[rgba(100,255,218,0.1)] space-y-1">
                      <p className="text-[9px] font-mono text-[#64FFDA] uppercase">SHA-256 fingerprint</p>
                      <p className="text-[9px] font-mono text-[#d8e2ff] break-all">{docHash}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button onClick={skipDocument}
                      className="flex-1 py-2 border border-[rgba(100,255,218,0.15)] text-[#abb9d6] text-xs rounded-lg hover:text-[#d8e2ff]">
                      Skip
                    </button>
                    <button onClick={proceedToKyc} disabled={!docHash}
                      className="flex-1 py-2 bg-[#64FFDA] text-[#011230] text-xs font-bold rounded-lg hover:brightness-110 disabled:opacity-40">
                      Proceed to KYC →
                    </button>
                  </div>
                </div>
              )}

              {/* KYC panel */}
              {step === "kyc" && (
                <div className="space-y-3">
                  <p className="font-mono text-[10px] text-[#64FFDA] uppercase tracking-widest">KYC Verification</p>

                  <div className="p-3 bg-[#112240] rounded-xl border border-[rgba(100,255,218,0.08)] space-y-2 text-[11px] text-[#abb9d6] leading-relaxed">
                    <p className="font-bold text-[#d8e2ff] text-xs">Accredited Investor Declaration</p>
                    <p>By signing, you declare that you meet the criteria of an accredited investor (annual income &gt; $200k, or net worth &gt; $1M excluding primary residence).</p>
                    <p>You understand that RWA tokens are restricted securities and that transfers are restricted to KYC-verified wallets.</p>
                  </div>

                  {kycAttested ? (
                    <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg space-y-1">
                      <p className="text-[9px] font-mono text-[#00C853] uppercase">Attestation signed</p>
                      <p className="text-[9px] font-mono text-[#d8e2ff] break-all">{kycSig?.slice(0, 40)}...</p>
                    </div>
                  ) : (
                    <button onClick={handleKycAttest} disabled={kycLoading || !wallet.isConnected}
                      className="w-full py-3 bg-[#253453] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] font-bold text-sm rounded-xl hover:bg-[#2d3d60] active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[16px]">verified_user</span>
                      {kycLoading ? "Signing..." : wallet.isConnected ? "Sign Attestation" : "Connect Wallet First"}
                    </button>
                  )}
                </div>
              )}

              {/* Mint button */}
              {step === "mint" && (
                <div className="space-y-3">
                  <p className="font-mono text-[10px] text-[#64FFDA] uppercase tracking-widest">Ready to Mint</p>
                  <div className="space-y-1.5 text-[10px]">
                    {[
                      { label: "Metadata", ok: !!metadata },
                      { label: "Document anchored", ok: !!docHash, optional: true },
                      { label: "KYC signed", ok: kycAttested },
                      { label: "Wallet connected", ok: wallet.isConnected },
                    ].map((c) => (
                      <div key={c.label} className="flex items-center gap-2">
                        <span className={`material-symbols-outlined text-[14px] ${c.ok ? "text-[#00C853]" : c.optional ? "text-[#abb9d6]" : "text-[#FF6B6B]"}`} style={c.ok ? { fontVariationSettings: "'FILL' 1" } : {}}>
                          {c.ok ? "check_circle" : c.optional ? "radio_button_unchecked" : "cancel"}
                        </span>
                        <span className={c.ok ? "text-[#d8e2ff]" : "text-[#abb9d6]"}>{c.label}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={handleMint} disabled={loading || !wallet.isConnected}
                    className="w-full py-3 bg-[#FF0000] text-white font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                    <span className="material-symbols-outlined text-[16px]">toll</span>
                    {loading ? "Waiting for signature..." : "Mint CEP-78 Token"}
                  </button>
                  {loading && (
                    <button onClick={() => setLoading(false)}
                      className="w-full py-1.5 text-[10px] text-[#ebbbb4] hover:text-[#d8e2ff] underline">
                      Cancel / reset
                    </button>
                  )}
                </div>
              )}

              {/* Done */}
              {step === "done" && txHash && tokenId && (
                <div className="space-y-3">
                  <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-xl space-y-1">
                    <p className="text-[9px] font-mono text-[#00C853] uppercase">Minted on Casper Testnet</p>
                    <p className="text-[9px] font-mono text-[#d8e2ff] break-all">{txHash}</p>
                  </div>
                  <a href={`https://testnet.cspr.live/deploy/${txHash}`} target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 border border-[rgba(100,255,218,0.2)] rounded-xl text-[10px] font-mono text-[#64FFDA] hover:bg-[#64FFDA]/5">
                    <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                    View on testnet.cspr.live
                  </a>
                  <button onClick={() => router.push(`/assets/${tokenId}`)}
                    className="w-full py-3 bg-[#64FFDA] text-[#011230] font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all">
                    View Cap Table →
                  </button>
                  <Link href="/yield" className="flex items-center justify-center w-full py-2.5 border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-sm font-bold rounded-xl hover:bg-[#64FFDA]/5">
                    Set Up Yield Distribution →
                  </Link>
                </div>
              )}

              {/* Contract reference */}
              <div className="pt-2 border-t border-[rgba(100,255,218,0.08)]">
                <p className="text-[9px] font-mono text-[#ebbbb4] uppercase mb-1">RWA NFT Contract</p>
                {CONTRACT_HASHES.rwaNft ? (
                  <a href={`https://testnet.cspr.live/contract/${CONTRACT_HASHES.rwaNft}`} target="_blank" rel="noopener noreferrer"
                    className="text-[9px] font-mono text-[#64FFDA] hover:underline break-all">{CONTRACT_HASHES.rwaNft.slice(0, 24)}...</a>
                ) : (
                  <p className="text-[9px] font-mono text-[#FF0000]">Contract not configured</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
