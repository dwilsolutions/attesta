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
  for (const [fam, hints] of FAMILY_HINTS) {
    if (hints.some((h) => s.includes(h))) return fam;
  }
  return null;
}
