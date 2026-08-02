import React, { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { C, F } from "../lib/theme";
import { extractText, guessDocType } from "../lib/parse";
import { supabase, hasSupabase } from "../lib/supabase";
import { resolveAssessment } from "../lib/queries";
import {
  PencilLine, UploadCloud, FileText, Check, Loader2, ChevronRight,
  Sparkles, AlertCircle, Cloud, HardDrive,
} from "lucide-react";

// Families → we draft control-by-control. For a first pass we walk a
// representative set; the edge function handles one control per call.
const SEED_CONTROLS = ["ac-2","ac-3","ac-6","au-2","au-6","cm-2","cm-6","ia-2","ia-5","sc-7","sc-13","si-2","si-4"];

export default function Ingest() {
  const { sys } = useOutletContext();
  const nav = useNavigate();
  const [file, setFile] = useState(null);
  const [text, setText] = useState("");
  const [docType, setDocType] = useState("ssp");
  const [phase, setPhase] = useState("idle"); // idle|parsing|parsed|drafting|done|error
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function onFile(f) {
    if (!f) return;
    setErr(""); setFile(f); setDocType(guessDocType(f.name)); setPhase("parsing");
    try {
      const t = await extractText(f);
      setText(t);
      setPhase("parsed");
    } catch (e) {
      setErr(String(e.message || e)); setPhase("error");
    }
  }

  async function runDraft() {
    if (!hasSupabase) {
      setErr("Connect Supabase to run AI drafting (mock mode can't call the edge function).");
      setPhase("error"); return;
    }
    setPhase("drafting");
    const assessment = await resolveAssessment(sys.name);
    setProgress({ done: 0, total: SEED_CONTROLS.length });
    for (let i = 0; i < SEED_CONTROLS.length; i++) {
      try {
        await supabase.functions.invoke("ingest-document", {
          body: {
            assessment_id: assessment,
            control_id: SEED_CONTROLS[i],
            extracted_text: text,
          },
        });
      } catch (e) { /* keep going; one control failing shouldn't halt all */ }
      setProgress({ done: i + 1, total: SEED_CONTROLS.length });
    }
    setPhase("done");
  }

  return (
    <div>
      <Header />
      <div style={{ padding: "28px 44px", maxWidth: 860 }}>
        {/* source options — upload live, connectors as "coming" */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 26 }}>
          <SourceCard active Icon={HardDrive} title="Upload a file"
            note=".docx · .pdf · .txt · .md" />
          <SourceCard Icon={Cloud} title="SharePoint" note="Connector — coming" dim />
          <SourceCard Icon={Cloud} title="Google Drive" note="Connector — coming" dim />
        </div>

        {/* dropzone */}
        {phase === "idle" || phase === "error" ? (
          <label style={{ display: "block", border: `2px dashed ${C.line}`, borderRadius: 14,
            padding: "48px 24px", textAlign: "center", cursor: "pointer", background: C.panel }}>
            <input type="file" accept=".docx,.pdf,.txt,.md" style={{ display: "none" }}
              onChange={(e) => onFile(e.target.files?.[0])} />
            <UploadCloud size={34} style={{ color: C.seal, marginBottom: 12 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>Drop your SSP, policy, or procedure</div>
            <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>
              Text is extracted in your browser — the original file is never stored.
            </div>
            {err && (
              <div style={{ marginTop: 14, fontSize: 13, color: "#B4402F", display: "flex",
                alignItems: "center", justifyContent: "center", gap: 6 }}>
                <AlertCircle size={15} /> {err}
              </div>
            )}
          </label>
        ) : null}

        {/* parsing / parsed */}
        {(phase === "parsing" || phase === "parsed" || phase === "drafting" || phase === "done") && (
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 14, background: C.panel,
            padding: "22px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.sealSoft,
                display: "grid", placeItems: "center" }}>
                <FileText size={20} style={{ color: C.seal }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{file?.name}</div>
                <div style={{ fontSize: 12.5, color: C.muted, fontFamily: F.mono }}>
                  {docType} · {text ? `${text.length.toLocaleString()} chars extracted` : "parsing…"}
                </div>
              </div>
              {phase === "parsing" && <Loader2 size={20} className="spin" style={{ color: C.seal }} />}
              {(phase === "parsed" || phase === "done") && <Check size={20} style={{ color: C.seal }} />}
            </div>

            {phase === "parsed" && (
              <button onClick={runDraft} style={{ width: "100%", background: C.seal, color: "#fff",
                border: "none", padding: "14px", borderRadius: 10, fontFamily: F.body, fontSize: 15,
                fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center",
                justifyContent: "center", gap: 8 }}>
                <Sparkles size={17} /> Draft narratives from this document
              </button>
            )}

            {phase === "drafting" && (
              <div>
                <div style={{ fontSize: 13.5, color: C.muted, marginBottom: 8, display: "flex",
                  alignItems: "center", gap: 8 }}>
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
              <div>
                <div style={{ fontSize: 14, color: C.seal, fontWeight: 600, marginBottom: 12,
                  display: "flex", alignItems: "center", gap: 8 }}>
                  <Check size={17} /> Drafts ready for {progress.total} controls
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
        <div style={{ width: 40, height: 40, borderRadius: 10, background: C.seal,
          display: "grid", placeItems: "center" }}>
          <PencilLine size={21} color="#fff" />
        </div>
        <div>
          <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, margin: 0,
            letterSpacing: "-0.02em" }}>Complete Docs</h1>
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
