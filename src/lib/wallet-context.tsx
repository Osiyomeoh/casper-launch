"use client";
import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  shortKey: string | null;
  loading: boolean;
  isInstalled: boolean;
  error: string | null;
}

export interface WalletActions {
  connect: () => void;
  disconnect: () => void;
  signMessage: (message: string) => Promise<string>;
}

type WalletCtx = WalletState & WalletActions;

// Access the CSPR.click SDK loaded by ClickProvider from CDN
function getSDK(): any {
  if (typeof window === "undefined") return null;
  return (window as any).csprclick ?? null;
}

const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let sdk = getSDK();

    function attach(s: any) {
      const onSignIn = (account: any) => setPublicKey(account?.public_key ?? null);
      const onSignOut = () => setPublicKey(null);
      s.on("csprclick:signed_in", onSignIn);
      s.on("csprclick:signed_out", onSignOut);
      s.on("csprclick:active_key_changed", onSignIn);
      // Pick up already-active account
      const active = s.getActiveAccount?.();
      if (active?.public_key) setPublicKey(active.public_key);
      return () => {
        s.off?.("csprclick:signed_in", onSignIn);
        s.off?.("csprclick:signed_out", onSignOut);
        s.off?.("csprclick:active_key_changed", onSignIn);
      };
    }

    if (sdk) return attach(sdk);

    // SDK loads async from CDN — wait for the ready event
    const onLoaded = () => {
      sdk = getSDK();
      if (sdk) attach(sdk);
    };
    window.addEventListener("csprclick:loaded", onLoaded);
    return () => window.removeEventListener("csprclick:loaded", onLoaded);
  }, []);

  const connect = useCallback(() => {
    getSDK()?.signIn();
  }, []);

  const disconnect = useCallback(() => {
    getSDK()?.signOut();
    setPublicKey(null);
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const sdk = getSDK();
    if (!sdk || !publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    try {
      const result = await sdk.signMessage(message, publicKey);
      if (!result?.signature) throw new Error("Signing cancelled or failed");
      return result.signature;
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  const shortKey = publicKey
    ? `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}`
    : null;

  const value: WalletCtx = {
    isConnected: !!publicKey,
    publicKey,
    shortKey,
    loading,
    isInstalled: true,
    error: null,
    connect,
    disconnect,
    signMessage,
  };

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletCtx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
