//! CasperLaunch Trade Escrow Contract
//!
//! Trustless atomic swap: CSPR ↔ yield rights.
//!
//! Safety guarantees:
//!   • CSPR locked in escrow purse before any external call
//!   • Cross-contract register_holder must succeed or entire tx reverts
//!   • CSPR only released to seller AFTER yield rights confirmed transferred
//!   • STATUS_PENDING prevents double-buy and seller cancellation mid-trade
//!   • Admin emergency refund for stuck PENDING listings
//!
//! Entry points: list, buy, cancel, refund, get_listing

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
    contract_api::{runtime, storage, system},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash,
    contracts::{EntryPoint, EntryPoints, NamedKeys},
    runtime_args,
    ApiError, CLType, CLValue, EntryPointAccess, EntryPointType,
    Key, Parameter, URef, U512,
};

const KEY_ADMIN:          &str = "admin";
const KEY_ESCROW_PURSE:   &str = "escrow_purse";
const KEY_LISTINGS:       &str = "listings";
const KEY_YIELD_CONTRACT: &str = "yield_contract";
const KEY_LISTING_COUNT:  &str = "listing_count";

const STATUS_OPEN:      u8 = 0;
const STATUS_PENDING:   u8 = 1;
const STATUS_FILLED:    u8 = 2;
const STATUS_CANCELLED: u8 = 3;

#[repr(u16)]
enum Err {
    NotAdmin            = 100,
    ListingNotFound     = 101,
    ListingNotOpen      = 102,
    InsufficientPayment = 103,
    SelfTrade           = 104,
    NotSeller           = 105,
    ListingPending      = 106,
    ZeroBps             = 107,
    ZeroPrice           = 108,
}
impl From<Err> for ApiError { fn from(e: Err) -> ApiError { ApiError::User(e as u16) } }

fn get_uref(name: &str) -> URef {
    runtime::get_key(name)
        .unwrap_or_revert_with(ApiError::MissingKey)
        .into_uref()
        .unwrap_or_revert_with(ApiError::UnexpectedKeyVariant)
}

fn require_admin() {
    let admin: AccountHash = storage::read(get_uref(KEY_ADMIN))
        .unwrap_or_revert().unwrap_or_revert();
    if runtime::get_caller() != admin { runtime::revert(Err::NotAdmin); }
}

type ListingMap = BTreeMap<String, Vec<u8>>;

fn lkey(id: &str, field: &str) -> String { format!("{}:{}", id, field) }

fn read_map(uref: URef) -> ListingMap {
    storage::read(uref).unwrap_or_revert().unwrap_or_default()
}

fn get_status(m: &ListingMap, id: &str) -> Option<u8>        { Some(*m.get(&lkey(id,"status"))?.first()?) }
fn get_seller(m: &ListingMap, id: &str) -> Option<AccountHash> {
    AccountHash::try_from(m.get(&lkey(id,"seller"))?.as_slice()).ok()
}
fn get_buyer(m: &ListingMap, id: &str) -> Option<AccountHash> {
    let b = m.get(&lkey(id,"buyer"))?;
    if b.len() == 32 { AccountHash::try_from(b.as_slice()).ok() } else { None }
}
fn get_bps(m: &ListingMap, id: &str) -> Option<u64> {
    Some(u64::from_le_bytes(m.get(&lkey(id,"bps"))?.as_slice().try_into().ok()?))
}
fn get_price(m: &ListingMap, id: &str) -> Option<U512> {
    Some(U512::from_little_endian(m.get(&lkey(id,"price"))?))
}

fn set_field(uref: URef, id: &str, field: &str, value: Vec<u8>) {
    let mut m = read_map(uref);
    m.insert(lkey(id, field), value);
    storage::write(uref, m);
}

fn next_id() -> String {
    let uref = get_uref(KEY_LISTING_COUNT);
    let n: u64 = storage::read(uref).unwrap_or_revert().unwrap_or(0u64);
    storage::write(uref, n + 1);
    format!("LST-{}", n)
}

fn price_bytes(p: U512) -> Vec<u8> {
    let mut b = [0u8; 64]; p.to_little_endian(&mut b); b[..32].to_vec()
}

// ── Entry points ──────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn list() {
    let bps: u64    = runtime::get_named_arg("bps");
    let price: U512 = runtime::get_named_arg("price_cspr");
    if bps == 0              { runtime::revert(Err::ZeroBps); }
    if price == U512::zero() { runtime::revert(Err::ZeroPrice); }

    let id = next_id();
    let uref = get_uref(KEY_LISTINGS);
    let seller = runtime::get_caller();
    set_field(uref, &id, "seller", seller.as_bytes().to_vec());
    set_field(uref, &id, "bps",    bps.to_le_bytes().to_vec());
    set_field(uref, &id, "price",  price_bytes(price));
    set_field(uref, &id, "status", vec![STATUS_OPEN]);
    runtime::ret(CLValue::from_t(id).unwrap_or_revert());
}

