"use client";
import { useEffect, ReactNode } from "react";

export default function CsprClickProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (document.getElementById("csprclick-sdk")) return;

    const appId = process.env.NEXT_PUBLIC_CSPRCLICK_APP_ID ?? "56c75317-c553-4b3c-ac7e-da7e757f";

    // Must be set before script loads
    (window as any).csprClickSDKAsyncInit = () => {
      const sdk = (window as any).csprclick;
      if (!sdk) return;

      sdk.init({
        appName: "CasperLaunch",
        appId,
        appKey: process.env.NEXT_PUBLIC_CSPRCLICK_APP_KEY ?? "37e6f4a2e720468e9763bfcc1bc86227",
        contentMode: 1, // CONTENT_MODE.Popup = 1
        providers: ["casper-wallet", "ledger", "csprclick-w3a-google"],
        casperNode: "https://node.testnet.casper.network/rpc",
        chainName: "casper-test",
      });

      sdk.on("csprclick:loaded", () => {
        window.dispatchEvent(new CustomEvent("csprclick:loaded"));
      });
    };

    const script = document.createElement("script");
    script.id = "csprclick-sdk";
    script.src = "https://cdn.cspr.click/latest/csprclick-sdk-2.1.js";
    script.async = true;
    script.onerror = () => console.error("[CsprClick] Failed to load SDK from CDN");
    document.head.appendChild(script);
  }, []);

  return <>{children}</>;
}
