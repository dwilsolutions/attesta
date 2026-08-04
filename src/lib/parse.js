// Client-side text extraction. Keeps raw files off the server (option 3):
// we extract text in the browser and send only text to the edge function.
// .txt/.md: native. .docx: mammoth. .pdf: pdfjs.
import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import pdfWorker from "pdfjs-dist/build/pdf.worker.min.mjs?url";
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".txt") || name.endsWith(".md")) {
    return await file.text();
  }
  if (name.endsWith(".docx")) {
    const buf = await file.arrayBuffer();
    const { value } = await mammoth.extractRawText({ arrayBuffer: buf });
    return value;
  }
  if (name.endsWith(".pdf")) {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let out = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return out;
  }
  throw new Error("Unsupported file type. Use .docx, .pdf, .txt, or .md");
}

export function guessDocType(filename) {
  const n = filename.toLowerCase();
  if (n.includes("ssp") || n.includes("security plan")) return "ssp";
  if (n.includes("policy") || n.includes("policies")) return "policy";
  if (n.includes("procedure")) return "procedure";
  if (n.includes("plan") || n.includes("irp") || n.includes("iscp") || n.includes("cmp"))
    return "plan";
  return "other";
}
