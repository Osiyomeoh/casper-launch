"use client";
import { useState, useEffect } from "react";
import AppLayout from "../components/AppLayout";
import { useWallet } from "@/lib/wallet-context";
import type { AppSettings } from "@/lib/db";

export default function SettingsPage() {
  const wallet = useWallet();
  const [riskLevel, setRiskLevel] = useState(65);
  const [toggles, setToggles] = useState<Omit<AppSettings, "riskLevel">>({
    biometrics: true,
    twoFactor: true,
    pushNotifications: true,
    emailReports: false,
    autonomousYield: true,
    oracleRebalancing: true,
    complianceReporting: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then((s: AppSettings) => {
        setRiskLevel(s.riskLevel);
        setToggles({
          biometrics: s.biometrics,
          twoFactor: s.twoFactor,
          pushNotifications: s.pushNotifications,
          emailReports: s.emailReports,
          autonomousYield: s.autonomousYield,
          oracleRebalancing: s.oracleRebalancing,
          complianceReporting: s.complianceReporting,
        });
      })
      .catch(() => {});
  }, []);

  const toggle = (key: keyof typeof toggles) =>
    setToggles((prev) => ({ ...prev, [key]: !prev[key] }));

  async function handleSave() {
    setSaving(true);
    await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskLevel, ...toggles }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const Toggle = ({ k }: { k: keyof typeof toggles }) => (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input type="checkbox" checked={toggles[k]} onChange={() => toggle(k)} className="sr-only peer" />
      <div className="w-11 h-6 bg-[#253453] rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#64FFDA]"></div>
    </label>
  );

  const Section = ({ icon, title, badge, children }: { icon: string; title: string; badge?: string; children: React.ReactNode }) => (
    <div className="p-5 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.08)] space-y-4">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#64FFDA] text-lg">{icon}</span>
        <h2 className="font-bold text-sm">{title}</h2>
        {badge && <span className="ml-auto text-[10px] font-mono text-[#FF0000] border border-[#FF0000]/30 px-1.5 py-0.5 rounded">{badge}</span>}
      </div>
      {children}
    </div>
  );

  const Row = ({ label, sub, k }: { label: string; sub: string; k: keyof typeof toggles }) => (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-[10px] text-[#ebbbb4] font-mono mt-0.5">{sub}</p>
      </div>
      <Toggle k={k} />
    </div>
  );

  return (
    <AppLayout title="Settings" action={
      <button onClick={handleSave} disabled={saving}
        className="flex items-center gap-1.5 bg-[#FF0000] text-white px-4 py-2 rounded-lg text-xs font-bold hover:brightness-110 transition-all active:scale-95 disabled:opacity-60">
        <span className="material-symbols-outlined text-sm">{saved ? "check" : "save"}</span>
        {saved ? "Saved!" : saving ? "Saving…" : "Save Changes"}
      </button>
    }>
      <div className="p-4 md:p-8">
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Agent status card */}
          <div className="p-5 rounded-xl bg-[#112240] border border-[rgba(100,255,218,0.15)] flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#64FFDA]/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[#64FFDA] text-3xl">smart_toy</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">Monitor Agent v2.4</p>
              <p className="text-[10px] text-[#ebbbb4] font-mono">ID: AGT-MNT-0092</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00C853] animate-pulse"></span>
                <span className="text-[10px] text-[#00C853]">Online — System Nominal</span>
              </div>
            </div>
            <div className="hidden sm:grid grid-cols-3 gap-4 text-center shrink-0">
              {[
                { label: "Uptime", value: "99.97%" },
                { label: "Tasks Run", value: "1,284" },
                { label: "Last Sync", value: "2s ago" },
              ].map((s) => (
                <div key={s.label}>
                  <p className="text-sm font-bold text-[#d8e2ff]">{s.value}</p>
                  <p className="text-[9px] font-mono text-[#ebbbb4] uppercase">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Risk tolerance */}
            <Section icon="tune" title="Risk Tolerance">
              <div className="flex justify-between items-center">
                <span className="text-xs text-[#ebbbb4]">Conservative</span>
                <span className="font-mono text-lg font-bold text-[#64FFDA]">{riskLevel}%</span>
                <span className="text-xs text-[#ebbbb4]">Aggressive</span>
              </div>
              <input
                type="range" min={0} max={100} value={riskLevel}
                onChange={(e) => setRiskLevel(Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{ background: `linear-gradient(to right, #64FFDA ${riskLevel}%, #253453 ${riskLevel}%)` }}
              />
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: "Conservative", value: 30 },
                  { label: "Balanced",     value: 60 },
                  { label: "Aggressive",   value: 90 },
                ].map((p) => (
                  <button key={p.label} onClick={() => setRiskLevel(p.value)}
                    className={`text-[10px] font-mono py-1.5 rounded-lg border transition-all ${riskLevel === p.value ? "border-[#64FFDA] bg-[#64FFDA]/10 text-[#64FFDA]" : "border-[rgba(100,255,218,0.2)] text-[#ebbbb4] hover:border-[#64FFDA]/40"}`}>
                    {p.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Security */}
            <Section icon="shield" title="Security">
              <Row k="biometrics"  label="Biometric Authentication"  sub="Face ID / Touch ID login" />
              <div className="border-t border-[rgba(100,255,218,0.08)]" />
              <Row k="twoFactor"   label="Two-Factor Authentication" sub="Hardware key required" />
            </Section>

            {/* Notifications */}
            <Section icon="notifications" title="Notifications">
              <Row k="pushNotifications" label="Push Notifications" sub="Real-time agent alerts" />
              <div className="border-t border-[rgba(100,255,218,0.08)]" />
              <Row k="emailReports"      label="Email Reports"       sub="Daily performance digest" />
            </Section>

            {/* Agent overrides */}
            <Section icon="psychology" title="Agent Overrides" badge="ADVANCED">
              <p className="text-[11px] text-[#ebbbb4]">Configure autonomous agent behaviors for your portfolio.</p>
              <Row k="autonomousYield"      label="Autonomous Yield Trigger"       sub="Agent auto-initiates distributions" />
              <div className="border-t border-[rgba(100,255,218,0.08)]" />
              <Row k="oracleRebalancing"    label="Oracle-Driven Rebalancing"      sub="Rebalance based on oracle feeds" />
              <div className="border-t border-[rgba(100,255,218,0.08)]" />
              <Row k="complianceReporting"  label="Automated Compliance Reporting" sub="Submit reports on-chain" />
            </Section>

          </div>

          {/* Danger zone */}
          <div className="p-5 rounded-xl border border-[#FF0000]/20 space-y-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF0000] text-lg">warning</span>
              <h2 className="font-bold text-sm text-[#FF0000]">Danger Zone</h2>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => saveSettings({ autonomousYield: false, oracleRebalancing: false, complianceReporting: false })}
                className="flex-1 py-3 rounded-xl border border-[#FF0000]/30 text-[#FF0000] text-sm font-bold hover:bg-[#FF0000]/5 transition-colors"
              >
                Revoke Agent Access
              </button>
              <button
                onClick={async () => {
                  await wallet.disconnect();
                  window.location.href = "/";
                }}
                className="flex-1 py-3 rounded-xl bg-[#FF0000] text-white text-sm font-bold hover:brightness-110 active:scale-95 transition-all"
              >
                Disconnect Wallet
              </button>
            </div>
          </div>

        </div>
      </div>
    </AppLayout>
  );

  function saveSettings(patch: Partial<Omit<AppSettings, "riskLevel">>) {
    setToggles(prev => ({ ...prev, ...patch }));
    fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ riskLevel, ...toggles, ...patch }),
    }).catch(() => {});
  }
}
