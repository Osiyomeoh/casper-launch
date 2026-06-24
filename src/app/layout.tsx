import type { Metadata } from "next";
import "./globals.css";
import PrivyProviderWrapper from "./components/PrivyProviderWrapper";

export const metadata: Metadata = {
  title: "CasperLaunch | Institutional RWA Tokenization",
  description: "Tokenize real-world assets in 20 minutes. No blockchain knowledge required.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        <PrivyProviderWrapper>{children}</PrivyProviderWrapper>
      </body>
    </html>
  );
}
