// Attesta · final package builder (browser-side, docx-js).
// Produces four deliverables from package_data():
//   1. SSP + Appendices (assembled, narratives by family/control)
//   2. Policies & Procedures (reconstructed clean from stored sections)
//   3. Plans (where applicable)
//   4. Evidence Register (summary table + per-control breakdown)
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, PageBreak, ShadingType,
} from "docx";
import { saveAs } from "file-saver";

const INK = "12161C", SEAL = "1F6F6B", MUTED = "6B6459", LINE = "E3DFD6", SOFT = "F6F3EC";
const LETTER = { width: 12240, height: 15840 };

function H(text, level) { return new Paragraph({ heading: level, spacing: { before: 240, after: 120 }, children: [new TextRun({ text })] }); }
function P(text, opts = {}) {
  return new Paragraph({ spacing: { after: 120 }, ...opts,
    children: [new TextRun({ text: text || "", color: opts.color, italics: opts.italics, bold: opts.bold, size: opts.size })] });
}
function label(text) { return new Paragraph({ spacing: { before: 120, after: 40 },
  children: [new TextRun({ text, bold: true, color: SEAL, size: 18 })] }); }

function cell(text, { w, bold, bg, color, size = 18 } = {}) {
  return new TableCell({
    width: { size: w, type: WidthType.DXA },
    shading: bg ? { type: ShadingType.CLEAR, color: "auto", fill: bg } : undefined,
    margins: { top: 60, bottom: 60, left: 90, right: 90 },
    children: [new Paragraph({ children: [new TextRun({ text: text || "", bold, color: color || INK, size })] })],
  });
}
function headerRow(cells, widths) {
  return new TableRow({ tableHeader: true,
    children: cells.map((c, i) => cell(c, { w: widths[i], bold: true, bg: SEAL, color: "FFFFFF" })) });
}
function row(cells, widths) {
  return new TableRow({ children: cells.map((c, i) => cell(c, { w: widths[i] })) });
}
function titlePage(title, subtitle) {
  return [
    new Paragraph({ spacing: { before: 2600, after: 120 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "ATTESTA", bold: true, color: SEAL, size: 28 })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
      children: [new TextRun({ text: title, bold: true, size: 44, color: INK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: subtitle, size: 24, color: MUTED })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: `Generated ${new Date().toLocaleDateString()} · PRELIMINARY — FOR REVIEW`, size: 18, color: MUTED, italics: true })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}
function doc(children) {
  return new Document({ styles: { default: { document: { run: { font: "Calibri", size: 21, color: INK } } } },
    sections: [{ properties: { page: { size: LETTER, margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }] });
}
async function save(d, name) { const blob = await Packer.toBlob(d); saveAs(blob, name); }

/* ---------- 1. SSP — FedRAMP template format ---------- */
function coverPage(systemName) {
  return [
    new Paragraph({ spacing: { before: 2200, after: 60 }, alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: "FedRAMP®", bold: true, size: 30, color: SEAL })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 300 },
      children: [new TextRun({ text: "Moderate Baseline", size: 22, color: MUTED })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
      children: [new TextRun({ text: "System Security Plan (SSP)", bold: true, size: 48, color: INK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 },
      children: [new TextRun({ text: `for ${systemName}`, size: 30, color: INK })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 400 },
      children: [new TextRun({ text: `Version 1.0`, size: 22, color: MUTED })] }),
    new Paragraph({ alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: new Date().toLocaleDateString(), size: 22, color: MUTED })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 900 },
      children: [new TextRun({ text: "PRELIMINARY — FOR REVIEW", italics: true, size: 20, color: "B4402F" })] }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function kvTable(rows) {
  const w = [3200, 6000];
  return new Table({ columnWidths: w, width: { size: 9200, type: WidthType.DXA },
    rows: rows.map(([k, v]) => new TableRow({ children: [
      cell(k, { w: w[0], bold: true, bg: SOFT }),
      cell(v, { w: w[1] }),
    ] })) });
}

export async function buildSSP(pkg, systemName) {
  const kids = [...coverPage(systemName)];

  // Revision history
  kids.push(H("Document Revision History", HeadingLevel.HEADING_1));
  { const w = [1800, 1800, 4000, 1600];
    kids.push(new Table({ columnWidths: w, width: { size: 9200, type: WidthType.DXA }, rows: [
      headerRow(["Date", "Version", "Description", "Author"], w),
      row([new Date().toLocaleDateString(), "1.0", "Initial preliminary SSP generated by Attesta", "Attesta"], w),
    ] })); }

  // 1. Introduction
  kids.push(H("1. Introduction", HeadingLevel.HEADING_1));
  kids.push(P(`This System Security Plan (SSP) describes the security controls and their implementation for ${systemName}, a cloud service offering assessed against the FedRAMP Moderate baseline. It documents the control implementation for each applicable NIST SP 800-53 assessment objective.`));

  // 2. Purpose
  kids.push(H("2. Purpose", HeadingLevel.HEADING_1));
  kids.push(P(`The purpose of this SSP is to provide an overview of the security requirements for ${systemName} and describe the controls in place or planned to meet those requirements. This document is developed in accordance with FedRAMP requirements and NIST SP 800-53.`));

  // 3. System Information (Table 3.1)
  kids.push(H("3. System Information", HeadingLevel.HEADING_1));
  kids.push(P("Table 3.1 provides a summary of the key attributes of the cloud service offering.", { italics: true, color: MUTED, size: 19 }));
  kids.push(kvTable([
    ["Information System Name", systemName],
    ["Service Model", "[Insert: IaaS / PaaS / SaaS / LI-SaaS]"],
    ["Deployment Model", "[Insert: Public / Government-Only / Hybrid Cloud]"],
    ["Digital Identity Level", "[Insert after completing Appendix E]"],
    ["FIPS PUB 199 Level", "[Insert: Moderate]"],
    ["Fully Operational as of", "[Insert MM/DD/YYYY]"],
    ["System Status", "[Insert: Operational / Under Development / Major Modification]"],
  ]));

  // 4-9 placeholder sections (system-description content Attesta doesn't own yet)
  const placeholders = [
    ["4. System Owner", "[Insert system owner name, title, organization, and contact information.]"],
    ["5. Assignment of Security Responsibility", "[Insert the individual(s) responsible for the security of the system, with contact information.]"],
    ["6. Leveraged FedRAMP-Authorized Services", "[Insert any leveraged FedRAMP-authorized services this offering inherits controls from.]"],
    ["7. External Systems and Services Not Having FedRAMP Authorization", "[Insert external systems/services used that are not FedRAMP-authorized, with justification.]"],
    ["8. Illustrated Architecture and Narrative", "[Insert the authorization boundary diagram, data flow diagrams, and supporting narrative.]"],
    ["9. Services, Ports, and Protocols", "[Insert the services, ports, and protocols used within the authorization boundary.]"],
    ["10. Cryptographic Modules (Data at Rest and in Transit)", "[Insert FIPS 140-validated cryptographic modules implemented for DAR and DIT.]"],
  ];
  placeholders.forEach(([h, body]) => { kids.push(H(h, HeadingLevel.HEADING_1)); kids.push(P(body, { color: MUTED, italics: true })); });

  // 11. Separation of Duties (AC-5) — Attesta can hint from AC-5 if present
  kids.push(H("11. Separation of Duties", HeadingLevel.HEADING_1));
  kids.push(P("Security control AC-5, Separation of Duties, requires that the CSP identify and document the separation of duties for the system. [Insert or confirm the separation-of-duties matrix.]", { color: MUTED, italics: true }));

  // 12. Control Implementation Summary — the heart, Attesta-owned
  kids.push(new Paragraph({ children: [new PageBreak()] }));
  kids.push(H("12. Security Control Implementation", HeadingLevel.HEADING_1));
  kids.push(P("The following documents the implementation of each applicable control, organized by control family. Each objective states its NIST 800-53 requirement, the FedRAMP assessment method, the implementation narrative, and its current implementation status.", { size: 20 }));

  const fams = {};
  pkg.forEach((c) => { (fams[c.family] ||= []).push(c); });
  Object.keys(fams).sort().forEach((fam) => {
    kids.push(new Paragraph({ children: [new PageBreak()] }));
    kids.push(H(`${fam} — ${famName(fam)}`, HeadingLevel.HEADING_1));
    fams[fam].forEach((c) => {
      kids.push(H(`${c.control_id.toUpperCase()} ${c.title}`, HeadingLevel.HEADING_2));

      // control summary table (implementation status rollup)
      const sat = (c.objectives||[]).filter(o=>o.coverage==="satisfied").length;
      const tot = (c.objectives||[]).length;
      const status = sat===tot && tot>0 ? "Implemented" : sat>0 ? "Partially Implemented" : "Planned";
      const w = [3200, 6000];
      kids.push(new Table({ columnWidths: w, width: { size: 9200, type: WidthType.DXA }, rows: [
        new TableRow({ children: [ cell("Implementation Status", { w: w[0], bold: true, bg: SOFT }), cell(`${status}  (${sat}/${tot} objectives satisfied)`, { w: w[1] }) ] }),
        new TableRow({ children: [ cell("Control Origination", { w: w[0], bold: true, bg: SOFT }), cell("Service Provider Corporate  [confirm]", { w: w[1] }) ] }),
        new TableRow({ children: [ cell("Responsible Role", { w: w[0], bold: true, bg: SOFT }), cell("[Insert responsible role]", { w: w[1] }) ] }),
      ] }));

      (c.objectives || []).forEach((o) => {
        kids.push(new Paragraph({ spacing: { before: 160, after: 40 }, children: [new TextRun({ text: o.objective_id, bold: true, color: SEAL, size: 19 })] }));
        kids.push(P(o.statement, { italics: true, color: MUTED, size: 19 }));
        if (o.sar_method) {
          const bits = [];
          if (o.sar_parameter) bits.push(`Parameter: ${o.sar_parameter}`);
          bits.push(`Method: ${o.sar_method}`);
          kids.push(P(bits.join("   ·   "), { size: 17, color: SEAL }));
        }
        if (o.narrative) kids.push(P(o.narrative));
        else kids.push(P("[Implementation narrative to be completed.]", { italics: true, color: "B4402F", size: 19 }));
        const cov = (o.coverage||"gap");
        kids.push(P(`Status: ${cov.charAt(0).toUpperCase()+cov.slice(1)}`, { size: 17, color: cov==="satisfied"?SEAL:cov==="partial"?"B5892B":"B4402F", bold: true }));
      });
    });
  });

  // 13. Appendices list
  kids.push(new Paragraph({ children: [new PageBreak()] }));
  kids.push(H("13. SSP Appendices List", HeadingLevel.HEADING_1));
  const apps = [
    "Appendix A — FedRAMP Security Controls (CIS/CRM Workbook)",
    "Appendix B — Related Acronyms",
    "Appendix C — Information Security Policies and Procedures",
    "Appendix D — User Guide",
    "Appendix E — Digital Identity Worksheet",
    "Appendix F — Rules of Behavior (RoB)",
    "Appendix G — Information System Contingency Plan (ISCP)",
    "Appendix H — Configuration Management Plan (CMP)",
    "Appendix I — Incident Response Plan (IRP)",
    "Appendix J — Control Implementation Summary (CIS) and Customer Responsibilities Matrix (CRM) Workbook",
    "Appendix K — FIPS 199 Categorization",
    "Appendix L — Laws and Regulations",
    "Appendix M — Integrated Inventory Workbook (IIW)",
    "Appendix N — Continuous Monitoring Plan",
    "Appendix O — POA&M",
    "Appendix P — Supply Chain Risk Management Plan (SCRMP)",
    "Appendix Q — Cryptographic Modules Table",
  ];
  apps.forEach((a) => kids.push(new Paragraph({ spacing: { after: 60 }, bullet: { level: 0 }, children: [new TextRun({ text: a, size: 20 })] })));
  kids.push(P("Note: Policies & Procedures, Plans, and the Evidence Register are provided as separate Attesta deliverables that populate the corresponding appendices above.", { italics: true, color: MUTED, size: 18 }));

  await save(doc(kids), `${systemName}_SSP.docx`);
}

function famName(fam) {
  const M = { AC:"Access Control", AT:"Awareness and Training", AU:"Audit and Accountability",
    CA:"Assessment, Authorization, and Monitoring", CM:"Configuration Management", CP:"Contingency Planning",
    IA:"Identification and Authentication", IR:"Incident Response", MA:"Maintenance", MP:"Media Protection",
    PE:"Physical and Environmental Protection", PL:"Planning", PS:"Personnel Security", RA:"Risk Assessment",
    SA:"System and Services Acquisition", SC:"System and Communications Protection",
    SI:"System and Information Integrity", SR:"Supply Chain Risk Management" };
  return M[fam] || fam;
}

/* ---------- 2. Policies & Procedures (reconstructed clean) ---------- */
export async function buildPolicies(pkg, systemName) {
  // gather unique docs of type policy/procedure across controls
  const seen = new Set(); const docs = [];
  pkg.forEach((c) => (c.documents || []).forEach((d) => {
    if (d.doc_type === "policy" || d.doc_type === "procedure") {
      const key = d.title + "|" + d.doc_type;
      if (!seen.has(key)) { seen.add(key); docs.push({ ...d, control: c.control_id }); }
    }
  }));
  if (docs.length === 0) return { skipped: "no policies or procedures" };

  const kids = [...titlePage("Policies & Procedures", `${systemName} · FedRAMP Moderate`)];
  docs.forEach((d, i) => {
    if (i > 0) kids.push(new Paragraph({ children: [new PageBreak()] }));
    kids.push(H(d.title, HeadingLevel.HEADING_1));
    kids.push(P(d.doc_type.toUpperCase() + ` · ${d.control.toUpperCase()}`, { color: SEAL, bold: true, size: 18 }));
    (d.sections || []).forEach((s) => {
      kids.push(H(s.heading, HeadingLevel.HEADING_2));
      (s.body || "").split(/\n+/).filter(Boolean).forEach((para) => kids.push(P(para)));
    });
  });
  await save(doc(kids), `${systemName}_Policies_and_Procedures.docx`);
  return { count: docs.length };
}

/* ---------- 3. Plans ---------- */
export async function buildPlans(pkg, systemName) {
  const seen = new Set(); const plans = [];
  pkg.forEach((c) => (c.documents || []).forEach((d) => {
    if (d.doc_type === "plan") { const k = d.title; if (!seen.has(k)) { seen.add(k); plans.push({ ...d, control: c.control_id }); } }
  }));
  if (plans.length === 0) return { skipped: "no plans" };

  const kids = [...titlePage("Plans", `${systemName} · FedRAMP Moderate`)];
  plans.forEach((d, i) => {
    if (i > 0) kids.push(new Paragraph({ children: [new PageBreak()] }));
    kids.push(H(d.title, HeadingLevel.HEADING_1));
    kids.push(P("PLAN · " + d.control.toUpperCase(), { color: SEAL, bold: true, size: 18 }));
    (d.sections || []).forEach((s) => {
      kids.push(H(s.heading, HeadingLevel.HEADING_2));
      (s.body || "").split(/\n+/).filter(Boolean).forEach((para) => kids.push(P(para)));
    });
  });
  await save(doc(kids), `${systemName}_Plans.docx`);
  return { count: plans.length };
}

/* ---------- 4. Evidence Register ---------- */
export async function buildEvidenceRegister(pkg, systemName) {
  // flatten evidence
  const rows_flat = [];
  pkg.forEach((c) => (c.objectives || []).forEach((o) => (o.evidence || []).forEach((e) =>
    rows_flat.push({ control: c.control_id.toUpperCase(), objective: o.objective_id,
      title: e.title, method: e.method, type: e.type, url: e.url }))));

  const kids = [...titlePage("Evidence Register", `${systemName} · FedRAMP Moderate`)];

  if (rows_flat.length === 0) {
    kids.push(P("No evidence linked yet.", { italics: true, color: MUTED }));
    await save(doc(kids), `${systemName}_Evidence_Register.docx`);
    return { count: 0 };
  }

  // summary table
  kids.push(H("1. Summary", HeadingLevel.HEADING_1));
  kids.push(P(`${rows_flat.length} evidence item(s) linked across the assessment.`));
  const w = [1500, 1900, 3200, 1300, 1300];
  const rows = [headerRow(["Control", "Objective", "Artifact", "Method", "Type"], w)];
  rows_flat.forEach((r) => rows.push(row([r.control, r.objective, r.title, (r.method||"").toUpperCase(), (r.type||"").replace(/_/g," ")], w)));
  kids.push(new Table({ columnWidths: w, width: { size: 9200, type: WidthType.DXA }, rows }));

  // per-control breakdown
  kids.push(new Paragraph({ children: [new PageBreak()] }));
  kids.push(H("2. By Control", HeadingLevel.HEADING_1));
  const byCtrl = {};
  rows_flat.forEach((r) => { (byCtrl[r.control] ||= []).push(r); });
  Object.keys(byCtrl).sort().forEach((ctrl) => {
    kids.push(H(ctrl, HeadingLevel.HEADING_2));
    byCtrl[ctrl].forEach((r) => {
      kids.push(label(`${r.title}  ·  ${(r.method||"").toUpperCase()}`));
      kids.push(P(`Objective: ${r.objective}`, { size: 18, color: MUTED }));
      if (r.url) kids.push(P(r.url, { size: 18, color: SEAL }));
    });
  });

  await save(doc(kids), `${systemName}_Evidence_Register.docx`);
  return { count: rows_flat.length };
}

export async function buildAll(pkg, systemName) {
  await buildSSP(pkg, systemName);
  const pol = await buildPolicies(pkg, systemName);
  const pl = await buildPlans(pkg, systemName);
  const ev = await buildEvidenceRegister(pkg, systemName);
  return { pol, pl, ev };
}
