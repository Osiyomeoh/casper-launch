# CasperLaunch — AI-Powered RWA Tokenization Platform

> Tokenize real-world assets in 20 minutes. No blockchain knowledge required.

Built for the **Casper Agentic Buildathon 2026** — Casper Innovation Track.

---

## What It Does

CasperLaunch lets anyone tokenize a real-world asset — property, treasury bill, invoice — as a CEP-78 NFT on the Casper blockchain. An AI agent extracts metadata, manages on-chain state, and autonomously distributes yield. Accessible to both crypto-native users via CasperWallet and complete beginners via Privy embedded wallets.

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
Token holders vote on proposals — parameter changes, asset whitelisting, treasury decisions. Vote weight is proportional to token holdings. Every proposal and vote is submitted as a real transaction to the governance smart contract.

---

## Smart Contracts (Casper Testnet)

All contracts are deployed and verified on Casper testnet:

| Contract | Hash | Explorer |
|----------|------|---------|
| RWA NFT (CEP-78) | `1aeb63ab...053908` | [View](https://testnet.cspr.live/contract/1aeb63aba3342f2cda379de22159c4a27b7595d9589f03e6b09298ecab053908) |
| Yield Distributor | `1ee33518...d92e2` | [View](https://testnet.cspr.live/contract/1ee335181e5f67cd054ccc9c3e6b776e6569cedc7f292edfd1d975077c5d92e2) |
| Governance | `7856b4dd...d0a3` | [View](https://testnet.cspr.live/contract/7856b4dd9c97e4a7a0701465efee1864772f7767167ca0f174535b3e9a90d0a3) |

Written in Rust, compiled to WASM, deployed via `casper-client` CLI.

---

## Tech Stack

- **Frontend:** Next.js 16 (App Router), Tailwind CSS v4
- **Blockchain:** Casper Network (testnet), casper-js-sdk v5
- **Smart Contracts:** Rust + casper-contract 5.1.1, casper-types 6.1.0
- **AI:** Google Gemini 2.0 Flash (metadata extraction)
- **Payments:** x402 protocol (Casper-native implementation)
- **Auth:** Privy (embedded wallets for web2 users) + CasperWallet (native crypto users)
- **Storage:** SQLite (WAL mode) for off-chain state mirroring

---

## Testnet Architecture & Production Roadmap

CasperLaunch is built on testnet for the hackathon. Several patterns are deliberately simplified for demonstration purposes. Below is an honest account of each trade-off and the exact production path.

### Agent-Pays Settlement Pattern

**Testnet:** The buy flow uses a `signMessage` authorization from the buyer's wallet, then a server-side agent keypair submits the CSPR transfer to the seller and calls `register_holder` on the yield contract. This works around CasperWallet's current lack of Casper 2.0 (`put-transaction`) signing support.

**Production path:** CasperWallet is actively shipping Casper 2.0 transaction signing. Once available, buyers sign and submit their own CSPR transfers directly — the agent is removed from the payment leg entirely. The smart contract enforces atomic settlement: funds are held in escrow and released only when asset transfer is confirmed. No trust in any server-side key is required.

---

### Privy — Web2 User Onboarding

**Testnet:** Privy is integrated for authentication. Web2 users can sign in with email or Google and receive an embedded wallet without installing any extension.

**Production path:** Privy embedded wallets connect to fiat on-ramps (Stripe, MoonPay) so users top up with a credit card and Privy handles the CSPR conversion behind the scenes. A user who has never heard of blockchain can buy fractional real estate in under three minutes. For institutional users, Privy supports multi-factor authentication, hardware wallet binding, and organisation-level key management.

---

### CSPR Price Oracle

**Testnet:** CSPR/USD rate is fetched from a public price API at request time. No on-chain oracle.

**Production path:** Integrate Pyth Network's on-chain price feed deployed on Casper. The yield distributor and trade contracts read the oracle price directly — no off-chain price injection, no manipulation surface. Settlement amounts are calculated and enforced entirely on-chain.

---

### KYC / AML Compliance

**Testnet:** KYC is checked against a whitelist stored on-chain via the `add_to_whitelist` entry point. Wallets are manually added by the platform operator.

**Production path:** Integrate a regulated KYC provider (Jumio, Onfido, or Fractal ID). On successful identity verification, the provider calls a permissioned `approve_kyc` entry point on the contract — signed by the provider's key, not the platform's. The contract stores a hash of the KYC approval, not personal data. Regulators can verify compliance without accessing private information.

---

### Asset Metadata Storage

**Testnet:** Asset metadata (name, location, valuation, yield rate) is stored as on-chain named keys attached to the CEP-78 token.

**Production path:** Legal documents, title deeds, survey reports, and property photos are pinned to IPFS via Pinata or web3.storage. The IPFS content hash is stored on-chain in the token metadata — creating a tamper-proof, permanent link between the blockchain token and its real-world evidence. A corrupted or modified document produces a different hash and is immediately detectable.

---

### Agent Key Security

**Testnet:** The yield distribution agent uses a single server-side keypair stored as a local `.pem` file. This is acceptable for testnet but not for production.

**Production path:** The agent key moves to a multi-signature threshold scheme — for example, 2-of-3 signers required to submit any agent-initiated transaction. Signers are distributed across geographies and organisations. No single compromised key can drain the yield pool or trigger unauthorised distributions. Key rotation is handled via the contract's `update_agent` governance proposal — community-approved, on-chain.

---

### Governance Quorum Enforcement

**Testnet:** Quorum is calculated and displayed in the UI. The contract records votes on-chain but proposal execution is currently triggered manually.

**Production path:** The governance contract enforces quorum on-chain. A proposal's `execute` entry point reverts if the required vote percentage has not been reached. Time-locks are added — a passed proposal cannot execute until a 48-hour delay has elapsed, giving the community time to react to potentially harmful changes. Emergency veto keys held by a multisig council can cancel proposals during the time-lock window.

---

### Yield Source

**Testnet:** Yield pool is seeded manually with testnet CSPR for demonstration.

**Production path:** Real yield flows from property rental income, collected by a regulated property manager and converted to CSPR via a licensed exchange. The conversion and deposit are verified on-chain via signed receipts from the exchange API. The yield distributor only accepts deposits from whitelisted source accounts — preventing fake yield injection.

---

## Production Asset Management

Tokenizing an asset on a blockchain is the easy part. Running a real RWA platform means managing the physical world that sits behind every token. Here is how CasperLaunch approaches each layer in production.

---

### Legal Structure & Asset Custody

Every tokenized asset must be held inside a legal entity that can be represented on-chain. In production, each asset is placed into a Special Purpose Vehicle — a limited liability company created specifically for that property. The SPV holds legal title. The CEP-78 token represents beneficial ownership of the SPV, not the property directly.

This structure means:
- Token holders have legally enforceable rights to yield and capital appreciation
- Regulatory treatment is clear — tokens represent equity in a company, not a commodity
- In the event of platform closure, the SPV and its assets survive independently

Legal SPV formation is handled in partnership with a licensed law firm in the asset's jurisdiction. In Nigeria for example, that means an RC-registered limited liability company with the Corporate Affairs Commission, with a shareholders agreement that maps token holders to equity percentage automatically on every transfer.

---

### Property & Asset Management

Owning a fraction of a property is only valuable if the property is managed. In production, CasperLaunch partners with accredited property management companies in each market.

The property manager is responsible for:
- Tenant sourcing, vetting, and onboarding
- Rent collection and reconciliation
- Maintenance, repairs, and capex decisions under a defined threshold
- Annual property valuation reports uploaded to IPFS and linked on-chain

Large capital decisions — a major renovation, a sale of the underlying property — require a governance vote from token holders before the property manager can proceed. The governance contract enforces this: the property manager's wallet is whitelisted for routine operations but blocked from major actions without an on-chain approval.

---

### Yield Collection & Distribution

Rental income arrives as fiat currency — naira, dollars, pounds — collected by the property manager. In production, that fiat is converted to CSPR via a licensed exchange partnership and deposited into the yield distributor contract.

The conversion and deposit flow:
1. Property manager collects rent and transfers to platform escrow account
2. Platform converts to CSPR via exchange API with a signed receipt
3. Signed receipt is verified and the deposit is recorded on-chain
4. Autonomous yield agent detects the pool balance crossing the threshold
5. Agent triggers `distribute()` — proportional CSPR sent to all registered holders

Every step produces an on-chain or verifiable off-chain record. Holders can audit the full income trail from rent payment to wallet receipt.

---

### KYC / AML & Investor Eligibility

Different asset classes carry different regulatory requirements. Commercial real estate in Nigeria may be open to all investors. A securitised treasury bill may be restricted to accredited investors only. A property in a regulated jurisdiction may require anti-money-laundering checks before any transfer.

In production, eligibility rules are encoded directly in the smart contract:
- Each token has an `eligibility_class` field set at mint time
- Transfers are blocked unless the recipient wallet holds a valid KYC approval for that class
- KYC approvals are issued on-chain by a licensed provider — Jumio, Onfido, or Fractal ID
- No personal data is stored on-chain — only a hash of the approval and its expiry date

If a KYC approval expires, the holder can still hold and earn yield but cannot transfer until they re-verify. This mirrors how regulated securities markets work.

---

### Secondary Market Compliance

Not every token can be freely traded. In production, the trade contract enforces transfer restrictions:
- Mandatory holding periods — some jurisdictions require a minimum 12-month hold before resale
- Investor caps — no single wallet can hold more than a defined percentage of any asset
- Jurisdictional blocks — wallets flagged to restricted jurisdictions are blocked from buying
- Tax reporting hooks — every settled trade emits an event that feeds the compliance audit trail, pre-formatted for regulatory reporting in the asset's jurisdiction

These rules are set at asset creation time and cannot be changed without a governance vote.

---

### Valuation & Reporting

Token holders need to know what their position is worth. In production:
- Independent valuers submit annual property appraisals
- Appraisal reports are pinned to IPFS and the content hash is stored on-chain
- The token's `valuation_usd` field is updated via a permissioned `update_valuation` entry point — callable only by the platform's oracle key, which itself requires a 2-of-3 multisig approval
- Quarterly yield reports are generated automatically from on-chain data and emailed to holders via Privy's notification layer

Holders can verify every valuation change in the contract's event history — who updated it, when, and with what supporting document hash.

---

### Platform Risk & Insurance

In production, CasperLaunch carries:
- **Property insurance** on every underlying asset, with the SPV as the named insured
- **Smart contract cover** via a DeFi insurance protocol for the yield distributor and governance contracts
- **Custodian insurance** on the agent keypair via a licensed digital asset custodian
- **Director and Officer insurance** for the SPV boards

Insurance certificates are stored on IPFS and linked in each token's metadata, so holders can verify coverage independently.

---

### Exit & Liquidity

Fractional RWA tokens are only useful if there is a way to exit. In production, CasperLaunch provides three exit paths:
1. **Secondary market** — sell your stake to another investor on the CasperLaunch trade page at a market-determined price
2. **Buyback programme** — the platform maintains a liquidity reserve that offers guaranteed buyback at a discount to NAV for holders who need fast exit
3. **Asset sale** — token holders can vote via governance to sell the underlying property entirely, with proceeds distributed proportionally to all holders at settlement

---

## Local Setup

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Fill in: GEMINI_API_KEY, NEXT_PUBLIC_PRIVY_APP_ID, contract hashes

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
| `/compliance` | KYC/AML audit trail |
| `/staking` | CSPR staking |
| `/portfolio` | Wallet holdings and yield positions |
| `/settings` | Account and agent preferences |

---

## Architecture

```
User (Web2 — email/Google)          User (Web3 — CasperWallet)
        │                                       │
        ▼                                       ▼
   Privy Embedded Wallet              CasperWallet Extension
        │                                       │
        └───────────────────┬───────────────────┘
                            │
                     Next.js App (App Router)
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
   /api/ai/tokenize   /api/agent/*     /api/casper/*
   (x402 gate +       (autonomous      (RPC proxy +
    Gemini AI)         yield agent)     settlement)
          │                 │                 │
          └─────────────────┴─────────────────┘
                            │
                     Casper Testnet
                            │
               ┌────────────┼────────────┐
               │            │            │
          rwa-nft      yield-dist    governance
          (CEP-78)     contract      contract
```

---

## License

MIT — open source, built for the Casper ecosystem.
