# Attesta

Compliance lifecycle platform. First module: FedRAMP Rev 5 Class C document
review & reconciliation for Krome.

## Stack
Vite + React + React Router · Supabase · deploy to Netlify.

## Run locally
```bash
npm install
cp .env.example .env      # fill in Supabase URL + anon key
npm run dev
```
Without `.env`, the app runs in **mock mode**: no auth, sample data, fully
browsable offline.

## Database — run in order
```bash
psql "$DATABASE_URL" -f supabase/01_schema.sql       # tables, views, triggers
psql "$DATABASE_URL" -f supabase/02_seed.sql         # NIST catalog + Class C (322 controls)
psql "$DATABASE_URL" -f supabase/03_functions.sql    # app RPCs
psql "$DATABASE_URL" -f supabase/04_bootstrap.sql    # Eccalon org, Krome system + assessment
```
After 04, the Review stage has a live target: 322 controls and 1,386 leaf
objectives in scope, all `gap` until narratives are approved and evidence linked.

Regenerate the seed with `python3 supabase/seed_gen.py`.

## What's built
- **Stage 01 · Onboarding** — TurboTax branching wizard → tailored plan → creates
  a system + scoped assessment on continue.
- **Stage 06 · Review & Reconcile** — family → control → objective drill-down,
  reading live coverage from `v_objective_state`, with the unproven-claim surface
  (approved narrative, no live evidence) flagged in amber.

Other lifecycle stages are honest stubs in the shell.

## The data flow
Onboarding → `create_assessment_from_onboarding` → assessment + assessment_control
+ assessment_objective rows. Review → `family_rollup` / `controls_in_family` /
`v_objective_state`. Coverage moves as document_section narratives get approved
and artifact_objective_link rows are added — those are stages 4 and 5, next to build.

## Deploy
`netlify.toml` configured (build `npm run build`, publish `dist`, SPA fallback).
Push to a repo, connect Netlify, set the two env vars.
