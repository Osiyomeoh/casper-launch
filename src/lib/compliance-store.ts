export type ComplianceLogEntry = {
  ts: number;
  level: "info" | "success" | "warn" | "error";
  message: string;
  wallet?: string;
  txHash?: string;
};

export type ComplianceFlag = {
  wallet: string;
  reason: "kyc_expired" | "kyc_missing" | "kyc_revoked";
  flaggedAt: number;
  resolvedAt?: number;
  txHash?: string;
};

export type ComplianceState = {
  running: boolean;
  lastCheck: number | null;
  nextCheck: number | null;
  totalRuns: number;
  totalRevocations: number;
  totalFlags: number;
  flags: ComplianceFlag[];
  logs: ComplianceLogEntry[];
};

const MAX_LOGS = 100;
const MAX_FLAGS = 50;

const state: ComplianceState = {
  running: false,
  lastCheck: null,
  nextCheck: null,
  totalRuns: 0,
  totalRevocations: 0,
  totalFlags: 0,
  flags: [],
  logs: [],
};

export function getComplianceState(): ComplianceState {
  return state;
}

export function setComplianceRunning(running: boolean) {
  state.running = running;
}

export function recordComplianceCheck(nextCheckMs: number) {
  state.totalRuns++;
  state.lastCheck = Date.now();
  state.nextCheck = nextCheckMs;
}

export function addFlag(flag: ComplianceFlag) {
  state.totalFlags++;
  state.flags.unshift(flag);
  if (state.flags.length > MAX_FLAGS) state.flags.pop();
}

export function resolveFlag(wallet: string, txHash?: string) {
  state.totalRevocations++;
  const flag = state.flags.find(f => f.wallet === wallet && !f.resolvedAt);
  if (flag) {
    flag.resolvedAt = Date.now();
    flag.txHash = txHash;
  }
}

export function complianceLog(level: ComplianceLogEntry["level"], message: string, wallet?: string, txHash?: string) {
  state.logs.unshift({ ts: Date.now(), level, message, wallet, txHash });
  if (state.logs.length > MAX_LOGS) state.logs.pop();
}
