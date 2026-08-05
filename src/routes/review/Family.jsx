import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { C, F } from "../../lib/theme";
import {
  getControlsInFamily, getObjectivesForControl, getProposals, acceptProposal,
  reviewEvidence, linkEvidence, getEvidenceForControl, resolveAssessment, getLinkedUrls,
  unlinkEvidence, editNarrative, removeNarrative, getNarratives,
  getGoverningDocs, editGoverningSection, setGoverningStatus,
  getDocsForControl, getSarForControl,
  runReconcile, getReconciliation,
} from "../../lib/queries";
import {
  ChevronLeft, CircleCheck, CircleDashed, CircleAlert, FileText, Paperclip,
  Sparkles, Check, X, Pencil, Loader2, Link2, Plus, ExternalLink, Cloud,
  Image as ImageIcon, Eye, Trash2, Save, FileStack, ChevronDown, BadgeCheck,
  ShieldCheck, AlertTriangle, Lightbulb, Scale, RefreshCw, CircleCheck as CircleCheck2,
} from "lucide-react";

const COVER = {
  satisfied: { c: C.seal,  Icon: CircleCheck,  label: "Satisfied" },
  partial:   { c: C.claim, Icon: CircleAlert,  label: "Partial" },
  gap:       { c: C.faint, Icon: CircleDashed, label: "Gap" },
};

const ARTIFACT_TYPES = [
  ["config_export","Config export"],["screenshot","Screenshot"],["log_sample","Log sample"],
  ["interview_note","Interview note"],["attestation","Attestation"],["inventory","Inventory"],
  ["csp_package_ref","CSP package ref"],["diagram","Diagram"],
];

