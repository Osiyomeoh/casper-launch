# CasperLaunch

> AI-powered real-world asset tokenization on the Casper blockchain.

**Live:** [casper-launch.vercel.app](https://casper-launch.vercel.app)
**Built for:** Casper Agentic Buildathon 2026

---

## What It Does

CasperLaunch converts physical assets (property, farmland, commercial buildings) into CEP-78 NFTs on the Casper blockchain. An AI agent extracts metadata from plain language, manages on-chain KYC, mints tokens, distributes yield autonomously, and settles secondary trades, all without human intervention.

Every flow is live on Casper testnet. Nothing is mocked.

---

## Agentic AI Features

### 1. AI Tokenization Agent (x402-gated)
Describe your asset in plain English. The AI (Gemini 2.0 Flash via Groq) extracts structured CEP-78 metadata and orchestrates the full minting flow. Access costs **3 CSPR paid on-chain** via the x402 micropayment protocol, the first non-EVM x402 implementation.

### 2. Autonomous Yield Distribution Agent
Polls the yield distributor contract continuously. When pool balance exceeds the threshold, it autonomously signs and submits a `distribute()` transaction, splitting yield proportionally to all registered holders. No human trigger required.

### 3. AI-Assisted Trade Settlement
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
- The AI extracts metadata, mints a CEP-78 token, registers you as holder
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
- Go to `/agent` to watch the autonomous agent activity log

**6. Governance**
- Go to `/governance`, create a proposal, vote, and view quorum status

---

## Architecture

```
User (CasperWallet)
        |
        v
Next.js App (Vercel)
  /chat   /trade   /yield   /governance   /agent
        |
        +-- Gemini AI (Groq inference)
        +-- x402 Payment Gate
        +-- Agent (server-side keypair, ED25519)
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
| AI Model | Google Gemini 2.0 Flash (Groq) |
| Payment Protocol | x402 (Casper-native, first non-EVM) |
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Deployment | Vercel |
| Database | Neon Postgres |
| Wallet | CasperWallet |
| Casper SDK | casper-js-sdk (TypeScript) |

---

## Local Development

```bash
git clone https://github.com/Osiyomeoh/casper-launch
cd casper-launch
npm install
cp .env.example .env.local
npm run dev
```

### Required Environment Variables

```
AGENT_SECRET_KEY_PEM=         # ED25519 private key for agent transactions
NEXT_PUBLIC_AGENT_PUBLIC_KEY= # Corresponding public key (hex)
NEXT_PUBLIC_NFT_HASH=         # CEP-78 contract hash
NEXT_PUBLIC_YIELD_HASH=       # Yield distributor contract hash
NEXT_PUBLIC_ESCROW_HASH=      # Trade escrow contract hash
NEXT_PUBLIC_GOV_HASH=         # Governance contract hash
GROQ_API_KEY=                 # Groq API key (Gemini access)
DATABASE_URL=                 # Neon Postgres connection string
```

---

## Security

See [SECURITY.md](SECURITY.md) for vulnerability reporting guidelines.

---

## License

MIT
