"use client";
import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import AppLayout from "@/app/components/AppLayout";

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function VerifyPageInner() {
  const searchParams = useSearchParams();
  const [hash, setHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [tokenHash, setTokenHash] = useState("");
  const [result, setResult] = useState<"match" | "mismatch" | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Auto-fill the on-chain hash from URL ?hash= param (linked from asset/compliance pages)
  useEffect(() => {
    const h = searchParams.get("hash");
    if (h) setTokenHash(h);
  }, [searchParams]);

  async function processFile(file: File) {
    const buf = await file.arrayBuffer();
    const h = await sha256Hex(buf);
    setHash(h);
    setFileName(file.name);
    setResult(null);
  }

  function verify() {
    if (!hash || !tokenHash.trim()) return;
    setResult(hash.toLowerCase() === tokenHash.trim().toLowerCase() ? "match" : "mismatch");
  }

  return (
    <AppLayout title="Verify Document">
      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-[#d8e2ff]">Document Verification</h1>
          <p className="text-sm text-[#abb9d6] mt-1">
            Verify that a document matches the cryptographic fingerprint anchored in a CasperLaunch token.
          </p>
        </div>

        {/* How it works */}
        <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 space-y-3">
          <p className="text-xs font-mono text-[#64FFDA] uppercase tracking-wider">How it works</p>
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { icon: "upload_file", label: "1. Upload the document", sub: "PDF, image, or any file" },
              { icon: "fingerprint", label: "2. We compute SHA-256", sub: "Entirely in your browser — nothing is uploaded" },
              { icon: "verified", label: "3. Compare to on-chain hash", sub: "Paste the hash from the token metadata" },
            ].map((s) => (
              <div key={s.label} className="space-y-2">
                <div className="w-10 h-10 rounded-lg bg-[#112240] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[#64FFDA] text-[20px]">{s.icon}</span>
                </div>
                <p className="text-xs font-bold text-[#d8e2ff]">{s.label}</p>
                <p className="text-[10px] text-[#abb9d6]">{s.sub}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Upload zone */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragging ? "border-[#64FFDA] bg-[#64FFDA]/5" : "border-[rgba(100,255,218,0.2)] hover:border-[#64FFDA]/40 bg-[#091b39]"
          }`}
        >
          <input ref={fileRef} type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) processFile(f); }} />
          {fileName ? (
            <div className="space-y-2">
              <span className="material-symbols-outlined text-[#64FFDA] text-4xl">description</span>
              <p className="text-sm font-bold text-[#d8e2ff]">{fileName}</p>
              <p className="text-[10px] text-[#abb9d6]">Click to change file</p>
            </div>
          ) : (
            <div className="space-y-2">
              <span className="material-symbols-outlined text-[#abb9d6] text-4xl">upload_file</span>
              <p className="text-sm text-[#abb9d6]">Drop a file here or click to browse</p>
              <p className="text-[10px] text-[#ebbbb4]">Processed locally — never leaves your device</p>
            </div>
          )}
        </div>

        {/* Computed hash */}
        {hash && (
          <div className="bg-[#091b39] border border-[rgba(100,255,218,0.12)] rounded-xl p-4 space-y-1">
            <p className="text-[10px] font-mono text-[#64FFDA] uppercase tracking-wider">Computed SHA-256 fingerprint</p>
            <p className="font-mono text-xs text-[#d8e2ff] break-all">{hash}</p>
          </div>
        )}

        {/* Token hash input */}
        <div className="space-y-2">
          <label className="text-xs font-mono text-[#abb9d6] uppercase tracking-wider">
            On-chain document hash (from token metadata)
          </label>
          <input
            value={tokenHash}
            onChange={(e) => { setTokenHash(e.target.value); setResult(null); }}
            placeholder="Paste the document_hash from the CEP-78 token metadata..."
            className="w-full bg-[#091b39] border border-[rgba(100,255,218,0.2)] focus:border-[#64FFDA] rounded-xl px-4 py-3 text-xs font-mono text-[#d8e2ff] outline-none placeholder:text-[#abb9d6]/40"
          />
        </div>

        <button
          onClick={verify}
          disabled={!hash || !tokenHash.trim()}
          className="w-full py-3 bg-[#FF0000] text-white font-bold text-sm rounded-xl hover:brightness-110 active:scale-95 transition-all disabled:opacity-40"
        >
          Verify Document
        </button>

        {result && (
          <div className={`p-5 rounded-xl border ${result === "match" ? "bg-[#00C853]/10 border-[#00C853]/30" : "bg-[#FF0000]/10 border-[#FF0000]/30"}`}>
            <div className="flex items-center gap-3">
              <span className={`material-symbols-outlined text-3xl ${result === "match" ? "text-[#00C853]" : "text-[#FF0000]"}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                {result === "match" ? "verified" : "cancel"}
              </span>
              <div>
                <p className={`font-bold text-sm ${result === "match" ? "text-[#00C853]" : "text-[#FF0000]"}`}>
                  {result === "match" ? "Document verified — hashes match" : "Verification failed — hashes do not match"}
                </p>
                <p className="text-xs text-[#abb9d6] mt-0.5">
                  {result === "match"
                    ? "This document is the exact file that was anchored on Casper testnet at token mint time."
                    : "The uploaded file does not match the on-chain record. The document may have been modified."}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <Link href="/chat" className="text-xs text-[#64FFDA] hover:underline">
            Tokenize a new asset →
          </Link>
        </div>
      </div>
    </AppLayout>
  );
}

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyPageInner />
    </Suspense>
  );
}
