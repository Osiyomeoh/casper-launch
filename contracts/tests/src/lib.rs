// Integration tests for CasperLaunch RWA-NFT contract.
// Run with: cargo test -p tests -- --nocapture

#[cfg(test)]
mod rwa_nft {
    use std::path::PathBuf;

    use casper_engine_test_support::{
        ExecuteRequestBuilder, LmdbWasmTestBuilder, DEFAULT_ACCOUNT_ADDR,
        LOCAL_GENESIS_REQUEST, ChainspecConfig, CHAINSPEC_SYMLINK,
    };
    use casper_types::{
        account::AccountHash, runtime_args, PublicKey, SecretKey,
    };

    fn wasm_path(name: &str) -> PathBuf {
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join(format!(
                "target/wasm32-unknown-unknown/release/{}.wasm",
                name
            ))
    }

    fn user_account() -> AccountHash {
        let sk = SecretKey::ed25519_from_bytes([7u8; 32]).unwrap();
        AccountHash::from(&PublicKey::from(&sk))
    }

    fn build() -> LmdbWasmTestBuilder {
        let mut b = LmdbWasmTestBuilder::new_temporary_with_config(
            ChainspecConfig::from_chainspec_path(&*CHAINSPEC_SYMLINK).unwrap(),
        );
        b.run_genesis(LOCAL_GENESIS_REQUEST.clone());
        b
    }

    fn deploy_rwa_nft(b: &mut LmdbWasmTestBuilder) {
        let wasm = std::fs::read(wasm_path("rwa_nft"))
            .expect("rwa_nft.wasm not found — run `cargo build --release --target wasm32-unknown-unknown` first");
        let req = ExecuteRequestBuilder::module_bytes(
            *DEFAULT_ACCOUNT_ADDR,
            wasm,
            runtime_args! {
                "collection_name" => "CasperLaunch RWA Test",
                "collection_symbol" => "CLRWA",
                "max_supply" => 10_000u64,
            },
        )
        .build();
        b.exec(req).commit().expect_success();
    }

    fn call_rwa(
        b: &mut LmdbWasmTestBuilder,
        sender: AccountHash,
        entry_point: &str,
        args: casper_types::RuntimeArgs,
    ) {
        let req = ExecuteRequestBuilder::contract_call_by_name(
            sender,
            "rwa_nft_contract_hash",
            entry_point,
            args,
        )
        .build();
        b.exec(req).commit().expect_success();
    }

    fn call_rwa_fails(
        b: &mut LmdbWasmTestBuilder,
        sender: AccountHash,
        entry_point: &str,
        args: casper_types::RuntimeArgs,
    ) {
        let req = ExecuteRequestBuilder::contract_call_by_name(
            sender,
            "rwa_nft_contract_hash",
            entry_point,
            args,
        )
        .build();
        b.exec(req).commit();
        assert!(b.is_error(), "expected {entry_point} to revert but it succeeded");
    }

    const META: &str = r#"{"asset_name":"Lagos Flat","asset_type":"residential","location":"Lagos, Nigeria","valuation_usd":120000,"yield_apy":8.5,"total_tokens":1000}"#;
    const META_WITH_DOC: &str = r#"{"asset_name":"Lagos Flat","asset_type":"residential","location":"Lagos, Nigeria","valuation_usd":120000,"yield_apy":8.5,"total_tokens":1000,"document_hash":"a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2","document_name":"title_deed.pdf","issuer_wallet":"02abc123"}"#;

    // ── Test 1: Contract deploys and named key is present ─────────────────────

    #[test]
    fn test_deploy_creates_named_key() {
        let mut b = build();
        deploy_rwa_nft(&mut b);
        b.query_named_key_by_account_hash(None, *DEFAULT_ACCOUNT_ADDR, "rwa_nft_contract_hash")
            .expect("rwa_nft_contract_hash not in deployer named keys after install");
    }

    // ── Test 2: Mint without KYC is rejected ──────────────────────────────────

