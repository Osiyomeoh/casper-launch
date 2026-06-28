# CasperLaunch — AI-Powered RWA Tokenization Platform

> Tokenize real-world assets in minutes. No blockchain knowledge required.

Built for the **Casper Agentic Buildathon 2026** — Casper Innovation Track.

**Live:** [casper-launch.vercel.app](https://casper-launch.vercel.app)

---

## What It Does

CasperLaunch lets anyone tokenize a real-world asset — property, farmland, commercial building — as a CEP-78 NFT on the Casper blockchain. An AI agent extracts metadata, manages KYC whitelisting, mints on-chain tokens, and autonomously distributes yield. Users connect via CasperWallet browser extension.

---

## Agentic AI Features

### 1. AI Asset Tokenization (x402-gated)
Describe your asset in plain English. The AI extracts structured CEP-78 metadata and guides you through the full minting flow. Access costs **3 CSPR**, paid on-chain before the AI runs.

```
1. User describes asset in chat
2. Server returns HTTP 402 + payment requirement (payTo, amount: 3 CSPR)
3. Platform builds unsigned CSPR transfer Deploy
4. CasperWallet popup — user approves and signs (Deploy format, Casper 1.x)
5. Deploy submitted on-chain → deploy hash returned
6. Client sends deploy hash as X-PAYMENT header to /api/ai/tokenize
7. Server verifies deploy on testnet RPC (info_get_transaction)
8. Gemini AI runs → metadata extracted → CEP-78 token minted
```

**Platform fee:** 0.5% of asset valuation displayed at mint time.

### 2. Autonomous Yield Distribution Agent
A server-side agent polls the yield distributor contract. When the pool balance exceeds the threshold, it autonomously signs and submits a `distribute()` transaction — no human approval needed.

- Dashboard at `/agent` shows real-time agent status and transaction history
- All distributions logged with on-chain transaction hashes

### 3. On-Chain Governance
Token holders vote on proposals — parameter changes, asset whitelisting, treasury decisions. Every vote is a real on-chain transaction.

### 4. Compliance-Enforced Marketplace
Fractional yield shares can be listed for sale on the escrow contract. Transfer restrictions are enforced on-chain — only KYC-verified wallets can receive shares.

---

## Revenue Model

| Stream | Rate | Status |
|--------|------|--------|
| AI access fee (x402) | 3 CSPR per tokenization request | **Live — on-chain payment required** |
| Tokenization fee | 0.5% of asset valuation | Displayed at mint |
| Secondary market spread | 0.25% per trade | Planned |
| Yield distribution fee | 5% of distributed yield | In contract formula |
| Compliance-as-a-Service | $99/mo per issuer | Planned |

---

## Smart Contracts (Casper Testnet)

All contracts are deployed and live on Casper testnet:

| Contract | Hash | Explorer |
|----------|------|---------|
| RWA NFT (CEP-78) | `53eb1c21627a3baad41e5419a4e8f7a5f17eaf25090125018d2bf9aa57150f66` | [View](https://testnet.cspr.live/contract/53eb1c21627a3baad41e5419a4e8f7a5f17eaf25090125018d2bf9aa57150f66) |
| Yield Distributor | `3df77115ff3fb4504add44719344b9d969378223a2bd9207bb3e57d3f51468f3` | [View](https://testnet.cspr.live/contract/3df77115ff3fb4504add44719344b9d969378223a2bd9207bb3e57d3f51468f3) |
| Governance | `7856b4dd9c97e4a7a0701465efee1864772f7767167ca0f174535b3e9a90d0a3` | [View](https://testnet.cspr.live/contract/7856b4dd9c97e4a7a0701465efee1864772f7767167ca0f174535b3e9a90d0a3) |
| Trade Escrow | `32e552364dad24a9939aaaff3bd40745b5ad75631c136b2031a657af4fc214bb` | [View](https://testnet.cspr.live/contract/32e552364dad24a9939aaaff3bd40745b5ad75631c136b2031a657af4fc214bb) |

Written in Rust, compiled to WASM, deployed to Casper testnet.

---

## Tech Stack

- **Frontend:** Next.js 15 (App Router), Tailwind CSS
- **Blockchain:** Casper Network (testnet), casper-js-sdk v5
- **Smart Contracts:** Rust + casper-contract, casper-types
- **AI:** Google Gemini 2.0 Flash (metadata extraction + chat)
- **Wallet:** CasperWallet browser extension
- **Storage:** Neon Postgres (serverless-compatible, via `@neondatabase/serverless`)
- **Files:** Pinata IPFS (document anchoring)

---

## Architecture

```
User (CasperWallet Extension)
        │
        ▼
   Next.js App (Vercel)
        │
   ┌────┼────────────────────┐
   │    │                    │
/chat  /api/casper/*    /api/agent/*
AI +   RPC proxy +      Autonomous
Mint   Settlement       Yield Agent
   │    │                    │
   └────┼────────────────────┘
        │
   Neon Postgres          IPFS (Pinata)
   (off-chain mirror)     (document storage)
        │
   Casper Testnet
        │
   ┌────┼──────────┬──────────┐
   │    │          │          │
rwa-nft  yield-dist  govern.  escrow
(CEP-78) contract   contract  contract
```

### Agent-Pays Settlement Pattern

CasperWallet currently supports signing Deploy (Casper 1.x) format only. Our contracts use TransactionV1 (Casper 2.0). The solution:

- **User authorizes** by signing a message via CasperWallet (`signMessage`)
- **Agent submits** the actual on-chain transaction (agent keypair pays gas)

This is a testnet workaround. Once CasperWallet ships `signTransaction` support for TransactionV1, users will sign and pay directly — the agent is removed from the payment leg entirely.

---

## Tokenization Flow

```
1. Describe asset in chat
2. CasperWallet popup — sign 3 CSPR transfer to platform treasury (x402 payment)
3. Deploy hash returned → sent as X-PAYMENT header to AI endpoint
4. Server verifies payment on-chain → Gemini AI extracts CEP-78 metadata
5. Upload backing document → SHA-256 hash anchored on IPFS
6. Sign authorization message via CasperWallet (proves wallet ownership)
7. Agent KYC-whitelists wallet on the RWA NFT contract
8. Agent mints CEP-78 token with metadata + IPFS CID
9. Agent registers issuer as 100% yield holder
10. Platform fee (0.5% of valuation) displayed
11. Token appears in portfolio — ready to offer shares to investors
```

---

## Local Setup

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Required: GEMINI_API_KEY, GROQ_API_KEY, PINATA_JWT, DATABASE_URL,
#           AGENT_SECRET_KEY_PEM, NEXT_PUBLIC_RWA_NFT_HASH,
#           NEXT_PUBLIC_YIELD_HASH, NEXT_PUBLIC_GOVERNANCE_HASH,
#           NEXT_PUBLIC_ESCROW_HASH

# Run dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/chat` | AI asset tokenization wizard |
| `/assets` | All tokenized assets |
| `/assets/[id]` | Asset detail, cap table, offer shares |
| `/trade` | Secondary marketplace |
| `/portfolio` | Wallet holdings and yield positions |
| `/governance` | On-chain proposal voting |
| `/agent` | Autonomous yield agent dashboard |
| `/compliance` | KYC/AML audit trail |
| `/settings` | Agent and notification preferences |

---

## License

MIT — open source, built for the Casper ecosystem.

*Contact: [GitHub](https://github.com/Osiyomeoh/casper-launch) | Built for Casper Agentic Buildathon 2026*
