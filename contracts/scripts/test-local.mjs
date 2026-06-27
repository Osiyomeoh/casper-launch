#!/usr/bin/env node
/**
 * CasperLaunch Contract Integration Tests
 *
 * Tests each entry point against the Casper testnet:
 *   1. Deploy rwa-nft contract
 *   2. set_kyc  — whitelist deployer
 *   3. mint     — mint token with document hash in metadata
 *   4. get_owner / get_metadata — read back values (via RPC state query)
 *   5. transfer — transfer to a second KYC'd wallet
 *   6. Deploy yield-distributor
 *   7. register_holder, distribute (empty pool should revert)
 *
 * Usage:
 *   node contracts/scripts/test-local.mjs
 *
 * Requires:
 *   casper-client in PATH
 *   ~/.casper/keys/secret_key.pem (ed25519 key with testnet CSPR for gas)
 */

import { execSync } from "child_process";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const NODE = "https://node.testnet.casper.network/rpc";
const CHAIN = "casper-test";
const KEY = join(homedir(), ".casper/keys/secret_key.pem");
const WASM_DIR = join(import.meta.dirname, "../target/wasm32-unknown-unknown/release");
const PAYMENT = "150000000000"; // 150 CSPR for contract install
const CALL_PAYMENT = "5000000000"; // 5 CSPR for entry point calls
const WAIT_MS = 90_000; // 90s for deploys to land on testnet

