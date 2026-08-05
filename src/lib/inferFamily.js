// Infer the 800-53 family from a policy/procedure's name or text.
const FAMILY_HINTS = [
  ["ac", ["access control"]],
  ["at", ["awareness", "training", "awareness and training"]],
  ["au", ["audit", "accountability", "audit and accountability"]],
  ["ca", ["assessment, authorization", "security assessment"]],
  ["cm", ["configuration management", "cmp", "config management plan"]],
  ["cp", ["contingency", "iscp", "contingency plan"]],
  ["ia", ["identification and authentication", "identification", "authentication"]],
  ["ir", ["incident response", "irp"]],
  ["ma", ["maintenance"]],
  ["mp", ["media protection"]],
  ["pe", ["physical", "environmental"]],
  ["pl", ["planning"]],
  ["ps", ["personnel security"]],
  ["ra", ["risk assessment"]],
  ["sa", ["system and services acquisition", "acquisition"]],
  ["sc", ["system and communications protection", "communications protection"]],
  ["si", ["system and information integrity", "information integrity"]],
  ["sr", ["supply chain"]],
];

export function inferFamily(nameOrText) {
  const s = (nameOrText || "").toLowerCase();
  // 1. bare family code as a standalone token: "...FedRAMP AC Policy...", "AU Procedures"
  //    (the 18 NIST families). Matches the CODE surrounded by non-letters.
  const codes = ["ac","at","au","ca","cm","cp","ia","ir","ma","mp","pe","pl","ps","ra","sa","sc","si","sr"];
  const codeMatch = s.match(/(?:^|[^a-z])([a-z]{2})(?:[^a-z]|$)/g);
  if (codeMatch) {
    for (const chunk of codeMatch) {
      const c = chunk.replace(/[^a-z]/g, "");
      if (codes.includes(c)) return c;
    }
  }
  // 2. fall back to descriptive hints ("access control", "audit", ...)
  for (const [fam, hints] of FAMILY_HINTS) {
    if (hints.some((h) => s.includes(h))) return fam;
  }
  return null;
}

// Infer a specific CONTROL id from a doc name, e.g. "AC-2 Policy" -> "ac-2",
// "AC-17(1) Procedure" -> "ac-17.1". Returns null if no control id is present
// (then the caller can fall back to family-level or ask).
export function inferControl(nameOrText) {
  const s = (nameOrText || "");
  // match AC-2, AC-02, AC-2(1), AC-17.1, ac-2, etc.
  const m = s.match(/\b([A-Za-z]{2})[-\s]?0*(\d{1,2})(?:\s*\(\s*0*(\d{1,2})\s*\)|\.(\d{1,2}))?/);
  if (!m) return null;
  const fam = m[1].toLowerCase();
  const num = parseInt(m[2], 10);
  const enh = m[3] || m[4];
  return `${fam}-${num}` + (enh ? `.${parseInt(enh, 10)}` : "");
}
