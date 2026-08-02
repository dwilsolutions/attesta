import React from "react";
import { C, F } from "../lib/theme";
import { FileText, Table, Download, Sparkles } from "lucide-react";

// Shared template offering — used in the Templates stage and on Complete Docs.
const TEMPLATES = [
  { file: "Attesta_SSP_Template.docx", title: "SSP Template", kind: "doc",
    desc: "Control-numbered System Security Plan shell. Best-structured input for AI ingest.", tag: "For starting from scratch" },
  { file: "Attesta_Policy_Template.docx", title: "Policy Template", kind: "doc",
    desc: "One per control family. Satisfies the policy (-1) control in each family.", tag: "" },
  { file: "Attesta_Procedure_Template.docx", title: "Procedure Template", kind: "doc",
    desc: "Operational steps that implement a policy.", tag: "" },
  { file: "Attesta_CRM_Template.csv", title: "Customer Responsibility Matrix", kind: "data",
    desc: "Structured format Attesta reads to set control inheritance. Keep the columns intact.", tag: "Recommended format" },
  { file: "Attesta_Evidence_Register_Template.csv", title: "Evidence Register", kind: "data",
    desc: "Describe each artifact so Attesta can link it in place. The evidence file stays in SharePoint.", tag: "For evidence (stage 5)" },
];

export default function TemplateList({ compact }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr 1fr" : "1fr 1fr 1fr", gap: 12 }}>
      {TEMPLATES.map((t) => {
        const Icon = t.kind === "data" ? Table : FileText;
        return (
          <a key={t.file} href={`/templates/${t.file}`} download
            style={{ textDecoration: "none", color: "inherit", border: `1px solid ${C.line}`,
              borderRadius: 12, background: C.panel, padding: "16px 18px", display: "flex",
              flexDirection: "column", gap: 8, transition: "border-color .12s" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 8, background: C.sealSoft,
                display: "grid", placeItems: "center", flexShrink: 0 }}>
                <Icon size={17} style={{ color: C.seal }} />
              </div>
              <div style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{t.title}</div>
              <Download size={16} style={{ color: C.faint }} />
            </div>
            <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.45 }}>{t.desc}</div>
            {t.tag && (
              <div style={{ fontSize: 11, fontFamily: F.mono, color: C.seal, background: C.sealSoft,
                padding: "3px 8px", borderRadius: 20, alignSelf: "flex-start" }}>{t.tag}</div>
            )}
          </a>
        );
      })}
    </div>
  );
}
