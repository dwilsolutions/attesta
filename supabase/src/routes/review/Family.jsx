import React, { useEffect, useState } from "react";
import { useParams, useNavigate, useOutletContext } from "react-router-dom";
import { C, F } from "../../lib/theme";
import { getControlsInFamily, getObjectivesForControl } from "../../lib/queries";
import { ChevronLeft, CircleCheck, CircleDashed, CircleAlert, FileText, Paperclip } from "lucide-react";

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
  const [loading, setLoading] = useState(true);

  // load controls for this family
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

  // load objectives for the open control
  useEffect(() => {
    if (!openControl) { setObjs([]); return; }
    let alive = true;
    getObjectivesForControl(openControl, sys.name).then((o) => alive && setObjs(o));
    return () => { alive = false; };
  }, [openControl, sys.name]);

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
        {/* control list */}
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
                  {ctl.claims > 0 && (
                    <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 10.5,
                      color: C.claim, background: "#FBF3E0", padding: "1px 6px", borderRadius: 10 }}>
                      {ctl.claims}
                    </span>
                  )}
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

        {/* objective review pane */}
        <div style={{ padding: "24px 40px", maxWidth: 760 }}>
          <div style={{ fontSize: 12, fontFamily: F.mono, color: C.faint, marginBottom: 6,
            textTransform: "uppercase", letterSpacing: ".05em" }}>
            Determination statements · {openControl}
          </div>
          <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 22px", lineHeight: 1.5 }}>
            Each objective is reviewed independently. A claim needs an approved narrative
            <em> and</em> live evidence to count as satisfied.
          </p>

          {objs.length === 0 && (
            <div style={{ fontSize: 13.5, color: C.faint, fontStyle: "italic" }}>
              No determination statements loaded for this control yet.
            </div>
          )}

          {objs.map((o) => {
            const cov = COVER[o.coverage] || COVER.gap;
            const Icon = cov.Icon;
            const unproven = o.narrative_approved && !o.evidence_linked;
            return (
              <div key={o.objective_id} style={{ border: `1px solid ${unproven ? C.claim : C.line}`,
                borderRadius: 11, padding: "16px 18px", marginBottom: 12,
                background: unproven ? "#FDFAF2" : C.panel }}>
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
                <div style={{ display: "flex", gap: 8 }}>
                  <Chip on={o.narrative_approved} Icon={FileText}
                    onLabel="Narrative approved" offLabel="No narrative" />
                  <Chip on={o.evidence_linked} Icon={Paperclip}
                    onLabel="Evidence linked" offLabel="No evidence" warn={unproven} />
                </div>
                {unproven && (
                  <div style={{ marginTop: 12, fontSize: 12.5, color: C.claim, fontStyle: "italic" }}>
                    Narrative claims this, but no live evidence backs it. An assessor will test it.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
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
