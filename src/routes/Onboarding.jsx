import React, { useState, useMemo } from "react";
import {
  Compass, ChevronRight, ChevronLeft, Check, Server, Layers,
  FileText, Boxes, GitBranch, ShieldCheck, Info, Sparkles,
  CircleCheck, CircleDashed, ArrowRight, Building2
} from "lucide-react";

/* ============================================================
   ATTESTA — Stage 01 · Onboarding
   TurboTax model: questions BRANCH on prior answers. The plan's
   detail mirrors the detail of what the company tells us.
   Plain language up top; control-scoping logic underneath.
   ============================================================ */

import { C, F } from "../lib/theme";
import { saveOnboarding } from "../lib/queries";
import { useNavigate } from "react-router-dom";

/* ---- question graph ------------------------------------------------
   Each step declares `show(a)` — whether it applies given answers so
   far. That's the branching. `impact` lines feed the plan rationale.
------------------------------------------------------------------- */
const STEPS = [
  {
    id: "hosting", icon: Server,
    q: "Where does the system run?",
    help: "This sets your inheritance baseline — controls the platform already satisfies on your behalf.",
    options: [
      { v: "azure_gov", label: "Microsoft Azure Government", note: "FedRAMP High P-ATO" },
      { v: "aws_govcloud", label: "AWS GovCloud", note: "FedRAMP High P-ATO" },
      { v: "gcc_high", label: "Microsoft 365 GCC High", note: "FedRAMP High" },
      { v: "onprem", label: "On-premises / self-hosted", note: "No inherited baseline" },
      { v: "other", label: "Something else", note: "" },
    ],
  },
  {
    id: "service_model", icon: Layers,
    q: "What do you deliver to your customers?",
    help: "Service model shifts how many controls are yours versus shared with the platform.",
    options: [
      { v: "saas", label: "SaaS", note: "Application-level responsibility" },
      { v: "paas", label: "PaaS", note: "Platform + application" },
      { v: "iaas", label: "IaaS", note: "Most controls are yours" },
    ],
  },
  {
    id: "lisaas", icon: Boxes,
    q: "Is this a low-complexity SaaS with a small footprint?",
    help: "Li-SaaS is a lighter Class B path — fewer controls — for simple, low-impact offerings.",
    show: (a) => a.service_model === "saas",
    options: [
      { v: "yes", label: "Yes — single app, minimal infrastructure", note: "May qualify for Class B (Li-SaaS)" },
      { v: "no", label: "No — full offering", note: "Class C (Moderate-equivalent)" },
    ],
  },
  {
    id: "docs", icon: FileText,
    q: "What documentation do you already have?",
    help: "This decides your entry point: reconcile what exists, or generate from templates.",
    multi: true,
    options: [
      { v: "ssp", label: "A System Security Plan (SSP)", note: "" },
      { v: "policies", label: "Written policies & procedures", note: "" },
      { v: "crm", label: "A Customer Responsibility Matrix", note: "" },
      { v: "evidence", label: "Collected evidence / artifacts", note: "" },
      { v: "none", label: "Starting from scratch", note: "", exclusive: true },
    ],
  },
  {
    id: "ssp_state", icon: GitBranch,
    q: "How current is your SSP?",
    help: "A recent SSP means we reconcile; an old one means we refresh against the current Class C baseline.",
    show: (a) => (a.docs || []).includes("ssp"),
    options: [
      { v: "recent", label: "Current — updated this year", note: "Reconcile path" },
      { v: "stale", label: "Outdated — over a year old", note: "Refresh against 5.2.0" },
      { v: "unknown", label: "Not sure", note: "" },
    ],
  },
  {
    id: "inherit_parent", icon: Building2,
    q: "Does this system inherit from another you already run?",
    help: "If a parent system already carries controls, this one inherits them instead of re-documenting.",
    options: [
      { v: "yes_krome", label: "Yes — hosted within an existing system", note: "Inherit that system's posture" },
      { v: "no", label: "No — this is standalone", note: "" },
    ],
  },
];

