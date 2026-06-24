//! CasperLaunch Yield Distributor Contract
//!
//! Receives CSPR rental income and distributes it pro-rata to all token holders
//! based on their share of the RWA NFT collection total supply.
//!
//! Flow:
//!   1. Property manager deposits rental income → `deposit()`
//!   2. AI CFO agent calls `distribute()` — splits among registered holders
//!   3. Each holder calls `claim()` to pull their share
//!   4. Admin can `register_holder` / `remove_holder` as tokens transfer
//!
//! Entry points:
//!   deposit           — receive CSPR into the distribution pool
//!   distribute        — compute each holder's share (admin/agent only)
//!   claim             — holder withdraws their earned yield
//!   register_holder   — add a wallet + share weight (admin only)
//!   remove_holder     — remove a wallet (admin only)
//!   update_share      — update a holder's fractional share (admin only)
//!   pool_balance      — query current undistributed pool
//!   pending_claim     — query how much a holder can claim

#![no_std]
#![no_main]

extern crate alloc;

use alloc::{
    collections::BTreeMap,
    format,
    string::{String, ToString},
    vec,
};
use casper_contract::{
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash,
    contracts::{EntryPoint, EntryPoints, NamedKeys},
    ApiError, CLType, CLValue, EntryPointAccess, EntryPointType, Key, Parameter, URef, U512,
};

const KEY_ADMIN: &str = "admin";
const KEY_PURSE: &str = "yield_purse";          // contract's CSPR purse
const KEY_POOL_TOTAL: &str = "pool_total";       // motes in undistributed pool
const KEY_HOLDERS: &str = "holders";             // AccountHash → share weight (u64, out of 10000 bps)
const KEY_PENDING: &str = "pending";             // AccountHash → claimable motes (U512)
const KEY_TOTAL_SHARES: &str = "total_shares";   // sum of all bps weights (should = 10000)

#[repr(u16)]
enum YieldError {
    NotAdmin = 1,
    NothingToDistribute = 2,
    NothingToClaim = 3,
    InsufficientFunds = 4,
    InvalidShare = 5,
}
impl From<YieldError> for ApiError {
    fn from(e: YieldError) -> ApiError {
        ApiError::User(e as u16)
    }
}

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(ApiError::MissingKey)
        .into_uref()
        .unwrap_or_revert_with(ApiError::UnexpectedKeyVariant)
}

fn require_admin() {
    let admin: AccountHash = storage::read(get_uref(KEY_ADMIN))
        .unwrap_or_revert()
        .unwrap_or_revert();
    if runtime::get_caller() != admin {
        runtime::revert(YieldError::NotAdmin);
    }
}

/// Deposit CSPR into the yield pool. Anyone can call (property manager, AI agent).
/// Caller must attach CSPR via `amount` arg and transfer from their main purse.
#[no_mangle]
pub extern "C" fn deposit() {
    let amount: U512 = runtime::get_named_arg("amount");
    let source_purse: URef = runtime::get_named_arg("source_purse");
    let yield_purse: URef = storage::read(get_uref(KEY_PURSE))
        .unwrap_or_revert()
        .unwrap_or_revert();

    system::transfer_from_purse_to_purse(source_purse, yield_purse, amount, None)
        .unwrap_or_revert_with(YieldError::InsufficientFunds);

    let pool_uref = get_uref(KEY_POOL_TOTAL);
    let current: U512 = storage::read(pool_uref).unwrap_or_revert().unwrap_or(U512::zero());
    storage::write(pool_uref, current + amount);
}

/// Distribute the current pool pro-rata among registered holders.
/// Clears the pool and writes pending balances. Admin/agent only.
#[no_mangle]
pub extern "C" fn distribute() {
    require_admin();

    let pool_uref = get_uref(KEY_POOL_TOTAL);
    let pool: U512 = storage::read(pool_uref).unwrap_or_revert().unwrap_or(U512::zero());
    if pool == U512::zero() {
        runtime::revert(YieldError::NothingToDistribute);
    }

    let holders_uref = get_uref(KEY_HOLDERS);
    let holders: BTreeMap<String, u64> = storage::read(holders_uref)
        .unwrap_or_revert()
        .unwrap_or_default();

    let total_shares: u64 = storage::read(get_uref(KEY_TOTAL_SHARES))
        .unwrap_or_revert()
        .unwrap_or(10_000u64);

    let pending_uref = get_uref(KEY_PENDING);
    let mut pending: BTreeMap<String, U512> = storage::read(pending_uref)
        .unwrap_or_revert()
        .unwrap_or_default();

    for (account_str, share_bps) in &holders {
        // share_amount = pool * bps / 10000
        let share = pool * U512::from(*share_bps) / U512::from(total_shares);
        let current = pending.entry(account_str.clone()).or_insert(U512::zero());
        *current += share;
    }

    storage::write(pending_uref, pending);
    // Reset pool
    storage::write(pool_uref, U512::zero());
}

