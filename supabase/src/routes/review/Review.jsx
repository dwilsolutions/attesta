import React, { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { C, F } from "../../lib/theme";
import { getFamilies } from "../../lib/queries";
import { ShieldCheck, ChevronRight, Search } from "lucide-react";

export default function Review() {
  const nav = useNavigate();
  const { sys } = useOutletContext();
  const [fams, setFams] = useState([]);
  useEffect(() => { getFamilies(sys.name).then(setFams); }, []);

  const totalObj = fams.reduce((a, f) => a + f.objectives, 0);
  const totalSat = fams.reduce((a, f) => a + f.satisfied, 0);
  const totalClaims = fams.reduce((a, f) => a + f.claims, 0);
  const pct = totalObj ? Math.round((totalSat / totalObj) * 100) : 0;

  return (
    <div>
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel,
        padding: "26px 44px 22px", position: "sticky", top: 0, zIndex: 5 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12,
          color: C.faint, fontFamily: F.mono, marginBottom: 8 }}>
          <span>{sys.name}</span><ChevronRight size={13} /><span>Stage 06</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.seal,
            display: "grid", placeItems: "center" }}>
            <ShieldCheck size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, margin: 0,
              letterSpacing: "-0.02em" }}>Review &amp; Reconcile</h1>
            <p style={{ margin: "3px 0 0", fontSize: 14, color: C.muted }}>
              Confirm every claim is backed by evidence
            </p>
          </div>
        </div>
      </div>

      <div style={{ padding: "28px 44px", maxWidth: 1000 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 26 }}>
          <Metric big={`${pct}%`} label="Objective coverage" sub={`${totalSat} of ${totalObj} satisfied`} tone="seal" />
          <Metric big={totalClaims} label="Unproven claims" sub="Narrative asserts it · no evidence" tone="claim" />
          <Metric big="322" label="Class C controls" sub="1,386 leaf objectives in scope" tone="ink" />
        </div>

        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
          <h2 style={{ fontFamily: F.display, fontSize: 19, fontWeight: 600, margin: 0 }}>Control families</h2>
          <div style={{ position: "relative", width: 220 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: 9, color: C.faint }} />
            <input placeholder="Find a control…" style={{ width: "100%", padding: "7px 10px 7px 30px",
              fontSize: 13, border: `1px solid ${C.line}`, borderRadius: 7, background: C.panel,
              fontFamily: F.body, color: C.ink, boxSizing: "border-box" }} />
          </div>
        </div>

        <div style={{ border: `1px solid ${C.line}`, borderRadius: 10, overflow: "hidden", background: C.panel }}>
          {fams.map((f, i) => {
            const fpct = Math.round((f.satisfied / f.objectives) * 100);
            return (
              <div key={f.id} onClick={() => nav(`/review/${f.id}`)} style={{ display: "flex",
                alignItems: "center", gap: 16, padding: "14px 18px",
                borderBottom: i < fams.length - 1 ? `1px solid ${C.line}` : "none", cursor: "pointer" }}>
                <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 500, color: C.seal,
                  textTransform: "uppercase", width: 26 }}>{f.id}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 500 }}>{f.name}</div>
                  <div style={{ fontSize: 12, color: C.faint, fontFamily: F.mono, marginTop: 2 }}>
                    {f.controls} controls · {f.objectives} objectives
                  </div>
                </div>
                {f.claims > 0 && (
                  <span style={{ fontSize: 12, fontFamily: F.mono, color: C.claim, background: "#FBF3E0",
                    padding: "3px 8px", borderRadius: 20, fontWeight: 500 }}>{f.claims} unproven</span>
                )}
                <div style={{ width: 130 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5,
                    color: C.muted, marginBottom: 4 }}>
                    <span>coverage</span><span style={{ fontFamily: F.mono }}>{fpct}%</span>
                  </div>
                  <div style={{ height: 5, background: C.lockBg, borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ width: `${fpct}%`, height: "100%", background: C.seal, borderRadius: 3 }} />
                  </div>
                </div>
                <ChevronRight size={17} style={{ color: C.faint }} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Metric({ big, label, sub, tone }) {
  const color = tone === "seal" ? C.seal : tone === "claim" ? C.claim : C.ink;
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "18px 20px" }}>
      <div style={{ fontFamily: F.display, fontSize: 38, fontWeight: 600, color, lineHeight: 1,
        letterSpacing: "-0.02em" }}>{big}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600, marginTop: 10 }}>{label}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
