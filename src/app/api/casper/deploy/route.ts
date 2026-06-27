import { NextResponse } from "next/server";
import { execSync } from "child_process";
import { writeFileSync, unlinkSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const NODE = "https://node.testnet.casper.network/rpc";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    let deploy = body.deploy;
    if (!deploy) return NextResponse.json({ error: "deploy payload required" }, { status: 400 });

    // Unwrap if SDK wrapped the deploy
    if (deploy.Deploy) deploy = deploy.Deploy;
    else if (deploy.Version1) deploy = deploy.Version1;

    // Write signed deploy to a temp file and submit via casper-client send-deploy
    const tmpFile = join(tmpdir(), `deploy-${Date.now()}.json`);
    writeFileSync(tmpFile, JSON.stringify(deploy));

    try {
      const out = execSync(
        `casper-client send-deploy --node-address ${NODE} --input ${tmpFile} 2>&1`,
        { encoding: "utf8", timeout: 30_000, stdio: "pipe" }
      );
      unlinkSync(tmpFile);

      // Strip casper-client warning banners before parsing JSON
      const jsonOnly = out.split("\n").filter(l => l.trimStart().startsWith("{") || l.trimStart().startsWith("}") || (out.indexOf("{") !== -1 && out.indexOf("}") !== -1)).join("\n");
      const jsonStart = out.indexOf("{");
      const jsonEnd = out.lastIndexOf("}");
      if (jsonStart === -1 || jsonEnd === -1) throw new Error(`No JSON in output: ${out.slice(0, 300)}`);
      const parsed = JSON.parse(out.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
      const result = (parsed.result ?? parsed) as Record<string, unknown>;
      const deployHash = (result.deploy_hash ?? result.transaction_hash ?? result.hash) as string;
      if (!deployHash) throw new Error(`No hash in response: ${out.slice(0, 200)}`);

      return NextResponse.json({ deployHash });
    } catch (e) {
      try { unlinkSync(tmpFile); } catch {}
      throw e;
    }
  } catch (e) {
    const err = e as { message?: string; stdout?: Buffer | string; stderr?: Buffer | string };
    const out = typeof err.stdout === "string" ? err.stdout : err.stdout?.toString() ?? "";
    const errOut = typeof err.stderr === "string" ? err.stderr : err.stderr?.toString() ?? "";
    const detail = (out + errOut).replace(/#{2,}.*?#{2,}/gs, "").trim(); // strip warning banners
    const msg = detail.slice(0, 500) || err.message || "Deploy submission failed";
    console.error("[deploy]", msg);
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