/// Holder claims their pending yield. Transfers CSPR from contract purse to caller.
#[no_mangle]
pub extern "C" fn claim() {
    let caller = runtime::get_caller();
    let key = format!("{}", caller);

    let pending_uref = get_uref(KEY_PENDING);
    let mut pending: BTreeMap<String, U512> = storage::read(pending_uref)
        .unwrap_or_revert()
        .unwrap_or_default();

    let amount = pending.get(&key).copied().unwrap_or(U512::zero());
    if amount == U512::zero() {
        runtime::revert(YieldError::NothingToClaim);
    }

    let yield_purse: URef = storage::read(get_uref(KEY_PURSE))
        .unwrap_or_revert()
        .unwrap_or_revert();

    system::transfer_from_purse_to_account(yield_purse, caller, amount, None)
        .unwrap_or_revert_with(YieldError::InsufficientFunds);

    pending.insert(key, U512::zero());
    storage::write(pending_uref, pending);
}

/// Register or update a holder's basis-point share (out of 10,000). Admin only.
/// Example: 6500 = 65% of yield goes to this holder.
#[no_mangle]
pub extern "C" fn register_holder() {
    require_admin();
    let account: AccountHash = runtime::get_named_arg("account");
    let share_bps: u64 = runtime::get_named_arg("share_bps");

    if share_bps > 10_000 {
        runtime::revert(YieldError::InvalidShare);
    }

    let holders_uref = get_uref(KEY_HOLDERS);
    let mut holders: BTreeMap<String, u64> = storage::read(holders_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    holders.insert(format!("{}", account), share_bps);
    storage::write(holders_uref, holders.clone());

    // Recalculate total shares
    let total: u64 = holders.values().sum();
    storage::write(get_uref(KEY_TOTAL_SHARES), total);
}

/// Remove a holder (e.g., when they transfer all tokens). Admin only.
#[no_mangle]
pub extern "C" fn remove_holder() {
    require_admin();
    let account: AccountHash = runtime::get_named_arg("account");

    let holders_uref = get_uref(KEY_HOLDERS);
    let mut holders: BTreeMap<String, u64> = storage::read(holders_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    holders.remove(&format!("{}", account));
    storage::write(holders_uref, holders.clone());

    let total: u64 = holders.values().sum();
    storage::write(get_uref(KEY_TOTAL_SHARES), total);
}

/// Read undistributed pool balance.
#[no_mangle]
pub extern "C" fn pool_balance() {
    let pool: U512 = storage::read(get_uref(KEY_POOL_TOTAL))
        .unwrap_or_revert()
        .unwrap_or(U512::zero());
    runtime::ret(CLValue::from_t(pool).unwrap_or_revert());
}

/// Read pending claimable amount for an account.
#[no_mangle]
pub extern "C" fn pending_claim() {
    let account: AccountHash = runtime::get_named_arg("account");
    let pending: BTreeMap<String, U512> = storage::read(get_uref(KEY_PENDING))
        .unwrap_or_revert()
        .unwrap_or_default();
    let amount = pending
        .get(&format!("{}", account))
        .copied()
        .unwrap_or(U512::zero());
    runtime::ret(CLValue::from_t(amount).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn call() {
    let yield_purse = system::create_purse();

    let mut named_keys: NamedKeys = NamedKeys::new();
    named_keys.insert(KEY_PURSE.to_string(), Key::URef(yield_purse));

    for key in &[KEY_POOL_TOTAL, KEY_HOLDERS, KEY_PENDING, KEY_TOTAL_SHARES] {
        let uref = storage::new_uref(());
        named_keys.insert(key.to_string(), Key::URef(uref));
    }

    let admin_uref = storage::new_uref(runtime::get_caller());
    named_keys.insert(KEY_ADMIN.to_string(), Key::URef(admin_uref));

    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "deposit",
        vec![
            Parameter::new("amount", CLType::U512),
            Parameter::new("source_purse", CLType::URef),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "distribute",
        vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "claim",
        vec![],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "register_holder",
        vec![
            Parameter::new("account", CLType::ByteArray(32)),
            Parameter::new("share_bps", CLType::U64),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "remove_holder",
        vec![Parameter::new("account", CLType::ByteArray(32))],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "pool_balance",
        vec![],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "pending_claim",
        vec![Parameter::new("account", CLType::ByteArray(32))],
        CLType::U512,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        Some("yield_distributor_contract_hash".to_string()),
        Some("yield_distributor_access_uref".to_string()),
        None,
    );
}
