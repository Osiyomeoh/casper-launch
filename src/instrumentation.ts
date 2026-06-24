// Next.js instrumentation hook — runs once when the server starts.
// Boots the autonomous yield agent so it monitors on-chain state
// without any user interaction.

export async function register() {
  // Only run agent in Node.js runtime, not in Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAgent } = await import("@/app/api/agent/yield-monitor/route");
    startAgent();
  }
}