export default function App() {
  const navigate = useNavigate();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState({});
  const [done, setDone] = useState(false);

  // visible steps given current answers (branching)
  const visible = useMemo(
    () => STEPS.filter((s) => !s.show || s.show(answers)),
    [answers]
  );
  const step = visible[i];
  const pct = Math.round((i / visible.length) * 100);

  function choose(v) {
    if (step.multi) {
      const cur = answers[step.id] || [];
      const opt = step.options.find((o) => o.v === v);
      let next;
      if (opt.exclusive) next = cur.includes(v) ? [] : [v];
      else next = cur.includes(v) ? cur.filter((x) => x !== v)
        : [...cur.filter((x) => !step.options.find((o) => o.v === x)?.exclusive), v];
      setAnswers({ ...answers, [step.id]: next });
    } else {
      setAnswers({ ...answers, [step.id]: v });
    }
  }

  function next() {
    if (i < visible.length - 1) setI(i + 1);
    else { setDone(true); }
  }
  function back() { if (i > 0) setI(i - 1); }

  const answered = step && (step.multi
    ? (answers[step.id] || []).length > 0
    : !!answers[step.id]);

  if (done) return <Plan answers={answers}
      onBack={() => { setDone(false); setI(visible.length - 1); }}
      onContinue={async () => { try { await saveOnboarding(answers, derivePlan(answers)); } catch (e) {} navigate("/review"); }} />;

  const Icon = step.icon;

  return (
    <div style={{ fontFamily: F.body, color: C.ink, background: C.paper,
      minHeight: "100vh", display: "flex", flexDirection: "column" }}>

      {/* top bar */}
      <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.line}`,
        background: C.panel, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: C.seal,
          display: "grid", placeItems: "center" }}>
          <ShieldCheck size={16} color="#fff" />
        </div>
        <span style={{ fontFamily: F.display, fontSize: 21, fontWeight: 600,
          letterSpacing: "-0.02em" }}>Attesta</span>
        <span style={{ marginLeft: 12, fontSize: 12, fontFamily: F.mono, color: C.faint,
          borderLeft: `1px solid ${C.line}`, paddingLeft: 12 }}>
          Stage 01 · Onboarding
        </span>
        <div style={{ marginLeft: "auto", fontSize: 12, color: C.muted, fontFamily: F.mono }}>
          {i + 1} / {visible.length}
        </div>
      </div>

      {/* progress */}
      <div style={{ height: 3, background: C.lockBg }}>
        <div style={{ width: `${pct}%`, height: "100%", background: C.seal,
          transition: "width .3s" }} />
      </div>

      {/* question */}
      <div style={{ flex: 1, display: "grid", placeItems: "center", padding: "40px 24px" }}>
        <div style={{ width: "100%", maxWidth: 560 }}>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: C.sealSoft,
            display: "grid", placeItems: "center", marginBottom: 22 }}>
            <Icon size={23} style={{ color: C.seal }} />
          </div>

          <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600,
            margin: "0 0 10px", letterSpacing: "-0.02em", lineHeight: 1.15 }}>
            {step.q}
          </h1>
          <p style={{ fontSize: 14.5, color: C.muted, margin: "0 0 26px", lineHeight: 1.5,
            display: "flex", gap: 8 }}>
            <Info size={16} style={{ color: C.faint, flexShrink: 0, marginTop: 2 }} />
            {step.help}
          </p>

          {step.multi && (
            <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, marginBottom: 10 }}>
              Select all that apply
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {step.options.map((o) => {
              const sel = step.multi
                ? (answers[step.id] || []).includes(o.v)
                : answers[step.id] === o.v;
              return (
                <button key={o.v} onClick={() => choose(o.v)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14, textAlign: "left",
                    padding: "15px 18px", borderRadius: 11, cursor: "pointer",
                    background: sel ? C.sealSoft : C.panel,
                    border: `1.5px solid ${sel ? C.seal : C.line}`,
                    transition: "all .12s",
                  }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: step.multi ? 5 : "50%",
                    border: `2px solid ${sel ? C.seal : C.faint}`,
                    background: sel ? C.seal : "transparent", flexShrink: 0,
                    display: "grid", placeItems: "center",
                  }}>
                    {sel && <Check size={12} color="#fff" strokeWidth={3} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500 }}>{o.label}</div>
                    {o.note && <div style={{ fontSize: 12.5, color: C.muted,
                      fontFamily: F.mono, marginTop: 2 }}>{o.note}</div>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* nav */}
          <div style={{ display: "flex", justifyContent: "space-between",
            marginTop: 30, alignItems: "center" }}>
            <button onClick={back} disabled={i === 0}
              style={{ display: "flex", alignItems: "center", gap: 6,
                background: "none", border: "none", fontFamily: F.body, fontSize: 14,
                color: i === 0 ? C.faint : C.muted, cursor: i === 0 ? "default" : "pointer" }}>
              <ChevronLeft size={17} /> Back
            </button>
            <button onClick={next} disabled={!answered}
              style={{ display: "flex", alignItems: "center", gap: 7,
                background: answered ? C.seal : C.lockBg,
                color: answered ? "#fff" : C.faint, border: "none",
                padding: "12px 22px", borderRadius: 9, fontFamily: F.body,
                fontSize: 14.5, fontWeight: 600, cursor: answered ? "pointer" : "default" }}>
              {i === visible.length - 1 ? "Build my plan" : "Continue"}
              <ArrowRight size={17} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- the tailored plan ---------------- */
function Plan({ answers, onBack, onContinue }) {
  // derive plan from answers — detail mirrors input
  const p = derivePlan(answers);

  return (
    <div style={{ fontFamily: F.body, color: C.ink, background: C.paper, minHeight: "100vh" }}>

      <div style={{ padding: "18px 28px", borderBottom: `1px solid ${C.line}`,
        background: C.panel, display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 6, background: C.seal,
          display: "grid", placeItems: "center" }}>
          <ShieldCheck size={16} color="#fff" />
        </div>
        <span style={{ fontFamily: F.display, fontSize: 21, fontWeight: 600,
          letterSpacing: "-0.02em" }}>Attesta</span>
        <button onClick={onBack} style={{ marginLeft: "auto", display: "flex",
          alignItems: "center", gap: 6, background: "none", border: `1px solid ${C.line}`,
          padding: "7px 13px", borderRadius: 8, fontSize: 13, color: C.muted,
          cursor: "pointer", fontFamily: F.body }}>
          <ChevronLeft size={15} /> Edit answers
        </button>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "40px 24px 70px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8,
          fontSize: 12, fontFamily: F.mono, color: C.seal, marginBottom: 12 }}>
          <Sparkles size={15} /> YOUR TAILORED PLAN
        </div>
        <h1 style={{ fontFamily: F.display, fontSize: 34, fontWeight: 600,
          margin: "0 0 8px", letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          {p.headline}
        </h1>
        <p style={{ fontSize: 15, color: C.muted, margin: "0 0 30px", lineHeight: 1.55 }}>
          {p.summary}
        </p>

        {/* the scope split */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12,
          marginBottom: 28 }}>
          <ScopeCard n={p.total} label="Controls in scope" sub={p.className} tone="ink" />
          <ScopeCard n={p.inherited} label="Inherited" sub="Platform carries these" tone="seal" />
          <ScopeCard n={p.yours} label="Your responsibility" sub="To document & prove" tone="claim" />
        </div>

        {/* responsibility bar */}
        <div style={{ background: C.panel, border: `1px solid ${C.line}`,
          borderRadius: 12, padding: "20px 22px", marginBottom: 28 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            Responsibility split
          </div>
          <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden",
            marginBottom: 12 }}>
            <div style={{ width: `${(p.inherited / p.total) * 100}%`, background: C.seal }} />
            <div style={{ width: `${(p.shared / p.total) * 100}%`, background: "#7FB0AD" }} />
            <div style={{ width: `${(p.yours / p.total) * 100}%`, background: C.claim }} />
          </div>
          <div style={{ display: "flex", gap: 20, fontSize: 12.5, color: C.muted,
            flexWrap: "wrap" }}>
            <Legend c={C.seal} t={`Inherited · ${p.inherited}`} />
            <Legend c="#7FB0AD" t={`Shared · ${p.shared}`} />
            <Legend c={C.claim} t={`Yours · ${p.yours}`} />
          </div>
        </div>

        {/* the plan steps — detail scales with input */}
        <h2 style={{ fontFamily: F.display, fontSize: 20, fontWeight: 600,
          margin: "0 0 4px" }}>Your path from here</h2>
        <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 18px" }}>
          {p.pathNote}
        </p>

        <div style={{ position: "relative", paddingLeft: 8 }}>
          {p.steps.map((s, idx) => (
            <div key={idx} style={{ display: "flex", gap: 14, paddingBottom: 18,
              position: "relative" }}>
              {idx < p.steps.length - 1 && (
                <div style={{ position: "absolute", left: 13, top: 28, bottom: 0,
                  width: 2, background: C.line }} />
              )}
              <div style={{ width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: s.now ? C.seal : C.panel,
                border: `2px solid ${s.now ? C.seal : C.line}`,
                display: "grid", placeItems: "center", zIndex: 1 }}>
                {s.now ? <CircleCheck size={15} color="#fff" />
                  : <CircleDashed size={15} style={{ color: C.faint }} />}
              </div>
              <div style={{ flex: 1, paddingTop: 2 }}>
                <div style={{ fontSize: 15, fontWeight: 600,
                  color: s.now ? C.ink : C.muted }}>
                  {s.title}
                  {s.now && <span style={{ fontSize: 11, fontFamily: F.mono,
                    color: C.seal, background: C.sealSoft, padding: "2px 8px",
                    borderRadius: 20, marginLeft: 8 }}>START HERE</span>}
                </div>
                <div style={{ fontSize: 13.5, color: C.muted, marginTop: 3,
                  lineHeight: 1.5 }}>{s.detail}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={onContinue} style={{ marginTop: 26, width: "100%", background: C.seal, color: "#fff",
          border: "none", padding: "16px", borderRadius: 11, fontFamily: F.body,
          fontSize: 15.5, fontWeight: 600, cursor: "pointer", display: "flex",
          alignItems: "center", justifyContent: "center", gap: 8 }}>
          {p.cta} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function ScopeCard({ n, label, sub, tone }) {
  const color = tone === "seal" ? C.seal : tone === "claim" ? C.claim : C.ink;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`,
      borderRadius: 11, padding: "16px 18px" }}>
      <div style={{ fontFamily: F.display, fontSize: 32, fontWeight: 600, color,
        lineHeight: 1 }}>{n}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>{label}</div>
      <div style={{ fontSize: 11.5, color: C.muted, marginTop: 1 }}>{sub}</div>
    </div>
  );
}
function Legend({ c, t }) {
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: c }} /> {t}
    </span>
  );
}

