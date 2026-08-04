import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { C, F } from "../lib/theme";
import { extractText, guessDocType } from "../lib/parse";
import { splitIntoSections } from "../lib/splitDoc";
import { inferFamily } from "../lib/inferFamily";
import { supabase, hasSupabase } from "../lib/supabase";
import { resolveAssessment, saveGoverningDoc } from "../lib/queries";
import {
  PencilLine, UploadCloud, FileText, Check, Loader2, ChevronRight,
  Sparkles, AlertCircle, Cloud, HardDrive, X, ChevronDown, FileStack,
} from "lucide-react";
import TemplateList from "../components/TemplateList.jsx";

const SEED_CONTROLS = ["ac-2","ac-3","ac-6","au-2","au-6","cm-2","cm-6","ia-2","ia-5","sc-7","sc-13","si-2","si-4"];

export default function Ingest() {
  const { sys } = useOutletContext();
  const nav = useNavigate();
  const [docs, setDocs] = useState([]);
  const [phase, setPhase] = useState("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showTemplates, setShowTemplates] = useState(false);

  async function onFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const seeded = files.map((f) => ({
      name: f.name, docType: guessDocType(f.name), text: "", chars: 0, status: "parsing", error: "",
    }));
    setDocs((prev) => [...prev, ...seeded]);
    for (let k = 0; k < files.length; k++) {
      const f = files[k];
      try {
        const t = await extractText(f);
        setDocs((prev) => prev.map((d) =>
          d.name === f.name && d.status === "parsing"
            ? { ...d, text: t, chars: t.length, status: "parsed" } : d));
      } catch (e) {
        setDocs((prev) => prev.map((d) =>
          d.name === f.name && d.status === "parsing"
            ? { ...d, status: "error", error: String(e.message || e) } : d));
      }
    }
  }

  function removeDoc(name) { setDocs((prev) => prev.filter((d) => d.name !== name)); }

  const parsed = docs.filter((d) => d.status === "parsed");
  const anyParsing = docs.some((d) => d.status === "parsing");

  async function runDraft() {
    if (!hasSupabase) {
      setDocs((prev) => prev.map((d) => ({ ...d, error: "Connect Supabase to run AI drafting." })));
      return;
    }
    if (!parsed.length) return;
    setPhase("drafting");
    const assessment = await resolveAssessment(sys.name);

    // Policies & procedures are the -1 controls: split by heading + save as
    // governing docs rather than drafting objective narratives from them.
    for (const d of parsed.filter((x) => x.docType === "policy" || x.docType === "procedure" || x.docType === "plan")) {
      const family = inferFamily(d.name) || inferFamily(d.text);
      if (!family) continue; // can't place it; leave for manual handling
      const sections = splitIntoSections(d.text);
      const title = d.name.replace(/\.[a-z0-9]+$/i, "").replace(/_/g, " ");
      try { await saveGoverningDoc(family, d.docType, title, sections, sys.name); } catch (e) {}
    }

    // Remaining docs (SSP/other) feed narrative drafting. If the upload was
    // ONLY policies/procedures, there's nothing to draft — finish here.
    const narrativeDocs = parsed.filter((x) => x.docType !== "policy" && x.docType !== "procedure" && x.docType !== "plan");
    if (narrativeDocs.length === 0) { setPhase("done"); return; }
    const corpus = narrativeDocs
      .map((d) => `### SOURCE: ${d.name} (${d.docType})\n${d.text}`).join("\n\n");
    setProgress({ done: 0, total: SEED_CONTROLS.length });
    for (let i = 0; i < SEED_CONTROLS.length; i++) {
      try {
        await supabase.functions.invoke("ingest-document", {
          body: { assessment_id: assessment, control_id: SEED_CONTROLS[i], extracted_text: corpus },
        });
      } catch (e) { /* keep going */ }
      setProgress({ done: i + 1, total: SEED_CONTROLS.length });
    }
    setPhase("done");
  }

  return (
    <div>
      <Header />
      <div style={{ padding: "28px 44px", maxWidth: 860 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 22 }}>
          <SourceCard active Icon={HardDrive} title="Upload files" note=".docx · .pdf · .txt · .md" />
          <SourceCard Icon={Cloud} title="SharePoint" note="Connector — coming" dim />
          <SourceCard Icon={Cloud} title="Google Drive" note="Connector — coming" dim />
        </div>

        {/* need a starting point? */}
        <div style={{ marginBottom: 18 }}>
          <button onClick={() => setShowTemplates((v) => !v)}
            style={{ display: "flex", alignItems: "center", gap: 8, background: "none", border: "none",
              cursor: "pointer", fontFamily: F.body, fontSize: 13.5, color: C.seal, fontWeight: 600, padding: "4px 0" }}>
            <FileStack size={16} /> Need a starting point? Download a template
            <ChevronDown size={15} style={{ transform: showTemplates ? "rotate(180deg)" : "none", transition: ".15s" }} />
          </button>
          {showTemplates && <div style={{ marginTop: 14 }}><TemplateList compact /></div>}
        </div>

        {phase === "idle" && (
          <label style={{ display: "block", border: `2px dashed ${C.line}`, borderRadius: 14,
            padding: docs.length ? "24px" : "48px 24px", textAlign: "center", cursor: "pointer",
            background: C.panel, marginBottom: docs.length ? 18 : 0 }}>
            <input type="file" accept=".docx,.pdf,.txt,.md" multiple style={{ display: "none" }}
              onChange={(e) => onFiles(e.target.files)} />
            <UploadCloud size={docs.length ? 26 : 34} style={{ color: C.seal, marginBottom: 10 }} />
            <div style={{ fontSize: docs.length ? 14 : 16, fontWeight: 600 }}>
              {docs.length ? "Add more files" : "Drop your SSP, policies, and procedures"}
            </div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              Select several at once. Text is extracted in your browser — originals are never stored.
            </div>
          </label>
        )}

        {docs.length > 0 && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.panel,
            overflow: "hidden", marginBottom: 18 }}>
            {docs.map((d, i) => (
              <div key={d.name + i} style={{ display: "flex", alignItems: "center", gap: 12,
                padding: "14px 18px", borderBottom: i < docs.length - 1 ? `1px solid ${C.line}` : "none" }}>
                <div style={{ width: 34, height: 34, borderRadius: 8, background: C.sealSoft,
                  display: "grid", placeItems: "center", flexShrink: 0 }}>
                  <FileText size={17} style={{ color: C.seal }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden",
                    textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.name}</div>
                  <div style={{ fontSize: 12, color: d.status === "error" ? "#B4402F" : C.muted, fontFamily: F.mono }}>
                    {d.status === "parsing" && "extracting…"}
                    {d.status === "parsed" && `${d.docType} · ${d.chars.toLocaleString()} chars`}
                    {d.status === "error" && d.error}
                  </div>
                </div>
                {d.status === "parsing" && <Loader2 size={18} className="spin" style={{ color: C.seal }} />}
                {d.status === "parsed" && <Check size={18} style={{ color: C.seal }} />}
                {d.status === "error" && <AlertCircle size={18} style={{ color: "#B4402F" }} />}
                {phase === "idle" && (
                  <button onClick={() => removeDoc(d.name)} style={{ background: "none", border: "none",
                    cursor: "pointer", padding: 4, color: C.faint }}><X size={16} /></button>
                )}
              </div>
            ))}
          </div>
        )}

        {phase === "idle" && parsed.length > 0 && (
          <button onClick={runDraft} disabled={anyParsing}
            style={{ width: "100%", background: anyParsing ? C.lockBg : C.seal,
              color: anyParsing ? C.faint : "#fff", border: "none", padding: "15px", borderRadius: 10,
              fontFamily: F.body, fontSize: 15, fontWeight: 600, cursor: anyParsing ? "default" : "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Sparkles size={17} />
            {anyParsing ? "Waiting for files to finish…"
              : `Draft narratives from ${parsed.length} document${parsed.length > 1 ? "s" : ""}`}
          </button>
        )}

        {phase === "drafting" && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.panel, padding: "22px 24px" }}>
            <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <Loader2 size={15} className="spin" style={{ color: C.seal }} />
              Drafting narratives — control {progress.done} of {progress.total}
            </div>
            <div style={{ height: 6, background: C.lockBg, borderRadius: 3, overflow: "hidden" }}>
              <div style={{ width: `${(progress.done / progress.total) * 100}%`, height: "100%",
                background: C.seal, transition: "width .3s" }} />
            </div>
          </div>
        )}

        {phase === "done" && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.panel, padding: "22px 24px" }}>
            <div style={{ fontSize: 14, color: C.seal, fontWeight: 600, marginBottom: 12,
              display: "flex", alignItems: "center", gap: 8 }}>
              <Check size={17} /> Drafts ready for {progress.total} controls, from {parsed.length} document{parsed.length > 1 ? "s" : ""}
            </div>
            <button onClick={() => nav("/review")} style={{ width: "100%", background: C.seal,
              color: "#fff", border: "none", padding: "14px", borderRadius: 10, fontFamily: F.body,
              fontSize: 15, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
              justifyContent: "center", gap: 8 }}>
              Review the proposed narratives <ChevronRight size={17} />
            </button>
          </div>
        )}
      </div>
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Header() {
  return (
    <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, padding: "26px 44px 22px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.faint,
        fontFamily: F.mono, marginBottom: 8 }}>
        <span>Krome</span><ChevronRight size={13} /><span>Stage 04</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.seal, display: "grid", placeItems: "center" }}>
          <PencilLine size={21} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>Complete Docs</h1>
          <p style={{ margin: "3px 0 0", fontSize: 14, color: C.muted }}>
            Upload existing documentation — Attesta drafts a narrative per objective
          </p>
        </div>
      </div>
    </div>
  );
}

function SourceCard({ Icon, title, note, active, dim }) {
  return (
    <div style={{ border: `1.5px solid ${active ? C.seal : C.line}`, borderRadius: 11,
      padding: "14px 16px", background: active ? C.sealSoft : C.panel, opacity: dim ? 0.6 : 1 }}>
      <Icon size={18} style={{ color: active ? C.seal : C.faint, marginBottom: 8 }} />
      <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
      <div style={{ fontSize: 11.5, color: C.muted, fontFamily: F.mono, marginTop: 2 }}>{note}</div>
    </div>
  );
}