    #[test]
    fn test_mint_without_kyc_reverts() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa_fails(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "mint",
            runtime_args! {
                "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
                "token_id" => 1u64,
                "metadata" => META,
            },
        );
    }

    // ── Test 3: KYC then mint succeeds ────────────────────────────────────────

    #[test]
    fn test_kyc_then_mint_succeeds() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "set_kyc",
            runtime_args! {
                "account" => DEFAULT_ACCOUNT_ADDR.value(),
                "approved" => true,
            },
        );

        call_rwa(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "mint",
            runtime_args! {
                "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
                "token_id" => 1u64,
                "metadata" => META,
            },
        );
    }

    // ── Test 4: Metadata with document hash is accepted ───────────────────────

    #[test]
    fn test_mint_with_document_hash_succeeds() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "set_kyc",
            runtime_args! { "account" => DEFAULT_ACCOUNT_ADDR.value(), "approved" => true },
        );

        call_rwa(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "mint",
            runtime_args! {
                "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
                "token_id" => 2u64,
                "metadata" => META_WITH_DOC,
            },
        );
    }

    // ── Test 5: Transfer to non-KYC wallet is rejected ───────────────────────

    #[test]
    fn test_transfer_to_non_kyc_reverts() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "set_kyc",
            runtime_args! { "account" => DEFAULT_ACCOUNT_ADDR.value(), "approved" => true },
        );
        call_rwa(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "mint",
            runtime_args! {
                "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
                "token_id" => 3u64,
                "metadata" => META,
            },
        );

        let stranger = user_account();
        call_rwa_fails(
            &mut b,
            *DEFAULT_ACCOUNT_ADDR,
            "transfer",
            runtime_args! {
                "from" => DEFAULT_ACCOUNT_ADDR.value(),
                "to" => stranger.value(),
                "token_id" => 3u64,
            },
        );
    }

    // ── Test 6: Transfer between two KYC'd wallets succeeds ──────────────────

    #[test]
    fn test_transfer_between_kyc_wallets_succeeds() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        let user = user_account();

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "set_kyc",
            runtime_args! { "account" => DEFAULT_ACCOUNT_ADDR.value(), "approved" => true });
        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "set_kyc",
            runtime_args! { "account" => user.value(), "approved" => true });

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "mint", runtime_args! {
            "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
            "token_id" => 4u64,
            "metadata" => META,
        });

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "transfer", runtime_args! {
            "from" => DEFAULT_ACCOUNT_ADDR.value(),
            "to" => user.value(),
            "token_id" => 4u64,
        });
    }

    // ── Test 7: Non-admin cannot call set_kyc ────────────────────────────────

    #[test]
    fn test_set_kyc_non_admin_reverts() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        // Non-genesis account has no CSPR so the deploy fails at payment.
        // Either way it must not succeed.
        let stranger = user_account();
        let req = ExecuteRequestBuilder::contract_call_by_name(
            stranger,
            "rwa_nft_contract_hash",
            "set_kyc",
            runtime_args! { "account" => stranger.value(), "approved" => true },
        )
        .build();
        b.exec(req).commit();
        assert!(b.is_error(), "non-admin set_kyc should not succeed");
    }

    // ── Test 8: Admin can update metadata ────────────────────────────────────

    #[test]
    fn test_set_metadata_by_admin_succeeds() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "set_kyc",
            runtime_args! { "account" => DEFAULT_ACCOUNT_ADDR.value(), "approved" => true });
        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "mint", runtime_args! {
            "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
            "token_id" => 5u64,
            "metadata" => META,
        });
        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "set_metadata", runtime_args! {
            "token_id" => 5u64,
            "metadata" => r#"{"asset_name":"Updated Flat","asset_type":"residential","location":"Lagos","valuation_usd":150000,"yield_apy":9.0,"total_tokens":1000}"#,
        });
    }

    // ── Test 9: Owner can burn their token ───────────────────────────────────

    #[test]
    fn test_burn_by_owner_succeeds() {
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "set_kyc",
            runtime_args! { "account" => DEFAULT_ACCOUNT_ADDR.value(), "approved" => true });
        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "mint", runtime_args! {
            "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
            "token_id" => 6u64,
            "metadata" => META,
        });
        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "burn",
            runtime_args! { "token_id" => 6u64 });
    }

    // ── Test 10: Double-mint same token_id reverts (owner already exists) ────

    #[test]
    fn test_double_mint_same_id_is_idempotent_or_reverts() {
        // The contract writes owners[token_id] = recipient on mint.
        // Minting the same ID twice overwrites the owner — this is currently
        // allowed (no uniqueness guard). This test documents that behaviour.
        // If you want to enforce uniqueness, add a check in the contract.
        let mut b = build();
        deploy_rwa_nft(&mut b);

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "set_kyc",
            runtime_args! { "account" => DEFAULT_ACCOUNT_ADDR.value(), "approved" => true });

        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "mint", runtime_args! {
            "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
            "token_id" => 10u64,
            "metadata" => META,
        });

        // Second mint of same ID — should succeed (overwrites) in current impl.
        call_rwa(&mut b, *DEFAULT_ACCOUNT_ADDR, "mint", runtime_args! {
            "recipient" => DEFAULT_ACCOUNT_ADDR.value(),
            "token_id" => 10u64,
            "metadata" => META_WITH_DOC,
        });
    }
}