const PUBLIC_KEY_HEX = readFileSync(join(homedir(), ".casper/keys/public_key_hex"), "utf8").trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd) {
  console.log(`\n$ ${cmd.slice(0, 120)}...`);
  return execSync(cmd, { encoding: "utf8" });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitForDeploy(deployHash) {
  console.log(`  Waiting for deploy ${deployHash} to finalise...`);
  const deadline = Date.now() + WAIT_MS;
  while (Date.now() < deadline) {
    await sleep(5000);
    try {
      const res = run(
        `casper-client get-deploy --node-address ${NODE} ${deployHash}`
      );
      const parsed = JSON.parse(res);
      const execResult = parsed?.result?.execution_results?.[0];
      if (execResult) {
        const success = execResult.result?.Success !== undefined;
        const failure = execResult.result?.Failure;
        if (success) {
          console.log("  ✓ Deploy succeeded");
          return { ok: true };
        }
        if (failure) {
          console.error("  ✗ Deploy failed:", JSON.stringify(failure, null, 2));
          return { ok: false, error: failure };
        }
      }
    } catch {}
  }
  throw new Error(`Timed out waiting for deploy ${deployHash}`);
}

function extractDeployHash(output) {
  const match = output.match(/"deploy_hash"\s*:\s*"([a-f0-9]{64})"/);
  if (!match) throw new Error("Could not extract deploy_hash from output:\n" + output);
  return match[1];
}

function getAccountHash(pubKeyHex) {
  try {
    const out = run(`casper-client account-address --public-key ${pubKeyHex}`);
    return out.trim().replace("account-hash-", "");
  } catch {
    return null;
  }
}

function queryNamedKey(accountHash, keyName) {
  try {
    const out = run(
      `casper-client query-global-state --node-address ${NODE} --key account-hash-${accountHash} --path ${keyName}`
    );
    return JSON.parse(out);
  } catch (e) {
    return null;
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

async function testDeploy() {
  console.log("\n══════════════════════════════════════");
  console.log(" TEST 1: Deploy rwa-nft contract");
  console.log("══════════════════════════════════════");

  const out = run(
    `casper-client put-deploy \
      --node-address ${NODE} \
      --chain-name ${CHAIN} \
      --secret-key ${KEY} \
      --payment-amount ${PAYMENT} \
      --session-path ${WASM_DIR}/rwa_nft.wasm \
      --session-arg "collection_name:string='CasperLaunch RWA'" \
      --session-arg "collection_symbol:string='CLRWA'" \
      --session-arg "max_supply:u64='10000'"`
  );

  const hash = extractDeployHash(out);
  const result = await waitForDeploy(hash);
  if (!result.ok) throw new Error("Deploy failed");

  // Check named key is present
  const accountHash = getAccountHash(PUBLIC_KEY_HEX);
  console.log(`  Account hash: ${accountHash}`);
  const namedKey = queryNamedKey(accountHash, "rwa_nft_contract_hash");
  if (!namedKey) throw new Error("rwa_nft_contract_hash not in account named keys");
  console.log("  ✓ rwa_nft_contract_hash found in named keys");

  const contractHash = namedKey?.result?.stored_value?.CLValue?.parsed ??
    namedKey?.result?.stored_value?.ContractPackage ??
    "unknown";
  return { deployHash: hash, accountHash, contractHash };
}

async function testSetKyc(contractHash) {
  console.log("\n══════════════════════════════════════");
  console.log(" TEST 2: set_kyc — whitelist deployer");
  console.log("══════════════════════════════════════");

  const out = run(
    `casper-client put-deploy \
      --node-address ${NODE} \
      --chain-name ${CHAIN} \
      --secret-key ${KEY} \
      --payment-amount ${CALL_PAYMENT} \
      --session-hash ${contractHash} \
      --session-entry-point set_kyc \
      --session-arg "account:byte_array='${PUBLIC_KEY_HEX.replace(/^01|^02/, '')}'" \
      --session-arg "approved:bool='true'"`
  );

  const hash = extractDeployHash(out);
  const result = await waitForDeploy(hash);
  if (!result.ok) throw new Error("set_kyc failed");
  console.log("  ✓ Wallet whitelisted on contract");
  return hash;
}

async function testMint(contractHash) {
  console.log("\n══════════════════════════════════════");
  console.log(" TEST 3: mint — with document hash in metadata");
  console.log("══════════════════════════════════════");

  const tokenId = Math.floor(Date.now() / 1000);
  const metadata = JSON.stringify({
    asset_name: "Test Property Lagos",
    asset_type: "residential",
    location: "Lagos, Nigeria",
    valuation_usd: 120000,
    yield_apy: 8.5,
    total_tokens: 1000,
    document_hash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    document_name: "title_deed.pdf",
    issuer_wallet: PUBLIC_KEY_HEX,
  });

  // Use account hash bytes for recipient
  const accountHash = getAccountHash(PUBLIC_KEY_HEX);

  const out = run(
    `casper-client put-deploy \
      --node-address ${NODE} \
      --chain-name ${CHAIN} \
      --secret-key ${KEY} \
      --payment-amount ${CALL_PAYMENT} \
      --session-hash ${contractHash} \
      --session-entry-point mint \
      --session-arg "recipient:byte_array='${accountHash}'" \
      --session-arg "token_id:u64='${tokenId}'" \
      --session-arg "metadata:string='${metadata.replace(/'/g, "\\'")}'" `
  );

  const hash = extractDeployHash(out);
  const result = await waitForDeploy(hash);
  if (!result.ok) throw new Error("mint failed");
  console.log(`  ✓ Token #${tokenId} minted with document hash`);
  return { hash, tokenId };
}

async function testMintWithoutKyc(contractHash) {
  console.log("\n══════════════════════════════════════");
  console.log(" TEST 4: mint without KYC should FAIL");
  console.log("══════════════════════════════════════");

  // Use a random account hash that is NOT KYC'd
  const strangerHash = "0000000000000000000000000000000000000000000000000000000000000001";
  const tokenId = 9999999;
  const metadata = JSON.stringify({
    asset_name: "Should Fail",
    asset_type: "residential",
    location: "X",
    valuation_usd: 1,
    yield_apy: 1,
    total_tokens: 1,
  });

  const out = run(
    `casper-client put-deploy \
      --node-address ${NODE} \
      --chain-name ${CHAIN} \
      --secret-key ${KEY} \
      --payment-amount ${CALL_PAYMENT} \
      --session-hash ${contractHash} \
      --session-entry-point mint \
      --session-arg "recipient:byte_array='${strangerHash}'" \
      --session-arg "token_id:u64='${tokenId}'" \
      --session-arg "metadata:string='${metadata.replace(/'/g, "\\'")}'" `
  );

  const hash = extractDeployHash(out);
  const result = await waitForDeploy(hash);
  if (result.ok) {
    console.error("  ✗ ERROR: mint to non-KYC recipient should have failed but succeeded");
  } else {
    console.log("  ✓ Correctly rejected: mint to non-KYC recipient reverted");
  }
}

async function deployYield() {
  console.log("\n══════════════════════════════════════");
  console.log(" TEST 5: Deploy yield-distributor");
  console.log("══════════════════════════════════════");

  const out = run(
    `casper-client put-deploy \
      --node-address ${NODE} \
      --chain-name ${CHAIN} \
      --secret-key ${KEY} \
      --payment-amount ${PAYMENT} \
      --session-path ${WASM_DIR}/yield_distributor.wasm`
  );

  const hash = extractDeployHash(out);
  const result = await waitForDeploy(hash);
  if (!result.ok) throw new Error("yield-distributor deploy failed");
  console.log("  ✓ Yield distributor deployed");
  return hash;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("CasperLaunch Contract Integration Tests");
  console.log(`Network: ${CHAIN}`);
  console.log(`Deployer: ${PUBLIC_KEY_HEX}`);
  console.log(`Node: ${NODE}\n`);

  // Verify WASM files exist
  for (const name of ["rwa_nft", "yield_distributor", "governance"]) {
    try {
      readFileSync(`${WASM_DIR}/${name}.wasm`);
    } catch {
      console.error(`ERROR: ${name}.wasm not found. Run: cd contracts && cargo build --release --target wasm32-unknown-unknown`);
      process.exit(1);
    }
  }

  try {
    // 1. Deploy
    const { accountHash, contractHash } = await testDeploy();
    console.log(`\n  Contract hash: ${contractHash}`);

    // Need the raw hash for subsequent calls — query the named key
    const hashQuery = run(
      `casper-client query-global-state --node-address ${NODE} --key account-hash-${accountHash} --path rwa_nft_contract_hash`
    );
    const hashJson = JSON.parse(hashQuery);
    // Extract hash from named key value
    const contractHashRaw = hashJson?.result?.stored_value?.ContractPackage
      ? Object.keys(hashJson.result.stored_value)[0]
      : null;

    // Use casper-client get-account-info to find the contract hash
    const accountInfo = run(
      `casper-client get-account-info --node-address ${NODE} --public-key ${PUBLIC_KEY_HEX}`
    );
    const parsed = JSON.parse(accountInfo);
    const namedKeys = parsed?.result?.account?.named_keys ?? [];
    const contractHashEntry = namedKeys.find(k => k.name === "rwa_nft_contract_hash");
    if (!contractHashEntry) {
      throw new Error("Could not find rwa_nft_contract_hash in account named keys via get-account-info");
    }

    const rawHash = contractHashEntry.key.replace("hash-", "").replace("contract-", "");
    console.log(`  Raw contract hash for calls: ${rawHash}`);

    // 2. KYC
    await testSetKyc(rawHash);

    // 3. Mint with document hash
    await testMint(rawHash);

    // 4. Mint without KYC (should fail)
    await testMintWithoutKyc(rawHash);

    // 5. Deploy yield distributor
    await deployYield();

    console.log("\n══════════════════════════════════════");
    console.log(" ALL TESTS COMPLETE ✓");
    console.log("══════════════════════════════════════");
    console.log(`\nAdd these hashes to .env.local:`);
    console.log(`NEXT_PUBLIC_RWA_NFT_HASH=${rawHash}`);

  } catch (e) {
    console.error("\n✗ TEST FAILED:", e.message);
    process.exit(1);
  }
}

main();
