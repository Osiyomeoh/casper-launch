//! CasperLaunch RWA-NFT Contract
//!
//! CEP-78 compatible NFT contract for tokenizing real-world assets on Casper.
//! Each token represents ownership of a physical asset backed by a legal SPV.
//!
//! Entry points:
//!   mint          — KYC'd wallet mints a new asset token to themselves
//!   transfer      — transfer token between KYC'd wallets
//!   burn          — burn a token (admin or owner)
//!   set_metadata  — update on-chain valuation / yield data (admin only)
//!   get_metadata  — read asset metadata for a token
//!   get_owner     — return the owner account hash string for a token
//!   set_kyc       — whitelist / de-whitelist a wallet (admin only)
//!   is_kyc        — check if an account is whitelisted
//!   approve       — approve a spender for a token
//!   total_supply  — total tokens minted
//!   balance_of    — token count for an account

#![no_std]
#![no_main]

extern crate alloc;

use alloc::{
    collections::BTreeMap,
    format,
    string::{String, ToString},
    vec,
    vec::Vec,
};
use casper_contract::{
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash,
    contracts::{EntryPoint, EntryPoints, NamedKeys},
    runtime_args, ApiError, CLType, CLValue, EntryPointAccess, EntryPointType, Key, Parameter,
    RuntimeArgs, URef,
};

// ── Storage keys ──────────────────────────────────────────────────────────────
const KEY_COLLECTION_NAME: &str = "collection_name";
const KEY_COLLECTION_SYMBOL: &str = "collection_symbol";
const KEY_TOTAL_SUPPLY: &str = "total_supply";
const KEY_MAX_SUPPLY: &str = "max_supply";
const KEY_ADMIN: &str = "admin";
const KEY_OWNERS: &str = "owners";
const KEY_BALANCES: &str = "balances";
const KEY_METADATA: &str = "metadata";
const KEY_APPROVED: &str = "approved";
const KEY_KYC_LIST: &str = "kyc_list";
const KEY_INITIALIZED: &str = "initialized";

// ── Error codes ───────────────────────────────────────────────────────────────
#[repr(u16)]
enum RwaError {
    NotAdmin        = 1,
    TokenNotFound   = 2,
    NotOwner        = 3,
    NotApproved     = 4,
    MaxSupplyReached = 5,
    WalletNotKyc    = 6,
    AlreadyInit     = 7,
}

impl From<RwaError> for ApiError {
    fn from(e: RwaError) -> ApiError {
        ApiError::User(e as u16)
    }
}

// ── Storage helpers ───────────────────────────────────────────────────────────

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(ApiError::MissingKey)
        .into_uref()
        .unwrap_or_revert_with(ApiError::UnexpectedKeyVariant)
}

fn caller() -> AccountHash {
    runtime::get_caller()
}

fn admin() -> AccountHash {
    storage::read::<AccountHash>(get_uref(KEY_ADMIN))
        .unwrap_or_revert()
        .unwrap_or_revert()
}

fn require_admin() {
    if caller() != admin() {
        runtime::revert(RwaError::NotAdmin);
    }
}

fn check_kyc(account: AccountHash) -> bool {
    let kyc: BTreeMap<String, bool> = storage::read(get_uref(KEY_KYC_LIST))
        .unwrap_or_revert()
        .unwrap_or_default();
    kyc.get(&format!("{}", account)).copied().unwrap_or(false)
}

fn require_kyc(account: AccountHash) {
    if !check_kyc(account) {
        runtime::revert(RwaError::WalletNotKyc);
    }
}

fn read_owners() -> BTreeMap<String, String> {
    storage::read(get_uref(KEY_OWNERS))
        .unwrap_or_revert()
        .unwrap_or_default()
}

fn read_balances() -> BTreeMap<String, u64> {
    storage::read(get_uref(KEY_BALANCES))
        .unwrap_or_revert()
        .unwrap_or_default()
}

// ── Entry points ──────────────────────────────────────────────────────────────

