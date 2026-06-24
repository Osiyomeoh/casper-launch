/**
 * CasperLaunch — Contract interaction layer (casper-js-sdk v3)
 *
 * Builds Casper Transactions (Condor / 2.0 format) for the three
 * CasperLaunch smart contracts:
 *   rwa-nft           — CEP-78 RWA tokenization
 *   yield-distributor  — rental income → token holders
 *   governance         — on-chain proposal voting
 *
 * After deploying the Rust contracts, set hashes in .env.local:
 *   NEXT_PUBLIC_RWA_NFT_HASH
 *   NEXT_PUBLIC_YIELD_HASH
 *   NEXT_PUBLIC_GOVERNANCE_HASH
 */

import {
  ContractCallBuilder,
  Args,
  CLValue,
  PublicKey,
  Transaction,
} from "casper-js-sdk";

export const CONTRACT_HASHES = {
  rwaNft: process.env.NEXT_PUBLIC_RWA_NFT_HASH ?? "",
  yield: process.env.NEXT_PUBLIC_YIELD_HASH ?? "",
  governance: process.env.NEXT_PUBLIC_GOVERNANCE_HASH ?? "",
};

/** 5 CSPR payment — sufficient for standard contract entry point calls */
const PAYMENT_MOTES = 5_000_000_000;

// ── Types ─────────────────────────────────────────────────────────────────────

export type AssetMetadata = {
  asset_name: string;
  asset_type: "residential" | "commercial" | "industrial" | "treasury";
  location: string;
  valuation_usd: number;
  yield_apy: number;
  total_tokens: number;
  ipfs_cid?: string;
};

export type ProposalMeta = {
  title: string;
  description: string;
  type: "parameter_change" | "asset_action" | "treasury";
};

// ── Builder helper ────────────────────────────────────────────────────────────

function call(
  contractHash: string,
  entryPoint: string,
  args: Args,
  sender: PublicKey,
  chainName = "casper"
): Transaction {
  return new ContractCallBuilder()
    .from(sender)
    .chainName(chainName)
    .payment(PAYMENT_MOTES)
    .byHash(contractHash)
    .entryPoint(entryPoint)
    .runtimeArgs(args)
    .buildFor1_5();
}

// ── RWA NFT ───────────────────────────────────────────────────────────────────

/**
 * Mint a new RWA NFT. Admin / AI agent only.
 * Sign the returned Transaction with CasperWallet before submitting.
 */
export function buildMintTransaction(params: {
  sender: PublicKey;
  recipientAccountHash: Uint8Array;
  tokenId: number;
  metadata: AssetMetadata;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("recipient", CLValue.newCLByteArray(params.recipientAccountHash));
  args.insert("token_id", CLValue.newCLUint64(params.tokenId));
  args.insert("metadata", CLValue.newCLString(JSON.stringify(params.metadata)));
  return call(CONTRACT_HASHES.rwaNft, "mint", args, params.sender, params.chainName);
}

/**
 * Transfer a token to a KYC-verified recipient.
 */
export function buildTransferTransaction(params: {
  sender: PublicKey;
  fromAccountHash: Uint8Array;
  toAccountHash: Uint8Array;
  tokenId: number;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("from", CLValue.newCLByteArray(params.fromAccountHash));
  args.insert("to", CLValue.newCLByteArray(params.toAccountHash));
  args.insert("token_id", CLValue.newCLUint64(params.tokenId));
  return call(CONTRACT_HASHES.rwaNft, "transfer", args, params.sender, params.chainName);
}

/**
 * Update on-chain asset metadata (called by AI CFO after oracle refresh).
 */
export function buildUpdateMetadataTransaction(params: {
  sender: PublicKey;
  tokenId: number;
  metadata: AssetMetadata;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("token_id", CLValue.newCLUint64(params.tokenId));
  args.insert("metadata", CLValue.newCLString(JSON.stringify(params.metadata)));
  return call(CONTRACT_HASHES.rwaNft, "set_metadata", args, params.sender, params.chainName);
}

/**
 * KYC-whitelist or de-whitelist a wallet. Admin only.
 */
export function buildSetKycTransaction(params: {
  sender: PublicKey;
  accountHash: Uint8Array;
  approved: boolean;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("account", CLValue.newCLByteArray(params.accountHash));
  args.insert("approved", CLValue.newCLValueBool(params.approved));
  return call(CONTRACT_HASHES.rwaNft, "set_kyc", args, params.sender, params.chainName);
}

// ── Yield Distributor ─────────────────────────────────────────────────────────

/**
 * Trigger yield distribution. AI CFO agent calls this after rental income deposit.
 * Splits the pool pro-rata among registered holders.
 */
export function buildDistributeTransaction(params: {
  sender: PublicKey;
  chainName?: string;
}): Transaction {
  return call(CONTRACT_HASHES.yield, "distribute", new Args(new Map()), params.sender, params.chainName);
}

/**
 * Token holder claims their accumulated yield in CSPR.
 */
export function buildClaimTransaction(params: {
  sender: PublicKey;
  chainName?: string;
}): Transaction {
  return call(CONTRACT_HASHES.yield, "claim", new Args(new Map()), params.sender, params.chainName);
}

/**
 * Set a holder's basis-point share (0–10000 = 0–100%). Admin only.
 * Called automatically when tokens mint/transfer via the AI agent.
 */
export function buildRegisterHolderTransaction(params: {
  sender: PublicKey;
  accountHash: Uint8Array;
  shareBps: number;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("account", CLValue.newCLByteArray(params.accountHash));
  args.insert("share_bps", CLValue.newCLUint64(params.shareBps));
  return call(CONTRACT_HASHES.yield, "register_holder", args, params.sender, params.chainName);
}

// ── Governance ────────────────────────────────────────────────────────────────

/**
 * Cast a governance vote. 0 = For, 1 = Against, 2 = Abstain.
 * Voting weight is read from the contract based on token holdings.
 */
export function buildVoteTransaction(params: {
  sender: PublicKey;
  proposalId: number;
  choice: 0 | 1 | 2;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("proposal_id", CLValue.newCLUint64(params.proposalId));
  args.insert("choice", CLValue.newCLUint8(params.choice));
  return call(CONTRACT_HASHES.governance, "vote", args, params.sender, params.chainName);
}

/**
 * Create a new governance proposal. Admin only.
 * deadline: Unix timestamp (seconds) when voting closes.
 */
export function buildCreateProposalTransaction(params: {
  sender: PublicKey;
  metadata: ProposalMeta;
  deadlineUnix: number;
  chainName?: string;
}): Transaction {
  const args = new Args(new Map<string, CLValue>());
  args.insert("metadata", CLValue.newCLString(JSON.stringify(params.metadata)));
  args.insert("deadline", CLValue.newCLUint64(params.deadlineUnix));
  return call(CONTRACT_HASHES.governance, "create_proposal", args, params.sender, params.chainName);
}

// ── Sign + Submit ─────────────────────────────────────────────────────────────

/**
 * Submit a signed Transaction to Casper via our /api/casper/deploy proxy.
 * Returns the on-chain transaction hash.
 *
 * Usage:
 *   const tx = buildMintTransaction({ ... });
 *   // sign with CasperWallet browser extension
 *   const hash = await submitTransaction(signedTx);
 *   window.open(`https://cspr.live/deploy/${hash}`, "_blank");
 */
export async function submitTransaction(signedTx: Transaction): Promise<string> {
  const res = await fetch("/api/casper/deploy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deploy: signedTx }),
  });
  const data = (await res.json()) as { deployHash?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? "Transaction submission failed");
  return data.deployHash!;
}
