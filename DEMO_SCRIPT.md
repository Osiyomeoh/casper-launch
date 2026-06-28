# CasperLaunch Demo Script
## Casper Agentic Buildathon 2026

---

### Part 1: The Problem and the Platform

Trillions of dollars in real-world assets sit locked behind walls that only institutional investors can climb.

Minimum investments in the hundreds of thousands. Lengthy legal processes. Zero liquidity once you are in. Everyday investors are shut out entirely.

What if you could own a fraction of an apartment building in Accra, earn quarterly yield on it, trade your position in seconds, and verify every single transaction on a public blockchain, without needing a lawyer, a broker, or a million dollars?

That is exactly what CasperLaunch does. And today I am going to show you how it works, live, on the Casper blockchain.

This is the CasperLaunch dashboard. Everything you see here is pulled from real on-chain data. The assets listed were minted as CEP-78 tokens, which is Casper's NFT standard for real-world assets. The trades settled here involved actual CSPR transfers between wallets. Nothing here is mocked.

CasperLaunch is built on three pillars. First: tokenization, converting a physical asset into a blockchain token with a legal identity and on-chain proof of ownership. Second: a liquid marketplace where fractional stakes in those assets can be bought and sold instantly. Third: autonomous yield distribution, where an on-chain agent monitors token pools and pays earnings to holders automatically.

When I click Connect Wallet, CasperWallet opens, a browser extension built specifically for the Casper network. I approve the connection, and immediately the app reads my active public key. My blockchain identity is live. My wallet is my identity on this platform.

---

### Part 2: Tokenizing an Asset

Now let us tokenize an asset.

Instead of filling out a complex form, I talk to the AI agent in plain language. I describe the asset: a three-bedroom apartment in Lekki Phase One, Lagos, valued at one hundred and eighty thousand dollars, with an expected rental yield of eight point five percent annually.

But before the AI runs, something important happens. The platform requests a payment of three CSPR, on-chain, before processing begins. This is the x402 protocol, the first implementation on a non-EVM blockchain. CasperWallet fires a signing popup. I approve. That single signature authorizes the payment, and the agent submits a real CSPR transfer to the Casper network.

Once the payment is confirmed on-chain, the AI agent extracts the asset details, runs a KYC compliance check on the submitting wallet against the on-chain whitelist registry, and constructs a CEP-78 mint transaction, a real smart contract call to our NFT contract deployed on Casper testnet.

Within seconds, we receive a transaction hash, a unique identifier that permanently records this token on the blockchain. Anyone in the world can look this up on the Casper explorer and verify that this asset exists, who owns it, and when it was created.

That apartment is now a tokenized real-world asset. Fully on-chain. Fully verifiable.

Now watch what happens next. The asset is minted, but I own one hundred percent of it. This is where CasperLaunch becomes a real capital raising tool.

I can offer yield rights to investors without transferring the deed. The NFT stays with me. The investor receives proportional yield distributions directly to their wallet. I enter the investor's wallet address, set the percentage, say ten percent, and authorize with my wallet.

The agent registers the investor on-chain in the yield distributor contract. From this moment, every time yield is distributed, ten percent flows automatically to the investor's wallet. No paperwork. No escrow. No bank. Just a smart contract executing the agreement, every time, without fail.

---

### Part 3: Trading, Yield, and Governance

On the trade page I can see all active listings: asset name, seller wallet, asking price in dollars and CSPR, and the yield percentage the buyer will inherit.

When I click Buy, CasperWallet fires a signing popup. I am not signing a payment. I am signing an authorization message that proves I, the buyer, approved this purchase. I approve. That signature is cryptographically tied to my wallet and cannot be forged.

The platform's agent reads my authorization, sends the exact CSPR amount on-chain, and calls register holder on the yield contract, recording me as the new rightful recipient of this asset's yield. No intermediary. No escrow. The smart contract handles everything.

Every tokenized asset generates yield. That yield pools in the yield distributor smart contract. The autonomous agent runs continuously. When the balance crosses the threshold, it triggers an on-chain distribute transaction, splitting the pool proportionally across all registered holders. Holders receive CSPR automatically. No button to click. If you hold a stake, you get paid.

Token holders control the rules through on-chain governance. Every proposal and every vote is submitted as a real transaction, permanent, immutable, publicly verifiable. The portfolio page shows every position with live valuations and yield projections linked to on-chain transaction hashes. The compliance page shows a full audit trail of every mint, trade, and listing, the transparency regulators demand, provided by default.

In production: buyers sign transfers directly from their own wallets. KYC links to a real verification provider. Documents live on IPFS. The agent key moves to multi-signature custody. The smart contracts do not change. The flows do not change. Real money replaces test tokens, and everything else stays exactly the same.

Real estate tokenization. Fractional ownership. Autonomous yield distribution. On-chain governance. Full compliance audit trails. Accessible to every person on earth with a Casper wallet.

All of it live. All of it verifiable. All of it built on Casper.

CasperLaunch. Built for testnet today. Built for the world tomorrow.

---

*Total runtime: approximately 4 minutes*
