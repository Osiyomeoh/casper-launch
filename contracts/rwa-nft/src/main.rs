//! CasperLaunch RWA-NFT Contract
//!
//! CEP-78 compatible NFT contract for tokenizing real-world assets on Casper.
//! Each token represents fractional ownership of a physical asset (real estate,
//! commodities, treasury bills, etc.).
//!
//! Entry points:
//!   init          — deploy & configure the collection
//!   mint          — AI agent or admin mints a new asset token
//!   transfer      — transfer token between KYC'd wallets
//!   burn          — burn a token (asset delisted)
//!   set_metadata  — update on-chain valuation / yield data
//!   get_metadata  — read asset metadata
//!   approve       — approve a spender
//!   total_supply  — total tokens in this collection
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

// ── Storage keys ─────────────────────────────────────────────────────────────
const KEY_COLLECTION_NAME: &str = "collection_name";
const KEY_COLLECTION_SYMBOL: &str = "collection_symbol";
const KEY_TOTAL_SUPPLY: &str = "total_supply";
const KEY_MAX_SUPPLY: &str = "max_supply";
const KEY_ADMIN: &str = "admin";
const KEY_OWNERS: &str = "owners";       // token_id → AccountHash
const KEY_BALANCES: &str = "balances";  // AccountHash → u64
const KEY_METADATA: &str = "metadata";  // token_id → JSON string
const KEY_APPROVED: &str = "approved";  // token_id → AccountHash
const KEY_KYC_LIST: &str = "kyc_list";  // AccountHash → bool

// ── Error codes ───────────────────────────────────────────────────────────────
#[repr(u16)]
enum RwaError {
    NotAdmin = 1,
    TokenNotFound = 2,
    NotOwner = 3,
    NotApproved = 4,
    MaxSupplyReached = 5,
    WalletNotKyc = 6,
    AlreadyInitialized = 7,
    InvalidTokenId = 8,
}

