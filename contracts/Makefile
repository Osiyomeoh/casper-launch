##
## CasperLaunch Smart Contracts — Build & Deploy
## Requires: Rust + wasm32-unknown-unknown target + casper-client CLI
##
## Install deps:
##   rustup target add wasm32-unknown-unknown
##   cargo install casper-client
##
## Usage:
##   make build       — compile all contracts to wasm
##   make deploy-testnet  — deploy to Casper testnet
##   make deploy-mainnet  — deploy to Casper mainnet

CHAIN_TESTNET  = casper-test
CHAIN_MAINNET  = casper

# Set your secret key path (export or .env)
SECRET_KEY     ?= $(HOME)/.casper/keys/secret_key.pem

# Node RPC endpoints
NODE_TESTNET   = https://rpc.testnet.casperlabs.io
NODE_MAINNET   = https://rpc.mainnet.casperlabs.io

# Gas payment (in motes; 1 CSPR = 1,000,000,000 motes)
PAYMENT        = 150000000000   # 150 CSPR — enough for contract install

WASM_DIR       = target/wasm32-unknown-unknown/release

.PHONY: build clean deploy-testnet deploy-mainnet init-testnet

build:
	cargo build --release --target wasm32-unknown-unknown
	@echo "✓ Contracts compiled:"
	@ls -lh $(WASM_DIR)/*.wasm

clean:
	cargo clean

## ── Testnet deployment ────────────────────────────────────────────────────────

deploy-testnet: build
	@echo "\n▸ Deploying RWA NFT contract to testnet..."
	casper-client put-deploy \
		--node-address $(NODE_TESTNET) \
		--chain-name $(CHAIN_TESTNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount $(PAYMENT) \
		--session-path $(WASM_DIR)/rwa_nft.wasm \
		--session-arg "collection_name:string='CasperLaunch RWA'" \
		--session-arg "collection_symbol:string='CLRWA'" \
		--session-arg "max_supply:u64='10000'"

	@echo "\n▸ Deploying Yield Distributor to testnet..."
	casper-client put-deploy \
		--node-address $(NODE_TESTNET) \
		--chain-name $(CHAIN_TESTNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount $(PAYMENT) \
		--session-path $(WASM_DIR)/yield_distributor.wasm

	@echo "\n▸ Deploying Governance to testnet..."
	casper-client put-deploy \
		--node-address $(NODE_TESTNET) \
		--chain-name $(CHAIN_TESTNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount $(PAYMENT) \
		--session-path $(WASM_DIR)/governance.wasm

	@echo "\n✓ All contracts deployed. Check contract hashes in your account named keys."
	@echo "  → https://testnet.cspr.live/account/YOUR_ACCOUNT_HASH"

## ── Mainnet deployment ────────────────────────────────────────────────────────

deploy-mainnet: build
	@echo "⚠  Deploying to MAINNET — this costs real CSPR."
	@read -p "Continue? [y/N] " yn; [ "$$yn" = "y" ] || exit 1

	casper-client put-deploy \
		--node-address $(NODE_MAINNET) \
		--chain-name $(CHAIN_MAINNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount $(PAYMENT) \
		--session-path $(WASM_DIR)/rwa_nft.wasm \
		--session-arg "collection_name:string='CasperLaunch RWA'" \
		--session-arg "collection_symbol:string='CLRWA'" \
		--session-arg "max_supply:u64='1000000'"

	casper-client put-deploy \
		--node-address $(NODE_MAINNET) \
		--chain-name $(CHAIN_MAINNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount $(PAYMENT) \
		--session-path $(WASM_DIR)/yield_distributor.wasm

	casper-client put-deploy \
		--node-address $(NODE_MAINNET) \
		--chain-name $(CHAIN_MAINNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount $(PAYMENT) \
		--session-path $(WASM_DIR)/governance.wasm

## ── Post-deploy: mint first RWA token ────────────────────────────────────────
## After deploying, grab the rwa_nft_contract_hash from your account named keys
## and run: make mint-first CONTRACT_HASH=<hash> RECIPIENT=<account_hash>

mint-first:
ifndef CONTRACT_HASH
	$(error CONTRACT_HASH is not set. Run: make mint-first CONTRACT_HASH=xxx RECIPIENT=yyy)
endif
	casper-client put-deploy \
		--node-address $(NODE_TESTNET) \
		--chain-name $(CHAIN_TESTNET) \
		--secret-key $(SECRET_KEY) \
		--payment-amount 5000000000 \
		--session-hash $(CONTRACT_HASH) \
		--session-entry-point mint \
		--session-arg "recipient:account_hash='$(RECIPIENT)'" \
		--session-arg "token_id:u64='1'" \
		--session-arg 'metadata:string={"asset_name":"1248 Alpine Terrace","asset_type":"residential","location":"San Francisco, CA","valuation_usd":4250000,"yield_apy":6.0,"total_tokens":1000000}'
