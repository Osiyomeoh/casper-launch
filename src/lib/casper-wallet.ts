/**
 * CasperWallet browser extension integration.
 *
 * The CasperWallet extension injects window.CasperWalletProvider when installed.
 * This module provides a React hook and helpers for connecting, signing,
 * and submitting Casper transactions from the browser.
 *
 * Install link: https://www.casperwallet.io
 */

import { useState, useEffect, useCallback } from "react";
import { PublicKey, Transaction, TransactionV1, Deploy } from "casper-js-sdk";

// ── Window type augmentation ───────────────────────────────────────────────────

type CasperWalletProvider = {
  requestConnection(): Promise<boolean>;
  disconnectFromSite(): Promise<boolean>;
  getActivePublicKey(): Promise<string>;
  /** Sign a Transaction (Casper 2.0) JSON string */
  signTransaction(transactionJson: string, signingPublicKey: string): Promise<{ cancelled: boolean; signatureHex: string }>;
  /** Sign a Deploy (Casper 1.x) JSON string */
  sign(deployJson: string, signingPublicKey: string): Promise<{ cancelled: boolean; signatureHex: string }>;
  /** Sign an arbitrary message */
  signMessage(message: string, signingPublicKey: string): Promise<{ cancelled: boolean; signatureHex: string }>;
  isConnected(): Promise<boolean>;
};

declare global {
  interface Window {
    CasperWalletProvider?: () => CasperWalletProvider;
  }
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export type WalletState = {
  /** Extension is installed in the browser */
  isInstalled: boolean;
  /** User has connected this site */
  isConnected: boolean;
  /** Hex-encoded active public key */
  publicKey: string | null;
  /** Human-readable short address */
  shortKey: string | null;
  /** Loading / waiting for user approval */
  loading: boolean;
  /** Last error message */
  error: string | null;
};

export type WalletActions = {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signAndSubmit(tx: Transaction): Promise<string>;
  sign(tx: Transaction): Promise<Transaction>;
};

export function useCasperWallet(): WalletState & WalletActions {
  const [state, setState] = useState<WalletState>({
    isInstalled: false,
    isConnected: false,
    publicKey: null,
    shortKey: null,
    loading: false,
    error: null,
  });

  const getProvider = useCallback((): CasperWalletProvider | null => {
    if (typeof window === "undefined") return null;
    return window.CasperWalletProvider?.() ?? null;
  }, []);

  // Check connection status on mount and on extension events
  useEffect(() => {
    const provider = getProvider();
    if (!provider) {
      setState((s) => ({ ...s, isInstalled: false }));
      return;
    }
    setState((s) => ({ ...s, isInstalled: true }));

    provider.isConnected().then(async (connected) => {
      if (connected) {
        const pk = await provider.getActivePublicKey();
        setState((s) => ({
          ...s,
          isConnected: true,
          publicKey: pk,
          shortKey: pk ? `${pk.slice(0, 8)}…${pk.slice(-6)}` : null,
        }));
      }
    }).catch(() => {});

    // Listen for CasperWallet events
    const onConnect = (e: Event) => {
      const detail = (e as CustomEvent<{ activeKey: string }>).detail;
      setState((s) => ({
        ...s,
        isConnected: true,
        publicKey: detail.activeKey,
        shortKey: `${detail.activeKey.slice(0, 8)}…${detail.activeKey.slice(-6)}`,
      }));
    };
    const onDisconnect = () => {
      setState((s) => ({ ...s, isConnected: false, publicKey: null, shortKey: null }));
    };
    const onActiveKeyChange = (e: Event) => {
      const detail = (e as CustomEvent<{ activeKey: string }>).detail;
      setState((s) => ({
        ...s,
        publicKey: detail.activeKey,
        shortKey: `${detail.activeKey.slice(0, 8)}…${detail.activeKey.slice(-6)}`,
      }));
    };

    window.addEventListener("casper-connected", onConnect);
    window.addEventListener("casper-disconnected", onDisconnect);
    window.addEventListener("casper-active-key-changed", onActiveKeyChange);
    return () => {
      window.removeEventListener("casper-connected", onConnect);
      window.removeEventListener("casper-disconnected", onDisconnect);
      window.removeEventListener("casper-active-key-changed", onActiveKeyChange);
    };
  }, [getProvider]);

  const connect = useCallback(async () => {
    const provider = getProvider();
    if (!provider) {
      window.open("https://www.casperwallet.io", "_blank");
      return;
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      await provider.requestConnection();
      const pk = await provider.getActivePublicKey();
      setState((s) => ({
        ...s,
        isConnected: true,
        publicKey: pk,
        shortKey: `${pk.slice(0, 8)}…${pk.slice(-6)}`,
        loading: false,
      }));
    } catch (e) {
      setState((s) => ({ ...s, loading: false, error: "Connection rejected" }));
    }
  }, [getProvider]);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) await provider.disconnectFromSite().catch(() => {});
    setState((s) => ({ ...s, isConnected: false, publicKey: null, shortKey: null }));
  }, [getProvider]);

  /**
   * Sign a Transaction with CasperWallet and return the signed Transaction.
   * The wallet prompts the user for approval.
   */
  const sign = useCallback(async (tx: Transaction): Promise<Transaction> => {
    const provider = getProvider();
    if (!provider) throw new Error("CasperWallet not installed");
    if (!state.publicKey) throw new Error("Wallet not connected");

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const txJson = JSON.stringify(tx.toJSON());
      const result = await provider.signTransaction(txJson, state.publicKey);
      if (result.cancelled) throw new Error("User cancelled signing");

      const sigBytes = hexToBytes(result.signatureHex);
      const pk = PublicKey.fromHex(state.publicKey);
      tx.setSignature(sigBytes, pk);

      setState((s) => ({ ...s, loading: false }));
      return tx;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Signing failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, [getProvider, state.publicKey]);

  /**
   * Sign and submit a Transaction to Casper mainnet.
   * Returns the on-chain deploy/transaction hash.
   */
  const signAndSubmit = useCallback(async (tx: Transaction): Promise<string> => {
    const signed = await sign(tx);
    setState((s) => ({ ...s, loading: true }));
    try {
      const res = await fetch("/api/casper/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploy: signed.toJSON() }),
      });
      const data = await res.json() as { deployHash?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Submission failed");
      setState((s) => ({ ...s, loading: false }));
      return data.deployHash!;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Submission failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, [sign]);

  return { ...state, connect, disconnect, sign, signAndSubmit };
}

// ── Utilities ──────────────────────────────────────────────────────────────────

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Format CSPR motes to human-readable CSPR */
export function motesToCspr(motes: string | bigint, decimals = 2): string {
  const n = Number(BigInt(motes.toString())) / 1_000_000_000;
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals });
}

/** Short-form a Casper public key for display */
export function shortKey(pk: string): string {
  return `${pk.slice(0, 8)}…${pk.slice(-6)}`;
}
