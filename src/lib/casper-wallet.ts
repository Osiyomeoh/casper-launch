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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signAndSubmitDeploy(deploy: any): Promise<string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  signAndSubmitTransaction(txJson: any): Promise<string>;
  signMessage(message: string): Promise<string>;
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
    // Extension injects CasperWalletProvider asynchronously — retry a few times
    let cancelled = false;
    async function init() {
      let provider = getProvider();
      // console.log("[wallet] init — provider on mount:", !!provider);
      if (!provider) {
        for (let i = 0; i < 6 && !provider; i++) {
          await new Promise(r => setTimeout(r, 500));
          provider = getProvider();
          // console.log(`[wallet] retry ${i + 1} — provider:`, !!provider);
        }
      }
      if (cancelled || !provider) {
        // console.log("[wallet] not installed / cancelled");
        setState((s) => ({ ...s, isInstalled: false }));
        return;
      }
      // console.log("[wallet] installed ✓");
      setState((s) => ({ ...s, isInstalled: true }));
      try {
        const connected = await provider.isConnected();
        // console.log("[wallet] isConnected:", connected);
        if (connected) {
          try {
            const pk = await provider.getActivePublicKey();
            // console.log("[wallet] active key:", pk);
            if (!cancelled && pk) {
              setState((s) => ({
                ...s,
                isConnected: true,
                publicKey: pk,
                shortKey: `${pk.slice(0, 8)}…${pk.slice(-6)}`,
              }));
            }
          } catch (e: unknown) {
            // Active account switched — need re-approval
            const err = e as { code?: number };
            // console.log("[wallet] getActivePublicKey error (code:", err?.code, ") — needs re-approval");
            if (!cancelled) setState((s) => ({ ...s, isConnected: false }));
          }
        }
      } catch { /* isConnected check error */ }
    }
    init();

    // Listen for CasperWallet events
    const onConnect = (e: Event) => {
      const detail = (e as CustomEvent<{ activeKey: string }>).detail;
      // console.log("[wallet] casper-connected event — key:", detail?.activeKey);
      setState((s) => ({
        ...s,
        isInstalled: true,
        isConnected: true,
        loading: false,
        error: null,
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
      cancelled = true;
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
      // console.log("[wallet] calling requestConnection...");
      const approved = await provider.requestConnection();
      // console.log("[wallet] requestConnection resolved — approved:", approved);
      if (!approved) {
        setState((s) => ({ ...s, loading: false, error: "Connection rejected" }));
        return;
      }
      await new Promise(r => setTimeout(r, 500));
      const pk = await provider.getActivePublicKey().catch((e: unknown) => {
        // console.log("[wallet] getActivePublicKey error:", e);
        return "";
      });
      // console.log("[wallet] getActivePublicKey after approve:", pk);
      if (pk) {
        setState((s) => ({
          ...s,
          isConnected: true,
          publicKey: pk,
          shortKey: `${pk.slice(0, 8)}…${pk.slice(-6)}`,
          loading: false,
        }));
      } else {
        setState((s) => ({ ...s, loading: false }));
      }
    } catch (e) {
      // console.log("[wallet] connect error:", e);
      setState((s) => ({ ...s, loading: false, error: "Connection rejected" }));
    }
  }, [getProvider]);

  const disconnect = useCallback(async () => {
    const provider = getProvider();
    if (provider) await provider.disconnectFromSite().catch(() => {});
    // Force-clear state regardless of whether the provider call succeeded
    setState((s) => ({ ...s, isConnected: false, publicKey: null, shortKey: null, error: null }));
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
      // buildFor1_5() produces a Deploy under the hood — use provider.sign (Deploy format)
      const deployJson = JSON.stringify(tx.toJSON());
      const result = await provider.sign(deployJson, state.publicKey);
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
   * Sign and submit a Transaction to Casper testnet.
   * Returns the on-chain deploy hash.
   */
  const signAndSubmit = useCallback(async (tx: Transaction): Promise<string> => {
    const provider = getProvider();
    if (!provider) throw new Error("CasperWallet not installed");
    if (!state.publicKey) throw new Error("Wallet not connected");

    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      // Call toJSON once — calling it twice can produce different hashes
      const deployObj = tx.toJSON() as Record<string, unknown>;
      const deployJson = JSON.stringify(deployObj);
      const result = await provider.sign(deployJson, state.publicKey);
      if (result.cancelled) throw new Error("User cancelled signing");

      // Casper requires signature prefixed with key algorithm: 01=Ed25519, 02=Secp256k1
      const sigPrefix = state.publicKey.startsWith("02") ? "02" : "01";
      const signature = /^0[12]/.test(result.signatureHex)
        ? result.signatureHex
        : `${sigPrefix}${result.signatureHex}`;

      const signedDeploy = {
        ...deployObj,
        approvals: [{ signer: state.publicKey, signature }],
      };

      const res = await fetch("/api/casper/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploy: signedDeploy }),
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
  }, [getProvider, state.publicKey]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signAndSubmitDeploy = useCallback(async (deploy: any): Promise<string> => {
    const provider = getProvider();
    if (!provider) throw new Error("CasperWallet not installed");
    if (!state.publicKey) throw new Error("Wallet not connected");
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const deployJson = JSON.stringify(deploy);
      const result = await provider.sign(deployJson, state.publicKey);
      if (result.cancelled) throw new Error("User cancelled signing");
      // Casper requires signature prefixed with key algorithm: 01=Ed25519, 02=Secp256k1
      const sigPrefix = state.publicKey.startsWith("02") ? "02" : "01";
      const signature = /^0[12]/i.test(result.signatureHex)
        ? result.signatureHex
        : `${sigPrefix}${result.signatureHex}`;
      const signedDeploy = {
        ...deploy,
        approvals: [{ signer: state.publicKey, signature }],
      };
      const res = await fetch("/api/casper/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploy: signedDeploy }),
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
  }, [getProvider, state.publicKey]);

  // Sign an authorization message and return the signature hex.
  // Used for sell listings: CasperWallet fires a popup, user confirms intent,
  // then the agent submits the on-chain transaction.
  // (CasperWallet does not yet support signing Casper 2.0 transactions directly.)
  const signMessage = useCallback(async (message: string): Promise<string> => {
    const provider = getProvider();
    if (!provider) throw new Error("CasperWallet not installed");
    if (!state.publicKey) throw new Error("Wallet not connected");
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const result = await provider.signMessage(message, state.publicKey);
      if (result.cancelled) throw new Error("User cancelled signing");
      setState((s) => ({ ...s, loading: false }));
      return result.signatureHex;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Signing failed";
      setState((s) => ({ ...s, loading: false, error: msg }));
      throw e;
    }
  }, [getProvider, state.publicKey]);

  // Keep for legacy deploy signing (make-transfer flow)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const signAndSubmitTransaction = useCallback(async (txJson: any): Promise<string> => {
    // Alias: sign the deploy and submit through the same path as signAndSubmitDeploy
    return signAndSubmitDeploy(txJson);
  }, [signAndSubmitDeploy]);

  return { ...state, connect, disconnect, sign, signAndSubmit, signAndSubmitDeploy, signAndSubmitTransaction, signMessage };
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
