# Attesta — Supabase

Run the SQL files in numeric order in the Supabase SQL Editor (or via psql).
Each is idempotent or safe to re-run except 02 (seed) and 04 (bootstrap),
which you run once.

## Run order
  01_schema.sql        Tables, views, triggers, enums.
  02_seed.sql          NIST 800-53 Rev 5 catalog + FedRAMP Class C (322 controls,
                       1,386 leaf objectives). Large — use psql if the editor
                       rejects the size.
  03_functions.sql     App RPCs: family_rollup, controls_in_family,
                       proposals_for_review, accept_proposal, etc.
  04_bootstrap.sql     Creates Eccalon org, Krome system, its Class C assessment,
                       and scopes all controls + objectives (gap by default).
                       Run once. Prints 322 / 1386 to verify.
  05_family_names.sql  Makes family_rollup use full family names ("Access Control"
                       not "Ac").
  06_stage4.sql        Stage 4: narrative_proposal table + accept/review functions.
  07_clean_params.sql  Cleans {{ insert: param }} placeholders in objective text.

## Edge Function
  functions/ingest-document/index.ts
    Deployed via Supabase dashboard (Edge Functions → new → paste) or CLI.
    Needs secret: ANTHROPIC_API_KEY.
    Parses uploaded doc text + drafts a narrative per objective via Claude.

## Regenerating the seed
  python3 seed_gen.py   Re-fetches the NIST catalog + FedRAMP Class C membership
                        and rewrites 02_seed.sql.
