import React from "react";
import { useOutletContext } from "react-router-dom";
import { C, F } from "../lib/theme";
import { FileStack, ChevronRight } from "lucide-react";
import TemplateList from "../components/TemplateList.jsx";

export default function Templates() {
  return (
    <div>
      <div style={{ borderBottom: `1px solid ${C.line}`, background: C.panel, padding: "26px 44px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.faint,
          fontFamily: F.mono, marginBottom: 8 }}>
          <span>Krome</span><ChevronRight size={13} /><span>Stage 03</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: C.seal,
            display: "grid", placeItems: "center" }}>
            <FileStack size={21} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontFamily: F.display, fontSize: 30, fontWeight: 600, margin: 0,
              letterSpacing: "-0.02em" }}>Templates</h1>
            <p style={{ margin: "3px 0 0", fontSize: 14, color: C.muted }}>
              Starting points for documentation and evidence — optional, but structured formats ingest best
            </p>
          </div>
        </div>
      </div>
      <div style={{ padding: "28px 44px", maxWidth: 1000 }}>
        <p style={{ fontSize: 14, color: C.muted, lineHeight: 1.55, margin: "0 0 22px", maxWidth: 640 }}>
          Attesta ingests your existing documents as-is — you don't need these. They're here for teams
          starting fresh, and for the two structured formats (CRM, Evidence Register) where consistent
          columns let Attesta read the data reliably.
        </p>
        <TemplateList />
      </div>
    </div>
  );
}
