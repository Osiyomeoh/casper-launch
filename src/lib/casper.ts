import { RpcClient, HttpHandler } from "casper-js-sdk";

const RPC_ENDPOINTS = [
  "https://node.testnet.casper.network/rpc",
  "https://rpc.mainnet.casperlabs.io/rpc",
  "https://casper-rpc.publicnode.com",
];

export function makeClient(endpoint: string): RpcClient {
  return new RpcClient(new HttpHandler(endpoint));
}

// Try each endpoint in order, return on first success
export async function withFallback<T>(fn: (client: RpcClient) => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      return await fn(makeClient(endpoint));
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("All Casper RPC endpoints unavailable");
}

// Real CEP-78 RWA contract hash on Casper mainnet
export const CONTRACTS = {
  RWA_NFT: "b568f50a64acc8bbe43462ffe243849a88111060a228a4a2cbe68f79d5875dc",
  YIELD_TOKEN: "93d923e336b20a4c4ca14d592b60e5bd3fe330775618290104f9baced68eb573",
};

export const EXPLORER = "https://cspr.live";
