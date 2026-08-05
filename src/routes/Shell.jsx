import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { C, F } from "../lib/theme";
import {
  Compass, ClipboardList, FileStack, PencilLine, ScanLine, ShieldCheck,
  FileCheck2, Radar, ChevronRight, Circle, CheckCircle2, Lock,
  Building2, ChevronDown, LayoutDashboard,
} from "lucide-react";

const STAGES = [
  { id: "onboard",   label: "Onboarding",           blurb: "Company profile → tailored plan", icon: Compass,       state: "done",   route: "/onboard" },
  { id: "plan",      label: "Plan of Action",        blurb: "Scoped control set",              icon: ClipboardList, state: "done" },
  { id: "templates", label: "Templates",             blurb: "Download starting points",         icon: FileStack,     state: "active", route: "/templates" },
  { id: "fill",      label: "Complete Docs",         blurb: "Upload & draft narratives",        icon: PencilLine,    state: "active", route: "/complete-docs" },
  { id: "evidence",  label: "Evidence Collection",   blurb: "Agent gathers artifacts",         icon: ScanLine,      state: "done" },
  { id: "review",    label: "Review & Reconcile",    blurb: "Confirm claims are backed",       icon: ShieldCheck,   state: "active", route: "/review" },
  { id: "produce",   label: "Final Documentation",   blurb: "Assessment-ready package",        icon: FileCheck2,    state: "active", route: "/final-docs" },
  { id: "monitor",   label: "Continuous Monitoring", blurb: "Watch evidence & intervals",      icon: Radar,         state: "locked" },
];

const SYSTEMS = [
  { id: "krome", name: "Krome", framework: "FedRAMP Rev 5 · Class C" },
  { id: "lynx",  name: "Lynx",  framework: "FedRAMP 20x (planned)" },
];

function Dot({ state }) {
  if (state === "done")   return <CheckCircle2 size={15} style={{ color: C.seal }} />;
  if (state === "active") return <Circle size={15} strokeWidth={3} style={{ color: C.claim }} />;
  return <Lock size={13} style={{ color: C.faint }} />;
}

