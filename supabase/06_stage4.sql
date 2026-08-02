-- ============================================================
-- Attesta · Stage 4 (Complete Docs) schema additions
-- Document ingestion → AI-drafted narratives per objective.
-- Run after 01–04. Idempotent where possible.
-- ============================================================

-- source_upload already exists (01_schema). Add columns for the
-- parse lifecycle and the "discard original after parse" policy.
alter table source_upload
  add column if not exists doc_type      text,        -- ssp | policy | procedure | other
  add column if not exists extracted_text text,       -- parsed plain text (transient working copy)
  add column if not exists retain_source  boolean not null default false; -- option 3: don't keep binary

-- A draft proposal per objective, produced by the AI pass.
-- Separate from document_section (the approved system-of-record):
-- proposals are staging; on approval we write document_section.
create table if not exists narrative_proposal (
  id              uuid primary key default gen_random_uuid(),
  assessment_id   uuid not null references assessment(id) on delete cascade,
  objective_id    text not null references control_objective(objective_id),
  source_upload_id uuid references source_upload(id) on delete set null,
  draft_text      text,                   -- AI-proposed narrative
  rationale       text,                   -- why the AI thinks this answers the objective
  source_excerpt  text,                   -- the uploaded text it drew from
  confidence      text,                   -- high | medium | low
  status          text not null default 'proposed',  -- proposed | accepted | edited | rejected
  created_at      timestamptz not null default now(),
  unique (assessment_id, objective_id)
);
create index if not exists narrative_proposal_assessment_idx
  on narrative_proposal (assessment_id, status);

-- Accepting a proposal writes an approved document_section and marks
-- the objective's coverage. One function keeps it atomic.
create or replace function accept_proposal(p_proposal uuid, p_editor text, p_final_text text)
returns void language plpgsql as $$
declare
  v_obj  text;
  v_assess uuid;
  v_org  uuid;
  v_doc  uuid;
begin
  select objective_id, assessment_id into v_obj, v_assess
  from narrative_proposal where id = p_proposal;

  select s.organization_id into v_org
  from assessment a join system s on s.id = a.system_id
  where a.id = v_assess;

  -- find or create an SSP document to hold approved sections
  select id into v_doc from document
  where organization_id = v_org and doc_type = 'ssp'
  order by created_at limit 1;

  if v_doc is null then
    insert into document (organization_id, doc_type, title, status)
    values (v_org, 'ssp', 'System Security Plan', 'in_review')
    returning id into v_doc;
  end if;

  -- upsert the approved section
  insert into document_section
    (document_id, organization_id, objective_id, body_text, status, origin, approved_by, approved_at)
  values
    (v_doc, v_org, v_obj, p_final_text, 'approved', 'ai_generated', p_editor, now())
  on conflict (document_id, objective_id) do update
    set body_text = excluded.body_text, status = 'approved',
        approved_by = excluded.approved_by, approved_at = now();

  -- reflect coverage: narrative present. (Evidence still required for 'satisfied'.)
  update assessment_objective
    set coverage = case when coverage = 'gap' then 'partial'::coverage_state else coverage end,
        updated_at = now()
  where assessment_id = v_assess and objective_id = v_obj;

  update narrative_proposal set status = 'accepted' where id = p_proposal;
end $$;

-- Proposals waiting for review, joined to their objective text.
create or replace function proposals_for_review(p_assessment uuid, p_control text default null)
returns table (
  proposal_id  uuid,
  objective_id text,
  control_id   text,
  statement    text,
  draft_text   text,
  rationale    text,
  confidence   text,
  status       text
) language sql stable as $$
  select np.id, np.objective_id, co.control_id, co.statement,
         np.draft_text, np.rationale, np.confidence, np.status
  from narrative_proposal np
  join control_objective co on co.objective_id = np.objective_id
  where np.assessment_id = p_assessment
    and (p_control is null or co.control_id = p_control)
  order by co.control_id, co.objective_id;
$$;
