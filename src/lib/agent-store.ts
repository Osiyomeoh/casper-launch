// In-memory singleton for the autonomous yield agent state.
// Survives across API route calls within the same Node.js process.

export type AgentLogEntry = {
  ts: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
  txHash?: string;
};

export type AgentState = {
  running: boolean;
  lastCheck: number | null;
  nextCheck: number | null;
  totalRuns: number;
  totalDistributions: number;
  logs: AgentLogEntry[];
};

const MAX_LOGS = 100;

const state: AgentState = {
  running: false,
  lastCheck: null,
  nextCheck: null,
  totalRuns: 0,
  totalDistributions: 0,
  logs: [],
};

export function getAgentState(): AgentState {
  return state;
}

export function setAgentRunning(running: boolean) {
  state.running = running;
}

export function recordCheck(nextCheckMs: number) {
  state.totalRuns++;
  state.lastCheck = Date.now();
  state.nextCheck = nextCheckMs;
}

export function recordDistribution() {
  state.totalDistributions++;
}

export function log(level: AgentLogEntry["level"], message: string, txHash?: string) {
  state.logs.unshift({ ts: Date.now(), level, message, txHash });
  if (state.logs.length > MAX_LOGS) state.logs.pop();
}
