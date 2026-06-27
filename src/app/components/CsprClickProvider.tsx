"use client";
import { useEffect, ReactNode } from "react";

const CLICK_OPTIONS = {
  appName: "CasperLaunch",
  appId: process.env.NEXT_PUBLIC_CSPRCLICK_APP_ID ?? "casperlaunch",
  contentMode: "Popup",
  providers: ["casper-wallet", "ledger", "csprclick-w3a-google"],
  casperNode: process.env.NEXT_PUBLIC_CASPER_NODE ?? "https://node.testnet.casper.network/rpc",
  chainName: process.env.NEXT_PUBLIC_CASPER_CHAIN ?? "casper-test",
};

export default function CsprClickProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("csprclick-sdk")) return;

    // Define the async init callback before the script loads
    (window as any).csprClickSDKAsyncInit = () => {
      const sdk = (window as any).csprclick;
      if (!sdk) return;
      sdk.once("csprclick:loaded", () => {
        window.dispatchEvent(new CustomEvent("csprclick:loaded"));
      });
      sdk.init(CLICK_OPTIONS);
    };

    const script = document.createElement("script");
    script.id = "csprclick-sdk";
    script.src = "https://cdn.cspr.click/latest/csprclick-sdk-2.1.js";
    script.async = true;
    document.head.appendChild(script);

    return () => {
      // Leave script in DOM — removing it breaks the SDK
    };
  }, []);

  return <>{children}</>;
}
