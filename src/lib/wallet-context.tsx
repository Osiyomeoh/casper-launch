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
  signTransaction: (txJson: object) => Promise<string>;
  signAndSubmit: (txJson: object) => Promise<string>;
}

type WalletCtx = WalletState & WalletActions;

function getProvider(): any {
  if (typeof window === "undefined") return null;
  return (window as any).CasperWalletProvider?.() ?? null;
}

const WalletContext = createContext<WalletCtx | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check installation and pick up already-connected key
  useEffect(() => {
    const check = async () => {
      const provider = getProvider();
      if (!provider) return;
      setIsInstalled(true);
      try {
        const connected = await provider.isConnected();
        if (connected) {
          const key = await provider.getActivePublicKey();
          if (key) setPublicKey(key);
        }
      } catch {}
    };

    // Extension may not be injected immediately
    const timer = setTimeout(check, 300);

    const onConnected = (e: any) => {
      const key = e.detail?.activeKey ?? null;
      setPublicKey(key);
      setIsInstalled(true);
    };
    const onDisconnected = () => setPublicKey(null);
    const onKeyChanged = (e: any) => {
      const key = e.detail?.activeKey ?? null;
      setPublicKey(key);
    };

    window.addEventListener("casper-wallet:connected", onConnected);
    window.addEventListener("casper-wallet:disconnected", onDisconnected);
    window.addEventListener("casper-wallet:active-key-changed", onKeyChanged);
    window.addEventListener("casper-wallet:locked", onDisconnected);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("casper-wallet:connected", onConnected);
      window.removeEventListener("casper-wallet:disconnected", onDisconnected);
      window.removeEventListener("casper-wallet:active-key-changed", onKeyChanged);
      window.removeEventListener("casper-wallet:locked", onDisconnected);
    };
  }, []);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://www.casperwallet.io/", "_blank");
      return;
    }
    setError(null);
    try {
      await provider.requestConnection();
      // Resolve key immediately after approval — don't wait for event
      const key = await provider.getActivePublicKey();
      if (key) setPublicKey(key);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Connection failed");
    }
  }, []);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    try { await provider?.disconnectFromSite(); } catch {}
    setPublicKey(null);
  }, []);

  const signMessage = useCallback(async (message: string): Promise<string> => {
    const provider = getProvider();
    if (!provider || !publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    try {
      const result = await provider.signMessage(message, publicKey);
      if (!result?.signatureHex) throw new Error("Signing cancelled or failed");
      return result.signatureHex;
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Sign a TransactionV1 JSON with the connected wallet and return signature hex
  const signTransaction = useCallback(async (txJson: object): Promise<string> => {
    const provider = getProvider();
    if (!provider || !publicKey) throw new Error("Wallet not connected");
    setLoading(true);
    try {
      const result = await provider.signTransaction(JSON.stringify(txJson), publicKey);
      if (result?.cancelled) throw new Error("Signing cancelled");
      if (!result?.signatureHex) throw new Error("No signature returned");
      return result.signatureHex;
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  // Build approval, attach to tx, submit to Casper node, return deploy hash
  const signAndSubmit = useCallback(async (txJson: object): Promise<string> => {
    const sigHex = await signTransaction(txJson);
    // ED25519 signatures are prefixed with "01" in Casper's approval format
    const approval = { signer: publicKey!, signature: "01" + sigHex };
    const signedTx = { ...(txJson as Record<string, unknown>), approvals: [approval] };
    const res = await fetch("https://node.testnet.casper.network/rpc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "account_put_transaction",
        params: { transaction: { Version1: signedTx } },
      }),
    });
    const data = await res.json() as {
      result?: { transaction_hash?: { Version1?: string } };
      error?: { code?: number; message?: string };
    };
    if (data.error) throw new Error(`Code: ${data.error.code}, err: ${data.error.message}`);
    const hash = data.result?.transaction_hash?.Version1;
    if (!hash) throw new Error("No transaction hash returned");
    return hash;
  }, [publicKey, signTransaction]);

  const shortKey = publicKey
    ? `${publicKey.slice(0, 8)}…${publicKey.slice(-6)}`
    : null;

  return (
    <WalletContext.Provider value={{
      isConnected: !!publicKey,
      publicKey,
      shortKey,
      loading,
      isInstalled,
      error,
      connect,
      disconnect,
      signMessage,
      signTransaction,
      signAndSubmit,
    }}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet(): WalletCtx {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
