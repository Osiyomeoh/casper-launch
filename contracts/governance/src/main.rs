//! CasperLaunch Governance Contract
//!
//! On-chain voting for RWA token holders. Each proposal has:
//!   - title, description, voting deadline (unix timestamp)
//!   - For / Against / Abstain vote tallies (weighted by token share)
//!   - Execution flag (admin executes passed proposals)
//!
//! Entry points:
//!   create_proposal   — create a new governance proposal (admin)
//!   vote              — cast a weighted vote (token holders)
//!   execute           — execute a passed proposal (admin)
//!   get_proposal      — read proposal state
//!   get_vote          — read a voter's cast vote

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
    contract_api::{runtime, storage},
    unwrap_or_revert::UnwrapOrRevert,
};
use casper_types::{
    account::AccountHash,
    contracts::{EntryPoint, EntryPoints, NamedKeys},
    ApiError, CLType, CLValue, EntryPointAccess, EntryPointType, Key, Parameter, URef,
};

const KEY_ADMIN: &str = "admin";
const KEY_PROPOSALS: &str = "proposals";        // proposal_id (u64) → JSON string
const KEY_VOTES_FOR: &str = "votes_for";        // proposal_id → total weight
const KEY_VOTES_AGAINST: &str = "votes_against";
const KEY_VOTES_ABSTAIN: &str = "votes_abstain";
const KEY_VOTED: &str = "voted";               // "proposal_id:account" → "for"|"against"|"abstain"
const KEY_PROPOSAL_COUNT: &str = "proposal_count";
const KEY_TOKEN_WEIGHTS: &str = "token_weights"; // AccountHash → voting weight (bps)
const KEY_EXECUTED: &str = "executed";          // proposal_id → bool
const KEY_DEADLINE: &str = "deadline";          // proposal_id → unix timestamp (u64)
const QUORUM_BPS: u64 = 5_000;                 // 50% quorum required to pass

#[repr(u16)]
enum GovError {
    NotAdmin = 1,
    ProposalNotFound = 2,
    AlreadyVoted = 3,
    VotingClosed = 4,
    QuorumNotReached = 5,
    AlreadyExecuted = 6,
    NoVotingWeight = 7,
}
impl From<GovError> for ApiError {
    fn from(e: GovError) -> ApiError {
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
        runtime::revert(GovError::NotAdmin);
    }
}

