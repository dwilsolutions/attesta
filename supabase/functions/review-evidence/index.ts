// Attesta · review-evidence Edge Function
// Fetches a shared link (SharePoint/Drive/public), reads what it can, and asks
// Claude which objectives of a given control the evidence satisfies + by which
// method. Returns proposals the user confirms. Bytes are never stored.
//
// Deploy as a NEW Edge Function named "review-evidence".
// Secret: ANTHROPIC_API_KEY (already set).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Reshape common share links toward a fetchable form.
function normalizeShareUrl(url) {
  try {
    const u = new URL(url);
    // Google Drive file link -> direct download
    const gd = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (gd) return `https://drive.google.com/uc?export=download&id=${gd[1]}`;
    // SharePoint/OneDrive: append download=1 to coax the raw file
    if (u.hostname.includes("sharepoint.com") || u.hostname.includes("1drv.ms") ||
        u.hostname.includes("-my.sharepoint")) {
      u.searchParams.set("download", "1");
      return u.toString();
    }
    return url;
  } catch { return url; }
}

async function fetchEvidenceText(url) {
  const target = normalizeShareUrl(url);
  const resp = await fetch(target, { redirect: "follow" });
  const ctype = resp.headers.get("content-type") || "";
  if (!resp.ok) return { ok: false, reason: `fetch returned ${resp.status}` };

  // Only handle text-ish content server-side for now. Binary docs (docx/pdf)
  // from a raw fetch aren't parsed here — the UI offers a paste fallback.
  if (ctype.includes("text") || ctype.includes("json") || ctype.includes("csv") ||
      ctype.includes("xml")) {
    const t = await resp.text();
    return { ok: true, text: t.slice(0, 12000), ctype };
  }
  if (ctype.includes("html")) {
    // Likely a viewer/login wrapper, not the file. Strip tags, keep any visible text.
    const html = await resp.text();
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, "")
                         .replace(/<style[\s\S]*?<\/style>/gi, "")
                         .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    // If it looks like a login/sign-in wrapper, tell the caller to use paste.
    if (/sign in|log in|redirecting|authentication/i.test(stripped.slice(0, 500))) {
      return { ok: false, reason: "link resolves to a sign-in page; paste the evidence text instead" };
    }
    return { ok: true, text: stripped.slice(0, 12000), ctype, note: "extracted from HTML" };
  }
  return { ok: false, reason: `unsupported content type (${ctype}); paste the evidence text instead` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { control_id, url, pasted_text, title } = await req.json();
    if (!control_id) return json({ error: "control_id required" }, 400);

    let evidenceText = pasted_text || "";
    let fetchNote = "";
    if (!evidenceText && url) {
      const fetched = await fetchEvidenceText(url);
      if (fetched.ok) { evidenceText = fetched.text; fetchNote = fetched.note || ""; }
      else return json({ ok: false, needs_paste: true, reason: fetched.reason }, 200);
    }
    if (!evidenceText) return json({ error: "provide url or pasted_text" }, 400);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));

    const { data: objectives, error: objErr } = await supabase
      .from("control_objective")
      .select("objective_id, statement")
      .eq("control_id", control_id)
      .eq("is_leaf", true)
      .order("sequence");
    if (objErr) throw objErr;
    if (!objectives?.length) return json({ error: "no objectives for control" }, 404);

    const objList = objectives.map((o) => `- ${o.objective_id}: ${o.statement}`).join("\n");

    const prompt = `You are a FedRAMP assessor reviewing a piece of evidence against the
assessment objectives for control ${control_id.toUpperCase()}.

Evidence artifact${title ? ` ("${title}")` : ""} content:
"""
${evidenceText}
"""

For each objective this evidence genuinely supports, decide the assessment METHOD the
evidence represents: "examine" (a document, config export, screenshot, or artifact you
look at), "interview" (notes from talking to personnel), or "test" (results of actually
exercising a control). Only include objectives the evidence actually supports — do not
force matches.

Return ONLY valid JSON, an array (possibly empty):
[{"objective_id":"...","method":"examine|interview|test","supports":"one sentence on how this evidence supports the objective","confidence":"high|medium|low"}]

OBJECTIVES:
${objList}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 1500,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiResp.ok) return json({ error: "anthropic failed", detail: await aiResp.text() }, 502);
    const aiData = await aiResp.json();
    const text = (aiData.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let matches;
    try { matches = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { return json({ error: "could not parse AI JSON", raw: text }, 502); }

    return json({ ok: true, control_id, fetch_note: fetchNote, matches });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "content-type": "application/json" },
  });
}
