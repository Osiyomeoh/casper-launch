# CasperLaunch Whitepaper
## Democratizing Real-World Asset Ownership Through Blockchain Tokenization

**Version 2.1 | July 2026**
**Network: Casper Blockchain (Testnet)**

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [The Problem](#2-the-problem)
3. [The Solution](#3-the-solution)
4. [Market Opportunity](#4-market-opportunity)
5. [Business Model & Revenue](#5-business-model--revenue)
6. [Platform Architecture](#6-platform-architecture)
7. [Smart Contracts](#7-smart-contracts)
8. [AI Agent Layer](#8-ai-agent-layer) (Tokenization Agent, Yield Agent, Compliance Agent, MCP integration)
9. [Tokenization Process](#9-tokenization-process)
10. [Marketplace & Trading](#10-marketplace--trading)
11. [Yield Distribution](#11-yield-distribution)
12. [Governance](#12-governance)
13. [Legal & Compliance Framework](#13-legal--compliance-framework)
14. [Asset Management in Production](#14-asset-management-in-production)
15. [Security Model](#15-security-model)
16. [Roadmap](#16-roadmap)
17. [Conclusion](#17-conclusion)

---

## 1. Abstract

CasperLaunch is a blockchain-based platform for the tokenization, trading, and yield distribution of real-world assets, built on the Casper Network. It enables fractional ownership of physical assets including real estate, commodities, treasury instruments, and invoices, making them accessible to any investor globally.

The platform combines a Groq-powered AI agent for natural-language metadata extraction, a CEP-78 NFT standard for on-chain asset representation, two autonomous agents (yield distribution and KYC compliance enforcement), Casper MCP Server integration for live blockchain context, and a compliance-enforced secondary marketplace. All components are deployed on the Casper blockchain with Neon Postgres for off-chain state mirroring.

This whitepaper describes the current working system as deployed on Casper testnet, the business model and revenue streams, the documented production upgrade paths for each testnet simplification, and the legal and operational framework required for mainnet deployment.

---

## 2. The Problem

### 2.1 Locked Capital

An estimated $326 trillion in real-world assets exists globally. The vast majority is inaccessible to ordinary investors. Real estate, commercial property, farmland, and infrastructure assets require:

- Minimum investments ranging from $50,000 to several million dollars
- Complex legal processes involving lawyers, notaries, and regulatory filings
- Long settlement periods, with property transactions taking 30 to 90 days to close
- Near-zero liquidity once invested, with exits taking months or years

### 2.2 Geographic Barriers

In emerging markets like Nigeria, Ghana, Kenya, and Indonesia, high-value real estate exists in abundance, but mechanisms to invest at scale do not. A diaspora investor wanting to own Lagos real estate must navigate local agents, title disputes, foreign currency restrictions, and opaque pricing. There is no liquid, verifiable market.

### 2.3 Trust Deficits

Traditional real estate investment vehicles such as REITs, property funds, and SPV syndicates require investors to trust a fund manager, custodian, law firm, and auditor simultaneously. In many markets, that trust is routinely violated. Yield is misreported. Capital is misappropriated. Exits are blocked. Investors have no independent verification mechanism.

---

## 3. The Solution

CasperLaunch addresses each problem with a layered approach:

| Problem | CasperLaunch Solution |
|---------|----------------------|
| High minimum investment | Fractional CEP-78 tokens representing basis-point stakes in any asset |
| Complex legal process | AI agent extracts metadata; SPV structure handles legal title |
| No liquidity | On-chain secondary marketplace with instant settlement |
| Zero transparency | Every transaction on the public Casper blockchain, independently verifiable |
| Trust in intermediaries | Smart contracts enforce all rules with no human discretion in distributions |
| Geographic barriers | Any wallet, anywhere, subject only to jurisdiction-specific eligibility rules |

---

## 4. Market Opportunity

### 4.1 Global RWA Tokenization

The tokenized RWA market is projected to reach $10 trillion by 2030 according to Boston Consulting Group estimates. Real estate represents approximately 60% of the total addressable market.

### 4.2 African Real Estate

Nigeria alone has a housing deficit of approximately 28 million units. Urban real estate in Lagos, Abuja, and Port Harcourt consistently delivers 8 to 15% annual rental yields, significantly above returns available in developed markets. CasperLaunch's initial focus on the African real estate market addresses a segment with high yield, high demand, and near-zero accessible investment infrastructure.

### 4.3 Casper Ecosystem

Casper's enterprise-grade blockchain, with predictable gas costs, formal verification support, and a permissioned account model, is uniquely positioned for regulated asset tokenization. The CEP-78 standard provides a battle-tested NFT framework with native support for metadata, transfer restrictions, and holder registries.

---

## 5. Business Model & Revenue

CasperLaunch generates revenue across five streams:

### 5.1 AI Access Fee: 3 CSPR per Tokenization Request (x402)

Every AI tokenization request is gated by the x402 micropayment protocol, implemented natively on Casper. The `/api/ai/tokenize` endpoint returns HTTP 402 with a Casper payment requirement if no `X-PAYMENT` header is present.

**Flow:**
```
Client calls POST /api/ai/tokenize with no payment header
Server returns 402 with payment requirement (scheme: casper-exact, payTo, maxAmountRequired)
Client calls /api/casper/make-x402-payment to submit 3 CSPR on-chain
User signs authorization in CasperWallet
Agent submits native TransactionV1 transfer, returns transaction hash
Client sends X-PAYMENT header containing the transaction hash
Server verifies via info_get_transaction on testnet RPC, then runs Gemini AI
```

This is a Casper-native implementation of the x402 protocol, the first on a non-EVM chain. Every AI inference is backed by an on-chain payment record. No payment, no AI access.

**Current status:** Live on testnet. Every tokenization request requires a real on-chain CSPR payment.

### 5.2 Tokenization Fee: 0.5% of Asset Valuation

Charged at mint time. Every asset tokenized on the platform incurs a one-time fee of 0.5% of its stated USD valuation.

**Example:** A $180,000 Lagos apartment generates a $900 tokenization fee.

**Current status:** Fee amount is displayed to the user in the mint confirmation message. Treasury collection is a Phase 2 mainnet feature enforced in the smart contract's `mint()` entry point.

### 5.3 Secondary Market Spread: 0.25% per Trade

Both buyer and seller pay 0.125% of the CSPR transaction value at settlement. The spread is retained by the escrow contract and withdrawable to the platform treasury by the operator key.

**Current status:** The escrow contract structure is in place. Fee collection is a Phase 2 feature when real CSPR changes hands on mainnet.

### 5.4 Yield Distribution Fee: 5% of Distributed Yield

The yield distributor contract deducts 5% from each distribution before paying holders:

```
holder_payment = holder_bps / total_bps × pool_balance × 0.95
platform_fee   = pool_balance × 0.05
```

Platform incentives are aligned with holder returns: the platform earns more when yields are higher.

**Current status:** The formula is implemented in the yield distributor contract.

### 5.5 Compliance-as-a-Service: $99/month per Issuer

Asset issuers (property developers, invoice factoring firms, treasury managers) pay a monthly subscription for:
- Automated KYC/AML management for their investor pool
- Regulatory reporting exports (formatted for SEC Nigeria, FCA, MiCA)
- White-label dashboard access
- Priority on-chain KYC approvals

**Current status:** Planned for Phase 3.

### Revenue Projection at Scale

| Assets Tokenized | x402 AI Fees (10 req/asset) | Tokenization Fee (0.5%) | Annual Yield Fee (8% yield, 5%) |
|-----------------|----------------------------|------------------------|--------------------------------|
| 10 | ~1,000 CSPR | $7,500 | $6,000 |
| 100 | ~10,000 CSPR | $75,000 | $60,000 |
| 1,000 | ~100,000 CSPR | $750,000 | $600,000 |

x402 fees are denominated in CSPR and collected on-chain at inference time. Tokenization fees, yield fees, secondary market spread, and subscriptions are incremental.

---

## 6. Platform Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER LAYER                               │
│                                                                   │
│              Web3 User via CasperWallet Extension                │
│                           │                                       │
└───────────────────────────┼─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     APPLICATION LAYER                            │
│                    Next.js App Router (Vercel)                   │
│                                                                   │
│   /chat          /trade         /yield        /governance        │
│   AI Tokenize    Marketplace    Yield Mgmt    Proposals          │
│                                                                   │
│   /api/ai/*           /api/agent/*         /api/casper/*          │
│   Groq AI             Yield Agent          RPC Proxy +           │
│   Extraction          Compliance Agent     Settlement             │
│   (MCP-enhanced)      (autonomous)                               │
│                                                                   │
│              Neon Postgres (serverless)                          │
│         Off-chain state mirror + audit log                       │
└───────────────────────────┬─────────────────────────────────────┘
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│                     BLOCKCHAIN LAYER                             │
│                    Casper Network (Testnet)                       │
│                                                                   │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────┐ │
│   │  RWA NFT     │  │    Yield     │  │  Governance  │  │Esc │ │
│   │  (CEP-78)    │  │ Distributor  │  │   Contract   │  │row │ │
│   │              │  │              │  │              │  │    │ │
│   │ mint()       │  │ distribute() │  │ vote()       │  │list│ │
│   │ transfer()   │  │ claim()      │  │ execute()    │  │buy │ │
│   │ set_kyc()    │  │ register_    │  │              │  │    │ │
│   │ is_kyc()     │  │ holder()     │  │              │  │    │ │
│   └──────────────┘  └──────────────┘  └──────────────┘  └────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 6.1 Agent-Pays Settlement Pattern

CasperWallet currently supports signing Casper 1.x Deploy format only. The platform contracts use TransactionV1 (Casper 2.0). The current workaround:

- **User authorizes** by signing a message with `signMessage`, proving wallet ownership without submitting a gas payment
- **Agent submits** the actual on-chain transaction using a server-side keypair (`AGENT_SECRET_KEY_PEM`)

This is a documented testnet limitation. When CasperWallet ships `signTransaction` support for TransactionV1, the agent is removed from the transaction path entirely. Users will sign and pay directly, with no trust in the server-side key required.

### 6.2 Off-Chain State

Neon Postgres (serverless-compatible, via `@neondatabase/serverless`) mirrors on-chain token state for fast API reads. The `/api/casper/sync` endpoint reconciles the Postgres mirror against the CEP-78 contract's `total_supply`, `metadata`, and `owners` named keys via the Casper JSON-RPC.

---

## 7. Smart Contracts

All contracts are written in Rust, compiled to WebAssembly, and deployed on Casper testnet.

| Contract | Hash |
|----------|------|
| RWA NFT (CEP-78) | `53eb1c21627a3baad41e5419a4e8f7a5f17eaf25090125018d2bf9aa57150f66` |
| Yield Distributor | `3df77115ff3fb4504add44719344b9d969378223a2bd9207bb3e57d3f51468f3` |
| Governance | `7856b4dd9c97e4a7a0701465efee1864772f7767167ca0f174535b3e9a90d0a3` |
| Trade Escrow | `32e552364dad24a9939aaaff3bd40745b5ad75631c136b2031a657af4fc214bb` |

### 7.1 RWA NFT Contract (CEP-78)

**Named keys (on-chain dictionaries):** `metadata`, `owners`, `kyc_list`, `balances`, `total_supply`

**Entry points:**
- `mint(token_id, metadata)`: creates token, callable by whitelisted operators
- `transfer(recipient, token_id)`: transfers ownership, subject to KYC check
- `set_kyc(account)`: grants KYC approval, callable by platform operator
- `is_kyc(account)`: read-only KYC status check
- `approve(spender, token_id)`: delegates transfer right to escrow contract

**Metadata schema (compact on-chain format, expanded by sync agent):**
```json
{ "n": "asset_name", "t": "asset_type", "v": 180000, "c": "ipfs_cid" }
```

### 7.2 Yield Distributor Contract

**Entry points:**
- `register_holder(account: ByteArray, share_bps: U64)`: registers fractional yield stake
- `distribute()`: triggers proportional payout to all registered holders
- `claim()`: pull-based claim for individual holders

**Distribution formula:**
```
holder_payment = (holder_bps / total_registered_bps) × (pool_balance × 0.95)
platform_fee   = pool_balance × 0.05
```

### 7.3 Trade Escrow Contract

**Entry points:**
- `list(bps: U64, price_cspr: U512)`: lists a fractional stake for sale
- `buy(listing_id)`: purchases a listed stake
- `cancel(listing_id)`: cancels an active listing

### 7.4 Governance Contract

**Entry points:** `create_proposal`, `vote`, `execute`

**Quorum rules:**
- Standard proposals: 51% of votes, minimum 10% supply participation
- Parameter changes: 66% supermajority
- Asset sale: 75% supermajority

---

## 8. AI Agent Layer

CasperLaunch runs three autonomous agents in parallel, each with a distinct on-chain authority scope.

### 8.1 Asset Tokenization Agent (x402-gated, MCP-enhanced)

Powered by Llama 3.3 70B (via Groq). When a user describes an asset in natural language via the `/chat` interface:

**Payment gate (x402, live on testnet):**
1. `/api/ai/tokenize` returns HTTP 402 with Casper payment requirement
2. User signs authorization message in CasperWallet (`signMessage`)
3. Agent submits a native 3 CSPR TransactionV1 transfer on-chain
4. Transaction hash returned as payment proof
5. Client sends `X-PAYMENT: base64({ txHash, from: publicKey })` header
6. Server verifies via `info_get_transaction` on testnet RPC

**MCP context fetching (before AI runs):**

Before the AI model processes the user's asset description, the server calls the **Casper MCP Server** (`mcp.cspr.cloud`) via the Model Context Protocol. Four tools run in parallel:

- `get_network_status`: current era, active validators, total stake
- `get_latest_blocks`: live block hashes and timestamps
- `get_validators`: top validators with network share
- `get_current_currency_rate`: live CSPR/USD rate

The results are injected into the AI system prompt as live blockchain context. This makes the AI genuinely agentic: it reasons about the current state of the Casper network, not a static snapshot.

**AI processing (after payment verified and MCP context loaded):**
7. Groq extracts structured metadata (name, type, valuation, IPFS CID) with on-chain context
8. Validates against CEP-78 schema
9. Orchestrates: KYC-whitelist, mint, register holder (all agent-signed TransactionV1)

The x402 gate is not a simulation. Every AI request requires a real on-chain CSPR payment. This is the first production x402 implementation on a non-EVM chain.

### 8.2 Autonomous Yield Distribution Agent

Polls the yield distributor contract every 30 seconds. When the pool balance crosses 1 CSPR threshold, it autonomously constructs, signs, and submits a `distribute()` TransactionV1.

- Agent status visible at `/agent` with live transaction log and CSPR.cloud data panels
- All distributions produce an on-chain transaction hash, fully auditable
- Agent authority is limited by the contract: it can only call `distribute()`, not modify parameters or the registry

### 8.3 Autonomous Compliance Agent

A second autonomous agent monitors KYC status for all registered token holders, running every 60 seconds.

**Scan logic:**
1. Query all tokens and holders from the Postgres mirror
2. For each holder, check `kyc_attested_at` timestamp in token metadata
3. If attestation is missing: flag wallet as `kyc_missing`
4. If attestation is older than 90 days: flag as `kyc_expired` and initiate revocation
5. Agent autonomously calls `set_kyc(account, approved=false)` on the CEP-78 contract
6. Revocation transaction hash logged and displayed in the compliance dashboard

The compliance agent enforces continuous AML/KYC compliance without human intervention. Flagged wallets cannot transfer tokens until re-attested. This represents the first autonomous on-chain KYC revocation system on the Casper Network.

**Agent authority scope:** The compliance agent can only call `set_kyc()`. It cannot mint, transfer tokens, or touch the yield distributor. Each agent is scoped to its contract entry points.

---

## 9. Tokenization Process

```
Step 1: Asset Description
  User describes asset in natural language via the AI chat interface

Step 2: x402 Payment (live on testnet)
  Server returns HTTP 402 with Casper payment requirement
  User signs authorization in CasperWallet
  Agent submits 3 CSPR native transfer on-chain
  Transaction hash used as X-PAYMENT header

Step 3: AI Extraction (after on-chain verification)
  Server calls info_get_transaction to confirm payment on testnet
  Gemini AI extracts: asset_name, asset_type, valuation_usd, ipfs_cid
  User reviews and confirms extracted metadata

Step 4: Document Anchoring
  User uploads title deed, appraisal, or lease agreement
  SHA-256 hash computed locally
  Document pinned to IPFS via Pinata; CID stored in token metadata

Step 5: Wallet Authorization
  User signs authorization message via CasperWallet (signMessage)
  Proves wallet ownership before any contract interaction

Step 6: KYC Whitelisting
  Agent calls set_kyc(wallet) on the RWA NFT contract (TransactionV1)
  Wallet approved on-chain, eligible to receive and transfer tokens

Step 7: On-Chain Mint
  Agent calls mint(token_id, metadata); CEP-78 token created
  Token ID assigned; transaction hash stored in Neon Postgres

Step 8: Holder Registration
  Agent calls register_holder(wallet, 10000); 100% stake registered
  Token immediately earns yield from the distributor pool

Step 9: Fee Display
  Platform calculates 0.5% of valuation_usd as tokenization fee
  Displayed in confirmation message
  In production: collected in CSPR at mint time

Step 10: Portfolio
  Token appears in asset list (Postgres mirror, synced from chain via /api/casper/sync)
  Owner can list fractional stakes for sale on the escrow contract
```

---

## 10. Marketplace & Trading

### 10.1 Listing

A token holder creates a listing by specifying basis points to sell and price in CSPR. The listing is recorded on the escrow contract via the platform agent after the seller authorizes with `signMessage`.

### 10.2 Buy Flow

**Testnet (current):**
1. Buyer clicks Buy and authorizes via `signMessage`
2. Agent submits CSPR transfer and calls `register_holder` on the yield contract
3. Buyer begins earning yield immediately

**Production (when CasperWallet ships TransactionV1 signing):**
1. Buyer signs and submits their own `buy(listing_id)` transaction to the escrow contract
2. Escrow holds CSPR atomically
3. On CSPR receipt: escrow calls `transfer` on NFT and `register_holder` on yield
4. CSPR released to seller
5. Fully atomic with no agent in the payment leg

### 10.3 Transfer Restrictions

On-chain eligibility checked at transfer time:
- Buyer must hold a valid KYC approval (`is_kyc` returns true)
- Holding period (minimum blocks elapsed) enforced in contract code
- Investor caps and jurisdiction blocks enforced via eligibility class

---

## 11. Yield Distribution

### 11.1 Yield Sources

In production, yield enters the distributor from verified, whitelisted sources:

| Asset Type | Yield Source | Collection Method |
|-----------|-------------|------------------|
| Residential Real Estate | Rental income | Property manager to escrow; CSPR conversion |
| Commercial Real Estate | Lease payments | Tenant direct to escrow account |
| Treasury Bills | Coupon payments | Custodian bank API; signed deposit receipt |
| Invoices | Invoice settlement | Debtor payment via factoring platform API |

### 11.2 Distribution Mechanics

```
for each registered holder:
  payment = (holder_bps / total_registered_bps) × (pool_balance × 0.95)
  transfer payment to holder wallet

platform_fee = pool_balance × 0.05
```

Gas costs for distribution are paid by the agent and recovered from the 5% platform fee.

---

## 12. Governance

### 12.1 Proposal Types

| Type | Quorum | Time-Lock | Examples |
|------|--------|-----------|---------|
| Standard | 51% | 48 hours | Fee adjustments, UI changes |
| Parameter Change | 66% | 72 hours | Distribution threshold, platform fee |
| Asset Action | 75% | 7 days | Property sale, major renovation |

### 12.2 Vote Weight

Vote weight is fixed at the block when a proposal is created. This snapshot approach prevents manipulation by purchasing tokens after submission.

### 12.3 Progressive Decentralization

At launch, the platform operator holds a significant governance allocation for rapid incident response. The roadmap reduces operator control at defined milestones toward full community governance.

---

## 13. Legal & Compliance Framework

### 13.1 Special Purpose Vehicle Structure

Every tokenized asset is held inside a Special Purpose Vehicle, a limited liability company created for that asset. The SPV holds legal title. The CEP-78 token represents beneficial ownership of the SPV.

```
Token Holder
    │ holds CEP-78 token
    ▼
CasperLaunch Registry
    │ maps token to SPV equity
    ▼
Special Purpose Vehicle (LLC)
    │ holds legal title
    ▼
Underlying Asset
```

This provides legally enforceable investor rights, clear regulatory classification (equity securities), platform bankruptcy protection, and orderly wind-down if the platform ceases operations.

### 13.2 KYC / AML

**On-chain (current):**
- `set_kyc(account)` records approval on the CEP-78 contract
- `is_kyc(account)` checked before every transfer
- No personal data stored on-chain

**Production:**
- Identity verification via licensed KYC provider (Jumio, Onfido, or Fractal ID)
- AML screening against OFAC, UN, EU, and local sanctions lists
- Source of funds declaration for investments above $10,000
- Annual re-verification for accredited and institutional investors

### 13.3 Securities Regulation

Fractional ownership tokens are structured as securities in all target jurisdictions:

- **Nigeria:** SEC Nigeria Digital Assets Framework (2022)
- **UK:** FCA Appointed Representative arrangement
- **EU:** MiCA compliance
- **US:** Regulation D 506(c) for accredited investors only; no public offering

---

## 14. Asset Management in Production

### 14.1 Property Management

Each real estate asset is managed by an accredited local property management company. Routine maintenance is within the manager's authority. Major decisions (capex above threshold, asset sale) require a token holder governance vote enforced on-chain.

### 14.2 Valuation

Asset valuations are updated annually by independent licensed valuers. Appraisal reports are pinned to IPFS, with content hashes stored on-chain, creating a tamper-proof link between the token's valuation field and its physical evidence. Valuation changes are recorded as on-chain events with full audit history.

### 14.3 Exit Paths

Three exit mechanisms are available:
1. **Secondary market:** sell on the CasperLaunch trade page
2. **Buyback programme:** guaranteed buyback at discount to NAV
3. **Asset sale:** 75% governance vote; proceeds distributed proportionally

---

## 15. Security Model

### 15.1 Agent Key Security

**Testnet:** Single keypair in `AGENT_SECRET_KEY_PEM` environment variable, acceptable for demonstration only.

**Production:** Agent key held by a licensed digital asset custodian under a 2-of-3 threshold scheme. Any agent-initiated transaction requires reconstruction from at least 2 shards. Key rotation via governance proposal, requiring community approval before activation.

### 15.2 Smart Contract Security

Before mainnet deployment:
- Automated audit via Rust static analysis
- Manual audit by a smart contract security firm
- Formal verification of the yield distribution formula
- Bug bounty programme up to $50,000 for critical vulnerabilities

### 15.3 Oracle Security

- Pyth Network on-chain price feed with TWAP, resistant to short-term manipulation
- Maximum 5% price deviation limit; transactions revert on breaches
- 2-of-3 oracle key signatures for off-chain price submissions

### 15.4 Governance Security

- Snapshot voting with weight fixed at proposal creation
- 48-hour minimum time-lock on all passed proposals
- 5-member multisig council can veto during time-lock window
- Proposal deposit (100 CSPR, returned if quorum reached) prevents spam

---

## 16. Roadmap

### Phase 1: Testnet (Current, July 2026)
- CEP-78 RWA NFT contract deployed and operational
- Autonomous Yield Distribution Agent: polls every 30s, submits `distribute()` on-chain
- Autonomous Compliance Agent: scans KYC expiry every 60s, auto-revokes via `set_kyc(false)`
- Governance contract with on-chain voting
- x402 payment gate live: real 3 CSPR on-chain payment required before AI runs
- First Casper-native x402 implementation (non-EVM chain)
- Casper MCP Server integration: live network context injected into AI prompts before inference
- CSPR.cloud API integration: live balance, transfers, block data on agent dashboard
- AI tokenization via Llama 3.3 70B (Groq inference)
- CasperWallet integration (signMessage authorization + agent-submitted TransactionV1)
- Secondary marketplace with on-chain escrow listings and yield rights transfer
- Neon Postgres off-chain state mirror with chain sync
- Revenue model: x402 fees live; 0.5% tokenization fee displayed at mint; yield fee in contract

### Phase 2: Mainnet Beta (Q3 2026)
- Mainnet contract deployment with full security audit
- First three assets: Lagos residential properties
- Real KYC integration via Fractal ID
- Pyth Network oracle integration
- 0.5% tokenization fee collected in CSPR at mint time
- Mobile-responsive UI
- Bug bounty programme launch

### Phase 3: Regulated Launch (Q4 2026)
- SEC Nigeria registration
- UK FCA Appointed Representative status
- IPFS document storage for all assets
- Multi-asset support: treasury bills and trade invoices
- Compliance-as-a-Service at $99/month
- Agent key moved to licensed custodian
- Governance fully operational with binding on-chain execution

### Phase 4: Scale (2027)
- Pan-African expansion: Ghana, Kenya, South Africa
- Cross-chain bridge: Ethereum and Polygon liquidity access
- Asset-backed lending: tokenized RWA as collateral for CSPR loans
- Secondary market maker programme
- Progressive governance decentralization milestones
- $100M total assets tokenized target

---

## 17. Conclusion

CasperLaunch demonstrates that real-world asset tokenization is deployable today on the Casper Network. Every critical flow including minting, trading, yield distribution, KYC compliance enforcement, and governance voting is live on-chain on Casper testnet.

The business model is built on sustainable fee streams that align platform incentives with investor outcomes. The platform earns more when assets are tokenized (0.5% fee), when they trade (0.25% spread), and when they yield (5% of distributions). Compliance-as-a-Service creates recurring revenue from institutional issuers. Together these streams support a scalable business without compromising the trustless guarantees that make blockchain tokenization valuable.

The patterns used in the testnet prototype are designed with production in mind. Every simplification has a documented upgrade path. The SPV legal structure, KYC framework, oracle integration, custody model, and governance security model are designed from first principles.

The core thesis: if the smart contracts are correct and the legal structure is sound, the platform can be trusted. Not because CasperLaunch says so, but because the blockchain proves it.

**CasperLaunch — Own Anything.**

---

*This whitepaper is for informational purposes only and does not constitute an offer to sell or a solicitation to buy any security or financial instrument. CasperLaunch is currently deployed on Casper testnet. Mainnet deployment is subject to regulatory approval in each target jurisdiction.*

*Contact: [GitHub](https://github.com/Osiyomeoh/casper-launch) | Built for Casper Agentic Buildathon 2026*
