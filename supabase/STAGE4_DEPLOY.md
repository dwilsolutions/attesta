# Stage 4 (Complete Docs) — deploy steps

Two new pieces beyond a normal push: one SQL file, and one Edge Function.

## 1. Run the SQL
In Supabase SQL Editor, run:
    supabase/06_stage4.sql
Adds narrative_proposal table, accept_proposal(), proposals_for_review(),
and upload columns. Idempotent (create-if-not-exists / or-replace).

## 2. Deploy the Edge Function
The AI drafting runs server-side so the Anthropic key stays secret.
Needs the Supabase CLI once:

    npm install -g supabase
    supabase login
    supabase link --project-ref dhqyezllssiyzqutxgti
    supabase secrets set ANTHROPIC_API_KEY=sk-ant-YOUR-KEY
    supabase functions deploy ingest-document

SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected automatically.

## 3. Push the app
Commit + push as usual. Netlify rebuilds. New route: /complete-docs
(the "Complete Docs" stage in the journey nav).

## Flow
Upload .docx/.pdf/.txt/.md → text extracted in-browser (file never stored)
→ "Draft narratives" calls ingest-document per control → Claude drafts a
narrative per objective → proposals land in narrative_proposal → review &
accept in the control drill-down → accepted narratives flip objectives from
gap to partial (evidence still needed for satisfied).

## Note on the control list
Ingest.jsx currently drafts for a representative set of ~13 controls
(SEED_CONTROLS) to keep the first pass fast/cheap. To draft the full 322,
replace that array with a query over framework_control where is_baseline_member.
