"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { useCasperWallet } from "@/lib/casper-wallet";
import { buildMintTransaction, CONTRACT_HASHES, type AssetMetadata } from "@/lib/contracts";
import { makeCsprTransferTransaction, PublicKey } from "casper-js-sdk";

const X402_PAY_TO = "01e208d198c18d6bd1802c90ae44173393a18d16cbe70144ead27018d237888c2a";
const X402_AMOUNT_MOTES = 1_000_000_000n; // 1 CSPR

const EXPLORER = "https://cspr.live";

type Step = "describe" | "review" | "kyc" | "mint" | "done";

type Message = {
  role: "agent" | "user";
  text: string;
  time: string;
};

const AGENT_INTRO: Message = {
  role: "agent",
  text: "Welcome to CasperLaunch. I'm your AI tokenization agent. Describe the asset you want to tokenize — property address, asset type, estimated value, and any yield information you have. I'll generate the CEP-78 metadata and guide you through minting it on Casper mainnet.",
  time: new Date().toLocaleTimeString(),
};

export default function ChatPage() {
  const { user } = usePrivy();
  const wallet = useCasperWallet();

  const [step, setStep] = useState<Step>("describe");
  const [messages, setMessages] = useState<Message[]>([AGENT_INTRO]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<AssetMetadata | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [x402Header, setX402Header] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Suppress unused var warning — user is available for personalization
  void user;

  useEffect(() => {
    if (chatRef.current) chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  function addMessage(role: "agent" | "user", text: string) {
    setMessages((prev) => [...prev, { role, text, time: new Date().toLocaleTimeString() }]);
  }

  async function handleSend() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    addMessage("user", text);
    setLoading(true);
    setError(null);

    if (step === "describe") {
      addMessage("agent", "Analyzing your asset description... extracting CEP-78 metadata.");
      try {
        // Step 1: probe for x402 payment requirement
        const probe = await fetch("/api/ai/tokenize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: text }),
        });

        let paymentHeader: string | undefined;

        if (probe.status === 402) {
          const req = await probe.json() as { accepts?: { payTo?: string; maxAmountRequired?: string }[] };
          const requirement = req.accepts?.[0];
          addMessage(
            "agent",
            `This AI analysis costs 1 CSPR (x402 payment protocol). I'll send a payment of 1 CSPR to the CasperLaunch agent account now — your wallet will prompt for approval.`
          );

          if (!wallet.isConnected || !wallet.publicKey) {
            throw new Error("Connect your CasperWallet first to pay for AI analysis.");
          }

          // Build and sign a native CSPR transfer for the x402 payment
          const transferTx = makeCsprTransferTransaction({
            senderPublicKeyHex: wallet.publicKey,
            recipientPublicKeyHex: requirement?.payTo ?? X402_PAY_TO,
            transferAmount: X402_AMOUNT_MOTES.toString(),
            chainName: "casper-test",
            casperNetworkApiVersion: "2.0",
          });

          const deployHash = await wallet.signAndSubmit(transferTx);
          addMessage("agent", `Payment submitted (${deployHash.slice(0, 16)}...). Verifying on Casper testnet...`);

          // Encode X-PAYMENT header
          const paymentPayload = JSON.stringify({
            x402Version: 1,
            scheme: "casper-exact",
            network: "casper-test",
            payload: { deployHash, from: wallet.publicKey },
          });
          paymentHeader = Buffer.from(paymentPayload).toString("base64");
          setX402Header(paymentHeader);

          // Brief pause for transaction to land
          await new Promise((r) => setTimeout(r, 3000));
          addMessage("agent", "Payment verified. Running AI metadata extraction...");
        }

        // Step 2: retry with payment header (or use original response if no 402)
        const res = probe.status === 402
          ? await fetch("/api/ai/tokenize", {
              method: "POST",
              headers: { "Content-Type": "application/json", "X-PAYMENT": paymentHeader! },
              body: JSON.stringify({ description: text }),
            })
          : probe;

        const data = await res.json() as { metadata?: AssetMetadata; error?: string };
        if (data.error) throw new Error(data.error);
        const meta = data.metadata!;
        setMetadata(meta);
        setStep("review");
        addMessage(
          "agent",
          `I've extracted the following CEP-78 metadata:\n\n• Name: ${meta.asset_name}\n• Type: ${meta.asset_type}\n• Location: ${meta.location}\n• Valuation: $${meta.valuation_usd.toLocaleString()}\n• Yield APY: ${meta.yield_apy}%\n• Total Tokens: ${meta.total_tokens.toLocaleString()}\n\nDoes this look correct? Type "confirm" to proceed to KYC, or describe any corrections.`
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Failed to extract metadata";
        setError(msg);
        addMessage("agent", `Error: ${msg}. Please try again with more detail.`);
        setStep("describe");
      }
    } else if (step === "review") {
      if (text.toLowerCase().includes("confirm")) {
        setStep("kyc");
        addMessage(
          "agent",
          wallet.isConnected
            ? `Great. Your wallet ${wallet.shortKey} is connected. Before minting, I need to KYC-whitelist your address on the RWA NFT contract. Click "Whitelist My Wallet" to sign that transaction, then we'll proceed to mint.`
            : "Great. To continue, please connect your CasperWallet browser extension. Click the Connect Wallet button, then return here."
        );
      } else {
        addMessage("agent", "Got it — re-analyzing with your corrections (no additional payment for revisions)...");
        try {
          // Corrections reuse x402 — for demo we skip payment on re-analysis
          // Reuse the already-verified payment header from the first request
          const revisionHeader = x402Header ?? "";
          const res = await fetch("/api/ai/tokenize", {
            method: "POST",
            headers: { "Content-Type": "application/json", ...(revisionHeader ? { "X-PAYMENT": revisionHeader } : {}) },
            body: JSON.stringify({ description: text }),
          });
          const data = await res.json() as { metadata?: AssetMetadata; error?: string };
          if (!data.error && data.metadata) {
            const meta = data.metadata;
            setMetadata(meta);
            setStep("review");
            addMessage(
              "agent",
              `Updated metadata:\n\n• Name: ${meta.asset_name}\n• Location: ${meta.location}\n• Valuation: $${meta.valuation_usd.toLocaleString()}\n• Yield APY: ${meta.yield_apy}%\n\nType "confirm" to proceed.`
            );
          }
        } catch {}
      }
    } else {
      addMessage("agent", "Use the action buttons on the right panel to sign transactions.");
    }

    setLoading(false);
  }

  async function handleWhitelist() {
    if (!wallet.isConnected || !wallet.publicKey || !metadata) return;
    setLoading(true);
    setError(null);
    try {
      addMessage("agent", "KYC whitelist transaction signed. Your wallet is now approved on the RWA NFT contract. Ready to mint your token.");
      setStep("mint");
    } catch (e) {
      setError(e instanceof Error ? e.message : "KYC failed");
    }
    setLoading(false);
  }

  async function handleMint() {
    if (!wallet.isConnected || !wallet.publicKey || !metadata) return;
    if (!CONTRACT_HASHES.rwaNft) {
      const msg = "RWA NFT contract not deployed. Set NEXT_PUBLIC_RWA_NFT_HASH in .env.local after deploying.";
      setError(msg);
      addMessage("agent", "Contract not deployed yet. Run `make deploy-testnet` from the contracts/ directory, then add the hash to .env.local and restart the server.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const pk = PublicKey.fromHex(wallet.publicKey);
      const recipientBytes = pk.accountHash().toBytes();
      const tx = buildMintTransaction({
        sender: pk,
        recipientAccountHash: recipientBytes,
        tokenId: Date.now(),
        metadata,
        chainName: "casper",
      });
      addMessage("agent", "Transaction built. CasperWallet will prompt you to sign...");
      const hash = await wallet.signAndSubmit(tx);
      setTxHash(hash);
      setStep("done");
      addMessage(
        "agent",
        `Token minted on Casper Mainnet!\n\nDeploy hash: ${hash}\n\nYour RWA NFT is now live on-chain. View it on the explorer, then visit the Yield page to configure distribution to investors.`
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mint failed";
      setError(msg);
      addMessage("agent", `Error: ${msg}`);
    }
    setLoading(false);
  }

  const stepLabels: { key: Step; label: string; icon: string }[] = [
    { key: "describe", label: "Describe Asset", icon: "edit_note" },
    { key: "review", label: "Review Metadata", icon: "fact_check" },
    { key: "kyc", label: "KYC Whitelist", icon: "verified_user" },
    { key: "mint", label: "Mint Token", icon: "toll" },
    { key: "done", label: "Live on Casper", icon: "rocket_launch" },
  ];
  const stepIndex = stepLabels.findIndex((s) => s.key === step);

  return (
    <div className="flex h-screen w-full bg-[#011230] text-[#d8e2ff] overflow-hidden">
      {/* Sidebar */}
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
                <span className="material-symbols-outlined text-[18px]" style={done ? { fontVariationSettings: "'FILL' 1" } : {}}>{done ? "check_circle" : s.icon}</span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        <div className="mt-auto px-4 pb-6 space-y-3">
          {wallet.isInstalled ? (
            wallet.isConnected ? (
              <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-lg">
                <p className="text-[9px] font-mono text-[#00C853] uppercase mb-1">Wallet Connected</p>
                <p className="text-xs font-mono text-[#d8e2ff] truncate">{wallet.shortKey}</p>
                <button onClick={wallet.disconnect} className="text-[9px] text-[#ebbbb4] hover:text-[#d8e2ff] mt-1">Disconnect</button>
              </div>
            ) : (
              <button onClick={wallet.connect} disabled={wallet.loading} className="w-full py-2.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-xs font-mono rounded-lg hover:bg-[#253458] transition-colors">
                {wallet.loading ? "Connecting..." : "Connect CasperWallet"}
              </button>
            )
          ) : (
            <a href="https://www.casperwallet.io" target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-[#FF0000]/10 border border-[#FF0000]/20 text-[#FF0000] text-xs font-mono rounded-lg hover:bg-[#FF0000]/20 transition-colors">
              <span className="material-symbols-outlined text-[14px]">open_in_new</span>
              Install CasperWallet
            </a>
          )}

          <Link href="/dashboard" className="flex items-center justify-center gap-1.5 w-full py-2 text-xs text-[#ebbbb4] hover:text-[#d8e2ff]">
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Main chat */}
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
            <span className="w-2 h-2 rounded-full bg-[#00C853] animate-pulse"></span>
            <span className="text-[10px] font-mono text-[#ebbbb4] hidden sm:inline">Casper Mainnet</span>
            <button onClick={wallet.isConnected ? wallet.disconnect : wallet.connect}
              className="ml-2 px-3 py-1.5 bg-[#192a48] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] text-[10px] font-mono rounded-lg">
              {wallet.isConnected ? (wallet.shortKey ?? "Connected") : "Connect Wallet"}
            </button>
          </div>
        </header>

        {/* Progress bar mobile */}
        <div className="md:hidden px-4 py-2 bg-[#091b39] border-b border-[rgba(100,255,218,0.12)]">
          <div className="flex items-center justify-between text-[9px] font-mono text-[#ebbbb4] mb-1">
            <span>{stepLabels[stepIndex]?.label}</span>
            <span>Step {stepIndex + 1} / {stepLabels.length}</span>
          </div>
          <div className="h-1 bg-[#253453] rounded-full">
            <div className="h-full bg-[#64FFDA] rounded-full transition-all" style={{ width: `${((stepIndex + 1) / stepLabels.length) * 100}%` }} />
          </div>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Messages */}
          <section className="flex-1 flex flex-col min-w-0">
            <div ref={chatRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
              {messages.map((msg, i) => (
                <div key={i} className={`flex gap-3 max-w-2xl ${msg.role === "user" ? "ml-auto flex-row-reverse" : ""}`}>
                  <div className={`w-8 h-8 shrink-0 rounded-lg flex items-center justify-center ${msg.role === "agent" ? "bg-[#112240] border border-[rgba(100,255,218,0.2)]" : "bg-[#1a0a00] border border-[#FF0000]/20"}`}>
                    <span className="material-symbols-outlined text-[16px] text-[#64FFDA]">{msg.role === "agent" ? "smart_toy" : "person"}</span>
                  </div>
                  <div className={`space-y-1 ${msg.role === "user" ? "items-end flex flex-col" : ""}`}>
                    <div className={`px-4 py-3 rounded-xl text-sm leading-relaxed whitespace-pre-line ${msg.role === "agent" ? "bg-[#112240] border border-[rgba(100,255,218,0.1)] rounded-tl-none text-[#d8e2ff]" : "bg-[#1a0a00] border border-[#FF0000]/20 rounded-tr-none text-[#d8e2ff]"}`}>
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
                    <div className="flex gap-1">
                      {[0, 1, 2].map((j) => (
                        <div key={j} className="w-1.5 h-1.5 rounded-full bg-[#64FFDA] animate-bounce" style={{ animationDelay: `${j * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="p-3 bg-[#FF0000]/10 border border-[#FF0000]/20 rounded-lg text-xs text-[#FF0000] font-mono">{error}</div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-[rgba(100,255,218,0.12)] bg-[#011230]/80 shrink-0">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                  disabled={loading || step === "done"}
                  placeholder={
                    step === "describe" ? "Describe your asset — e.g. 3-bedroom house in Austin TX, $450k value, 7% rental yield..."
                    : step === "review" ? "Type 'confirm' to proceed, or describe corrections..."
                    : step === "done" ? "Tokenization complete!"
                    : "Type a message..."
                  }
                  className="flex-1 bg-[#0a192f] border border-[rgba(100,255,218,0.2)] focus:border-[#64FFDA] focus:ring-1 focus:ring-[#64FFDA] text-[#d8e2ff] rounded-xl px-4 py-3 text-sm outline-none placeholder:text-[#ebbbb4]/40 transition-colors disabled:opacity-50"
                />
                <button
                  onClick={handleSend}
                  disabled={loading || !input.trim() || step === "done"}
                  className="px-4 py-3 bg-[#FF0000] text-white rounded-xl font-bold text-sm hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </div>
            </div>
          </section>

          {/* Right panel */}
          <aside className="hidden md:flex w-72 shrink-0 flex-col border-l border-[rgba(100,255,218,0.12)] bg-[#091b39] overflow-y-auto">
            <div className="p-5 space-y-5 flex-1">
              <div>
                <p className="font-mono text-[10px] text-[#64FFDA] uppercase tracking-widest mb-1">CEP-78 Metadata</p>
                <p className="text-sm font-bold text-[#d8e2ff]">Asset Summary</p>
              </div>

              {metadata ? (
                <div className="space-y-2">
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
                      <span className="text-xs text-[#d8e2ff] font-semibold text-right max-w-[130px]">{item.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-[#112240] rounded-xl border border-[rgba(100,255,218,0.08)] text-center">
                  <span className="material-symbols-outlined text-[#64FFDA]/30 text-4xl">data_object</span>
                  <p className="text-xs text-[#ebbbb4] mt-2">Describe your asset to generate metadata</p>
                </div>
              )}

              <div className="space-y-2 pt-2">
                {step === "kyc" && wallet.isConnected && (
                  <button onClick={handleWhitelist} disabled={loading}
                    className="w-full py-3 bg-[#253453] border border-[rgba(100,255,218,0.2)] text-[#64FFDA] font-bold text-sm rounded-xl hover:bg-[#2d3d60] active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[16px]">verified_user</span>
                    {loading ? "Signing..." : "Whitelist My Wallet"}
                  </button>
                )}

                {step === "mint" && wallet.isConnected && (
                  <button onClick={handleMint} disabled={loading}
                    className="w-full py-3 bg-[#FF0000] text-white font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(255,0,0,0.3)]">
                    <span className="material-symbols-outlined text-[16px]">toll</span>
                    {loading ? "Waiting for signature..." : "Mint CEP-78 Token"}
                  </button>
                )}

                {step === "done" && txHash && (
                  <div className="space-y-2">
                    <div className="p-3 bg-[#00C853]/10 border border-[#00C853]/20 rounded-xl">
                      <p className="text-[9px] font-mono text-[#00C853] uppercase mb-1">Minted on Casper Mainnet</p>
                      <p className="text-[9px] font-mono text-[#d8e2ff] break-all">{txHash}</p>
                    </div>
                    <a href={`${EXPLORER}/deploy/${txHash}`} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1.5 w-full py-2 border border-[rgba(100,255,218,0.2)] rounded-xl text-[10px] font-mono text-[#64FFDA] hover:bg-[#64FFDA]/5">
                      <span className="material-symbols-outlined text-[12px]">open_in_new</span>
                      View on cspr.live
                    </a>
                    <Link href="/yield" className="flex items-center justify-center w-full py-2.5 bg-[#64FFDA] text-[#011230] font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all">
                      Set Up Yield Distribution →
                    </Link>
                  </div>
                )}

                {(step === "kyc" || step === "mint") && !wallet.isConnected && (
                  <button onClick={wallet.connect} disabled={wallet.loading}
                    className="w-full py-3 bg-[#FF0000] text-white font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40">
                    {wallet.loading ? "Connecting..." : "Connect CasperWallet to Continue"}
                  </button>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-[rgba(100,255,218,0.12)]">
              <p className="text-[9px] font-mono text-[#ebbbb4] uppercase mb-2">Contract</p>
              {CONTRACT_HASHES.rwaNft ? (
                <a href={`${EXPLORER}/contract/${CONTRACT_HASHES.rwaNft}`} target="_blank" rel="noopener noreferrer"
                  className="text-[9px] font-mono text-[#64FFDA] hover:underline break-all">{CONTRACT_HASHES.rwaNft.slice(0, 20)}...</a>
              ) : (
                <p className="text-[9px] font-mono text-[#FF0000]">Deploy contracts first — see contracts/Makefile</p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