/// No-op entry point kept for ABI compatibility. Initialization happens in call().
#[no_mangle]
pub extern "C" fn init() {}

/// Mint a new RWA token. Caller must be KYC-whitelisted. Admin is NOT required —
/// the platform whitelists issuers via set_kyc, then the issuer mints to themselves.
/// `metadata` is a JSON string: { asset_name, asset_type, location, valuation_usd,
///   yield_apy, total_tokens, document_hash?, document_name?, issuer_wallet? }
#[no_mangle]
pub extern "C" fn mint() {
    let recipient: AccountHash = runtime::get_named_arg("recipient");
    let token_id: u64 = runtime::get_named_arg("token_id");
    let metadata: String = runtime::get_named_arg("metadata");

    // Caller must be KYC'd to mint
    require_kyc(caller());
    // Recipient must also be KYC'd (prevents minting to un-verified third party)
    require_kyc(recipient);

    // Enforce max supply
    let total_uref = get_uref(KEY_TOTAL_SUPPLY);
    let max: u64 = storage::read(get_uref(KEY_MAX_SUPPLY))
        .unwrap_or_revert()
        .unwrap_or_revert();
    let mut total: u64 = storage::read(total_uref)
        .unwrap_or_revert()
        .unwrap_or(0);
    if total >= max {
        runtime::revert(RwaError::MaxSupplyReached);
    }

    // Store owner
    let owners_uref = get_uref(KEY_OWNERS);
    let mut owners = read_owners();
    owners.insert(token_id.to_string(), format!("{}", recipient));
    storage::write(owners_uref, owners);

    // Store metadata
    let meta_uref = get_uref(KEY_METADATA);
    let mut meta: BTreeMap<String, String> = storage::read(meta_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    meta.insert(token_id.to_string(), metadata);
    storage::write(meta_uref, meta);

    // Update balance
    let bal_uref = get_uref(KEY_BALANCES);
    let mut balances = read_balances();
    *balances.entry(format!("{}", recipient)).or_insert(0) += 1;
    storage::write(bal_uref, balances);

    total += 1;
    storage::write(total_uref, total);
}

/// Transfer a token. Caller must be owner or approved. Recipient must be KYC'd.
#[no_mangle]
pub extern "C" fn transfer() {
    let from: AccountHash = runtime::get_named_arg("from");
    let to: AccountHash = runtime::get_named_arg("to");
    let token_id: u64 = runtime::get_named_arg("token_id");

    let owners_uref = get_uref(KEY_OWNERS);
    let mut owners = read_owners();
    let current = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();

    if current != format!("{}", from) {
        runtime::revert(RwaError::NotOwner);
    }

    // Caller must be owner or approved spender
    let approved_uref = get_uref(KEY_APPROVED);
    let approved_map: BTreeMap<String, String> = storage::read(approved_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let caller_str = format!("{}", caller());
    let from_str = format!("{}", from);
    let is_approved = approved_map
        .get(&token_id.to_string())
        .map(|a| a == &caller_str)
        .unwrap_or(false);

    if caller_str != from_str && !is_approved {
        runtime::revert(RwaError::NotApproved);
    }

    // Compliant transfer: recipient must be KYC'd
    require_kyc(to);

    owners.insert(token_id.to_string(), format!("{}", to));
    storage::write(owners_uref, owners);

    let bal_uref = get_uref(KEY_BALANCES);
    let mut balances = read_balances();
    let from_bal = balances.entry(format!("{}", from)).or_insert(1);
    *from_bal = from_bal.saturating_sub(1);
    *balances.entry(format!("{}", to)).or_insert(0) += 1;
    storage::write(bal_uref, balances);

    // Clear approval
    let mut approved_mut: BTreeMap<String, String> = storage::read(approved_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    approved_mut.remove(&token_id.to_string());
    storage::write(approved_uref, approved_mut);
}

/// Approve a spender for a token. Owner only.
#[no_mangle]
pub extern "C" fn approve() {
    let spender: AccountHash = runtime::get_named_arg("spender");
    let token_id: u64 = runtime::get_named_arg("token_id");

    let owners = read_owners();
    let owner_str = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();

    if owner_str != format!("{}", caller()) {
        runtime::revert(RwaError::NotOwner);
    }

    let approved_uref = get_uref(KEY_APPROVED);
    let mut approved: BTreeMap<String, String> = storage::read(approved_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    approved.insert(token_id.to_string(), format!("{}", spender));
    storage::write(approved_uref, approved);
}

/// Update asset metadata. Admin only (AI agent re-valuations, oracle updates).
#[no_mangle]
pub extern "C" fn set_metadata() {
    require_admin();
    let token_id: u64 = runtime::get_named_arg("token_id");
    let metadata: String = runtime::get_named_arg("metadata");

    let meta_uref = get_uref(KEY_METADATA);
    let mut meta: BTreeMap<String, String> = storage::read(meta_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    meta.insert(token_id.to_string(), metadata);
    storage::write(meta_uref, meta);
}

/// Read asset metadata JSON for a token.
#[no_mangle]
pub extern "C" fn get_metadata() {
    let token_id: u64 = runtime::get_named_arg("token_id");
    let meta: BTreeMap<String, String> = storage::read(get_uref(KEY_METADATA))
        .unwrap_or_revert()
        .unwrap_or_default();
    let value = meta
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();
    runtime::ret(CLValue::from_t(value).unwrap_or_revert());
}

/// Return the owner account hash (as hex string) for a token.
#[no_mangle]
pub extern "C" fn get_owner() {
    let token_id: u64 = runtime::get_named_arg("token_id");
    let owners = read_owners();
    let owner = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();
    runtime::ret(CLValue::from_t(owner).unwrap_or_revert());
}

/// Whitelist or de-whitelist a wallet. Admin only.
/// Called by the server agent after verifying accredited investor attestation.
#[no_mangle]
pub extern "C" fn set_kyc() {
    require_admin();
    let account: AccountHash = runtime::get_named_arg("account");
    let approved: bool = runtime::get_named_arg("approved");

    let kyc_uref = get_uref(KEY_KYC_LIST);
    let mut kyc: BTreeMap<String, bool> = storage::read(kyc_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    kyc.insert(format!("{}", account), approved);
    storage::write(kyc_uref, kyc);
}

/// Returns true if an account is KYC-whitelisted.
#[no_mangle]
pub extern "C" fn is_kyc() {
    let account: AccountHash = runtime::get_named_arg("account");
    runtime::ret(CLValue::from_t(check_kyc(account)).unwrap_or_revert());
}

/// Burn a token. Admin or token owner.
#[no_mangle]
pub extern "C" fn burn() {
    let token_id: u64 = runtime::get_named_arg("token_id");

    let owners_uref = get_uref(KEY_OWNERS);
    let mut owners = read_owners();
    let owner_str = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();

    if owner_str != format!("{}", caller()) && caller() != admin() {
        runtime::revert(RwaError::NotOwner);
    }

    owners.remove(&token_id.to_string());
    storage::write(owners_uref, owners);

    let bal_uref = get_uref(KEY_BALANCES);
    let mut balances = read_balances();
    let bal = balances.entry(owner_str).or_insert(1);
    *bal = bal.saturating_sub(1);
    storage::write(bal_uref, balances);

    let supply_uref = get_uref(KEY_TOTAL_SUPPLY);
    let total: u64 = storage::read(supply_uref).unwrap_or_revert().unwrap_or(1);
    storage::write(supply_uref, total.saturating_sub(1));
}

/// Total minted tokens.
#[no_mangle]
pub extern "C" fn total_supply() {
    let total: u64 = storage::read(get_uref(KEY_TOTAL_SUPPLY))
        .unwrap_or_revert()
        .unwrap_or(0);
    runtime::ret(CLValue::from_t(total).unwrap_or_revert());
}

/// Token count for an account.
#[no_mangle]
pub extern "C" fn balance_of() {
    let account: AccountHash = runtime::get_named_arg("account");
    let balances = read_balances();
    let bal = balances.get(&format!("{}", account)).copied().unwrap_or(0);
    runtime::ret(CLValue::from_t(bal).unwrap_or_revert());
}

// ── Installer ─────────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn call() {
    // Read deploy args FIRST so we can bake actual values into named_keys.
    let collection_name: String = runtime::get_named_arg("collection_name");
    let collection_symbol: String = runtime::get_named_arg("collection_symbol");
    let max_supply: u64 = runtime::get_named_arg("max_supply");

    let mut named_keys: NamedKeys = NamedKeys::new();
    named_keys.insert(KEY_ADMIN.to_string(),             Key::URef(storage::new_uref(runtime::get_caller())));
    named_keys.insert(KEY_COLLECTION_NAME.to_string(),   Key::URef(storage::new_uref(collection_name)));
    named_keys.insert(KEY_COLLECTION_SYMBOL.to_string(), Key::URef(storage::new_uref(collection_symbol)));
    named_keys.insert(KEY_TOTAL_SUPPLY.to_string(),      Key::URef(storage::new_uref(0u64)));
    named_keys.insert(KEY_MAX_SUPPLY.to_string(),        Key::URef(storage::new_uref(max_supply)));
    named_keys.insert(KEY_OWNERS.to_string(),            Key::URef(storage::new_uref(BTreeMap::<String, String>::new())));
    named_keys.insert(KEY_BALANCES.to_string(),          Key::URef(storage::new_uref(BTreeMap::<String, u64>::new())));
    named_keys.insert(KEY_METADATA.to_string(),          Key::URef(storage::new_uref(BTreeMap::<String, String>::new())));
    named_keys.insert(KEY_APPROVED.to_string(),          Key::URef(storage::new_uref(BTreeMap::<String, String>::new())));
    named_keys.insert(KEY_KYC_LIST.to_string(),          Key::URef(storage::new_uref(BTreeMap::<String, bool>::new())));
    named_keys.insert(KEY_INITIALIZED.to_string(),       Key::URef(storage::new_uref(true)));

    let mut eps = EntryPoints::new();

    eps.add_entry_point(EntryPoint::new(
        "init",
        vec![
            Parameter::new("collection_name", CLType::String),
            Parameter::new("collection_symbol", CLType::String),
            Parameter::new("max_supply", CLType::U64),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "mint",
        vec![
            Parameter::new("recipient", CLType::ByteArray(32)),
            Parameter::new("token_id", CLType::U64),
            Parameter::new("metadata", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "transfer",
        vec![
            Parameter::new("from", CLType::ByteArray(32)),
            Parameter::new("to", CLType::ByteArray(32)),
            Parameter::new("token_id", CLType::U64),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "approve",
        vec![
            Parameter::new("spender", CLType::ByteArray(32)),
            Parameter::new("token_id", CLType::U64),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "set_metadata",
        vec![
            Parameter::new("token_id", CLType::U64),
            Parameter::new("metadata", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "get_metadata",
        vec![Parameter::new("token_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "get_owner",
        vec![Parameter::new("token_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "set_kyc",
        vec![
            Parameter::new("account", CLType::ByteArray(32)),
            Parameter::new("approved", CLType::Bool),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "is_kyc",
        vec![Parameter::new("account", CLType::ByteArray(32))],
        CLType::Bool,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "burn",
        vec![Parameter::new("token_id", CLType::U64)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "total_supply",
        vec![],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    eps.add_entry_point(EntryPoint::new(
        "balance_of",
        vec![Parameter::new("account", CLType::ByteArray(32))],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    storage::new_contract(
        eps.into(),
        Some(named_keys),
        Some("rwa_nft_contract_hash".to_string()),
        Some("rwa_nft_access_uref".to_string()),
        None,
    );
}
