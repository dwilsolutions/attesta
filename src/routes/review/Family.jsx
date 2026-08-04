import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { C, F } from "../../lib/theme";
import {
  getControlsInFamily, getObjectivesForControl, getProposals, acceptProposal,
  reviewEvidence, linkEvidence, getEvidenceForControl, resolveAssessment, getLinkedUrls,
  unlinkEvidence, editNarrative, removeNarrative, getNarratives,
  getGoverningDocs, editGoverningSection, setGoverningStatus,
} from "../../lib/queries";
import {
  ChevronLeft, CircleCheck, CircleDashed, CircleAlert, FileText, Paperclip,
  Sparkles, Check, X, Pencil, Loader2, Link2, Plus, ExternalLink, Cloud,
  Image as ImageIcon, Eye, Trash2, Save, FileStack, ChevronDown, BadgeCheck,
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
    const isDashOne = /-1$/.test(openControl);
    const [o, props, ev, narrs, gdocs] = await Promise.all([
      getObjectivesForControl(openControl, sys.name),
      getProposals(openControl, sys.name),
      getEvidenceForControl(openControl, sys.name),
      getNarratives(openControl, sys.name),
      isDashOne ? getGoverningDocs(family, sys.name) : Promise.resolve([]),
    ]);
    setObjs(o);
    const byObj = {}; (props || []).forEach((p) => { byObj[p.objective_id] = p; });
    setProposals(byObj);
    const evByObj = {};
    (ev || []).forEach((e) => { (evByObj[e.objective_id] ||= []).push(e); });
    setEvidence(evByObj);
    setNarratives(narrs || {});
    setGovDocs(gdocs || []);
  }, [openControl, sys.name]);

  useEffect(() => { loadControl(); }, [loadControl]);

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

        <div style={{ padding: "24px 40px", maxWidth: 820 }}>
          {openControl && (
            <EvidencePanel control={openControl} sys={sys} onLinked={loadControl} />
          )}

          {/-1$/.test(openControl) && (
            <GoverningDocs docs={govDocs} reload={loadControl} />
          )}

          <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, margin: "26px 0 6px",
            textTransform: "uppercase", letterSpacing: ".05em" }}>
            Determination statements · {openControl}
          </div>
          <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 18px", lineHeight: 1.5 }}>
            Each objective is reviewed independently. Narrative + evidence together mark it satisfied.
          </p>

          {objs.map((o) => (
            <ObjectiveCard key={o.objective_id} o={o} proposal={proposals[o.objective_id]}
              evidence={evidence[o.objective_id]} approvedText={narratives[o.objective_id]}
              onAccept={onAccept} sys={sys} reload={loadControl} />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---------------- evidence panel (per control) ---------------- */
function EvidencePanel({ control, sys, onLinked }) {
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
      <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 8,
        background: C.sealSoft, border: `1px solid ${C.seal}`, borderRadius: 10, padding: "11px 16px",
        cursor: "pointer", fontFamily: F.body, fontSize: 13.5, fontWeight: 600, color: C.sealDk }}>
        <Link2 size={16} /> Link evidence for {control.toUpperCase()}
      </button>
    );
  }

  return (
    <div style={{ border: `1.5px solid ${C.seal}`, borderRadius: 13, background: "#F4FAF9", padding: "18px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <Link2 size={16} style={{ color: C.seal }} />
        <span style={{ fontSize: 14.5, fontWeight: 600 }}>Link evidence for {control.toUpperCase()}</span>
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
                <Paperclip size={13} /> Already linked on {control.toUpperCase()}
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
                      padding: "1px 6px", borderRadius: 20 }}>{e.artifact_type.replace("_"," ")}</span>}
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
