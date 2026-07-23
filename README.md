# CasperLaunch

> AI-powered real-world asset tokenization on the Casper blockchain.

**Live:** [casper-launch.vercel.app](https://casper-launch.vercel.app)
**Demo:** [youtube.com/watch?v=0NtvhF9qrow](https://www.youtube.com/watch?v=0NtvhF9qrow)
**Built for:** Casper Agentic Buildathon 2026

---

## What It Does

CasperLaunch converts physical assets (property, farmland, commercial buildings) into CEP-78 NFTs on the Casper blockchain. A multi-agent AI system extracts metadata from plain language, enforces KYC compliance autonomously, mints tokens, distributes yield, and settles secondary trades — all without human intervention.

Every flow is live on Casper testnet. Nothing is mocked.

---

## Agentic AI Features

### 1. AI Tokenization Agent (x402-gated, MCP-enhanced)

Describe your asset in plain English. Before the AI runs, the agent queries live Casper blockchain state via the **Casper MCP Server** (Model Context Protocol): network status, latest blocks, active validators. This on-chain context is injected into the AI prompt before Groq/Gemini processes your asset description.

Access costs **3 CSPR paid on-chain** via the x402 micropayment protocol — the first non-EVM x402 implementation. No payment, no AI.

### 2. Autonomous Yield Distribution Agent

Polls the yield distributor contract every 30 seconds. When the pool balance exceeds the threshold, it autonomously signs and submits a `distribute()` TransactionV1 — splitting yield proportionally to all registered holders. No human trigger required. Live at `/agent`.

### 3. Autonomous Compliance Agent

A second autonomous agent scans all token holders every 60 seconds, verifies each wallet's KYC attestation age, and autonomously calls `set_kyc(approved=false)` on-chain for any wallet whose attestation has expired (90-day window) or is missing. No human approval required. Live at `/compliance`.

### 4. AI-Assisted Trade Settlement

Buyer authorizes via `signMessage`. The agent verifies ownership, submits the CSPR transfer on-chain, and calls `register_holder` on the yield contract, transferring yield rights instantly.

---

## Smart Contracts (Casper Testnet)

| Contract | Package Hash |
|---|---|
| RWA NFT (CEP-78) | `53eb1c21627a3baad41e5419a4e8f7a5f17eaf25090125018d2bf9aa57150f66` |
| Yield Distributor | `3df77115ff3fb4504add44719344b9d969378223a2bd9207bb3e57d3f51468f3` |
| Governance | `7856b4dd9c97e4a7a0701465efee1864772f7767167ca0f174535b3e9a90d0a3` |
| Trade Escrow | `32e552364dad24a9939aaaff3bd40745b5ad75631c136b2031a657af4fc214bb` |

All contracts are written in Rust, compiled to WebAssembly, and deployed on Casper testnet.

---

## How to Test

### Prerequisites
- [CasperWallet](https://casperwallet.io) browser extension installed
- Casper testnet CSPR from the [faucet](https://testnet.cspr.live/tools/faucet)

### Step-by-Step

**1. Connect wallet**
Visit [casper-launch.vercel.app](https://casper-launch.vercel.app) and click **Connect Wallet**. Approve in CasperWallet.

**2. Tokenize an asset**
- Go to `/chat`
- Describe an asset: e.g. "A 3-bedroom apartment in Lekki Lagos worth $180,000 with 8.5% rental yield"
- Sign the authorization popup in CasperWallet (x402 payment: 3 CSPR on-chain)
- The AI fetches live Casper network context via MCP, then extracts metadata and mints a CEP-78 token
- You receive a Casper testnet transaction hash

**3. List a fractional stake**
- Go to `/trade`, click **List Asset**
- Enter basis points (e.g. 1000 = 10%) and price in CSPR
- Sign authorization in CasperWallet

**4. Buy a listed stake**
- Go to `/trade`, find an active listing, click **Buy**
- Sign in CasperWallet
- Agent submits CSPR transfer and registers you as yield holder on-chain

**5. View yield distribution**
- Go to `/yield` to see pool balance and distribution history
- Go to `/agent` to watch the autonomous yield agent activity log

**6. View compliance monitoring**
- Go to `/compliance` to see the autonomous KYC compliance agent
- Click **Scan Now** to trigger an immediate compliance scan across all holders
- Expired or missing KYC attestations are flagged and auto-revoked on-chain

**7. Governance**
- Go to `/governance`, create a proposal, vote, and view quorum status

---

## Architecture

```
User (CasperWallet)
        |
        v
Next.js App (Vercel)
  /chat   /trade   /yield   /governance   /agent   /compliance
        |
        +-- Casper MCP Server (mcp.cspr.cloud)
        |     get_network_status, get_latest_blocks, get_validators
        |     Live on-chain context injected into AI prompts
        |
        +-- Groq AI (Llama 3.3 70B)
        +-- x402 Payment Gate (3 CSPR, first non-EVM implementation)
        +-- Yield Agent (autonomous distribute(), every 30s)
        +-- Compliance Agent (autonomous set_kyc revocation, every 60s)
        |
        v
Casper Testnet
  CEP-78 NFT  |  Yield Distributor  |  Governance  |  Escrow
        |
        v
Neon Postgres (off-chain state mirror)
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Blockchain | Casper Network (Testnet) |
| Smart Contracts | Rust / WebAssembly |
| NFT Standard | CEP-78 |
| AI Model | Llama 3.3 70B (Groq) |
| Blockchain AI Context | Casper MCP Server (mcp.cspr.cloud) |
| Payment Protocol | x402 (Casper-native, first non-EVM) |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Deployment | Vercel |
| Database | Neon Postgres |
| Wallet | CasperWallet |
| Casper SDK | casper-js-sdk (TypeScript) |
| Live Blockchain Data | CSPR.cloud API |

---

## Local Development

```bash
git clone https://github.com/Osiyomeoh/casper-launch
cd casper-launch
npm install
cp .env.example .env.local
# Fill in .env.local with your keys
npm run dev
```

### Required Environment Variables

See [.env.example](.env.example) for the full list. Key variables:

```
AGENT_SECRET_KEY_PEM=          # ED25519 private key for agent transactions
NEXT_PUBLIC_AGENT_PUBLIC_KEY=  # Corresponding public key (hex)
NEXT_PUBLIC_RWA_NFT_HASH=      # CEP-78 contract hash
NEXT_PUBLIC_YIELD_HASH=        # Yield distributor contract hash
GROQ_API_KEY=                  # Groq API key
DATABASE_URL=                  # Neon Postgres connection string
CSPR_CLOUD_API_KEY=            # CSPR.cloud API key (MCP + live data)
```

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines.

---

## License

MIT
