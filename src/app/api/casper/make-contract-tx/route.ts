/**
 * POST /api/casper/make-contract-tx
 *
 * Creates an unsigned Casper 2.0 transaction targeting an invocable-entity
 * (contract call), for browser-side signing via CasperWallet.
 *
 * Body: { signerPublicKey, contractHash, entryPoint, sessionArgs, paymentMotes }
 * Returns: { txJson } — unsigned transaction JSON for CasperWallet to sign
 */
import { NextResponse } from "next/server";
import {
  PublicKey,
  TransactionV1Payload,
  TransactionV1,
  TransactionInvocationTarget,
  TransactionEntryPoint,
  TransactionScheduling,
  TransactionTarget,
  FixedMode,
  PricingMode,
  Args,
  NamedArg,
  CLValue,
  InitiatorAddr,
  Duration,
  Timestamp,
} from "casper-js-sdk";

const CHAIN = "casper-test";
const TTL = new Duration(30 * 60 * 1000); // 30 minutes in ms

/**
 * Parse a "name:type='value'" session arg string into a NamedArg.
 * Supports the subset of types used in this project.
 */
function parseSessionArg(arg: string): [string, NamedArg] {
  const colonIdx = arg.indexOf(":");
  const eqIdx = arg.indexOf("=");
  if (colonIdx === -1 || eqIdx === -1) throw new Error(`Invalid session arg: ${arg}`);
  const name = arg.slice(0, colonIdx).trim();
  const type = arg.slice(colonIdx + 1, eqIdx).trim();
  // value is wrapped in single quotes
  const rawValue = arg.slice(eqIdx + 1).trim().replace(/^'|'$/g, "");

  let clValue: CLValue;
  switch (type) {
    case "string":
      clValue = CLValue.newCLString(rawValue);
      break;
    case "u64":
      clValue = CLValue.newCLUint64(BigInt(rawValue));
      break;
    case "u512":
      clValue = CLValue.newCLUInt512(BigInt(rawValue));
      break;
    case "bool":
      clValue = CLValue.newCLValueBool(rawValue === "true");
      break;
    case "byte_array_32":
    case "byte_array": {
      const bytes = Buffer.from(rawValue.replace(/^account-hash-/, ""), "hex");
      clValue = CLValue.newCLByteArray(bytes);
      break;
    }
    default:
      // Fallback: treat as string
      clValue = CLValue.newCLString(rawValue);
  }
  return [name, new NamedArg(name, clValue)];
}

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      signerPublicKey: string;
      contractHash: string;     // 64-char hex, no prefix
      entryPoint: string;
      sessionArgs: string[];    // "name:type='value'" strings
      paymentMotes?: string;
    };

    const { signerPublicKey, contractHash, entryPoint, sessionArgs = [], paymentMotes = "3000000000" } = body;

    if (!signerPublicKey || !contractHash || !entryPoint)
      return NextResponse.json({ error: "signerPublicKey, contractHash, entryPoint required" }, { status: 400 });

    const publicKey = PublicKey.fromHex(signerPublicKey);
    const initiatorAddr = new InitiatorAddr(publicKey);

    // Parse session args
    const namedArgsList: NamedArg[] = [];
    for (const argStr of sessionArgs) {
      const [, namedArg] = parseSessionArg(argStr);
      namedArgsList.push(namedArg);
    }
    const args = Args.fromNamedArgs(namedArgsList);

    // Build pricing
    const pricing = new PricingMode();
    const fixed = new FixedMode();
    fixed.gasPriceTolerance = 1;
    fixed.additionalComputationFactor = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (fixed as any).paymentAmount = BigInt(paymentMotes);
    pricing.fixed = fixed;

    // Build target — TransactionInvocationTarget constructor accepts a string at runtime
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const target = new TransactionTarget(new (TransactionInvocationTarget as any)(`hash-${contractHash}`));

    const payload = TransactionV1Payload.build({
      initiatorAddr,
      args,
      ttl: TTL,
      entryPoint: TransactionEntryPoint.fromJSON({ Custom: entryPoint }),
      pricingMode: pricing,
      timestamp: new Timestamp(new Date()),
      transactionTarget: target,
      scheduling: new TransactionScheduling(),
      chainName: CHAIN,
    });

    // Create unsigned transaction (no signing)
    const tx = TransactionV1.makeTransactionV1(payload);
    const txJson = TransactionV1.toJSON(tx);

    return NextResponse.json({ txJson });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create transaction";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
