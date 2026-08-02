// Attesta · ingest-document Edge Function
// Runs server-side on Supabase. Parses an uploaded doc to text, then asks
// Claude to draft a narrative per objective for a given control.
//
// Deploy:  supabase functions deploy ingest-document
// Secrets: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// The browser NEVER sees the Anthropic key. The app calls this function
// with the Supabase anon JWT; the function uses the service role to write.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { assessment_id, control_id, extracted_text, source_upload_id } = await req.json();
    if (!assessment_id || !control_id || !extracted_text) {
      return json({ error: "assessment_id, control_id, extracted_text required" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Pull the objectives for this control.
    const { data: objectives, error: objErr } = await supabase
      .from("control_objective")
      .select("objective_id, statement")
      .eq("control_id", control_id)
      .eq("is_leaf", true)
      .order("sequence");
    if (objErr) throw objErr;
    if (!objectives?.length) return json({ error: "no objectives for control" }, 404);

    // 2. Ask Claude for a draft narrative per objective, in one call.
    const objList = objectives
      .map((o) => `- ${o.objective_id}: ${o.statement}`)
      .join("\n");

    const prompt = `You are helping prepare a FedRAMP System Security Plan.
Below is source text from an organization's existing documentation, followed by
the assessment objectives for control ${control_id.toUpperCase()}.

For EACH objective, draft a concise SSP narrative (2-4 sentences) describing how
the organization satisfies it, grounded ONLY in the source text. If the source
does not address an objective, set draft_text to "" and confidence to "low".
Never invent controls, tools, or facts not present in the source.

Return ONLY valid JSON, an array where each element is:
{"objective_id": "...", "draft_text": "...", "rationale": "one sentence on what source text supports this", "confidence": "high|medium|low"}

SOURCE TEXT:
"""
${extracted_text.slice(0, 12000)}
"""

OBJECTIVES:
${objList}`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY")!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiResp.ok) {
      const t = await aiResp.text();
      return json({ error: "anthropic call failed", detail: t }, 502);
    }
    const aiData = await aiResp.json();
    const text = (aiData.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("");

    let proposals: any[];
    try {
      proposals = JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
      return json({ error: "could not parse AI JSON", raw: text }, 502);
    }

    // 3. Upsert proposals.
    const rows = proposals.map((p) => ({
      assessment_id,
      objective_id: p.objective_id,
      source_upload_id: source_upload_id ?? null,
      draft_text: p.draft_text ?? "",
      rationale: p.rationale ?? "",
      confidence: p.confidence ?? "low",
      status: "proposed",
    }));

    const { error: upErr } = await supabase
      .from("narrative_proposal")
      .upsert(rows, { onConflict: "assessment_id,objective_id" });
    if (upErr) throw upErr;

    return json({ ok: true, control_id, proposed: rows.length });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "content-type": "application/json" },
  });
}
