import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { C, F } from "../lib/theme";
import { getPackageData } from "../lib/queries";
import { buildSSP, buildPolicies, buildPlans, buildEvidenceRegister, buildAll } from "../lib/buildPackage";
import { FileText, BookOpen, ClipboardList, Paperclip, Download, Loader2, Package } from "lucide-react";

export default function FinalDocs() {
  const { sys } = useOutletContext();
  const [pkg, setPkg] = useState(null);
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let live = true;
    getPackageData(null, sys?.name).then((d) => { if (live) setPkg(d); });
    return () => { live = false; };
  }, [sys?.name]);

  const stats = summarize(pkg);

  async function run(kind) {
    if (!pkg) return;
    setBusy(kind);
    try {
      if (kind === "ssp") await buildSSP(pkg, sys.name);
      else if (kind === "pol") await buildPolicies(pkg, sys.name);
      else if (kind === "plans") await buildPlans(pkg, sys.name);
      else if (kind === "ev") await buildEvidenceRegister(pkg, sys.name);
      else if (kind === "all") await buildAll(pkg, sys.name);
    } catch (e) { console.error(e); alert("Export failed — see console."); }
    finally { setBusy(null); }
  }

  return (
    <div style={{ padding: "28px 40px", maxWidth: 820 }}>
      <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, margin: "0 0 2px" }}>Final documentation</h1>
      <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 8px" }}>
        Assemble the assessment package for {sys?.name || "the system"}. Preliminary — for review inside and outside the tool.
      </p>
      <div style={{ display: "inline-block", fontSize: 11.5, fontFamily: F.mono, color: C.claim,
        background: "#FAF1DD", padding: "3px 10px", borderRadius: 20, marginBottom: 22 }}>
        PRELIMINARY · not a submission package
      </div>

      {!pkg && <div style={{ color: C.muted }}>Loading assessment data…</div>}

      {pkg && (
        <>
          <Deliverable Icon={FileText} title="SSP + Appendices"
            desc="System Security Plan: control narratives by family, plus a coverage-summary appendix."
            meta={`${stats.controls} controls · ${stats.objectives} objectives · ${stats.narratives} narratives`}
            busy={busy === "ssp"} onRun={() => run("ssp")} />

          <Deliverable Icon={BookOpen} title="Policies & Procedures"
            desc="Each policy and procedure reconstructed as a clean document from its stored sections, including edits made during review."
            meta={stats.policies + stats.procedures > 0 ? `${stats.policies} policies · ${stats.procedures} procedures` : "none uploaded yet"}
            busy={busy === "pol"} onRun={() => run("pol")} disabled={stats.policies + stats.procedures === 0} />

          <Deliverable Icon={ClipboardList} title="Plans"
            desc="Incident Response, Contingency, Configuration Management, and other plans — where applicable."
            meta={stats.plans > 0 ? `${stats.plans} plan(s)` : "none uploaded yet"}
            busy={busy === "plans"} onRun={() => run("plans")} disabled={stats.plans === 0} />

          <Deliverable Icon={Paperclip} title="Evidence Register"
            desc="Index of linked evidence — a summary table plus a per-control breakdown. Points to evidence; does not contain the files."
            meta={stats.evidence > 0 ? `${stats.evidence} item(s) linked` : "no evidence linked yet"}
            busy={busy === "ev"} onRun={() => run("ev")} disabled={stats.evidence === 0} />

          <div style={{ marginTop: 22, paddingTop: 20, borderTop: `1px solid ${C.line}` }}>
            <button onClick={() => run("all")} disabled={!!busy}
              style={{ display: "flex", alignItems: "center", gap: 9, background: C.seal, color: "#fff",
                border: "none", padding: "12px 20px", borderRadius: 10, fontFamily: F.body, fontSize: 14.5,
                fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
              {busy === "all" ? <Loader2 size={17} className="spin" /> : <Package size={17} />}
              Generate full package (all four)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Deliverable({ Icon, title, desc, meta, busy, onRun, disabled }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel,
      padding: "16px 18px", marginBottom: 12, display: "flex", gap: 14, alignItems: "flex-start",
      opacity: disabled ? 0.6 : 1 }}>
      <div style={{ width: 38, height: 38, borderRadius: 9, background: C.sealSoft, display: "grid",
        placeItems: "center", flexShrink: 0 }}>
        <Icon size={19} style={{ color: C.seal }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.5 }}>{desc}</div>
        <div style={{ fontSize: 11.5, fontFamily: F.mono, color: C.faint, marginTop: 6 }}>{meta}</div>
      </div>
      <button onClick={onRun} disabled={busy || disabled}
        style={{ display: "flex", alignItems: "center", gap: 6, background: disabled ? C.lockBg : C.panel,
          border: `1px solid ${disabled ? C.line : C.seal}`, color: disabled ? C.faint : C.sealDk,
          padding: "8px 14px", borderRadius: 8, fontFamily: F.body, fontSize: 13, fontWeight: 600,
          cursor: busy || disabled ? "default" : "pointer", flexShrink: 0 }}>
        {busy ? <Loader2 size={14} className="spin" /> : <Download size={14} />} {busy ? "Building…" : "Generate"}
      </button>
    </div>
  );
}

function summarize(pkg) {
  const s = { controls: 0, objectives: 0, narratives: 0, policies: 0, procedures: 0, plans: 0, evidence: 0 };
  if (!pkg) return s;
  const seenDocs = new Set();
  s.controls = pkg.length;
  pkg.forEach((c) => {
    (c.objectives || []).forEach((o) => {
      s.objectives++;
      if (o.narrative) s.narratives++;
      s.evidence += (o.evidence || []).length;
    });
    (c.documents || []).forEach((d) => {
      const k = d.title + "|" + d.doc_type;
      if (seenDocs.has(k)) return; seenDocs.add(k);
      if (d.doc_type === "policy") s.policies++;
      else if (d.doc_type === "procedure") s.procedures++;
      else if (d.doc_type === "plan") s.plans++;
    });
  });
  return s;
}