/* ---- plan derivation: output detail mirrors input detail -------- */
function derivePlan(a) {
  const liSaas = a.lisaas === "yes";
  const total = liSaas ? 156 : 322;
  const className = liSaas ? "FedRAMP Class B · Li-SaaS" : "FedRAMP Class C";

  // inheritance depends on hosting
  const hosted = ["azure_gov", "aws_govcloud", "gcc_high"].includes(a.hosting);
  const inheritsParent = a.inherit_parent === "yes_krome";
  let inherited = hosted ? Math.round(total * 0.12) : 0;
  if (inheritsParent) inherited += Math.round(total * 0.18);
  let shared = hosted ? Math.round(total * 0.42) : Math.round(total * 0.15);
  const yours = total - inherited - shared;

  const docs = a.docs || [];
  const hasSSP = docs.includes("ssp");
  const fromScratch = docs.includes("none");

  // headline + summary scale with what they told us
  let headline, summary, pathNote, cta;
  if (fromScratch) {
    headline = `${className}, built from the ground up`;
    summary = `You're starting fresh. Attesta will generate every template pre-filled from your profile, so you're editing rather than authoring from a blank page.`;
    pathNote = "Because you're starting without documentation, your path runs the full lifecycle.";
    cta = "Generate my templates";
  } else if (hasSSP && a.ssp_state === "recent") {
    headline = `${className} — reconciliation, not reconstruction`;
    summary = `You already have a current SSP. Attesta will ingest it, map each narrative to the ${total === 322 ? "1,386" : "~700"} Class ${liSaas ? "B" : "C"} objectives, and show you exactly which claims still need evidence.`;
    pathNote = "Because you have current documentation, you skip template generation and go straight to reconciliation.";
    cta = "Ingest my SSP";
  } else if (hasSSP) {
    headline = `${className} — refresh against the current baseline`;
    summary = `Your SSP predates catalog 5.2.0. Attesta will ingest what you have, flag what's changed under the current Class ${liSaas ? "B" : "C"} baseline, and pre-fill the gaps.`;
    pathNote = "Because your documentation needs refreshing, your path starts with ingest then fills forward.";
    cta = "Ingest & refresh";
  } else {
    headline = `${className} — fill the gaps you have`;
    summary = `You have some materials but no full SSP. Attesta will use what exists, generate the rest pre-filled, and route you into review.`;
    pathNote = "Your path uses existing materials where present and generates the remainder.";
    cta = "Start with what I have";
  }

  // steps — the ones marked now:true reflect their actual entry point
  const steps = [];
  if (fromScratch || !hasSSP) {
    steps.push({ title: "Generate templates", now: true,
      detail: `${yours + shared} controls' worth of documents, pre-filled from your hosting, service model, and boundary answers.` });
    steps.push({ title: "Complete the documents",
      detail: "Fill only what the profile couldn't infer — the specifics unique to your system." });
  } else {
    steps.push({ title: "Ingest your documentation", now: true,
      detail: `Attesta parses your SSP${docs.includes("policies") ? " and policies" : ""} into objective-level sections you can review.` });
    if (a.ssp_state === "stale") steps.push({ title: "Refresh against 5.2.0",
      detail: "Reconcile old control references against the current Class C baseline." });
  }
  steps.push({ title: "Collect evidence",
    detail: docs.includes("evidence")
      ? "Link the artifacts you already have; the agent gathers the rest from your systems."
      : "The evidence agent gathers artifacts from your connected systems." });
  steps.push({ title: "Review & reconcile",
    detail: "Confirm every narrative claim is backed by live evidence. Unproven claims surface here." });
  steps.push({ title: "Produce final documentation",
    detail: "Generate the assessment-ready package for your 3PAO." });
  steps.push({ title: "Continuous monitoring",
    detail: "Watch evidence freshness and get reminded when policy tasks come due." });

  return { headline, summary, pathNote, cta, total, inherited, shared, yours, className };
}