export default function Family() {
  const { family } = useParams();
  const nav = useNavigate();
  const { sys } = useOutletContext();
  const [controls, setControls] = useState([]);
  const [openControl, setOpenControl] = useState(null);
  const [objs, setObjs] = useState([]);
  const [proposals, setProposals] = useState({});
  const [evidence, setEvidence] = useState({}); // objective_id -> [artifacts]
  const [narratives, setNarratives] = useState({}); // objective_id -> approved text
  const [govDocs, setGovDocs] = useState([]);
  const [sarRows, setSarRows] = useState([]);
  const [recon, setRecon] = useState(null);
  const [reconBusy, setReconBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true; setLoading(true);
    getControlsInFamily(family, sys.name).then((cs) => {
      if (!alive) return;
      setControls(cs); setOpenControl(cs[0]?.control_id || null); setLoading(false);
    });
    return () => { alive = false; };
  }, [family, sys.name]);

  const loadControl = useCallback(async () => {
    if (!openControl) { setObjs([]); setProposals({}); setEvidence({}); return; }
    const [o, props, ev, narrs, cdocs, rec, sar] = await Promise.all([
      getObjectivesForControl(openControl, sys.name),
      getProposals(openControl, sys.name),
      getEvidenceForControl(openControl, sys.name),
      getNarratives(openControl, sys.name),
      getDocsForControl(openControl, sys.name),
      getReconciliation(openControl, sys.name),
      getSarForControl(openControl),
    ]);
    setObjs(o);
    const byObj = {}; (props || []).forEach((p) => { byObj[p.objective_id] = p; });
    setProposals(byObj);
    const evByObj = {};
    (ev || []).forEach((e) => { (evByObj[e.objective_id] ||= []).push(e); });
    setEvidence(evByObj);
    setNarratives(narrs || {});
    setGovDocs(cdocs || []);
    setRecon(rec || null);
    // index SAR rows by normalized objective suffix for per-objective display
    const sarByObj = {};
    (sar || []).forEach((r) => { sarByObj[r.procedure_id] = r; });
    setSarRows(sar || []);
  }, [openControl, sys.name]);

  useEffect(() => { loadControl(); }, [loadControl]);

  async function onReconcile() {
    setReconBusy(true);
    try {
      const res = await runReconcile(openControl, sys.name);
      if (res && res.ok !== false) setRecon(res);
    } finally { setReconBusy(false); }
  }

  async function onAccept(proposal, finalText) {
    await acceptProposal(proposal.proposal_id, "duane.wilson@eccalon.com", finalText);
    await loadControl();
  }

  return (
    <div>
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, padding: "22px 44px" }}>
        <button onClick={() => nav("/review")} style={{ display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", fontFamily: F.body, fontSize: 13, color: C.muted,
          cursor: "pointer", marginBottom: 10, padding: 0 }}>
          <ChevronLeft size={15} /> All families
        </button>
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, margin: 0, letterSpacing: "-0.02em" }}>
          <span style={{ fontFamily: F.mono, color: C.seal, textTransform: "uppercase" }}>{family}</span>
          {"  "}Control Family
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "calc(100vh - 96px)" }}>
        <div style={{ borderRight: `1px solid ${C.line}`, background: C.panel, padding: "12px", overflowY: "auto" }}>
          {loading && <div style={{ padding: 14, fontSize: 13, color: C.faint }}>Loading…</div>}
          {controls.map((ctl) => {
            const active = openControl === ctl.control_id;
            return (
              <button key={ctl.control_id} onClick={() => setOpenControl(ctl.control_id)}
                style={{ width: "100%", textAlign: "left", padding: "11px 13px", borderRadius: 8,
                  border: "none", marginBottom: 3, background: active ? C.sealSoft : "transparent", cursor: "pointer" }}>
                <span style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 600,
                  color: active ? C.sealDk : C.ink, textTransform: "uppercase" }}>{ctl.control_id}</span>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 2, lineHeight: 1.35 }}>{ctl.title}</div>
                {ctl.objectives > 0 && (
                  <div style={{ fontSize: 11, color: C.faint, fontFamily: F.mono, marginTop: 3 }}>
                    {ctl.satisfied}/{ctl.objectives} satisfied
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ padding: "24px 40px", maxWidth: 860 }}>
          {openControl && (
            <ControlBox
              control={openControl}
              controlTitle={(controls.find((c) => c.control_id === openControl) || {}).title}
              satisfied={(controls.find((c) => c.control_id === openControl) || {}).satisfied}
              total={(controls.find((c) => c.control_id === openControl) || {}).objectives}
              recon={recon} reconBusy={reconBusy} onReconcile={onReconcile}
              docs={govDocs} sarRows={sarRows}
              objs={objs} proposals={proposals} evidence={evidence} narratives={narratives}
              onAccept={onAccept} sys={sys} reload={loadControl}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- evidence panel (per control) ---------------- */
function EvidencePanel({ control, sys, onLinked, compact }) {
  const [open, setOpen] = useState(false);
  const [urls, setUrls] = useState("");
  const [title, setTitle] = useState("");
  const [artifactType, setArtifactType] = useState("config_export");
  const [phase, setPhase] = useState("idle"); // idle|reviewing|matches|needsPaste|linking|done
  const [matches, setMatches] = useState([]);
  const [reviewFiles, setReviewFiles] = useState([]);
  const [alreadyLinked, setAlreadyLinked] = useState([]); // [{url, objectives:[]}]
  const [pasteText, setPasteText] = useState("");
  const [reason, setReason] = useState("");

  async function review(usePaste) {
    setPhase("reviewing"); setReason("");
    const urlList = urls.split(/\s*\n\s*/).map((u) => u.trim()).filter(Boolean);
    // heads-up: which pasted URLs are already linked on this control?
    if (!usePaste && urlList.length) {
      const linkedMap = await getLinkedUrls(control, sys.name);
      const dupes = urlList
        .filter((u) => linkedMap[u])
        .map((u) => ({ url: u, objectives: linkedMap[u] }));
      if (dupes.length) {
        setAlreadyLinked(dupes);
        // if EVERY pasted url is already linked, stop here — nothing new to review
        if (dupes.length === urlList.length) { setPhase("idle"); return; }
      } else {
        setAlreadyLinked([]);
      }
    }
    const res = await reviewEvidence(control, {
      urls: usePaste ? undefined : urlList,
      pasted_text: usePaste ? pasteText : undefined,
    });
    if (res.needs_paste) { setReason(res.reason || ""); setPhase("needsPaste"); return; }
    if (!res.ok) { setReason(res.reason || "Review failed."); setPhase("needsPaste"); return; }
    setReviewFiles(res.files || []);
    setMatches((res.matches || []).map((m) => ({ ...m, keep: true })));
    setPhase("matches");
  }

  async function confirm() {
    setPhase("linking");
    const assessment = await resolveAssessment(sys.name);
    for (const m of matches.filter((x) => x.keep)) {
      try {
        await linkEvidence(m.objective_id, {
          assessment,
          title: m.title || "Evidence",
          url: m.source_url || "",
          artifactType: m.artifact_type || "config_export",
          method: m.method,
          supports: m.observed || m.supports,
        }, sys.name);
      } catch (e) { /* continue */ }
    }
    setPhase("done");
    onLinked && onLinked();
  }

  function reset() {
    setUrls(""); setAlreadyLinked([]); setReviewFiles([]); setPasteText(""); setMatches([]); setReason("");
    setPhase("idle"); setOpen(false);
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 6,
        background: compact ? C.panel : C.sealSoft, border: `1px solid ${C.seal}`, borderRadius: 8,
        padding: compact ? "5px 11px" : "11px 16px", cursor: "pointer", fontFamily: F.body,
        fontSize: compact ? 12 : 13.5, fontWeight: 600, color: C.sealDk }}>
        <Link2 size={compact ? 13 : 16} /> {compact ? "Link evidence" : `Link evidence for ${(control||"").toUpperCase()}`}
      </button>
    );
  }

  return (
    <div style={{ border: `1.5px solid ${C.seal}`, borderRadius: 13, background: "#F4FAF9", padding: "18px 20px",
      ...(compact ? { position: "absolute", right: 40, marginTop: 6, width: 620, zIndex: 20,
        boxShadow: "0 8px 30px rgba(0,0,0,0.12)" } : {}) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Link2 size={16} style={{ color: C.seal }} />
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>Link evidence for {(control||"").toUpperCase()}</span>
        <button onClick={reset} style={{ marginLeft: "auto", background: "none", border: "none",
          cursor: "pointer", color: C.faint }}><X size={16} /></button>
      </div>

      {(phase === "idle" || phase === "reviewing") && (
        <>
          {alreadyLinked.length > 0 && (
            <div style={{ border: `1px solid ${C.claim}`, background: "#FBF3E0", borderRadius: 9,
              padding: "10px 12px", marginBottom: 10, fontSize: 12.5, color: C.ink }}>
              <div style={{ fontWeight: 600, color: C.claim, marginBottom: 4, display: "flex",
                alignItems: "center", gap: 6 }}>
                <Paperclip size={13} /> Already linked on {(control||"").toUpperCase()}
              </div>
              {alreadyLinked.map((d, i) => (
                <div key={i} style={{ lineHeight: 1.4, marginTop: 2 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 11 }}>
                    {d.url.length > 48 ? d.url.slice(0, 48) + "…" : d.url}
                  </span>
                  <span style={{ color: C.muted }}> → {d.objectives.join(", ")}</span>
                </div>
              ))}
              <div style={{ marginTop: 5, color: C.muted, fontStyle: "italic" }}>
                Remove these from the box to skip re-reviewing, or continue to review the rest.
              </div>
            </div>
          )}
          <textarea value={urls} onChange={(e) => setUrls(e.target.value)} rows={3}
            placeholder={"Paste one or more shared links — one per line\n(SharePoint / Drive / URL)"}
            style={{ ...inputS, marginBottom: 10, resize: "vertical", fontFamily: F.mono, fontSize: 12.5 }} />
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
            <Cloud size={13} /> Multiple files review together. Attesta reads them in place — files are never stored.
          </div>
          <button onClick={() => review(false)} disabled={!urls.trim() || phase === "reviewing"}
            style={{ ...btnS(!!urls.trim() && phase !== "reviewing") }}>
            {phase === "reviewing"
              ? <><Loader2 size={15} className="spin" /> Reviewing evidence…</>
              : <><Sparkles size={15} /> Review & match to objectives</>}
          </button>
        </>
      )}

      {phase === "needsPaste" && (
        <>
          <div style={{ fontSize: 13, color: C.claim, marginBottom: 10 }}>
            Couldn't read the link directly{reason ? ` — ${reason}` : ""}. Paste the evidence text and Attesta will review it.
          </div>
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={5}
            placeholder="Paste the relevant evidence content here"
            style={{ ...inputS, width: "100%", marginBottom: 12, resize: "vertical" }} />
          <button onClick={() => review(true)} disabled={!pasteText}
            style={btnS(!!pasteText)}><Sparkles size={15} /> Review pasted evidence</button>
        </>
      )}

      {phase === "matches" && (
        <>
          {reviewFiles.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, textTransform: "uppercase",
                letterSpacing: ".04em", marginBottom: 8 }}>Attesta read {reviewFiles.length} file{reviewFiles.length>1?"s":""}</div>
              {reviewFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "9px 11px",
                  background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, marginBottom: 6 }}>
                  <div style={{ marginTop: 1 }}>
                    {f.is_image
                      ? <ImageIcon size={15} style={{ color: C.seal }} />
                      : <FileText size={15} style={{ color: C.seal }} />}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{f.title}</span>
                      <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.seal, background: C.sealSoft,
                        padding: "1px 7px", borderRadius: 20 }}>{(f.artifact_type||"").replace("_"," ")}</span>
                      {f.is_image && <span style={{ fontFamily: F.mono, fontSize: 10, color: "#7A5C00",
                        background: "#FBF3E0", padding: "1px 7px", borderRadius: 20, display: "flex",
                        alignItems: "center", gap: 3 }}><Eye size={10} /> read by vision</span>}
                    </div>
                    {f.observed && <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.45,
                      fontStyle: "italic" }}>&ldquo;{f.observed}&rdquo;</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 10 }}>
            {matches.length ? `These map to ${matches.filter(m=>m.keep).length} objective${matches.filter(m=>m.keep).length>1?"s":""}:` : "No objectives matched this evidence."}
          </div>
          {matches.map((m, i) => (
            <label key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 12px",
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 9, marginBottom: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={m.keep}
                onChange={(e) => setMatches((prev) => prev.map((x, j) => j === i ? { ...x, keep: e.target.checked } : x))}
                style={{ marginTop: 3 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 12, color: C.seal, fontWeight: 600 }}>{m.objective_id}</span>
                  <span style={{ fontSize: 10.5, fontFamily: F.mono, color: C.muted, textTransform: "uppercase",
                    border: `1px solid ${C.line}`, borderRadius: 20, padding: "1px 7px" }}>{m.method}</span>
                  <span style={{ marginLeft: "auto", fontSize: 10.5, fontFamily: F.mono, color: C.faint,
                    textTransform: "uppercase" }}>{m.confidence}</span>
                </div>
                <div style={{ fontSize: 12.5, color: C.muted, marginTop: 3, lineHeight: 1.4 }}>{m.supports}</div>
                {m.title && <div style={{ fontSize: 11, color: C.faint, marginTop: 3, fontFamily: F.mono }}>
                  from: {m.title}</div>}
              </div>
            </label>
          ))}
          {matches.some((m) => m.keep) && (
            <button onClick={confirm} style={btnS(true)}><Check size={15} /> Link confirmed evidence</button>
          )}
        </>
      )}

      {phase === "linking" && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.muted }}>
          <Loader2 size={15} className="spin" style={{ color: C.seal }} /> Linking evidence…
        </div>
      )}

      {phase === "done" && (
        <div>
          <div style={{ fontSize: 14, color: C.seal, fontWeight: 600, marginBottom: 10, display: "flex",
            alignItems: "center", gap: 8 }}><Check size={16} /> Evidence linked. Coverage updated.</div>
          <button onClick={reset} style={{ ...btnS(true), background: C.panel, color: C.ink,
            border: `1px solid ${C.line}` }}><Plus size={15} /> Link more evidence</button>
        </div>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const inputS = {
  padding: "10px 12px", fontSize: 13.5, border: `1px solid ${C.line}`, borderRadius: 8,
  boxSizing: "border-box", fontFamily: F.body, color: C.ink, background: C.panel, width: "100%",
};
const btnS = (on) => ({
  display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%",
  background: on ? C.seal : C.lockBg, color: on ? "#fff" : C.faint, border: "none",
  padding: "12px", borderRadius: 9, fontFamily: F.body, fontSize: 14, fontWeight: 600,
  cursor: on ? "pointer" : "default",
});

/* ---------------- objective card ---------------- */
function ObjectiveCard({ o, proposal, evidence, approvedText, onAccept, sys, reload }) {
  const cov = COVER[o.coverage] || COVER.gap;
  const Icon = cov.Icon;
  const unproven = o.narrative_approved && !o.evidence_linked;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal?.draft_text || "");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [editingNarr, setEditingNarr] = useState(false);
  const [narrText, setNarrText] = useState(approvedText || "");
  const [narrBusy, setNarrBusy] = useState(false);
  useEffect(() => { setDraft(proposal?.draft_text || ""); }, [proposal?.proposal_id]);
  useEffect(() => { setNarrText(approvedText || ""); }, [approvedText]);

  async function saveNarr() {
    setNarrBusy(true);
    try { await editNarrative(o.objective_id, narrText, "duane.wilson@eccalon.com", sys.name); await reload(); setEditingNarr(false); }
    finally { setNarrBusy(false); }
  }
  async function removeNarr() {
    setNarrBusy(true);
    try { await removeNarrative(o.objective_id, sys.name); await reload(); setEditingNarr(false); }
    finally { setNarrBusy(false); }
  }
  async function unlink(artifactId) {
    try { await unlinkEvidence(o.objective_id, artifactId, sys.name); await reload(); } catch (e) {}
  }

  const showProposal = proposal && proposal.status === "proposed" && !dismissed;
  const hasEvidence = evidence && evidence.length > 0;

  async function accept() { setBusy(true); try { await onAccept(proposal, draft); } finally { setBusy(false); } }

  return (
    <div style={{ border: `1px solid ${showProposal ? C.seal : unproven ? C.claim : C.line}`,
      borderRadius: 11, padding: "16px 18px", marginBottom: 12,
      background: showProposal ? "#F4FAF9" : unproven ? "#FDFAF2" : C.panel }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.seal, fontWeight: 500 }}>{o.objective_id}</span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
          fontSize: 12, color: cov.c, fontWeight: 500 }}><Icon size={14} /> {cov.label}</span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 13 }}>{o.statement}</div>

      {showProposal ? (
        <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.seal,
            fontWeight: 600, marginBottom: 8 }}>
            <Sparkles size={13} /> AI-drafted narrative
            {proposal.confidence && <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 11,
              color: C.muted, textTransform: "uppercase" }}>{proposal.confidence} confidence</span>}
          </div>
          {editing ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4}
              style={{ ...inputS, lineHeight: 1.5, resize: "vertical" }} />
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: draft ? C.ink : C.faint,
              fontStyle: draft ? "normal" : "italic" }}>
              {draft || "The source documentation does not address this objective."}
            </div>
          )}
          {proposal.rationale && !editing && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontStyle: "italic" }}>{proposal.rationale}</div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
            <button onClick={accept} disabled={busy || !draft} style={{ display: "flex", alignItems: "center",
              gap: 6, background: draft ? C.seal : C.lockBg, color: draft ? "#fff" : C.faint, border: "none",
              padding: "8px 14px", borderRadius: 8, fontFamily: F.body, fontSize: 13, fontWeight: 600,
              cursor: draft ? "pointer" : "default" }}>
              {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Accept
            </button>
            <button onClick={() => setEditing((e) => !e)} style={{ display: "flex", alignItems: "center", gap: 6,
              background: C.panel, color: C.ink, border: `1px solid ${C.line}`, padding: "8px 14px",
              borderRadius: 8, fontFamily: F.body, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <Pencil size={14} /> {editing ? "Done" : "Edit"}
            </button>
            <button onClick={() => setDismissed(true)} style={{ display: "flex", alignItems: "center", gap: 6,
              background: "none", color: C.muted, border: "none", padding: "8px 10px", borderRadius: 8,
              fontFamily: F.body, fontSize: 13, cursor: "pointer" }}><X size={14} /> Reject</button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Chip on={o.narrative_approved} Icon={FileText} onLabel="Narrative approved" offLabel="No narrative" />
            <Chip on={o.evidence_linked || hasEvidence} Icon={Paperclip} onLabel="Evidence linked" offLabel="No evidence" warn={unproven} />
            {o.narrative_approved && !editingNarr && (
              <button onClick={() => { setEditingNarr(true); setNarrText(approvedText || ""); }}
                style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer",
                  color: C.seal, fontSize: 12, fontFamily: F.body, display: "flex", alignItems: "center", gap: 5 }}>
                <Pencil size={12} /> Edit narrative</button>
            )}
          </div>
          {editingNarr && (
            <div style={{ marginTop: 12, borderTop: `1px dashed ${C.line}`, paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.seal, marginBottom: 6 }}>Edit approved narrative</div>
              <textarea value={narrText} onChange={(e) => setNarrText(e.target.value)} rows={4}
                style={{ ...inputS, width: "100%", lineHeight: 1.5, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={saveNarr} disabled={narrBusy || !narrText.trim()}
                  style={{ display: "flex", alignItems: "center", gap: 6, background: narrText.trim() ? C.seal : C.lockBg,
                    color: narrText.trim() ? "#fff" : C.faint, border: "none", padding: "8px 14px", borderRadius: 8,
                    fontFamily: F.body, fontSize: 13, fontWeight: 600, cursor: narrText.trim() ? "pointer" : "default" }}>
                  {narrBusy ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save</button>
                <button onClick={() => setEditingNarr(false)} style={{ background: C.panel, color: C.ink,
                  border: `1px solid ${C.line}`, padding: "8px 14px", borderRadius: 8, fontFamily: F.body,
                  fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={removeNarr} disabled={narrBusy} style={{ marginLeft: "auto", background: "none",
                  color: "#B4402F", border: "none", padding: "8px 10px", borderRadius: 8, fontFamily: F.body,
                  fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Trash2 size={13} /> Remove narrative</button>
              </div>
            </div>
          )}
          {hasEvidence && (
            <div style={{ marginTop: 10, borderTop: `1px dashed ${C.line}`, paddingTop: 10 }}>
              {evidence.map((e) => (
                <div key={e.artifact_id} style={{ padding: "6px 0" }}>
                  <a href={e.url} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", color: C.ink, fontSize: 12.5 }}>
                    {e.artifact_type === "screenshot" || e.artifact_type === "diagram"
                      ? <ImageIcon size={13} style={{ color: C.seal }} />
                      : <Paperclip size={13} style={{ color: C.seal }} />}
                    <span style={{ fontWeight: 600 }}>{e.title}</span>
                    {e.artifact_type && <span style={{ fontFamily: F.mono, fontSize: 10, color: C.seal, background: C.sealSoft,
                      padding: "1px 6px", borderRadius: 20 }}>{(e.artifact_type||"").replace("_"," ")}</span>}
                    <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, textTransform: "uppercase",
                      border: `1px solid ${C.line}`, borderRadius: 20, padding: "1px 6px" }}>{e.method}</span>
                    <ExternalLink size={12} style={{ color: C.faint, marginLeft: "auto" }} />
                  </a>
                  {e.supports && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3, marginLeft: 21,
                    fontStyle: "italic", lineHeight: 1.4 }}>&ldquo;{e.supports}&rdquo;</div>}
                  <button onClick={() => unlink(e.artifact_id)} style={{ marginLeft: 21, marginTop: 2,
                    background: "none", border: "none", cursor: "pointer", color: C.faint, fontSize: 11,
                    fontFamily: F.body, display: "flex", alignItems: "center", gap: 4, padding: 0 }}>
                    <Trash2 size={11} /> Unlink</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!showProposal && unproven && !hasEvidence && (
        <div style={{ marginTop: 12, fontSize: 12.5, color: C.claim, fontStyle: "italic" }}>
          Narrative claims this, but no live evidence backs it. An assessor will test it.
        </div>
      )}
      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

function Chip({ on, Icon, onLabel, offLabel, warn }) {
  const col = on ? C.seal : warn ? C.claim : C.faint;
  const bg = on ? C.sealSoft : warn ? "#FBF3E0" : C.lockBg;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500,
      color: col, background: bg, padding: "5px 10px", borderRadius: 7 }}>
      <Icon size={13} /> {on ? onLabel : offLabel}
    </span>
  );
}

/* ---------------- governing documents (policy/procedure at -1 controls) ------- */
function GoverningDocs({ docs, reload }) {
  if (!docs || docs.length === 0) {
    return (
      <div style={{ marginTop: 22, border: `1px dashed ${C.line}`, borderRadius: 12,
        padding: "18px 20px", background: C.panel }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, color: C.muted }}>
          <FileStack size={16} style={{ color: C.faint }} />
          No policy or procedure on file for this family yet. Upload one in Complete Docs —
          Attesta will split it into sections here.
        </div>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, marginBottom: 8,
        textTransform: "uppercase", letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 6 }}>
        <FileStack size={13} /> Governing documents
      </div>
      {docs.map((d) => <GovDoc key={d.doc_id} doc={d} reload={reload} />)}
    </div>
  );
}

function GovDoc({ doc, reload }) {
  const [open, setOpen] = useState(true);
  const approved = doc.status === "approved";
  async function toggleApprove() {
    await setGoverningStatus(doc.doc_id, approved ? "draft" : "approved");
    await reload();
  }
  return (
    <div style={{ border: `1px solid ${approved ? C.seal : C.line}`, borderRadius: 12,
      background: C.panel, marginBottom: 12, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 16px",
        background: approved ? C.sealSoft : "transparent", cursor: "pointer" }}
        onClick={() => setOpen((v) => !v)}>
        <ChevronDown size={16} style={{ color: C.faint, transform: open ? "none" : "rotate(-90deg)",
          transition: ".15s" }} />
        <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.seal, background: C.sealSoft,
          padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" }}>{doc.doc_type}</span>
        <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{doc.title}</span>
        <button onClick={(e) => { e.stopPropagation(); toggleApprove(); }}
          style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: F.body, fontSize: 12.5,
            fontWeight: 600, border: `1px solid ${approved ? C.seal : C.line}`, borderRadius: 7,
            padding: "5px 11px", cursor: "pointer",
            background: approved ? C.seal : C.panel, color: approved ? "#fff" : C.ink }}>
          <BadgeCheck size={14} /> {approved ? "Approved" : "Approve"}
        </button>
      </div>
      {open && (
        <div style={{ padding: "6px 16px 14px" }}>
          {doc.sections.map((sec) => <GovSection key={sec.section_id} sec={sec} reload={reload} />)}
        </div>
      )}
    </div>
  );
}

function GovSection({ sec, reload }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sec.body_text || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(sec.body_text || ""); }, [sec.section_id]);
  async function save() {
    setBusy(true);
    try { await editGoverningSection(sec.section_id, text); await reload(); setEditing(false); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "12px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>{sec.heading}</span>
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ marginLeft: "auto", background: "none",
            border: "none", cursor: "pointer", color: C.seal, fontSize: 12, fontFamily: F.body,
            display: "flex", alignItems: "center", gap: 5 }}>
            <Pencil size={12} /> Edit
          </button>
        )}
      </div>
      {editing ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
            style={{ ...inputS, width: "100%", lineHeight: 1.5, resize: "vertical" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={save} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 6,
              background: C.seal, color: "#fff", border: "none", padding: "7px 13px", borderRadius: 7,
              fontFamily: F.body, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              {busy ? <Loader2 size={13} className="spin" /> : <Save size={13} />} Save
            </button>
            <button onClick={() => { setEditing(false); setText(sec.body_text || ""); }}
              style={{ background: C.panel, color: C.ink, border: `1px solid ${C.line}`, padding: "7px 13px",
                borderRadius: 7, fontFamily: F.body, fontSize: 12.5, cursor: "pointer" }}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 13, lineHeight: 1.55, color: text ? C.ink : C.faint,
          whiteSpace: "pre-wrap", fontStyle: text ? "normal" : "italic" }}>
          {text || "Empty section"}
        </div>
      )}
    </div>
  );
}

