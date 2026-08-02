import React, { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { C, F } from "../../lib/theme";
import {
  getControlsInFamily, getObjectivesForControl, getProposals, acceptProposal,
} from "../../lib/queries";
import {
  ChevronLeft, CircleCheck, CircleDashed, CircleAlert, FileText, Paperclip,
  Sparkles, Check, X, Pencil, Loader2,
} from "lucide-react";

const COVER = {
  satisfied: { c: C.seal,  Icon: CircleCheck,  label: "Satisfied" },
  partial:   { c: C.claim, Icon: CircleAlert,  label: "Partial" },
  gap:       { c: C.faint, Icon: CircleDashed, label: "Gap" },
};

export default function Family() {
  const { family } = useParams();
  const nav = useNavigate();
  const { sys } = useOutletContext();
  const [controls, setControls] = useState([]);
  const [openControl, setOpenControl] = useState(null);
  const [objs, setObjs] = useState([]);
  const [proposals, setProposals] = useState({}); // objective_id -> proposal
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getControlsInFamily(family, sys.name).then((cs) => {
      if (!alive) return;
      setControls(cs);
      setOpenControl(cs[0]?.control_id || null);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [family, sys.name]);

  const loadControl = useCallback(async () => {
    if (!openControl) { setObjs([]); setProposals({}); return; }
    const [o, props] = await Promise.all([
      getObjectivesForControl(openControl, sys.name),
      getProposals(openControl, sys.name),
    ]);
    setObjs(o);
    const byObj = {};
    (props || []).forEach((p) => { byObj[p.objective_id] = p; });
    setProposals(byObj);
  }, [openControl, sys.name]);

  useEffect(() => { loadControl(); }, [loadControl]);

  async function onAccept(proposal, finalText) {
    await acceptProposal(proposal.proposal_id, "duane.wilson@eccalon.com", finalText);
    await loadControl(); // refresh coverage + proposal state
  }

  const pendingCount = Object.values(proposals).filter((p) => p.status === "proposed").length;

  return (
    <div>
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, padding: "22px 44px" }}>
        <button onClick={() => nav("/review")} style={{ display: "flex", alignItems: "center", gap: 6,
          background: "none", border: "none", fontFamily: F.body, fontSize: 13, color: C.muted,
          cursor: "pointer", marginBottom: 10, padding: 0 }}>
          <ChevronLeft size={15} /> All families
        </button>
        <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, margin: 0,
          letterSpacing: "-0.02em" }}>
          <span style={{ fontFamily: F.mono, color: C.seal, textTransform: "uppercase" }}>{family}</span>
          {"  "}Control Family
        </h1>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", minHeight: "calc(100vh - 96px)" }}>
        <div style={{ borderRight: `1px solid ${C.line}`, background: C.panel, padding: "12px", overflowY: "auto" }}>
          {loading && <div style={{ padding: 14, fontSize: 13, color: C.faint }}>Loading…</div>}
          {!loading && controls.length === 0 && (
            <div style={{ padding: 14, fontSize: 13, color: C.faint }}>No controls in scope.</div>
          )}
          {controls.map((ctl) => {
            const active = openControl === ctl.control_id;
            return (
              <button key={ctl.control_id} onClick={() => setOpenControl(ctl.control_id)}
                style={{ width: "100%", textAlign: "left", padding: "11px 13px", borderRadius: 8,
                  border: "none", marginBottom: 3, background: active ? C.sealSoft : "transparent",
                  cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: F.mono, fontSize: 12.5, fontWeight: 600,
                    color: active ? C.sealDk : C.ink, textTransform: "uppercase" }}>{ctl.control_id}</span>
                </div>
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

        <div style={{ padding: "24px 40px", maxWidth: 780 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
            <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, textTransform: "uppercase",
              letterSpacing: ".05em" }}>
              Determination statements · {openControl}
            </div>
            {pendingCount > 0 && (
              <div style={{ fontSize: 12, fontFamily: F.mono, color: C.seal, background: C.sealSoft,
                padding: "3px 10px", borderRadius: 20, display: "flex", alignItems: "center", gap: 5 }}>
                <Sparkles size={12} /> {pendingCount} AI draft{pendingCount > 1 ? "s" : ""} to review
              </div>
            )}
          </div>
          <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 22px", lineHeight: 1.5 }}>
            Each objective is reviewed independently. Accept a draft to record the narrative;
            a claim still needs evidence to count as satisfied.
          </p>

          {objs.length === 0 && (
            <div style={{ fontSize: 13.5, color: C.faint, fontStyle: "italic" }}>
              No determination statements loaded for this control yet.
            </div>
          )}

          {objs.map((o) => (
            <ObjectiveCard key={o.objective_id} o={o} proposal={proposals[o.objective_id]}
              onAccept={onAccept} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ObjectiveCard({ o, proposal, onAccept }) {
  const cov = COVER[o.coverage] || COVER.gap;
  const Icon = cov.Icon;
  const unproven = o.narrative_approved && !o.evidence_linked;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(proposal?.draft_text || "");
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => { setDraft(proposal?.draft_text || ""); }, [proposal?.proposal_id]);

  const showProposal = proposal && proposal.status === "proposed" && !dismissed;

  async function accept() {
    setBusy(true);
    try { await onAccept(proposal, draft); } finally { setBusy(false); }
  }

  return (
    <div style={{ border: `1px solid ${showProposal ? C.seal : unproven ? C.claim : C.line}`,
      borderRadius: 11, padding: "16px 18px", marginBottom: 12,
      background: showProposal ? "#F4FAF9" : unproven ? "#FDFAF2" : C.panel }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 9 }}>
        <span style={{ fontFamily: F.mono, fontSize: 12, color: C.seal, fontWeight: 500 }}>
          {o.objective_id}
        </span>
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5,
          fontSize: 12, color: cov.c, fontWeight: 500 }}>
          <Icon size={14} /> {cov.label}
        </span>
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.5, marginBottom: 13 }}>{o.statement}</div>

      {showProposal ? (
        <div style={{ borderTop: `1px dashed ${C.line}`, paddingTop: 13 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12,
            color: C.seal, fontWeight: 600, marginBottom: 8 }}>
            <Sparkles size={13} /> AI-drafted narrative
            {proposal.confidence && (
              <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 11,
                color: C.muted, textTransform: "uppercase" }}>
                {proposal.confidence} confidence
              </span>
            )}
          </div>

          {editing ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={4}
              style={{ width: "100%", fontFamily: F.body, fontSize: 13.5, lineHeight: 1.5,
                border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px",
                boxSizing: "border-box", color: C.ink, resize: "vertical" }} />
          ) : (
            <div style={{ fontSize: 13.5, lineHeight: 1.55, color: draft ? C.ink : C.faint,
              fontStyle: draft ? "normal" : "italic" }}>
              {draft || "The source documentation does not address this objective."}
            </div>
          )}

          {proposal.rationale && !editing && (
            <div style={{ fontSize: 12, color: C.muted, marginTop: 6, fontStyle: "italic" }}>
              {proposal.rationale}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 13 }}>
            <button onClick={accept} disabled={busy || !draft}
              style={{ display: "flex", alignItems: "center", gap: 6, background: draft ? C.seal : C.lockBg,
                color: draft ? "#fff" : C.faint, border: "none", padding: "8px 14px", borderRadius: 8,
                fontFamily: F.body, fontSize: 13, fontWeight: 600, cursor: draft ? "pointer" : "default" }}>
              {busy ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Accept
            </button>
            <button onClick={() => setEditing((e) => !e)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: C.panel,
                color: C.ink, border: `1px solid ${C.line}`, padding: "8px 14px", borderRadius: 8,
                fontFamily: F.body, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <Pencil size={14} /> {editing ? "Done" : "Edit"}
            </button>
            <button onClick={() => setDismissed(true)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: "none",
                color: C.muted, border: "none", padding: "8px 10px", borderRadius: 8,
                fontFamily: F.body, fontSize: 13, cursor: "pointer" }}>
              <X size={14} /> Reject
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8 }}>
          <Chip on={o.narrative_approved} Icon={FileText}
            onLabel="Narrative approved" offLabel="No narrative" />
          <Chip on={o.evidence_linked} Icon={Paperclip}
            onLabel="Evidence linked" offLabel="No evidence" warn={unproven} />
        </div>
      )}

      {!showProposal && unproven && (
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
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12,
      fontWeight: 500, color: col, background: bg, padding: "5px 10px", borderRadius: 7 }}>
      <Icon size={13} /> {on ? onLabel : offLabel}
    </span>
  );
}
