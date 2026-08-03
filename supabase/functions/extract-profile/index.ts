// Attesta · extract-profile Edge Function
// Reads uploaded document text and proposes onboarding profile fields
// (hosting, service model, inheritance) so the user confirms rather than
// answers a questionnaire. Returns nulls for anything it can't determine —
// those fall back to being asked.
//
// Deploy: paste into a new Edge Function named "extract-profile".
// Secret needed: ANTHROPIC_API_KEY (already set for ingest-document).

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { extracted_text } = await req.json();
    if (!extracted_text) return json({ error: "extracted_text required" }, 400);

    const prompt = `You are reading an organization's existing compliance documentation
(an SSP, policies, and/or a responsibility matrix) to pre-fill an onboarding profile.
Extract ONLY what the text actually states. If a field is not clearly stated, return null
for it — do not guess.

Return ONLY valid JSON with exactly these keys:
{
  "hosting": one of "azure_gov" | "aws_govcloud" | "gcc_high" | "onprem" | "other" | null,
  "service_model": one of "saas" | "paas" | "iaas" | null,
  "inherits_from_csp": true | false | null,   // does it inherit controls from a cloud provider's authorization?
  "system_name": string | null,               // the system/product name if stated
  "evidence": {
    "hosting": short quote or phrase from the text supporting the hosting value, or null,
    "service_model": short quote supporting service_model, or null
  }
}

DOCUMENT TEXT:
"""
${extracted_text.slice(0, 14000)}
"""`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": Deno.env.get("ANTHROPIC_API_KEY"),
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!aiResp.ok) return json({ error: "anthropic failed", detail: await aiResp.text() }, 502);
    const aiData = await aiResp.json();
    const text = (aiData.content || []).filter((b) => b.type === "text").map((b) => b.text).join("");
    let profile;
    try { profile = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { return json({ error: "could not parse profile JSON", raw: text }, 502); }

    return json({ ok: true, profile });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...cors, "content-type": "application/json" },
  });
}