/* ---------------- reconcile panel (unified AI check) ---------------- */
const VERDICT = {
  met:        { c: C.seal,  bg: C.sealSoft, label: "Requirements met", Icon: CircleCheck2 },
  partial:    { c: C.claim, bg: "#FBF3E0",  label: "Partially met",    Icon: AlertTriangle },
  not_met:    { c: "#B4402F", bg: "#FBEAE6", label: "Not met",         Icon: AlertTriangle },
  consistent:    { c: C.seal, bg: C.sealSoft, label: "Consistent across documents", Icon: CircleCheck2 },
  issues_found:  { c: C.claim, bg: "#FBF3E0", label: "Consistency issues found",     Icon: AlertTriangle },
};

function ReconcilePanel({ control, recon, busy, onRun }) {
  const req = recon?.requirements;
  const con = recon?.consistency;
  const imp = recon?.improvements || [];
  const has = !!recon;

  return (
    <div style={{ marginTop: 24, border: `1.5px solid ${C.seal}`, borderRadius: 13,
      background: "#F4FAF9", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: has ? 16 : 4 }}>
        <Scale size={17} style={{ color: C.seal }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14.5, fontWeight: 600 }}>Reconcile {(control||"").toUpperCase()}</div>
          <div style={{ fontSize: 12.5, color: C.muted }}>
            Checks all documents together against the requirement, for consistency, and for improvements.
          </div>
        </div>
        <button onClick={onRun} disabled={busy}
          style={{ display: "flex", alignItems: "center", gap: 7, background: C.seal, color: "#fff",
            border: "none", padding: "9px 15px", borderRadius: 9, fontFamily: F.body, fontSize: 13.5,
            fontWeight: 600, cursor: busy ? "default" : "pointer" }}>
          {busy ? <Loader2 size={15} className="spin" /> : <RefreshCw size={15} />}
          {has ? "Re-run" : "Reconcile"}
        </button>
      </div>

      {busy && !has && (
        <div style={{ fontSize: 13, color: C.muted, display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 size={14} className="spin" style={{ color: C.seal }} /> Reading every document for this control…
        </div>
      )}

      {has && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* 1. requirements */}
          {req && <VerdictBlock title="Against requirements" verdict={req.verdict}
            body={req.detail} />}

          {/* 2. consistency */}
          {con && (
            <VerdictBlock title="Consistency across documents" verdict={con.verdict}
              body={con.verdict === "consistent" ? "No contradictions found across policy, procedure, plan, SSP, and evidence." : null}>
              {con.issues && con.issues.length > 0 && (
                <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                  {con.issues.map((iss, i) => (
                    <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
                      <span style={{ fontFamily: F.mono, fontSize: 11, color: C.claim,
                        background: "#FBF3E0", padding: "1px 7px", borderRadius: 20 }}>{iss.between}</span>
                      <span style={{ color: C.ink, marginLeft: 8 }}>{iss.problem}</span>
                    </div>
                  ))}
                </div>
              )}
            </VerdictBlock>
          )}

          {/* 3. improvements */}
          <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, padding: "13px 15px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, fontWeight: 600, marginBottom: imp.length ? 10 : 0 }}>
              <Lightbulb size={15} style={{ color: C.claim }} /> Suggested improvements
              <span style={{ fontFamily: F.mono, fontSize: 11, color: C.faint, marginLeft: "auto" }}>
                {imp.length ? `${imp.length}` : "none — looks solid"}
              </span>
            </div>
            {imp.map((s2, i) => (
              <div key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 11 : 0, marginTop: i ? 11 : 0 }}>
                <div style={{ fontFamily: F.mono, fontSize: 11, color: C.seal, marginBottom: 6 }}>{s2.layer}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Original</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.ink, background: "#FBEAE6",
                  borderRadius: 6, padding: "7px 10px", marginBottom: 8 }}>{s2.original}</div>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 2 }}>Suggested</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.ink, background: C.sealSoft,
                  borderRadius: 6, padding: "7px 10px", marginBottom: 6 }}>{s2.improved}</div>
                <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic", display: "flex", gap: 6 }}>
                  <Lightbulb size={12} style={{ color: C.claim, flexShrink: 0, marginTop: 2 }} /> {s2.why}
                </div>
              </div>
            ))}
          </div>

          {recon.ran_at && (
            <div style={{ fontSize: 11, color: C.faint, fontFamily: F.mono, textAlign: "right" }}>
              last run {new Date(recon.ran_at).toLocaleString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function VerdictBlock({ title, verdict, body, children }) {
  const v = VERDICT[verdict] || { c: C.faint, bg: C.lockBg, label: verdict, Icon: AlertTriangle };
  const Icon = v.Icon;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, padding: "13px 15px" }}>
      <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, textTransform: "uppercase",
        letterSpacing: ".04em", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
        color: v.c, background: v.bg, padding: "4px 11px", borderRadius: 20 }}>
        <Icon size={14} /> {v.label}
      </div>
      {body && <div style={{ fontSize: 12.5, lineHeight: 1.55, color: C.ink, marginTop: 9 }}>{body}</div>}
      {children}
    </div>
  );
}