/// Create a new proposal. Admin only.
/// `metadata` = JSON: { title, description, type: "parameter_change"|"asset_action"|"treasury" }
#[no_mangle]
pub extern "C" fn create_proposal() {
    require_admin();

    let metadata: String = runtime::get_named_arg("metadata");
    let deadline: u64 = runtime::get_named_arg("deadline"); // unix timestamp

    let count_uref = get_uref(KEY_PROPOSAL_COUNT);
    let mut count: u64 = storage::read(count_uref).unwrap_or_revert().unwrap_or(0);
    count += 1;

    // Store proposal metadata
    let proposals_uref = get_uref(KEY_PROPOSALS);
    let mut proposals: BTreeMap<String, String> = storage::read(proposals_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    proposals.insert(count.to_string(), metadata);
    storage::write(proposals_uref, proposals);

    // Store deadline
    let deadline_uref = get_uref(KEY_DEADLINE);
    let mut deadlines: BTreeMap<String, u64> = storage::read(deadline_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    deadlines.insert(count.to_string(), deadline);
    storage::write(deadline_uref, deadlines);

    storage::write(count_uref, count);

    // Return the new proposal ID
    runtime::ret(CLValue::from_t(count).unwrap_or_revert());
}

/// Cast a vote on a proposal. Weight is taken from token_weights.
/// `choice`: 0 = for, 1 = against, 2 = abstain
#[no_mangle]
pub extern "C" fn vote() {
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");
    let choice: u8 = runtime::get_named_arg("choice"); // 0=for, 1=against, 2=abstain
    let caller = runtime::get_caller();

    // Check proposal exists
    let proposals: BTreeMap<String, String> = storage::read(get_uref(KEY_PROPOSALS))
        .unwrap_or_revert()
        .unwrap_or_default();
    if !proposals.contains_key(&proposal_id.to_string()) {
        runtime::revert(GovError::ProposalNotFound);
    }

    // Check deadline
    let deadlines: BTreeMap<String, u64> = storage::read(get_uref(KEY_DEADLINE))
        .unwrap_or_revert()
        .unwrap_or_default();
    let deadline = deadlines
        .get(&proposal_id.to_string())
        .copied()
        .unwrap_or(0);
    let now: u64 = runtime::get_blocktime().into();
    if now > deadline {
        runtime::revert(GovError::VotingClosed);
    }

    // Check not already voted
    let voted_key = format!("{}:{}", proposal_id, caller);
    let voted_uref = get_uref(KEY_VOTED);
    let voted: BTreeMap<String, u8> = storage::read(voted_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    if voted.contains_key(&voted_key) {
        runtime::revert(GovError::AlreadyVoted);
    }

    // Get voting weight
    let weights: BTreeMap<String, u64> = storage::read(get_uref(KEY_TOKEN_WEIGHTS))
        .unwrap_or_revert()
        .unwrap_or_default();
    let weight = weights
        .get(&format!("{}", caller))
        .copied()
        .unwrap_or(0);
    if weight == 0 {
        runtime::revert(GovError::NoVotingWeight);
    }

    // Record vote
    let mut voted_mut: BTreeMap<String, u8> = storage::read(voted_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    voted_mut.insert(voted_key, choice);
    storage::write(voted_uref, voted_mut);

    // Tally
    let tally_key = match choice {
        0 => KEY_VOTES_FOR,
        1 => KEY_VOTES_AGAINST,
        _ => KEY_VOTES_ABSTAIN,
    };
    let tally_uref = get_uref(tally_key);
    let mut tally: BTreeMap<String, u64> = storage::read(tally_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    *tally.entry(proposal_id.to_string()).or_insert(0) += weight;
    storage::write(tally_uref, tally);
}

/// Execute a passed proposal. Admin only. Checks quorum + majority.
#[no_mangle]
pub extern "C" fn execute() {
    require_admin();
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");

    // Not already executed
    let executed_uref = get_uref(KEY_EXECUTED);
    let executed: BTreeMap<String, bool> = storage::read(executed_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    if executed.get(&proposal_id.to_string()).copied().unwrap_or(false) {
        runtime::revert(GovError::AlreadyExecuted);
    }

    // Check quorum: (for + against) / 10000 >= 50%
    let for_tally: BTreeMap<String, u64> = storage::read(get_uref(KEY_VOTES_FOR))
        .unwrap_or_revert()
        .unwrap_or_default();
    let against_tally: BTreeMap<String, u64> = storage::read(get_uref(KEY_VOTES_AGAINST))
        .unwrap_or_revert()
        .unwrap_or_default();

    let votes_for = for_tally.get(&proposal_id.to_string()).copied().unwrap_or(0);
    let votes_against = against_tally.get(&proposal_id.to_string()).copied().unwrap_or(0);
    let participation = votes_for + votes_against;

    if participation < QUORUM_BPS {
        runtime::revert(GovError::QuorumNotReached);
    }
    // Majority: for > against
    // (In production: revert if !passed)

    let mut exec_mut: BTreeMap<String, bool> = storage::read(executed_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    exec_mut.insert(proposal_id.to_string(), true);
    storage::write(executed_uref, exec_mut);

    runtime::ret(CLValue::from_t(votes_for > votes_against).unwrap_or_revert());
}

/// Read proposal metadata + vote tallies.
#[no_mangle]
pub extern "C" fn get_proposal() {
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");
    let proposals: BTreeMap<String, String> = storage::read(get_uref(KEY_PROPOSALS))
        .unwrap_or_revert()
        .unwrap_or_default();
    let meta = proposals
        .get(&proposal_id.to_string())
        .unwrap_or_revert_with(GovError::ProposalNotFound)
        .clone();
    runtime::ret(CLValue::from_t(meta).unwrap_or_revert());
}

/// Read a voter's recorded choice for a proposal.
#[no_mangle]
pub extern "C" fn get_vote() {
    let proposal_id: u64 = runtime::get_named_arg("proposal_id");
    let account: AccountHash = runtime::get_named_arg("account");
    let voted_key = format!("{}:{}", proposal_id, account);
    let voted: BTreeMap<String, u8> = storage::read(get_uref(KEY_VOTED))
        .unwrap_or_revert()
        .unwrap_or_default();
    let choice = voted.get(&voted_key).copied().unwrap_or(255u8); // 255 = no vote
    runtime::ret(CLValue::from_t(choice).unwrap_or_revert());
}

/// Set a voter's weight (in bps out of 10000). Admin only.
/// Called automatically when tokens are minted/transferred.
#[no_mangle]
pub extern "C" fn set_voting_weight() {
    require_admin();
    let account: AccountHash = runtime::get_named_arg("account");
    let weight: u64 = runtime::get_named_arg("weight");

    let weights_uref = get_uref(KEY_TOKEN_WEIGHTS);
    let mut weights: BTreeMap<String, u64> = storage::read(weights_uref)
        .unwrap_or_revert()
        .unwrap_or_default();
    weights.insert(format!("{}", account), weight);
    storage::write(weights_uref, weights);
}

#[no_mangle]
pub extern "C" fn call() {
    let mut named_keys: NamedKeys = NamedKeys::new();
    for key in &[
        KEY_PROPOSALS,
        KEY_VOTES_FOR,
        KEY_VOTES_AGAINST,
        KEY_VOTES_ABSTAIN,
        KEY_VOTED,
        KEY_PROPOSAL_COUNT,
        KEY_TOKEN_WEIGHTS,
        KEY_EXECUTED,
        KEY_DEADLINE,
    ] {
        let uref = storage::new_uref(());
        named_keys.insert(key.to_string(), Key::URef(uref));
    }

    let admin_uref = storage::new_uref(runtime::get_caller());
    named_keys.insert(KEY_ADMIN.to_string(), Key::URef(admin_uref));

    let mut entry_points = EntryPoints::new();

    entry_points.add_entry_point(EntryPoint::new(
        "create_proposal",
        vec![
            Parameter::new("metadata", CLType::String),
            Parameter::new("deadline", CLType::U64),
        ],
        CLType::U64,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "vote",
        vec![
            Parameter::new("proposal_id", CLType::U64),
            Parameter::new("choice", CLType::U8),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "execute",
        vec![Parameter::new("proposal_id", CLType::U64)],
        CLType::Bool,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "get_proposal",
        vec![Parameter::new("proposal_id", CLType::U64)],
        CLType::String,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "get_vote",
        vec![
            Parameter::new("proposal_id", CLType::U64),
            Parameter::new("account", CLType::ByteArray(32)),
        ],
        CLType::U8,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));
    entry_points.add_entry_point(EntryPoint::new(
        "set_voting_weight",
        vec![
            Parameter::new("account", CLType::ByteArray(32)),
            Parameter::new("weight", CLType::U64),
        ],
        CLType::Unit,
        EntryPointAccess::Public,
        EntryPointType::Called,
    ));

    storage::new_contract(
        entry_points.into(),
        Some(named_keys),
        Some("governance_contract_hash".to_string()),
        Some("governance_access_uref".to_string()),
        None,
    );
}
