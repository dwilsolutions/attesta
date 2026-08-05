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

/* ---------- 1. SSP + Appendices ---------- */
export async function buildSSP(pkg, systemName) {
  const kids = [...titlePage("System Security Plan", `${systemName} · FedRAMP Moderate`)];
  kids.push(H("1. Introduction", HeadingLevel.HEADING_1));
  kids.push(P(`This System Security Plan documents the security control implementation for ${systemName}. Control narratives are organized by family and control, each addressing the applicable NIST SP 800-53 assessment objectives.`));

  // group by family
  const fams = {};
  pkg.forEach((c) => { (fams[c.family] ||= []).push(c); });
  Object.keys(fams).sort().forEach((fam) => {
    kids.push(new Paragraph({ children: [new PageBreak()] }));
    kids.push(H(`${fam} — ${fam} Family`, HeadingLevel.HEADING_1));
    fams[fam].forEach((c) => {
      kids.push(H(`${c.control_id.toUpperCase()} — ${c.title}`, HeadingLevel.HEADING_2));
      (c.objectives || []).forEach((o) => {
        kids.push(label(o.objective_id));
        kids.push(P(o.statement, { italics: true, color: MUTED, size: 19 }));
        if (o.narrative) kids.push(P(o.narrative));
        else kids.push(P("[No narrative — to be completed]", { italics: true, color: "B4402F", size: 19 }));
      });
    });
  });

  // Appendix A: coverage summary
  kids.push(new Paragraph({ children: [new PageBreak()] }));
  kids.push(H("Appendix A — Control Coverage Summary", HeadingLevel.HEADING_1));
  const w = [2200, 5400, 1600];
  const rows = [headerRow(["Control", "Title", "Coverage"], w)];
  pkg.forEach((c) => {
    const sat = (c.objectives || []).filter((o) => o.coverage === "satisfied").length;
    const tot = (c.objectives || []).length;
    rows.push(row([c.control_id.toUpperCase(), c.title, `${sat}/${tot}`], w));
  });
  kids.push(new Table({ columnWidths: w, width: { size: 9200, type: WidthType.DXA }, rows }));

  await save(doc(kids), `${systemName}_SSP.docx`);
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