/* ===================================================================
   UNIFIED CONTROL BOX — one container: reconcile + this control's
   documents + per-objective 7-layer stacks. Replaces the scattered view.
   =================================================================== */
const PANEL2 = "#F6F3EC";
const CLAIMSOFT = "#FAF1DD";
const DANGER = "#B4402F";

// Normalize a control id + objective suffix so SAR rows line up with objectives.
// SAR procedure_id like 'AC-02j.' ; objective_id like 'ac-2_obj.j'
function sarForObjective(sarRows, objectiveId) {
  if (!sarRows || !objectiveId) return null;
  const m = objectiveId.match(/_obj\.(.+)$/);
  if (!m) return null;
  const suffix = m[1].toLowerCase().replace(/\./g, "");
  // find a SAR row whose procedure suffix matches
  return sarRows.find((r) => {
    const pm = (r.procedure_id || "").match(/^[A-Z]{2}-\d+(.*)$/);
    if (!pm) return false;
    const psuffix = pm[1].toLowerCase().replace(/[^a-z0-9]/g, "");
    return psuffix === suffix || psuffix.startsWith(suffix);
  }) || null;
}

function ControlBox({ control, controlTitle, satisfied, total, recon, reconBusy, onReconcile,
  docs, sarRows, objs, proposals, evidence, narratives, onAccept, sys, reload }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span style={{ fontFamily: F.mono, fontSize: 13, color: C.sealDk, background: C.sealSoft,
          padding: "2px 9px", borderRadius: 20, textTransform: "uppercase" }}>{control}</span>
        <span style={{ fontSize: 19, fontWeight: 500 }}>{controlTitle}</span>
        {total > 0 && <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 12, color: C.muted }}>
          {satisfied} / {total} satisfied</span>}
      </div>
      <p style={{ fontSize: 13, color: C.muted, margin: "0 0 18px" }}>
        Everything for this control in one place — reconcile, its documents, and each objective's full stack.
      </p>

      <div style={{ border: `1.5px solid ${C.line}`, borderRadius: 14, background: C.panel, overflow: "hidden" }}>
        {/* 1 · reconcile */}
        <div style={{ borderBottom: `1px solid ${C.line}` }}>
          <ReconcilePanelInline control={control} recon={recon} busy={reconBusy} onRun={onReconcile} />
        </div>

        {/* 2 · this control's documents */}
        <div style={{ borderBottom: `1px solid ${C.line}`, padding: "16px 18px" }}>
          <div style={{ fontFamily: F.mono, fontSize: 11, color: C.faint, textTransform: "uppercase",
            letterSpacing: ".05em", marginBottom: 10, display: "flex", alignItems: "center", gap: 7 }}>
            <FileStack size={13} /> {control.toUpperCase()} documents
          </div>
          <ControlDocs docs={docs} reload={reload} />
        </div>

        {/* 3 · objectives */}
        <div style={{ padding: "16px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontFamily: F.mono, fontSize: 11, color: C.faint, textTransform: "uppercase",
              letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 7 }}>
              <BadgeCheck size={13} /> Objectives · {objs.length} total
            </div>
            <div style={{ marginLeft: "auto" }}>
              <EvidencePanel control={control} sys={sys} onLinked={reload} compact />
            </div>
          </div>
          {objs.map((o) => (
            <ObjectiveStack key={o.objective_id} o={o}
              proposal={proposals[o.objective_id]} evidence={evidence[o.objective_id]}
              approvedText={narratives[o.objective_id]} sar={sarForObjective(sarRows, o.objective_id)}
              onAccept={onAccept} sys={sys} reload={reload} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* documents for this control (policy/procedure/plan, via section mapping) */
function ControlDocs({ docs, reload }) {
  if (!docs || docs.length === 0) {
    return (
      <div style={{ fontSize: 12.5, color: C.muted, display: "flex", alignItems: "center", gap: 8,
        padding: "6px 0" }}>
        <FileStack size={15} style={{ color: C.faint }} />
        No policy or procedure text mapped to this control yet. Upload docs in Complete Docs —
        Attesta splits them and maps each section to the controls it addresses.
      </div>
    );
  }
  return <>{docs.map((d) => <ControlDoc key={d.doc_id} doc={d} reload={reload} />)}</>;
}

function ControlDoc({ doc, reload }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: PANEL2,
      marginBottom: 8, overflow: "hidden" }}>
      <div onClick={() => setOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 9,
        padding: "11px 13px", cursor: "pointer", background: open ? C.sealSoft : "transparent" }}>
        <ChevronDown size={15} style={{ color: C.faint, transform: open ? "none" : "rotate(-90deg)", transition: ".15s" }} />
        <span style={{ fontFamily: F.mono, fontSize: 10, color: C.sealDk, background: open ? C.panel : C.sealSoft,
          padding: "2px 8px", borderRadius: 20, textTransform: "uppercase" }}>{doc.doc_type}</span>
        <span style={{ fontSize: 13.5, fontWeight: 500 }}>{doc.title}</span>
        <span style={{ marginLeft: "auto", fontSize: 11.5, color: C.muted }}>{doc.sections.length} section{doc.sections.length !== 1 ? "s" : ""}</span>
      </div>
      {open && (
        <div style={{ padding: "2px 13px 12px" }}>
          {doc.sections.map((sec) => <ControlDocSection key={sec.section_id} sec={sec} reload={reload} />)}
        </div>
      )}
    </div>
  );
}

