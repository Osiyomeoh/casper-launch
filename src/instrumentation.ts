// Next.js instrumentation hook — runs once when the server starts.

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // One-time migration: seed SQLite from legacy tokens.json if DB is empty
  const { migrateJsonToDb } = await import("@/lib/migrate");
  await migrateJsonToDb();

  // Start autonomous yield agent
  const { startAgent } = await import("@/app/api/agent/yield-monitor/route");
  startAgent();
}