export default function Shell() {
  const nav = useNavigate();
  const loc = useLocation();
  const [sys, setSys] = useState(SYSTEMS[0]);
  const [open, setOpen] = useState(false);
  const done = STAGES.filter((s) => s.state === "done").length;
  const activeId = loc.pathname.startsWith("/complete-docs") ? "fill"
    : loc.pathname.startsWith("/templates") ? "templates"
    : loc.pathname.startsWith("/review") ? "review"
    : loc.pathname.startsWith("/final-docs") ? "produce" : "dashboard";

  return (
    <div style={{ fontFamily: F.body, color: C.ink, background: C.paper,
      minHeight: "100vh", display: "grid", gridTemplateColumns: "300px 1fr" }}>
      <aside style={{ background: C.panel, borderRight: `1px solid ${C.line}`,
        display: "flex", flexDirection: "column", position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${C.line}` }}>
          <div onClick={() => nav("/")} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}
            title="Back to dashboard">
            <div style={{ width: 26, height: 26, borderRadius: 6, background: C.seal,
              display: "grid", placeItems: "center" }}>
              <ShieldCheck size={16} color="#fff" />
            </div>
            <span style={{ fontFamily: F.display, fontSize: 23, fontWeight: 600,
              letterSpacing: "-0.02em" }}>Attesta</span>
          </div>
        </div>

        <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.line}`, position: "relative" }}>
          <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", background: C.paper,
            border: `1px solid ${C.line}`, borderRadius: 8, padding: "10px 12px", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 10, textAlign: "left" }}>
            <Building2 size={16} style={{ color: C.seal }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{sys.name}</div>
              <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sys.framework}</div>
            </div>
            <ChevronDown size={15} style={{ color: C.faint,
              transform: open ? "rotate(180deg)" : "none", transition: ".15s" }} />
          </button>
          {open && (
            <div style={{ position: "absolute", left: 16, right: 16, top: "calc(100% - 4px)",
              background: C.panel, border: `1px solid ${C.line}`, borderRadius: 8,
              boxShadow: "0 8px 24px rgba(18,22,28,.10)", zIndex: 20, overflow: "hidden" }}>
              {SYSTEMS.map((s) => (
                <button key={s.id} onClick={() => { setSys(s); setOpen(false); }}
                  style={{ width: "100%", padding: "10px 12px", border: "none",
                    background: s.id === sys.id ? C.paper : "transparent", cursor: "pointer",
                    textAlign: "left", borderBottom: `1px solid ${C.line}` }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{s.name}</div>
                  <div style={{ fontSize: 11, color: C.muted, fontFamily: F.mono }}>{s.framework}</div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div style={{ padding: "16px 12px 8px", flex: 1, overflowY: "auto" }}>
          <button onClick={() => nav("/")}
            style={{ width: "100%", display: "flex", gap: 11, alignItems: "center",
              padding: "9px 12px", border: "none", borderRadius: 8,
              background: activeId === "dashboard" ? C.paper : "transparent",
              cursor: "pointer", textAlign: "left", marginBottom: 12 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6,
              background: activeId === "dashboard" ? C.seal : C.panel,
              border: `2px solid ${activeId === "dashboard" ? C.seal : C.line}`,
              display: "grid", placeItems: "center" }}>
              <LayoutDashboard size={11} style={{ color: activeId === "dashboard" ? "#fff" : C.muted }} />
            </div>
            <span style={{ fontSize: 13.5, fontWeight: activeId === "dashboard" ? 600 : 500 }}>Dashboard</span>
          </button>

          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: ".08em",
            textTransform: "uppercase", color: C.faint, padding: "0 12px 10px" }}>
            Compliance journey
          </div>
          <div style={{ position: "relative" }}>
            <div style={{ position: "absolute", left: 22, top: 14, bottom: 14, width: 2, background: C.line }} />
            {STAGES.map((s) => {
              const isActive = s.id === activeId;
              const clickable = s.state !== "locked" && s.route;
              const Icon = s.icon;
              return (
                <button key={s.id} onClick={() => clickable && nav(s.route)} disabled={!clickable}
                  style={{ width: "100%", display: "flex", gap: 11, alignItems: "flex-start",
                    padding: "9px 12px", border: "none", borderRadius: 8,
                    background: isActive ? C.paper : "transparent",
                    cursor: clickable ? "pointer" : "default", textAlign: "left",
                    position: "relative", marginBottom: 2, opacity: s.state === "locked" ? 0.55 : 1 }}>
                  <div style={{ width: 22, height: 22, borderRadius: "50%",
                    background: isActive ? C.seal : C.panel,
                    border: `2px solid ${isActive ? C.seal : C.line}`,
                    display: "grid", placeItems: "center", zIndex: 1 }}>
                    <Icon size={11} style={{ color: isActive ? "#fff" : C.muted }} />
                  </div>
                  <div style={{ flex: 1, paddingTop: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6,
                      fontSize: 13.5, fontWeight: isActive ? 600 : 500,
                      color: s.state === "locked" ? C.faint : C.ink }}>
                      {s.label}
                      <span style={{ marginLeft: "auto" }}><Dot state={s.state} /></span>
                    </div>
                    {isActive && <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>{s.blurb}</div>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.line}` }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12,
            color: C.muted, marginBottom: 7 }}>
            <span>Journey progress</span>
            <span style={{ fontFamily: F.mono }}>{done}/{STAGES.length}</span>
          </div>
          <div style={{ height: 5, background: C.lockBg, borderRadius: 3, overflow: "hidden" }}>
            <div style={{ width: `${(done / STAGES.length) * 100}%`, height: "100%",
              background: C.seal, borderRadius: 3 }} />
          </div>
        </div>
      </aside>

      <main><Outlet context={{ sys }} /></main>
    </div>
  );
}