function ControlDocSection({ sec, reload }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sec.body_text || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setText(sec.body_text || ""); }, [sec.section_id]);
  async function save() {
    setBusy(true);
    try { await editGoverningSection(sec.section_id, text); await reload(); setEditing(false); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ borderTop: `1px solid ${C.line}`, padding: "9px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600 }}>{sec.heading}</span>
        {sec.confidence && sec.confidence !== "high" && (
          <span style={{ fontFamily: F.mono, fontSize: 9.5, color: C.claim, background: CLAIMSOFT,
            padding: "1px 6px", borderRadius: 20, textTransform: "uppercase" }}>{sec.confidence} match</span>
        )}
        {!editing && (
          <button onClick={() => setEditing(true)} style={{ marginLeft: "auto", background: "none",
            border: "none", cursor: "pointer", color: C.seal, fontSize: 11.5, fontFamily: F.body,
            display: "flex", alignItems: "center", gap: 5 }}><Pencil size={12} /> Edit</button>
        )}
      </div>
      {editing ? (
        <>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
            style={{ ...inputS, width: "100%", lineHeight: 1.5, resize: "vertical", marginTop: 6 }} />
          <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
            <button onClick={save} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 6,
              background: C.seal, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 7,
              fontFamily: F.body, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              {busy ? <Loader2 size={12} className="spin" /> : <Save size={12} />} Save</button>
            <button onClick={() => { setEditing(false); setText(sec.body_text || ""); }}
              style={{ background: C.panel, color: C.ink, border: `1px solid ${C.line}`, padding: "6px 12px",
                borderRadius: 7, fontFamily: F.body, fontSize: 12, cursor: "pointer" }}>Cancel</button>
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5, marginTop: 4, whiteSpace: "pre-wrap" }}>
          {text || <span style={{ fontStyle: "italic", color: C.faint }}>Empty section</span>}
        </div>
      )}
    </div>
  );
}