impl From<RwaError> for ApiError {
    fn from(e: RwaError) -> ApiError {
        ApiError::User(e as u16)
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(ApiError::MissingKey)
        .into_uref()
        .unwrap_or_revert_with(ApiError::UnexpectedKeyVariant)
}

fn caller() -> AccountHash {
    runtime::get_caller()
}

fn is_admin() -> bool {
    let admin: AccountHash = storage::read(get_uref(KEY_ADMIN))
        .unwrap_or_revert()
        .unwrap_or_revert();
    caller() == admin
}

fn require_admin() {
    if !is_admin() {
        runtime::revert(RwaError::NotAdmin);
    }
}

fn require_kyc(account: AccountHash) {
    let kyc_uref = get_uref(KEY_KYC_LIST);
    let kyc: BTreeMap<String, bool> = storage::read(kyc_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    if !kyc.get(&format!("{}", account)).copied().unwrap_or(false) {
        runtime::revert(RwaError::WalletNotKyc);
    }
}

// ── Entry points ──────────────────────────────────────────────────────────────

/// Deploy the RWA NFT collection. Called once during contract installation.
#[no_mangle]
pub extern "C" fn init() {
    // Guard: only callable during install
    let initialized: bool = storage::read(get_uref("initialized"))
        .unwrap_or_default()
        .unwrap_or(false);
    if initialized {
        runtime::revert(RwaError::AlreadyInitialized);
    }

    let collection_name: String = runtime::get_named_arg("collection_name");
    let collection_symbol: String = runtime::get_named_arg("collection_symbol");
    let max_supply: u64 = runtime::get_named_arg("max_supply");

    storage::write(get_uref(KEY_COLLECTION_NAME), collection_name);
    storage::write(get_uref(KEY_COLLECTION_SYMBOL), collection_symbol);
    storage::write(get_uref(KEY_MAX_SUPPLY), max_supply);
    storage::write(get_uref(KEY_TOTAL_SUPPLY), 0u64);
    storage::write(get_uref("initialized"), true);
}

/// Mint a new RWA token. Admin/AI agent only.
/// `metadata` is a JSON string with asset details:
/// { asset_name, asset_type, location, valuation_usd, yield_apy, ipfs_cid }
#[no_mangle]
pub extern "C" fn mint() {
    require_admin();

    let recipient: AccountHash = runtime::get_named_arg("recipient");
    let token_id: u64 = runtime::get_named_arg("token_id");
    let metadata: String = runtime::get_named_arg("metadata");

    require_kyc(recipient);

    // Check max supply
    let total_supply_uref = get_uref(KEY_TOTAL_SUPPLY);
    let max_supply: u64 = storage::read(get_uref(KEY_MAX_SUPPLY))
        .unwrap_or_revert()
        .unwrap_or_revert();
    let mut total_supply: u64 = storage::read(total_supply_uref)
        .unwrap_or_revert()
        .unwrap_or(0);

    if total_supply >= max_supply {
        runtime::revert(RwaError::MaxSupplyReached);
    }

    // Write owner
    let owners_uref = get_uref(KEY_OWNERS);
    let mut owners: BTreeMap<String, String> = storage::read(owners_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    owners.insert(token_id.to_string(), format!("{}", recipient));
    storage::write(owners_uref, owners);

    // Write metadata
    let metadata_uref = get_uref(KEY_METADATA);
    let mut meta_map: BTreeMap<String, String> = storage::read(metadata_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    meta_map.insert(token_id.to_string(), metadata);
    storage::write(metadata_uref, meta_map);

    // Update balance
    let balances_uref = get_uref(KEY_BALANCES);
    let mut balances: BTreeMap<String, u64> = storage::read(balances_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let bal = balances.entry(format!("{}", recipient)).or_insert(0);
    *bal += 1;
    storage::write(balances_uref, balances);

    total_supply += 1;
    storage::write(total_supply_uref, total_supply);
}

/// Transfer a token. Both sender and recipient must be KYC'd.
#[no_mangle]
pub extern "C" fn transfer() {
    let from: AccountHash = runtime::get_named_arg("from");
    let to: AccountHash = runtime::get_named_arg("to");
    let token_id: u64 = runtime::get_named_arg("token_id");

    let caller_account = caller();

    // Check ownership or approval
    let owners_uref = get_uref(KEY_OWNERS);
    let mut owners: BTreeMap<String, String> = storage::read(owners_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let current_owner = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound);

    if current_owner != &format!("{}", from) {
        runtime::revert(RwaError::NotOwner);
    }

    // Allow owner or approved address
    let approved_uref = get_uref(KEY_APPROVED);
    let approved_map: BTreeMap<String, String> = storage::read(approved_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let approved = approved_map.get(&token_id.to_string());

    if caller_account != from
        && approved.map(|a| a == &format!("{}", caller_account)).unwrap_or(false) == false
    {
        runtime::revert(RwaError::NotApproved);
    }

    require_kyc(to);

    // Update owner
    owners.insert(token_id.to_string(), format!("{}", to));
    storage::write(owners_uref, owners);

    // Update balances
    let balances_uref = get_uref(KEY_BALANCES);
    let mut balances: BTreeMap<String, u64> = storage::read(balances_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    *balances.entry(format!("{}", from)).or_insert(1) -= 1;
    *balances.entry(format!("{}", to)).or_insert(0) += 1;
    storage::write(balances_uref, balances);

    // Clear approval on transfer
    let mut approved_map_mut: BTreeMap<String, String> = storage::read(approved_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    approved_map_mut.remove(&token_id.to_string());
    storage::write(approved_uref, approved_map_mut);
}

/// Approve a spender for a specific token.
#[no_mangle]
pub extern "C" fn approve() {
    let spender: AccountHash = runtime::get_named_arg("spender");
    let token_id: u64 = runtime::get_named_arg("token_id");

    let owners_uref = get_uref(KEY_OWNERS);
    let owners: BTreeMap<String, String> = storage::read(owners_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let owner_str = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound);

    if owner_str != &format!("{}", caller()) {
        runtime::revert(RwaError::NotOwner);
    }

    let approved_uref = get_uref(KEY_APPROVED);
    let mut approved: BTreeMap<String, String> = storage::read(approved_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    approved.insert(token_id.to_string(), format!("{}", spender));
    storage::write(approved_uref, approved);
}

/// Update on-chain asset metadata (valuation, yield, etc.). Admin only.
#[no_mangle]
pub extern "C" fn set_metadata() {
    require_admin();
    let token_id: u64 = runtime::get_named_arg("token_id");
    let metadata: String = runtime::get_named_arg("metadata");

    let metadata_uref = get_uref(KEY_METADATA);
    let mut meta_map: BTreeMap<String, String> = storage::read(metadata_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    meta_map.insert(token_id.to_string(), metadata);
    storage::write(metadata_uref, meta_map);
}

/// Read asset metadata for a token.
#[no_mangle]
pub extern "C" fn get_metadata() {
    let token_id: u64 = runtime::get_named_arg("token_id");
    let metadata_uref = get_uref(KEY_METADATA);
    let meta_map: BTreeMap<String, String> = storage::read(metadata_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let meta = meta_map
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();
    runtime::ret(CLValue::from_t(meta).unwrap_or_revert());
}

/// Add/remove an account from the KYC whitelist. Admin only.
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

/// Burn a token (asset delisted). Admin or token owner.
#[no_mangle]
pub extern "C" fn burn() {
    let token_id: u64 = runtime::get_named_arg("token_id");

    let owners_uref = get_uref(KEY_OWNERS);
    let mut owners: BTreeMap<String, String> = storage::read(owners_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    let owner_str = owners
        .get(&token_id.to_string())
        .unwrap_or_revert_with(RwaError::TokenNotFound)
        .clone();

    if owner_str != format!("{}", caller()) && !is_admin() {
        runtime::revert(RwaError::NotOwner);
    }

    owners.remove(&token_id.to_string());
    storage::write(owners_uref, owners);

    // Update balance
    let balances_uref = get_uref(KEY_BALANCES);
    let mut balances: BTreeMap<String, u64> = storage::read(balances_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    *balances.entry(owner_str).or_insert(1) -= 1;
    storage::write(balances_uref, balances);

    // Decrement total supply
    let supply_uref = get_uref(KEY_TOTAL_SUPPLY);
    let total: u64 = storage::read(supply_uref).unwrap_or_revert().unwrap_or(1);
    storage::write(supply_uref, total - 1);
}

/// Return total minted tokens.
#[no_mangle]
pub extern "C" fn total_supply() {
    let total: u64 = storage::read(get_uref(KEY_TOTAL_SUPPLY))
        .unwrap_or_revert()
        .unwrap_or(0);
    runtime::ret(CLValue::from_t(total).unwrap_or_revert());
}

/// Return token count for an account.
#[no_mangle]
pub extern "C" fn balance_of() {
    let account: AccountHash = runtime::get_named_arg("account");
    let balances: BTreeMap<String, u64> = storage::read(get_uref(KEY_BALANCES))
        .unwrap_or_revert()
        .unwrap_or_default();
    let bal = balances.get(&format!("{}", account)).copied().unwrap_or(0);
    runtime::ret(CLValue::from_t(bal).unwrap_or_revert());
}

// ── Contract installer ────────────────────────────────────────────────────────
#[no_mangle]
pub extern "C" fn call() {
    // Build named keys (all storage urefs)
    let mut named_keys: NamedKeys = NamedKeys::new();
    for key in &[
        KEY_COLLECTION_NAME,
        KEY_COLLECTION_SYMBOL,
        KEY_TOTAL_SUPPLY,
        KEY_MAX_SUPPLY,
        KEY_ADMIN,
        KEY_OWNERS,
        KEY_BALANCES,
        KEY_METADATA,
        KEY_APPROVED,
        KEY_KYC_LIST,
        "initialized",
    ] {
        let uref = storage::new_uref(());
        named_keys.insert(key.to_string(), Key::URef(uref));
    }

    // Store admin = deployer
    let admin_uref = storage::new_uref(runtime::get_caller());
    named_keys.insert(KEY_ADMIN.to_string(), Key::URef(admin_uref));

    // Build entry points
    let mut entry_points = EntryPoints::new();
    entry_points.add_entry_point(EntryPoint::new(
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
    entry_points.add_entry_point(EntryPoint::new(
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
    entry_points.add_entry_point(EntryPoint::new(
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
    entry_points.add_entry_point(EntryPoint::new(
        "approve",
        vec![
            Parameter::new("spender", CLType::ByteArray(32)),
            Parameter::new("token_id", CLType::U64),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "set_metadata",
        vec![
            Parameter::new("token_id", CLType::U64),
            Parameter::new("metadata", CLType::String),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "get_metadata",
        vec![Parameter::new("token_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "set_kyc",
        vec![
            Parameter::new("account", CLType::ByteArray(32)),
            Parameter::new("approved", CLType::Bool),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "burn",
        vec![Parameter::new("token_id", CLType::U64)],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "total_supply",
        vec![],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "balance_of",
        vec![Parameter::new("account", CLType::ByteArray(32))],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    // Install the contract on chain
    let (contract_hash, _version) = storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        Some("rwa_nft_contract_hash".to_string()),
        Some("rwa_nft_access_uref".to_string()),
        None,
    );

    // Immediately init
    runtime::call_contract::<()>(
        contract_hash,
        "init",
        runtime_args! {
            "collection_name" => runtime::get_named_arg::<String>("collection_name"),
            "collection_symbol" => runtime::get_named_arg::<String>("collection_symbol"),
            "max_supply" => runtime::get_named_arg::<u64>("max_supply"),
        },
    );
}
