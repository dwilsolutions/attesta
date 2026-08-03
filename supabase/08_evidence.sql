-- ============================================================
-- Attesta · Stage 5 evidence linking
-- Persist a confirmed evidence match: create the artifact (index only,
-- no bytes), link it to objectives, and recompute coverage.
-- artifact / artifact_objective_link already exist (01_schema).
-- Run after 01-07. Idempotent.
-- ============================================================

-- Link confirmed evidence to an objective and update coverage.
-- Called once per (artifact, objective) the user confirms.
create or replace function link_evidence(
  p_assessment  uuid,
  p_objective   text,
  p_title       text,
  p_url         text,
  p_artifact_type text,
  p_method      text,
  p_supports    text
) returns void language plpgsql as $$
declare
  v_org      uuid;
  v_system   uuid;
  v_artifact uuid;
  v_has_narr boolean;
begin
  select s.organization_id, s.id into v_org, v_system
  from assessment a join system s on s.id = a.system_id
  where a.id = p_assessment;

  -- find an existing artifact by url (same shared link reused across objectives)
  select id into v_artifact from artifact
  where organization_id = v_org and sharepoint_url = p_url
  limit 1;

  if v_artifact is null then
    insert into artifact (organization_id, system_id, owner_scope, title, artifact_type,
                          method, sharepoint_url, access_state, last_verified_at)
    values (v_org, v_system, 'system', p_title, p_artifact_type::artifact_type,
            p_method::assessment_method, p_url, 'ok', now())
    returning id into v_artifact;
  end if;

  -- link (idempotent on the pk)
  insert into artifact_objective_link (artifact_id, objective_id, excerpt_ref, linked_by, confidence)
  values (v_artifact, p_objective, p_supports, 'user', 'confirmed')
  on conflict (artifact_id, objective_id) do nothing;

  -- coverage: satisfied if a narrative is approved AND evidence now linked; else partial
  select exists (
    select 1 from document_section ds
    where ds.objective_id = p_objective and ds.organization_id = v_org
      and ds.status = 'approved'
  ) into v_has_narr;

  update assessment_objective
  set coverage = case when v_has_narr then 'satisfied'::coverage_state
                      else 'partial'::coverage_state end,
      updated_at = now()
  where assessment_id = p_assessment and objective_id = p_objective;
end $$;

-- Evidence already linked for a control (for the drill-down to show).
create or replace function evidence_for_control(p_assessment uuid, p_control text)
returns table (
  objective_id text,
  artifact_id  uuid,
  title        text,
  url          text,
  method       text,
  supports     text
) language sql stable as $$
  select aol.objective_id, a.id, a.title, a.sharepoint_url,
         a.method::text, aol.excerpt_ref
  from artifact_objective_link aol
  join artifact a on a.id = aol.artifact_id
  join control_objective co on co.objective_id = aol.objective_id
  where co.control_id = p_control
    and a.organization_id = (
      select s.organization_id from assessment ass
      join system s on s.id = ass.system_id where ass.id = p_assessment)
  order by aol.objective_id;
$$;
