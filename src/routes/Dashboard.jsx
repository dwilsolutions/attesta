import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { C, F } from "../lib/theme";
import { getDashboardStats } from "../lib/queries";
import { LayoutGrid, TriangleAlert, ShieldCheck, FileText, Paperclip, Scale } from "lucide-react";

const CLAIMSOFT = "#FAF1DD", DANGER = "#B4402F", DANGERSOFT = "#FBEAE6", PANEL2 = "#F6F3EC";
const GAP = "#D9D3C8";
const FAMILY_NAMES = {
  AC:"Access Control", AT:"Awareness & Training", AU:"Audit & Accountability",
  CA:"Assessment & Authorization", CM:"Configuration Management", CP:"Contingency Planning",
  IA:"Identification & Authentication", IR:"Incident Response", MA:"Maintenance",
  MP:"Media Protection", PE:"Physical & Environmental", PL:"Planning", PS:"Personnel Security",
  RA:"Risk Assessment", SA:"System & Services Acquisition", SC:"System & Communications Protection",
  SI:"System & Information Integrity", SR:"Supply Chain Risk Management",
};

export default function Dashboard() {
  const { sys } = useOutletContext();
  const nav = useNavigate();
  const [s, setS] = useState(null);

  useEffect(() => {
    let live = true;
    getDashboardStats(sys?.name).then((d) => { if (live) setS(d); });
    return () => { live = false; };
  }, [sys?.name]);

  if (!s) return <div style={{ padding: 40, color: C.muted }}>Loading readiness…</div>;

  const o = s.objectives, ready = o.total ? Math.round(100 * o.satisfied / o.total) : 0;
  const pctW = (n) => o.total ? (100 * n / o.total) : 0;
  const empty = o.total === 0;

  const C1 = 2 * Math.PI * 58;

  return (
    <div style={{ padding: "28px 40px", maxWidth: 1000 }}>
      <h1 style={{ fontFamily: F.display, fontSize: 26, fontWeight: 600, margin: "0 0 2px", letterSpacing: "-.01em" }}>
        Assessment readiness
      </h1>
      <p style={{ fontSize: 13.5, color: C.muted, margin: "0 0 22px" }}>
        {sys?.name || "Krome"} · FedRAMP Moderate · {o.total || 0} objectives across {s.controls.total || 0} controls
      </p>

      {empty && (
        <div style={{ border: `1px dashed ${C.line}`, borderRadius: 12, background: PANEL2,
          padding: "16px 18px", marginBottom: 20, fontSize: 13.5, color: C.muted }}>
          No coverage yet. As you approve narratives, link evidence, and reconcile controls in
          Review, this dashboard fills in — readiness, family progress, and what needs attention.
        </div>
      )}

      {/* hero */}
      <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 26,
        border: `1.5px solid ${C.line}`, borderRadius: 16, background: C.panel, padding: "22px 26px",
        marginBottom: 20, alignItems: "center" }}>
        <div style={{ position: "relative", width: 132, height: 132 }}>
          <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="66" cy="66" r="58" fill="none" stroke={C.line} strokeWidth="12" />
            <circle cx="66" cy="66" r="58" fill="none" stroke={C.seal} strokeWidth="12" strokeLinecap="round"
              strokeDasharray={C1} strokeDashoffset={C1 * (1 - ready / 100)} />
          </svg>
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div>
              <b style={{ fontSize: 30, fontFamily: F.display, fontWeight: 600, display: "block", lineHeight: 1 }}>{ready}%</b>
              <span style={{ fontSize: 11, color: C.muted, fontFamily: F.mono, textTransform: "uppercase" }}>ready</span>
            </div>
          </div>
        </div>
        <div>
          <h3 style={{ margin: "0 0 12px", fontSize: 15, fontWeight: 600 }}>
            Objective coverage — {o.satisfied} of {o.total} satisfied
          </h3>
          <Bar label="Satisfied" color={C.seal} w={pctW(o.satisfied)} num={`${o.satisfied} · ${ready}%`} />
          <Bar label="Partial" color={C.claim} w={pctW(o.partial)} num={`${o.partial} · ${o.total ? Math.round(100*o.partial/o.total) : 0}%`} />
          <Bar label="Gap" color={GAP} w={pctW(o.gap)} num={`${o.gap} · ${o.total ? Math.round(100*o.gap/o.total) : 0}%`} />
        </div>
      </div>

      {/* stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 22 }}>
        <Card k="Controls satisfied" v={s.controls.satisfied} d={`of ${s.controls.total} controls`} tone="ok" />
        <Card k="Missing evidence" v={s.buckets.missing_evidence} d="narrative, no proof" tone="warn" />
        <Card k="Missing narrative" v={s.buckets.missing_narrative} d="evidence, no SSP text" tone="warn" />
        <Card k="Reconcile conflicts" v={s.conflicts} d="across doc types" tone="alert" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 16 }}>
        {/* family coverage */}
        <Panel title="Coverage by family" Icon={LayoutGrid} count={`${s.families.length} families`}>
          {s.families.length === 0 && <Blank>No family data yet.</Blank>}
          {s.families.map((f) => (
            <div key={f.family} onClick={() => nav(`/review/${f.family.toLowerCase()}`)}
              style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 16px",
                borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
              <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, width: 30, color: C.sealDk }}>{f.family}</span>
              <span style={{ fontSize: 12.5, color: C.muted, flex: 1, overflow: "hidden",
                textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{FAMILY_NAMES[f.family] || ""}</span>
              <span style={{ width: 120, height: 7, borderRadius: 20, background: PANEL2, overflow: "hidden", display: "flex" }}>
                <i style={{ width: `${f.pct || 0}%`, background: C.seal }} />
              </span>
              <span style={{ width: 44, textAlign: "right", fontFamily: F.mono, fontSize: 11.5, color: C.muted }}>{f.pct || 0}%</span>
            </div>
          ))}
        </Panel>

        {/* needs attention */}
        <Panel title="Needs attention" Icon={TriangleAlert} iconColor={DANGER} count="top items">
          {s.attention.length === 0 && <Blank>Nothing flagged yet. Run Reconcile on a control to surface conflicts.</Blank>}
          {s.attention.map((a, i) => (
            <div key={i} onClick={() => nav(`/review/${(a.control_id||"").toLowerCase().split("-")[0]}`)}
              style={{ padding: "11px 16px", borderBottom: `1px solid ${C.line}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: F.mono, fontSize: 12, fontWeight: 600, color: C.sealDk }}>{a.control_id}</span>
                <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 10, padding: "1px 7px",
                  borderRadius: 20, background: DANGERSOFT, color: DANGER }}>{a.kind}</span>
              </div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 3 }}>{a.desc}</div>
            </div>
          ))}
        </Panel>
      </div>
    </div>
  );
}

function Bar({ label, color, w, num }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, marginBottom: 9 }}>
      <span style={{ width: 84, color: C.muted, display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ width: 9, height: 9, borderRadius: "50%", background: color }} /> {label}
      </span>
      <span style={{ flex: 1, height: 9, borderRadius: 20, background: PANEL2, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${w}%`, background: color, borderRadius: 20 }} />
      </span>
      <span style={{ width: 74, textAlign: "right", fontFamily: F.mono, fontSize: 12 }}>{num}</span>
    </div>
  );
}

function Card({ k, v, d, tone }) {
  const col = tone === "ok" ? C.seal : tone === "alert" ? DANGER : tone === "warn" ? C.claim : C.ink;
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, padding: "15px 16px" }}>
      <div style={{ fontSize: 12, color: C.muted, fontFamily: F.mono, textTransform: "uppercase", letterSpacing: ".03em" }}>{k}</div>
      <div style={{ fontSize: 26, fontFamily: F.display, fontWeight: 600, marginTop: 4, color: col }}>{v}</div>
      <div style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>{d}</div>
    </div>
  );
}

function Panel({ title, Icon, iconColor, count, children }) {
  return (
    <div style={{ border: `1px solid ${C.line}`, borderRadius: 12, background: C.panel, overflow: "hidden" }}>
      <h4 style={{ margin: 0, padding: "13px 16px", fontSize: 13, fontWeight: 600,
        borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", gap: 8 }}>
        <Icon size={15} style={{ color: iconColor || C.seal }} /> {title}
        <span style={{ marginLeft: "auto", fontFamily: F.mono, fontSize: 11, color: C.faint, fontWeight: 400 }}>{count}</span>
      </h4>
      {children}
    </div>
  );
}

function Blank({ children }) {
  return <div style={{ padding: "16px", fontSize: 12.5, color: C.faint, fontStyle: "italic" }}>{children}</div>;
}
