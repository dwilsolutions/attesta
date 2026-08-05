// Attesta · SSP narrative extractor.
// A filled FedRAMP SSP contains, per control, a table titled
// "{CONTROL} What is the solution and how is it implemented?" whose rows are the
// implementation narrative — either "Part a: …/Part b: …" (mapping to lettered
// objectives) or a single blob (for single-objective controls). This pulls those
// real narratives out so we DON'T need to AI-draft them.
import mammoth from "mammoth";

// "AC-2(1)" -> "ac-2.1", "AC-2" -> "ac-2"
export function normControl(raw) {
  const m = String(raw).match(/^([A-Za-z]{2})-(\d+)(?:\((\d+)\))?$/);
  if (!m) return null;
  const enh = m[3] ? `.${parseInt(m[3], 10)}` : "";
  return `${m[1].toLowerCase()}-${parseInt(m[2], 10)}${enh}`;
}

// Parse the SSP docx into { controlId: { parts: {a:"...",b:"..."}, blob: "..." } }
export async function extractSSP(file) {
  const buf = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer: buf });
  const dom = new DOMParser().parseFromString(html, "text/html");

  const out = {};
  const tables = Array.from(dom.querySelectorAll("table"));
  for (const table of tables) {
    const firstCell = table.querySelector("td, th");
    if (!firstCell) continue;
    const head = firstCell.textContent.trim();
    const m = head.match(/^([A-Za-z]{2}-\d+(?:\(\d+\))?)\s+What is the solution/i);
    if (!m) continue;
    const cid = normControl(m[1]);
    if (!cid) continue;

    const parts = {};
    const blobLines = [];
    const rows = Array.from(table.querySelectorAll("tr"));
    for (let i = 1; i < rows.length; i++) {
      const text = rows[i].textContent.trim();
      if (!text) continue;
      const pm = text.match(/^Part\s+([a-z0-9]+)\s*[:.]\s*([\s\S]*)$/i);
      if (pm) parts[pm[1].toLowerCase()] = pm[2].trim();
      else blobLines.push(text);
    }
    out[cid] = { parts, blob: blobLines.join("\n").trim() };
  }
  return out;
}

// Given extracted SSP data + the objective list for a control, produce
// [{objective_id, text}] pairs to save as approved narratives.
//   - part letter matches the objective suffix (ac-2_obj.a <- Part a)
//   - a blob with one objective -> whole blob to that objective
//   - a blob with several objectives -> blob to each (same implementation text)
export function mapToObjectives(controlData, objectives) {
  if (!controlData) return [];
  const pairs = [];
  const { parts, blob } = controlData;
  const suffixOf = (oid) => {
    const m = oid.match(/_obj\.(.+)$/);
    return m ? m[1].toLowerCase() : null;
  };
  if (Object.keys(parts).length > 0) {
    for (const o of objectives) {
      const suf = suffixOf(o.objective_id);
      if (!suf) continue;
      // match "a" to part "a"; "a-1"/"a.1" fall back to part "a"
      const base = suf.split(/[-.]/)[0];
      const text = parts[suf] || parts[base];
      if (text) pairs.push({ objective_id: o.objective_id, text });
    }
    // if nothing matched by letter but we have a blob too, fall through
    if (pairs.length === 0 && blob) {
      for (const o of objectives) pairs.push({ objective_id: o.objective_id, text: blob });
    }
  } else if (blob) {
    for (const o of objectives) pairs.push({ objective_id: o.objective_id, text: blob });
  }
  return pairs;
}
