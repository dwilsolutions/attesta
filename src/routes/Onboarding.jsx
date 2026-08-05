import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { C, F } from "../lib/theme";
import { extractText, guessDocType } from "../lib/parse";
import { supabase, hasSupabase } from "../lib/supabase";
import { saveOnboarding } from "../lib/queries";
import {
  Compass, ChevronRight, ChevronLeft, Check, Server, Layers, FileText,
  Boxes, Building2, ShieldCheck, Info, Sparkles, ArrowRight, UploadCloud,
  Loader2, FileStack, Pencil, CheckCircle2,
} from "lucide-react";

/* ============================================================
   ATTESTA — Stage 01 · Onboarding
   Fork at the top: have docs → upload → AI derives profile → confirm.
   Starting fresh → full branching wizard.
   ============================================================ */

export default function Onboarding() {
  const nav = useNavigate();
  const [mode, setMode] = useState(null); // null | "docs" | "fresh"

  if (mode === null) return <Fork onPick={setMode} />;
  if (mode === "docs") return <DocsPath onBack={() => setMode(null)} nav={nav} />;
  return <FreshWizard onBack={() => setMode(null)} nav={nav} />;
}

/* ---------------- shared chrome ---------------- */
function Shell({ children, step, total }) {
  return (
    <div style={{ fontFamily: F.body, color: C.ink, background: C.paper,
      minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.line}`, background: C.panel,
        display: "flex", alignItems: "center", gap: 10 }}>
        <div onClick={() => nav("/")} title="Back to dashboard"
          style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: C.seal,
            display: "grid", placeItems: "center" }}>
            <ShieldCheck size={16} color="#fff" />
          </div>
          <span style={{ fontFamily: F.display, fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>Attesta</span>
        </div>
        <span style={{ marginLeft: 12, fontSize: 12, fontFamily: F.mono, color: C.faint,
          borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>Stage 01 · Onboarding</span>
      </div>
      {children}
    </div>
  );
}

/* ---------------- the fork ---------------- */
function Fork({ onPick }) {
  return (
    <Shell>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 620 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.sealSoft,
            display: "grid", placeItems: "center", marginBottom: 22 }}>
            <Compass size={23} style={{ color: C.seal }} />
          </div>
          <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, margin: "0 0 10px",
            letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            Let's set up your compliance profile
          </h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: "0 0 26px", lineHeight: 1.5 }}>
            The fastest path depends on what you already have.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <PickCard Icon={FileStack} title="I have existing documentation"
              desc="Upload your SSP, policies, or CRM. Attesta reads them and fills in your profile — you just confirm."
              badge="Fastest" onClick={() => onPick("docs")} />
            <PickCard Icon={Compass} title="I'm starting from scratch"
              desc="Answer a few questions and Attesta builds your plan and generates pre-filled templates."
              onClick={() => onPick("fresh")} />
          </div>
        </div>
      </div>
    </Shell>
  );
}

function PickCard({ Icon, title, desc, badge, onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "flex-start", gap: 14,
      textAlign: "left", padding: "20px 22px", borderRadius: 13, cursor: "pointer",
      background: C.panel, border: `1.5px solid ${C.line}` }}>
      <div style={{ width: 42, height: 42, borderRadius: 10, background: C.sealSoft,
        display: "grid", placeItems: "center", flexShrink: 0 }}>
        <Icon size={21} style={{ color: C.seal }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span>
          {badge && <span style={{ fontSize: 11, fontFamily: F.mono, color: C.seal,
            background: C.sealSoft, padding: "2px 8px", borderRadius: 20 }}>{badge}</span>}
        </div>
        <div style={{ fontSize: 13.5, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>{desc}</div>
      </div>
      <ChevronRight size={20} style={{ color: C.faint, alignSelf: "center" }} />
    </button>
  );
}

/* ---------------- docs-first path ---------------- */
function DocsPath({ onBack, nav }) {
  const [docs, setDocs] = useState([]);
  const [phase, setPhase] = useState("upload"); // upload | extracting | confirm | saving
  const [profile, setProfile] = useState(null);

  async function onFiles(list) {
    const files = Array.from(list || []);
    if (!files.length) return;
    const seeded = files.map((f) => ({ name: f.name, docType: guessDocType(f.name),
      text: "", status: "parsing" }));
    setDocs((p) => [...p, ...seeded]);
    for (const f of files) {
      try {
        const t = await extractText(f);
        setDocs((p) => p.map((d) => d.name === f.name && d.status === "parsing"
          ? { ...d, text: t, status: "parsed" } : d));
      } catch (e) {
        setDocs((p) => p.map((d) => d.name === f.name && d.status === "parsing"
          ? { ...d, status: "error" } : d));
      }
    }
  }

  const parsed = docs.filter((d) => d.status === "parsed");

  async function derive() {
    setPhase("extracting");
    const corpus = parsed.map((d) => d.text).join("\n\n").slice(0, 14000);
    let p = { hosting: null, service_model: null, inherits_from_csp: null, system_name: null };
    if (hasSupabase) {
      try {
        const { data } = await supabase.functions.invoke("extract-profile", {
          body: { extracted_text: corpus },
        });
        if (data?.profile) p = data.profile;
      } catch (e) { /* fall through with nulls */ }
    }
    setProfile(p);
    setPhase("confirm");
  }

  async function confirmAndSave(finalProfile) {
    setPhase("saving");
    const plan = derivePlanFromProfile(finalProfile);
    try {
      await saveOnboarding(
        { system_name: finalProfile.system_name || "Krome", ...finalProfile, source: "docs" },
        plan,
      );
    } catch (e) { /* ignore in mock */ }
    nav("/complete-docs");
  }

  return (
    <Shell>
      <div style={{ flex: 1, padding: "32px 24px" }}>
        <div style={{ maxWidth: 620, margin: "0 auto" }}>
          <BackLink onClick={onBack} />

          {(phase === "upload" || phase === "extracting") && (
            <>
              <h1 style={{ fontFamily: F.display, fontSize: 27, fontWeight: 600, margin: "6px 0 8px",
                letterSpacing: "-0.02em" }}>Upload your documentation</h1>
              <p style={{ fontSize: 14, color: C.muted, margin: "0 0 22px", lineHeight: 1.5 }}>
                Your SSP, policies, or CRM. Attesta reads them to fill in your profile — nothing is stored.
              </p>

              {phase === "upload" && (
                <label style={{ display: "block", border: `2px dashed ${C.line}`, borderRadius: 14,
                  padding: docs.length ? "22px" : "44px 24px", textAlign: "center", cursor: "pointer",
                  background: C.panel, marginBottom: 16 }}>
                  <input type="file" accept=".docx,.pdf,.txt,.md" multiple style={{ display: "none" }}
                    onChange={(e) => onFiles(e.target.files)} />
                  <UploadCloud size={30} style={{ color: C.seal, marginBottom: 10 }} />
                  <div style={{ fontSize: 15, fontWeight: 600 }}>
                    {docs.length ? "Add more files" : "Drop your documents"}
                  </div>
                  <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>.docx · .pdf · .txt · .md</div>
                </label>
              )}

              {docs.length > 0 && (
                <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
                  overflow: "hidden", marginBottom: 16 }}>
                  {docs.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 16px", borderBottom: i < docs.length - 1 ? `1px solid ${C.line}` : "none" }}>
                      <FileText size={16} style={{ color: C.seal }} />
                      <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{d.name}</span>
                      {d.status === "parsing" && <Loader2 size={15} className="spin" style={{ color: C.seal }} />}
                      {d.status === "parsed" && <Check size={15} style={{ color: C.seal }} />}
                    </div>
                  ))}
                </div>
              )}

              {phase === "extracting" ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14,
                  color: C.muted, padding: "14px 0" }}>
                  <Loader2 size={17} className="spin" style={{ color: C.seal }} />
                  Reading your documents…
                </div>
              ) : (
                parsed.length > 0 && (
                  <button onClick={derive} style={{ width: "100%", background: C.seal, color: "#fff",
                    border: "none", padding: "14px", borderRadius: 10, fontFamily: F.body, fontSize: 15,
                    fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 8 }}>
                    <Sparkles size={16} /> Read documents & build my profile
                  </button>
                )
              )}
            </>
          )}

          {phase === "confirm" && profile && (
            <ConfirmProfile profile={profile} onConfirm={confirmAndSave} />
          )}

          {phase === "saving" && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, color: C.muted,
              padding: "40px 0" }}>
              <Loader2 size={17} className="spin" style={{ color: C.seal }} /> Setting up your assessment…
            </div>
          )}
        </div>
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </Shell>
  );
}

/* ---------------- confirm derived profile ---------------- */
const HOSTING_LABELS = {
  azure_gov: "Microsoft Azure Government", aws_govcloud: "AWS GovCloud",
  gcc_high: "Microsoft 365 GCC High", onprem: "On-premises", other: "Other",
};
const SERVICE_LABELS = { saas: "SaaS", paas: "PaaS", iaas: "IaaS" };

function ConfirmProfile({ profile, onConfirm }) {
  const [p, setP] = useState({
    hosting: profile.hosting || "",
    service_model: profile.service_model || "",
    inherits_from_csp: profile.inherits_from_csp,
    system_name: profile.system_name || "",
  });

  const derivedCount = ["hosting", "service_model"].filter((k) => profile[k]).length;

  function set(k, v) { setP((prev) => ({ ...prev, [k]: v })); }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, fontFamily: F.mono,
        color: C.seal, marginBottom: 12 }}>
        <Sparkles size={15} /> READ FROM YOUR DOCUMENTS
      </div>
      <h1 style={{ fontFamily: F.display, fontSize: 27, fontWeight: 600, margin: "0 0 8px",
        letterSpacing: "-0.02em" }}>Confirm your profile</h1>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 22px", lineHeight: 1.5 }}>
        {derivedCount > 0
          ? "Attesta pulled these from your documents. Check they're right, fill any blanks, and continue."
          : "Attesta couldn't determine these from your documents — please fill them in."}
      </p>

      <Field label="System name">
        <input value={p.system_name} onChange={(e) => set("system_name", e.target.value)}
          placeholder="e.g. Krome" style={inputStyle} />
      </Field>

      <Field label="Hosting environment" derived={!!profile.hosting}
        evidence={profile.evidence?.hosting}>
        <Select value={p.hosting} onChange={(v) => set("hosting", v)}
          options={Object.entries(HOSTING_LABELS)} />
      </Field>

      <Field label="Service model" derived={!!profile.service_model}
        evidence={profile.evidence?.service_model}>
        <Select value={p.service_model} onChange={(v) => set("service_model", v)}
          options={Object.entries(SERVICE_LABELS)} />
      </Field>

      <Field label="Inherits controls from a cloud provider?" derived={profile.inherits_from_csp !== null}>
        <Select value={p.inherits_from_csp === true ? "yes" : p.inherits_from_csp === false ? "no" : ""}
          onChange={(v) => set("inherits_from_csp", v === "yes")}
          options={[["yes", "Yes"], ["no", "No"]]} />
      </Field>

      <button onClick={() => onConfirm(p)} disabled={!p.hosting || !p.service_model}
        style={{ width: "100%", marginTop: 12, background: (p.hosting && p.service_model) ? C.seal : C.lockBg,
          color: (p.hosting && p.service_model) ? "#fff" : C.faint, border: "none", padding: "14px",
          borderRadius: 10, fontFamily: F.body, fontSize: 15, fontWeight: 600,
          cursor: (p.hosting && p.service_model) ? "pointer" : "default", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 8 }}>
        Confirm & continue to documents <ArrowRight size={16} />
      </button>
    </div>
  );
}

function Field({ label, derived, evidence, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 600 }}>{label}</span>
        {derived && <span style={{ fontSize: 10.5, fontFamily: F.mono, color: C.seal,
          background: C.sealSoft, padding: "2px 7px", borderRadius: 20, display: "flex",
          alignItems: "center", gap: 4 }}><Sparkles size={10} /> from docs</span>}
      </div>
      {children}
      {evidence && <div style={{ fontSize: 11.5, color: C.faint, fontStyle: "italic", marginTop: 5 }}>
        "{evidence}"</div>}
    </div>
  );
}

const inputStyle = {
  width: "100%", padding: "11px 13px", fontSize: 14, border: `1px solid ${C.line}`,
  borderRadius: 9, boxSizing: "border-box", fontFamily: F.body, color: C.ink,
};

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      style={{ ...inputStyle, cursor: "pointer", background: C.panel }}>
      <option value="">Select…</option>
      {options.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
    </select>
  );
}

function BackLink({ onClick }) {
  return (
    <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
      border: "none", fontFamily: F.body, fontSize: 13, color: C.muted, cursor: "pointer",
      marginBottom: 8, padding: 0 }}>
      <ChevronLeft size={15} /> Back
    </button>
  );
}

function derivePlanFromProfile(p) {
  const hosted = ["azure_gov", "aws_govcloud", "gcc_high"].includes(p.hosting);
  return {
    frameworkId: "fedramp-class-c",
    end_state: "3pao_readiness",
    hosting: p.hosting, service_model: p.service_model,
    inherits_from_csp: p.inherits_from_csp,
    summary: `${p.system_name || "System"} — FedRAMP Moderate, hosted on ${HOSTING_LABELS[p.hosting] || p.hosting}`,
  };
}

/* ---------------- starting-fresh wizard (unchanged branching) ---------------- */
const STEPS = [
  { id: "hosting", icon: Server, q: "Where does the system run?",
    help: "This sets your inheritance baseline — controls the platform already satisfies on your behalf.",
    options: [
      { v: "azure_gov", label: "Microsoft Azure Government", note: "FedRAMP High P-ATO" },
      { v: "aws_govcloud", label: "AWS GovCloud", note: "FedRAMP High P-ATO" },
      { v: "gcc_high", label: "Microsoft 365 GCC High", note: "FedRAMP High" },
      { v: "onprem", label: "On-premises / self-hosted", note: "No inherited baseline" },
      { v: "other", label: "Something else", note: "" },
    ] },
  { id: "service_model", icon: Layers, q: "What do you deliver to your customers?",
    help: "Service model shifts how many controls are yours versus shared with the platform.",
    options: [
      { v: "saas", label: "SaaS", note: "Application-level responsibility" },
      { v: "paas", label: "PaaS", note: "Platform + application" },
      { v: "iaas", label: "IaaS", note: "Most controls are yours" },
    ] },
  { id: "inherit_parent", icon: Building2, q: "Does this system inherit from another you run?",
    help: "If a parent system already carries controls, this one inherits them instead of re-documenting.",
    options: [
      { v: "yes_krome", label: "Yes — hosted within an existing system", note: "Inherit that system's posture" },
      { v: "no", label: "No — this is standalone", note: "" },
    ] },
];

function FreshWizard({ onBack, nav }) {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const step = STEPS[i];
  const answered = !!answers[step.id];
  const Icon = step.icon;

  async function finish() {
    const plan = { frameworkId: "fedramp-class-c", end_state: "3pao_readiness",
      hosting: answers.hosting, service_model: answers.service_model,
      summary: "New system — FedRAMP Moderate, starting from templates" };
    try { await saveOnboarding({ system_name: "New System", ...answers, source: "fresh" }, plan); }
    catch (e) {}
    nav("/templates");
  }

  return (
    <Shell>
      <div style={{ height: 3, background: C.lockBg }}>
        <div style={{ width: `${(i / STEPS.length) * 100}%`, height: "100%", background: C.seal, transition: "width .3s" }} />
      </div>
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <BackLink onClick={i === 0 ? onBack : () => setI(i - 1)} />
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.sealSoft,
            display: "grid", placeItems: "center", margin: "8px 0 22px" }}>
            <Icon size={23} style={{ color: C.seal }} />
          </div>
          <h1 style={{ fontFamily: F.display, fontSize: 29, fontWeight: 600, margin: "0 0 10px",
            letterSpacing: "-0.02em", lineHeight: 1.15 }}>{step.q}</h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: "0 0 26px", lineHeight: 1.5,
            display: "flex", gap: 8 }}>
            <Info size={16} style={{ color: C.faint, flexShrink: 0, marginTop: 2 }} />{step.help}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {step.options.map((o) => {
              const sel = answers[step.id] === o.v;
              return (
                <button key={o.v} onClick={() => setAnswers({ ...answers, [step.id]: o.v })}
                  style={{ display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                    padding: "15px 18px", borderRadius: 11, cursor: "pointer",
                    background: sel ? C.sealSoft : C.panel, border: `1.5px solid ${sel ? C.seal : C.line}` }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%",
                    border: `2px solid ${sel ? C.seal : C.faint}`, background: sel ? C.seal : "transparent",
                    flexShrink: 0, display: "grid", placeItems: "center" }}>
                    {sel && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{o.label}</div>
                    {o.note && <div style={{ fontSize: 12.5, color: C.muted, fontFamily: F.mono, marginTop: 2 }}>{o.note}</div>}
                  </div>
                </button>
              );
            })}
          </div>
          <button onClick={() => i < STEPS.length - 1 ? setI(i + 1) : finish()} disabled={!answered}
            style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 7, marginLeft: "auto",
              background: answered ? C.seal : C.lockBg, color: answered ? "#fff" : C.faint, border: "none",
              padding: "12px 22px", borderRadius: 9, fontFamily: F.body, fontSize: 14.5, fontWeight: 600,
              cursor: answered ? "pointer" : "default" }}>
            {i === STEPS.length - 1 ? "Build my plan" : "Continue"} <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </Shell>
  );
}
