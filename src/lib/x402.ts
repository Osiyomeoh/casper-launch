// Casper-native x402 payment protocol implementation.
// Spec: https://x402.org — adapted for Casper Network (non-EVM).

const CASPER_TESTNET_RPC = "https://node.testnet.casper.network/rpc";
const AGENT_ACCOUNT = "01e208d198c18d6bd1802c90ae44173393a18d16cbe70144ead27018d237888c2a";
const PAYMENT_MOTES = "3000000000"; // 3 CSPR

export type X402PaymentRequirement = {
  scheme: "casper-exact";
  network: "casper-test";
  maxAmountRequired: string;
  resource: string;
  description: string;
  mimeType: string;
  payTo: string;
  maxTimeoutSeconds: number;
  asset: "CSPR";
  decimals: 9;
};

export type X402Payment = {
  x402Version: 1;
  scheme: "casper-exact";
  network: "casper-test";
  payload: {
    deployHash: string;
    from: string;
  };
};

export function buildPaymentRequirement(resource: string): X402PaymentRequirement {
  return {
    scheme: "casper-exact",
    network: "casper-test",
    maxAmountRequired: PAYMENT_MOTES,
    resource,
    description: "AI RWA Asset Tokenization — 3 CSPR per request",
    mimeType: "application/json",
    payTo: AGENT_ACCOUNT,
    maxTimeoutSeconds: 300,
    asset: "CSPR",
    decimals: 9,
  };
}

export function parsePaymentHeader(header: string): X402Payment | null {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf8");
    const parsed = JSON.parse(decoded) as X402Payment;
    if (parsed.x402Version !== 1 || !parsed.payload?.deployHash) return null;
    return parsed;
  } catch {
    return null;
  }
}

type CasperRpcResponse = {
  result?: {
    transaction?: {
      FinalizedApprovals?: {
        transaction?: {
          Deploy?: { header?: { account?: string }; payment?: unknown };
        };
      };
      execution_info?: {
        execution_result?: {
          V2?: { effects?: unknown[]; error_message?: string | null };
        };
      };
    };
    execution_results?: Array<{
      result?: { Success?: unknown; Failure?: unknown };
    }>;
  };
  error?: { message: string };
};

export async function verifyPayment(payment: X402Payment): Promise<{ valid: boolean; reason?: string }> {
  const { deployHash } = payment.payload;
  if (!/^[0-9a-f]{64}$/i.test(deployHash)) {
    return { valid: false, reason: "Invalid deploy hash format" };
  }

  try {
    // Try Casper 2.0 transaction lookup first
    const txRes = await fetch(CASPER_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "info_get_transaction",
        params: { transaction_hash: { Deploy: deployHash }, finalized_approvals: true },
      }),
    });

    if (txRes.ok) {
      const txData = (await txRes.json()) as CasperRpcResponse;
      if (txData.error) {
        return { valid: false, reason: `Transaction not found: ${txData.error.message}` };
      }
      const execResult = txData.result?.transaction?.execution_info?.execution_result?.V2;
      if (execResult?.error_message) {
        return { valid: false, reason: `Transaction failed: ${execResult.error_message}` };
      }
      // Transaction exists and executed without error — accept it
      return { valid: true };
    }

    // Fallback: try info_get_deploy (Casper 1.x format)
    const deployRes = await fetch(CASPER_TESTNET_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "info_get_deploy",
        params: { deploy_hash: deployHash },
      }),
    });

    const deployData = (await deployRes.json()) as CasperRpcResponse;
    if (deployData.error) {
      return { valid: false, reason: "Deploy not found on testnet" };
    }
    const execResults = deployData.result?.execution_results ?? [];
    if (execResults.length === 0) {
      return { valid: false, reason: "Deploy not yet executed" };
    }
    const success = execResults.some((r) => r.result?.Success !== undefined);
    if (!success) {
      return { valid: false, reason: "Deploy execution failed" };
    }
    return { valid: true };
  } catch (e) {
    return { valid: false, reason: `RPC error: ${e instanceof Error ? e.message : String(e)}` };
  }
}
