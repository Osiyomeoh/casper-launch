"use client";
import { usePrivy } from "@privy-io/react-auth";
import { useWallet } from "@/lib/wallet-context";

export default function ConnectModal({ onClose }: { onClose: () => void }) {
  const { login } = usePrivy();
  const casperWallet = useWallet();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-[rgba(100,255,218,0.15)] p-6 space-y-4"
        style={{ background: "rgba(9,27,57,0.98)" }}
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <h2 className="text-lg font-bold text-[#d8e2ff]">Connect to CasperLaunch</h2>
          <p className="text-xs text-[#abb9d6]">Choose how you want to connect</p>
        </div>

        {/* Privy — email / social */}
        <button
          onClick={() => { login(); onClose(); }}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-[rgba(100,255,218,0.15)] hover:border-[rgba(100,255,218,0.35)] bg-[#112240] hover:bg-[#152a50] transition-all text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-[#64FFDA]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#64FFDA] text-xl">email</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#d8e2ff]">Email or Social</p>
            <p className="text-[10px] text-[#abb9d6] mt-0.5">Sign in with Google, email, or social — wallet created automatically</p>
          </div>
        </button>

        {/* CasperWallet */}
        <button
          onClick={() => { casperWallet.connect(); onClose(); }}
          disabled={casperWallet.loading}
          className="w-full flex items-center gap-4 p-4 rounded-xl border border-[rgba(100,255,218,0.15)] hover:border-[rgba(100,255,218,0.35)] bg-[#112240] hover:bg-[#152a50] transition-all text-left disabled:opacity-50"
        >
          <div className="w-10 h-10 rounded-lg bg-[#FF0000]/10 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#FF0000] text-xl">account_balance_wallet</span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#d8e2ff]">CasperWallet</p>
            <p className="text-[10px] text-[#abb9d6] mt-0.5">
              {casperWallet.isInstalled
                ? "Connect your existing CasperWallet browser extension"
                : "Install CasperWallet extension first"}
            </p>
          </div>
          {!casperWallet.isInstalled && (
            <a
              href="https://www.casperwallet.io"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="ml-auto shrink-0 text-[9px] font-mono text-[#64FFDA] border border-[#64FFDA]/20 px-2 py-1 rounded-lg hover:bg-[#64FFDA]/5"
            >
              Install
            </a>
          )}
        </button>

        <button onClick={onClose} className="w-full text-xs text-[#abb9d6] hover:text-[#d8e2ff] py-1 transition-colors">
          Cancel
        </button>
      </div>
    </div>
  );
}
