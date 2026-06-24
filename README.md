# CasperLaunch — AI-Powered RWA Tokenization Platform

> Tokenize real-world assets in 20 minutes. No blockchain knowledge required.

Built for the **Casper Agentic Buildathon 2026** — Casper Innovation Track.

---

## What It Does

CasperLaunch lets anyone tokenize a real-world asset (property, treasury bill, invoice) as a CEP-78 NFT on Casper blockchain using an AI agent that extracts metadata, manages on-chain state, and autonomously distributes yield — all without technical knowledge from the user.

---

## Agentic AI Features

### 1. AI Asset Tokenization (x402-gated)
Describe your asset in plain English. The AI extracts structured CEP-78 metadata for on-chain minting.

**x402 Micropayment Protocol:** Each AI tokenization request costs **1 CSPR**, paid on-chain before the AI runs. The `/api/ai/tokenize` endpoint implements the [x402 protocol](https://x402.org) natively on Casper — returning HTTP 402 with Casper payment requirements if no `X-PAYMENT` header is present, then verifying the deploy hash on-chain before processing.

```
Client → POST /api/ai/tokenize
Server → 402 { accepts: [{ scheme: "casper-exact", payTo: "...", maxAmountRequired: "1000000000" }] }
Client → pays 1 CSPR via CasperWallet → gets deploy hash
Client → POST /api/ai/tokenize + X-PAYMENT: base64(deployHash)
Server → verifies deploy on Casper testnet RPC → runs Gemini AI → returns metadata
```

### 2. Autonomous Yield Distribution Agent
A server-side agent polls the yield distributor smart contract every 30 seconds. When the pool balance exceeds 1 CSPR, it **autonomously signs and submits** a `distribute()` transaction using a server-side keypair — no human approval needed.

- Boots automatically on server start via Next.js `instrumentation.ts`
- Logs all activity with on-chain transaction links
- Dashboard at `/agent` shows real-time agent status

### 3. On-Chain Governance
Token holders vote on proposals (parameter changes, asset actions, treasury decisions). Vote weight is proportional to token holdings, enforced in the smart contract.

---

## Smart Contracts (Casper Testnet)

All three contracts are deployed and verified on Casper testnet:

| Contract | Hash | Explorer |
|----------|------|---------|
| RWA NFT (CEP-78) | `1aeb63ab...053908` | [View](https://testnet.cspr.live/contract/1aeb63aba3342f2cda379de22159c4a27b7595d9589f03e6b09298ecab053908) |
| Yield Distributor | `1ee33518...d92e2` | [View](https://testnet.cspr.live/contract/1ee335181e5f67cd054ccc9c3e6b776e6569cedc7f292edfd1d975077c5d92e2) |
| Governance | `62ab0dc4...507e` | [View](https://testnet.cspr.live/contract/62ab0dc4a2db35b939095faf5832bd8f6f9af091e8e7207bef8d94ca2d92507e) |

Written in Rust, compiled to WASM, deployed via `casper-client` CLI.

---

## Tech Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4
- **Blockchain:** Casper Network (testnet), casper-js-sdk v5
- **Smart Contracts:** Rust + casper-contract 5.1.1, casper-types 6.1.0
- **AI:** Google Gemini 2.0 Flash (metadata extraction)
- **Payments:** x402 protocol (Casper-native implementation)
- **Auth:** Privy + CasperWallet browser extension

---

## Local Setup

```bash
# Install dependencies
npm install

# Set environment variables — copy and fill in your keys
# GEMINI_API_KEY=...
# NEXT_PUBLIC_PRIVY_APP_ID=...
# NEXT_PUBLIC_RWA_NFT_HASH=...
# NEXT_PUBLIC_YIELD_HASH=...
# NEXT_PUBLIC_GOVERNANCE_HASH=...

# Run dev server
npm run dev
```

Open [http://localhost:3001](http://localhost:3001).

### Build Smart Contracts

```bash
cd contracts
make build-all      # compiles all 3 contracts to WASM
make deploy-testnet # deploys to Casper testnet (requires funded keypair)
```

Requires: Rust nightly-2025-01-15, wasm32-unknown-unknown target, casper-client v5.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Landing page |
| `/dashboard` | Portfolio overview, live CSPR balance |
| `/chat` | AI asset tokenization wizard (x402-gated) |
| `/agent` | Autonomous yield agent dashboard |
| `/yield` | Yield pool management |
| `/governance` | On-chain proposal voting |
| `/assets` | My tokenized assets |
| `/trade` | Asset marketplace |
| `/compliance` | KYC/AML compliance status |
| `/staking` | CSPR staking |

---

## Architecture

```
User
 │
 ├─ CasperWallet (browser) ──────────────────── Casper Testnet
 │   └─ signs transactions                          │
 │                                                  │
Next.js App                                    Smart Contracts
 ├─ /api/ai/tokenize  ←── x402 gate            ├─ rwa-nft (CEP-78)
 │   └─ Gemini AI                              ├─ yield-distributor
 ├─ /api/agent/*      ←── autonomous agent     └─ governance
 │   └─ signs with server keypair
 └─ /api/casper/*     ←── RPC proxy
```

---

## License

MIT — open source, built for the Casper ecosystem.