/* one objective as a labeled 7-layer stack; satisfied ones collapse to a line */
function ObjectiveStack({ o, proposal, evidence, approvedText, sar, onAccept, sys, reload }) {
  const hasEvidence = evidence && evidence.length > 0;
  const satisfied = o.coverage === "satisfied";
  const [open, setOpen] = useState(!satisfied);
  const [editingNarr, setEditingNarr] = useState(false);
  const [narrText, setNarrText] = useState(approvedText || "");
  const [narrBusy, setNarrBusy] = useState(false);
  const [evBusy, setEvBusy] = useState(false);
  useEffect(() => { setNarrText(approvedText || ""); }, [approvedText]);

  const status = satisfied
    ? { c: C.seal, Icon: CircleCheck2, label: "Satisfied" }
    : o.coverage === "partial"
    ? { c: C.claim, Icon: AlertTriangle, label: "Partial" }
    : { c: C.faint, Icon: null, label: "Gap" };

  async function saveNarr() {
    setNarrBusy(true);
    try { await editNarrative(o.objective_id, narrText, "duane.wilson@eccalon.com", sys.name); await reload(); setEditingNarr(false); }
    finally { setNarrBusy(false); }
  }
  async function unlink(artifactId) {
    setEvBusy(true);
    try { await unlinkEvidence(o.objective_id, artifactId, sys.name); await reload(); } finally { setEvBusy(false); }
  }

  if (!open) {
    return (
      <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, background: C.panel, marginBottom: 8 }}>
        <div onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8,
          padding: "11px 13px", cursor: "pointer" }}>
          <span style={{ fontFamily: F.mono, fontSize: 12, color: C.sealDk, fontWeight: 600 }}>{o.objective_id}</span>
          <span style={{ fontSize: 12.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis",
            whiteSpace: "nowrap", maxWidth: 420 }}>{o.statement}</span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: status.c, display: "flex", alignItems: "center", gap: 4 }}>
            {status.Icon && <status.Icon size={14} />} {status.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ border: `1px solid ${satisfied ? C.line : C.seal}`, borderRadius: 10,
      background: C.panel, marginBottom: 8, overflow: "hidden" }}>
      <div onClick={() => setOpen(false)} style={{ display: "flex", alignItems: "center", gap: 8,
        padding: "11px 13px", cursor: "pointer", background: C.sealSoft }}>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.sealDk, fontWeight: 600 }}>{o.objective_id}</span>
        <span style={{ marginLeft: "auto", fontSize: 12, color: status.c, display: "flex", alignItems: "center", gap: 4 }}>
          {status.Icon && <status.Icon size={14} />} {status.label}
        </span>
      </div>

      <div style={{ padding: "4px 13px 12px" }}>
        {/* 1 · NIST */}
        <Layer n="1" label="NIST 800-53 standard" accent>
          <div style={{ fontSize: 12.5, lineHeight: 1.5 }}>{o.statement}</div>
        </Layer>

        {/* 2 · FedRAMP SAR */}
        <Layer n="2" label="FedRAMP SAR requirement" sar>
          {sar ? (
            <>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, color: C.sealDk }}>{sar.objective}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" }}>
                {sar.parameter && <span style={{ fontFamily: F.mono, fontSize: 10, color: C.sealDk,
                  background: C.panel, padding: "1px 7px", borderRadius: 20 }}>param: {sar.parameter}</span>}
                {(sar.test_method || "").split(/,\s*/).filter(Boolean).map((m) => (
                  <span key={m} style={{ fontFamily: F.mono, fontSize: 10, color: C.muted,
                    border: `1px solid ${C.line}`, padding: "1px 7px", borderRadius: 20, textTransform: "uppercase" }}>{m}</span>
                ))}
              </div>
              {sar.addl_fedramp && <div style={{ fontSize: 11.5, color: C.claim, marginTop: 5 }}>
                + FedRAMP: {sar.addl_fedramp}</div>}
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.faint, fontStyle: "italic" }}>No SAR procedure mapped to this objective.</div>
          )}
        </Layer>

        {/* 3 · Draft SSP statement */}
        <Layer n="3" label="Draft SSP statement" action={
          o.narrative_approved && !editingNarr
            ? <button onClick={() => { setEditingNarr(true); setNarrText(approvedText || ""); }}
                style={miniBtn}><Pencil size={11} /> Edit</button>
            : null
        }>
          {editingNarr ? (
            <>
              <textarea value={narrText} onChange={(e) => setNarrText(e.target.value)} rows={4}
                style={{ ...inputS, width: "100%", lineHeight: 1.5, resize: "vertical" }} />
              <div style={{ display: "flex", gap: 8, marginTop: 7 }}>
                <button onClick={saveNarr} disabled={narrBusy || !narrText.trim()} style={{ display: "flex",
                  alignItems: "center", gap: 6, background: C.seal, color: "#fff", border: "none",
                  padding: "6px 12px", borderRadius: 7, fontFamily: F.body, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  {narrBusy ? <Loader2 size={12} className="spin" /> : <Save size={12} />} Save</button>
                <button onClick={() => setEditingNarr(false)} style={{ background: C.panel, color: C.ink,
                  border: `1px solid ${C.line}`, padding: "6px 12px", borderRadius: 7, fontFamily: F.body,
                  fontSize: 12, cursor: "pointer" }}>Cancel</button>
              </div>
            </>
          ) : approvedText ? (
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5 }}>{approvedText}</div>
          ) : proposal ? (
            <div>
              <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginBottom: 8 }}>{proposal.draft_text}</div>
              <button onClick={() => onAccept(proposal, proposal.draft_text)} style={{ display: "flex",
                alignItems: "center", gap: 6, background: C.seal, color: "#fff", border: "none",
                padding: "6px 12px", borderRadius: 7, fontFamily: F.body, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                <Check size={12} /> Approve draft</button>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: C.faint, fontStyle: "italic" }}>No narrative yet — draft from Complete Docs.</div>
          )}
        </Layer>

        {/* 4 · Evidence */}
        <Layer n="4" label="Evidence">
          {hasEvidence ? evidence.map((e) => (
            <div key={e.artifact_id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, marginTop: 3 }}>
              {e.artifact_type === "screenshot" || e.artifact_type === "diagram"
                ? <ImageIcon size={13} style={{ color: C.seal }} />
                : <Paperclip size={13} style={{ color: C.seal }} />}
              <a href={e.url} target="_blank" rel="noreferrer" style={{ fontWeight: 500, color: C.ink,
                textDecoration: "none" }}>{e.title}</a>
              {e.artifact_type && <span style={{ fontFamily: F.mono, fontSize: 10, color: C.sealDk,
                background: C.sealSoft, padding: "1px 6px", borderRadius: 20 }}>{e.artifact_type.replace("_", " ")}</span>}
              <span style={{ fontFamily: F.mono, fontSize: 10, color: C.muted, border: `1px solid ${C.line}`,
                padding: "1px 6px", borderRadius: 20, textTransform: "uppercase" }}>{e.method}</span>
              <button onClick={() => unlink(e.artifact_id)} disabled={evBusy} style={{ ...miniBtn, marginLeft: "auto" }}>Unlink</button>
            </div>
          )) : (
            <div style={{ fontSize: 12, color: C.faint, fontStyle: "italic" }}>No evidence linked.</div>
          )}
        </Layer>
      </div>
    </div>
  );
}

