/**
 * Casper MCP Server client
 * Connects to the official CSPR.cloud MCP server (Model Context Protocol).
 * Used by the CasperLaunch AI agent to query live on-chain data as tools.
 * Docs: https://docs.cspr.cloud/agentic-tools/mcp-server
 */

const MCP_ENDPOINT = "https://mcp.cspr.cloud/mcp";
const API_KEY = process.env.CSPR_CLOUD_API_KEY ?? "";

let _msgId = 1;
function nextId() { return _msgId++; }

async function mcpRequest(method: string, params: Record<string, unknown> = {}): Promise<unknown> {
  const res = await fetch(MCP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSPR-Cloud-Api-Key": API_KEY,
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: nextId(), method, params }),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  // MCP returns SSE — parse the data line
  for (const line of text.split("\n")) {
    if (line.startsWith("data:")) {
      const parsed = JSON.parse(line.slice(5)) as { result?: unknown; error?: { message: string } };
      if (parsed.error) throw new Error(`MCP ${method}: ${parsed.error.message}`);
      return parsed.result;
    }
  }
  throw new Error(`MCP ${method}: no data in response`);
}

async function callTool(name: string, args: Record<string, unknown>): Promise<string> {
  const result = await mcpRequest("tools/call", { name, arguments: args }) as {
    content?: { type: string; text: string }[];
  };
  return result?.content?.map(c => c.text).join("\n") ?? "";
}

// ── Tools used by CasperLaunch ────────────────────────────────────────────────

export type McpNetworkStatus = {
  block_height: number;
  era_id: number;
  total_validators: number;
  active_validators: number;
  total_stake: string;
};

export async function mcpGetNetworkStatus(): Promise<McpNetworkStatus> {
  const text = await callTool("get_network_status", {});
  try { return JSON.parse(text) as McpNetworkStatus; } catch { return JSON.parse(extractJson(text)) as McpNetworkStatus; }
}

export async function mcpGetAccountInfo(publicKey: string): Promise<string> {
  return callTool("get_account_info", { account_identifier: publicKey });
}

export async function mcpGetAccountBalance(publicKey: string): Promise<string> {
  return callTool("get_account_balance", { account_identifier: publicKey });
}

export async function mcpGetAccountNfts(publicKey: string, page = 1): Promise<string> {
  return callTool("get_account_nfts", { account_identifier: publicKey, page, page_size: 10 });
}

export async function mcpGetNftCollection(contractPackageHash: string): Promise<string> {
  return callTool("get_nft_collection", { contract_package_hash: contractPackageHash });
}

export async function mcpGetContract(contractHash: string): Promise<string> {
  return callTool("get_contract", { contract_hash: contractHash });
}

export async function mcpGetAccountDeploys(publicKey: string, page = 1): Promise<string> {
  return callTool("get_account_deploys", { account_identifier: publicKey, page, page_size: 5 });
}

export async function mcpGetLatestBlocks(count = 3): Promise<string> {
  return callTool("get_latest_blocks", { page_size: count });
}

export async function mcpGetCsprRate(currency = "usd"): Promise<string> {
  return callTool("get_current_currency_rate", { currency_id: currency });
}

// ── Agentic tool runner (called by AI during tokenization) ────────────────────

export type McpToolCall = {
  tool: string;
  args: Record<string, unknown>;
  result: string;
  timestamp: number;
};

export async function runMcpTools(publicKey: string, nftContractHash: string): Promise<McpToolCall[]> {
  const calls: McpToolCall[] = [];

  const run = async (tool: string, args: Record<string, unknown>) => {
    const ts = Date.now();
    try {
      const result = await callTool(tool, args);
      calls.push({ tool, args, result, timestamp: ts });
      return result;
    } catch (e) {
      const result = `Error: ${e instanceof Error ? e.message : String(e)}`;
      calls.push({ tool, args, result, timestamp: ts });
      return result;
    }
  };

  await Promise.all([
    run("get_network_status", {}),
    run("get_latest_blocks", { page_size: 3 }),

    run("get_validators", { page: 1, page_size: 5 }),
  ]);

  return calls;
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : "{}";
}
