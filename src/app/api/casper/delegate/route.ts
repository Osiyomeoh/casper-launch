import { NextResponse } from "next/server";
import {
  RpcClient,
  HttpHandler,
  PrivateKey,
  KeyAlgorithm,
  makeAuctionManagerDeploy,
  AuctionManagerEntryPoint,
  CasperNetworkName,
} from "casper-js-sdk";

const CHAIN = (process.env.NEXT_PUBLIC_CASPER_CHAIN ?? CasperNetworkName.Testnet) as CasperNetworkName;
const NODE = process.env.NEXT_PUBLIC_CASPER_NODE ?? "https://node.testnet.casper.network/rpc";

const rpc = new RpcClient(new HttpHandler(NODE));

function getAgentPrivateKey(): PrivateKey {
  const pem = process.env.AGENT_SECRET_KEY_PEM;
  if (!pem) throw new Error("AGENT_SECRET_KEY_PEM env var not set");
  return PrivateKey.fromPem(pem.replace(/\\n/g, "\n"), KeyAlgorithm.ED25519);
}

export async function POST(req: Request) {
  try {
    const { validatorPublicKey, amountMotes } = await req.json() as {
      validatorPublicKey: string;
      amountMotes: string;
    };

    if (!validatorPublicKey || !amountMotes)
      return NextResponse.json({ error: "validatorPublicKey and amountMotes required" }, { status: 400 });

    const agentKey = getAgentPrivateKey();
    const agentPubKeyHex = agentKey.publicKey.toHex();

    const deploy = makeAuctionManagerDeploy({
      contractEntryPoint: AuctionManagerEntryPoint.delegate,
      delegatorPublicKeyHex: agentPubKeyHex,
      validatorPublicKeyHex: validatorPublicKey,
      amount: amountMotes,
      paymentAmount: "3000000000",
      chainName: CHAIN,
    });

    deploy.sign(agentKey);
    const result = await rpc.putDeploy(deploy);
    const hash = result?.deployHash;
    const txHash = hash ? (typeof hash === "string" ? hash : (hash as { toHex?: () => string }).toHex?.() ?? String(hash)) : "submitted";

    return NextResponse.json({ txHash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delegation failed";
    console.error("[delegate]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