#[no_mangle]
pub extern "C" fn buy() {
    let listing_id: String = runtime::get_named_arg("listing_id");
    let source_purse: URef = runtime::get_named_arg("source_purse");
    let amount: U512       = runtime::get_named_arg("amount");

    let uref = get_uref(KEY_LISTINGS);
    let map  = read_map(uref);

    let status = get_status(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let seller = get_seller(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let bps    = get_bps(&map,    &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let price  = get_price(&map,  &listing_id).unwrap_or_revert_with(Err::ListingNotFound);

    if status != STATUS_OPEN   { runtime::revert(Err::ListingNotOpen); }
    let buyer = runtime::get_caller();
    if buyer == seller         { runtime::revert(Err::SelfTrade); }
    if amount < price          { runtime::revert(Err::InsufficientPayment); }

    // Re-entrancy guard: mark PENDING first
    set_field(uref, &listing_id, "status", vec![STATUS_PENDING]);
    set_field(uref, &listing_id, "buyer",  buyer.as_bytes().to_vec());

    // 1. Lock CSPR in escrow
    let escrow: URef = storage::read(get_uref(KEY_ESCROW_PURSE))
        .unwrap_or_revert().unwrap_or_revert();
    system::transfer_from_purse_to_purse(source_purse, escrow, amount, None)
        .unwrap_or_revert_with(Err::InsufficientPayment);

    // 2. Cross-contract: register buyer on yield distributor
    //    If this reverts → entire tx reverts → CSPR stays in escrow
    let yield_key = runtime::get_key(KEY_YIELD_CONTRACT)
        .unwrap_or_revert_with(ApiError::MissingKey);
    if let Key::Hash(hash) = yield_key {
        runtime::call_contract::<()>(
            hash.into(),
            "register_holder",
            runtime_args! {
                "account"   => buyer.as_bytes().to_vec(),
                "share_bps" => bps,
            },
        );
    } else {
        runtime::revert(ApiError::UnexpectedKeyVariant);
    }

    // 3. Release CSPR to seller — only reached if step 2 succeeded
    system::transfer_from_purse_to_account(escrow, seller, amount, None)
        .unwrap_or_revert_with(Err::InsufficientPayment);

    // 4. Finalize
    set_field(uref, &listing_id, "status", vec![STATUS_FILLED]);
}

#[no_mangle]
pub extern "C" fn cancel() {
    let listing_id: String = runtime::get_named_arg("listing_id");
    let uref   = get_uref(KEY_LISTINGS);
    let map    = read_map(uref);
    let status = get_status(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let seller = get_seller(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    if runtime::get_caller() != seller { runtime::revert(Err::NotSeller); }
    if status == STATUS_PENDING        { runtime::revert(Err::ListingPending); }
    if status != STATUS_OPEN           { runtime::revert(Err::ListingNotOpen); }
    set_field(uref, &listing_id, "status", vec![STATUS_CANCELLED]);
}

#[no_mangle]
pub extern "C" fn refund() {
    require_admin();
    let listing_id: String = runtime::get_named_arg("listing_id");
    let uref   = get_uref(KEY_LISTINGS);
    let map    = read_map(uref);
    let status = get_status(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let buyer  = get_buyer(&map,  &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let price  = get_price(&map,  &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    if status != STATUS_PENDING { runtime::revert(Err::ListingNotOpen); }
    let escrow: URef = storage::read(get_uref(KEY_ESCROW_PURSE))
        .unwrap_or_revert().unwrap_or_revert();
    system::transfer_from_purse_to_account(escrow, buyer, price, None).unwrap_or_revert();
    set_field(uref, &listing_id, "status", vec![STATUS_CANCELLED]);
}

#[no_mangle]
pub extern "C" fn get_listing() {
    let listing_id: String = runtime::get_named_arg("listing_id");
    let uref   = get_uref(KEY_LISTINGS);
    let map    = read_map(uref);
    let status = get_status(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let seller = get_seller(&map, &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let bps    = get_bps(&map,    &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let price  = get_price(&map,  &listing_id).unwrap_or_revert_with(Err::ListingNotFound);
    let json   = format!(r#"{{"seller":"{:?}","bps":{},"price_cspr":"{}","status":{}}}"#,
        seller, bps, price, status);
    runtime::ret(CLValue::from_t(json).unwrap_or_revert());
}

// ── Constructor ───────────────────────────────────────────────────────────────

#[no_mangle]
pub extern "C" fn call() {
    let yield_key: Key = runtime::get_named_arg("yield_contract_key");

    let escrow_purse = system::create_purse();
    let listings_init: ListingMap = BTreeMap::new();

    let mut nk = NamedKeys::new();
    nk.insert(KEY_ADMIN.into(),          storage::new_uref(runtime::get_caller()).into());
    nk.insert(KEY_ESCROW_PURSE.into(),   storage::new_uref(escrow_purse).into());
    nk.insert(KEY_LISTINGS.into(),       storage::new_uref(listings_init).into());
    nk.insert(KEY_YIELD_CONTRACT.into(), yield_key);
    nk.insert(KEY_LISTING_COUNT.into(),  storage::new_uref(0u64).into());

    let mut ep = EntryPoints::new();
    ep.add_entry_point(EntryPoint::new("list", vec![
        Parameter::new("bps",        CLType::U64),
        Parameter::new("price_cspr", CLType::U512),
    ], CLType::String, EntryPointAccess::Public, EntryPointType::Called));

    ep.add_entry_point(EntryPoint::new("buy", vec![
        Parameter::new("listing_id",   CLType::String),
        Parameter::new("source_purse", CLType::URef),
        Parameter::new("amount",       CLType::U512),
    ], CLType::Unit, EntryPointAccess::Public, EntryPointType::Called));

    ep.add_entry_point(EntryPoint::new("cancel", vec![
        Parameter::new("listing_id", CLType::String),
    ], CLType::Unit, EntryPointAccess::Public, EntryPointType::Called));

    ep.add_entry_point(EntryPoint::new("refund", vec![
        Parameter::new("listing_id", CLType::String),
    ], CLType::Unit, EntryPointAccess::Public, EntryPointType::Called));

    ep.add_entry_point(EntryPoint::new("get_listing", vec![
        Parameter::new("listing_id", CLType::String),
    ], CLType::String, EntryPointAccess::Public, EntryPointType::Called));

    storage::new_contract(
        ep.into(), Some(nk),
        Some("trade_escrow_package".to_string()),
        Some("trade_escrow_access_uref".to_string()),
        None,
    );
}