const miniBtn = {
  border: `1px solid ${C.line}`, background: C.panel, borderRadius: 7, padding: "2px 9px",
  fontFamily: F.body, fontSize: 11, cursor: "pointer", color: C.ink,
  display: "inline-flex", alignItems: "center", gap: 4,
};

function Layer({ n, label, accent, sar, action, children }) {
  return (
    <div style={{ borderLeft: `2px solid ${accent || sar ? C.seal : C.line}`,
      background: sar ? C.sealSoft : "transparent", padding: "7px 0 7px 11px", marginTop: 9,
      paddingRight: sar ? 11 : 0, borderRadius: sar ? "0 6px 6px 0" : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
        <span style={{ fontFamily: F.mono, fontSize: 10, color: sar ? C.sealDk : C.muted,
          textTransform: "uppercase", letterSpacing: ".04em" }}>{n} · {label}</span>
        {action && <span style={{ marginLeft: "auto" }}>{action}</span>}
      </div>
      {children}
    </div>
  );
}

/* reconcile, restyled to sit flush inside the box top */
function ReconcilePanelInline({ control, recon, busy, onRun }) {
  const req = recon?.requirements, con = recon?.consistency, imp = recon?.improvements || [];
  const has = !!recon;
  return (
    <div style={{ background: C.sealSoft, padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Scale size={17} style={{ color: C.sealDk }} />
        <span style={{ fontWeight: 600, fontSize: 14, color: C.sealDk }}>Reconcile {(control || "").toUpperCase()}</span>
        {has && req && <Pill tone={req.verdict === "met" ? "ok" : "warn"}>requirements: {req.verdict}</Pill>}
        {has && con && <Pill tone={con.verdict === "consistent" ? "ok" : "warn"}>
          {con.verdict === "consistent" ? "consistent" : `${(con.issues || []).length} conflict${(con.issues||[]).length!==1?"s":""}`}</Pill>}
        {has && <Pill tone="info">{imp.length} suggestion{imp.length !== 1 ? "s" : ""}</Pill>}
        <button onClick={onRun} disabled={busy} style={{ marginLeft: "auto", display: "flex",
          alignItems: "center", gap: 6, background: C.seal, color: "#fff", border: "none",
          padding: "7px 13px", borderRadius: 8, fontFamily: F.body, fontSize: 12.5, fontWeight: 600,
          cursor: busy ? "default" : "pointer" }}>
          {busy ? <Loader2 size={14} className="spin" /> : <RefreshCw size={14} />} {has ? "Re-run" : "Reconcile"}
        </button>
      </div>

      {busy && !has && <div style={{ fontSize: 12.5, color: C.sealDk, marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
        <Loader2 size={13} className="spin" /> Reading every document for this control…</div>}

      {has && (
        <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
          {req?.detail && <div style={{ fontSize: 12.5, color: C.sealDk, lineHeight: 1.5 }}>{req.detail}</div>}
          {con?.issues?.length > 0 && con.issues.map((iss, i) => (
            <div key={i} style={{ fontSize: 12.5, lineHeight: 1.5 }}>
              <span style={{ fontFamily: F.mono, fontSize: 10.5, color: C.claim, background: CLAIMSOFT,
                padding: "1px 7px", borderRadius: 20 }}>{iss.between}</span>
              <span style={{ color: C.ink, marginLeft: 8 }}>{iss.problem}</span>
            </div>
          ))}
          {imp.length > 0 && (
            <div style={{ border: `1px solid ${C.line}`, borderRadius: 9, background: C.panel, padding: "11px 13px" }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                <Lightbulb size={13} style={{ color: C.claim }} /> Suggested improvements</div>
              {imp.map((s2, i) => (
                <div key={i} style={{ borderTop: i ? `1px solid ${C.line}` : "none", paddingTop: i ? 9 : 0, marginTop: i ? 9 : 0 }}>
                  <div style={{ fontFamily: F.mono, fontSize: 10.5, color: C.seal, marginBottom: 5 }}>{s2.layer}</div>
                  <div style={{ fontSize: 12, color: C.ink, background: "#FBEAE6", borderRadius: 6, padding: "6px 9px", marginBottom: 6, lineHeight: 1.45 }}>{s2.original}</div>
                  <div style={{ fontSize: 12, color: C.ink, background: C.sealSoft, borderRadius: 6, padding: "6px 9px", marginBottom: 5, lineHeight: 1.45 }}>{s2.improved}</div>
                  <div style={{ fontSize: 11.5, color: C.muted, fontStyle: "italic" }}>{s2.why}</div>
                </div>
              ))}
            </div>
          )}
          {recon.ran_at && <div style={{ fontSize: 10.5, color: C.faint, fontFamily: F.mono, textAlign: "right" }}>
            last run {new Date(recon.ran_at).toLocaleString()}</div>}
        </div>
      )}
    </div>
  );
}

function Pill({ tone, children }) {
  const styles = tone === "ok" ? { c: C.sealDk, bg: C.panel } : tone === "warn"
    ? { c: C.claim, bg: CLAIMSOFT } : { c: C.sealDk, bg: C.panel };
  return <span style={{ fontSize: 12, padding: "2px 10px", borderRadius: 20, color: styles.c, background: styles.bg }}>{children}</span>;
}
