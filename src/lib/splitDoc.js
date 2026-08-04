// Split an extracted policy/procedure into heading-keyed sections.
// Recognizes common governing-doc headings, numbered or plain, and falls back
// to a single "Document" section if no headings are found.
const KNOWN = [
  "purpose", "scope", "roles and responsibilities", "roles", "responsibilities",
  "policy", "procedure", "procedures", "review", "definitions", "references",
  "compliance", "enforcement", "exceptions", "revision history",
];

// A line is a heading if it's short and matches a known heading (optionally
// prefixed with a number like "1." or "3.2"), or is ALL CAPS / Title Case short.
function isHeading(line) {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  const stripped = t.replace(/^\s*\d+(\.\d+)*\.?\s*/, "").trim().toLowerCase();
  if (KNOWN.includes(stripped)) return { heading: titleCase(stripped) };
  // numbered heading with a short title: "4. Policy", "3. Roles and Responsibilities"
  const m = t.match(/^\s*\d+(\.\d+)*\.?\s+([A-Z][A-Za-z &/]{2,40})\s*$/);
  if (m) return { heading: m[2].trim() };
  return false;
}

function titleCase(s) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function splitIntoSections(text) {
  const lines = text.split(/\r?\n/);
  const sections = [];
  let current = null;
  for (const line of lines) {
    const h = isHeading(line);
    if (h) {
      if (current) sections.push(current);
      current = { heading: h.heading, body: "" };
    } else if (current) {
      current.body += (current.body ? "\n" : "") + line;
    } else if (line.trim()) {
      // preamble before first heading -> a "Header" section
      current = { heading: "Header", body: line };
    }
  }
  if (current) sections.push(current);

  // clean whitespace; drop empty
  const cleaned = sections
    .map((s) => ({ heading: s.heading, body: s.body.trim() }))
    .filter((s) => s.body || s.heading !== "Header");

  if (cleaned.length === 0) return [{ heading: "Document", body: text.trim() }];
  return cleaned;
}
