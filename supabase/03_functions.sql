-- ============================================================
-- ATTESTA — application RPCs
-- The app calls these; they read the views 01_schema.sql defines.
-- Run after 01_schema.sql and 02_seed.sql.
-- ============================================================

-- ---- family rollup for the Review stage ----
-- Coverage per control family for a given assessment, over baseline members.
create or replace function family_rollup(p_assessment uuid)
returns table (
  id          text,
  name        text,
  controls    int,
  objectives  int,
  satisfied   int,
  claims      int
) language sql stable as $$
  with scope as (
    select distinct c.control_id, c.family
    from assessment_control ac
    join framework_control fc on fc.id = ac.framework_control_id
    join control c on c.control_id = fc.control_id
    where ac.assessment_id = p_assessment
      and ac.is_baseline_member
  ),
  objs as (
    select co.control_id, co.objective_id, s.family
    from control_objective co
    join scope s on s.control_id = co.control_id
    where co.is_leaf
  ),
  state as (
    select o.family,
           o.control_id,
           o.objective_id,
           coalesce(vs.coverage, 'gap'::coverage_state)                                as coverage,
           coalesce(vs.narrative_approved, false)                      as narrative_approved,
           coalesce(vs.evidence_linked, false)                         as evidence_linked
    from objs o
    left join v_objective_state vs
      on vs.assessment_id = p_assessment
     and vs.objective_id  = o.objective_id
  )
  select
    family                                                             as id,
    initcap(replace(family, '-', ' '))                                 as name,
    count(distinct control_id)::int                                    as controls,
    count(*)::int                                                      as objectives,
    count(*) filter (where coverage = 'satisfied')::int                as satisfied,
    count(*) filter (where narrative_approved and not evidence_linked)::int as claims
  from state
  group by family
  order by family;
$$;

-- ---- family display names (nice labels for the UI) ----
create or replace function family_label(fam text)
returns text language sql immutable as $$
  select case fam
    when 'ac' then 'Access Control'
    when 'at' then 'Awareness & Training'
    when 'au' then 'Audit & Accountability'
    when 'ca' then 'Assessment, Authorization & Monitoring'
    when 'cm' then 'Configuration Management'
    when 'cp' then 'Contingency Planning'
    when 'ia' then 'Identification & Authentication'
    when 'ir' then 'Incident Response'
    when 'ma' then 'Maintenance'
    when 'mp' then 'Media Protection'
    when 'pe' then 'Physical & Environmental Protection'
    when 'pl' then 'Planning'
    when 'pm' then 'Program Management'
    when 'ps' then 'Personnel Security'
    when 'pt' then 'PII Processing & Transparency'
    when 'ra' then 'Risk Assessment'
    when 'sa' then 'System & Services Acquisition'
    when 'sc' then 'System & Communications Protection'
    when 'si' then 'System & Information Integrity'
    when 'sr' then 'Supply Chain Risk Management'
    else initcap(replace(fam, '-', ' '))
  end;
$$;

-- ---- controls in a family for an assessment (drill-down list) ----
create or replace function controls_in_family(p_assessment uuid, p_family text)
returns table (
  control_id text,
  title      text,
  objectives int,
  satisfied  int,
  claims     int
) language sql stable as $$
  with fc_scope as (
    select c.control_id, c.title
    from assessment_control ac
    join framework_control fc on fc.id = ac.framework_control_id
    join control c on c.control_id = fc.control_id
    where ac.assessment_id = p_assessment
      and ac.is_baseline_member
      and c.family = p_family
  ),
  objs as (
    select co.control_id, co.objective_id
    from control_objective co
    join fc_scope f on f.control_id = co.control_id
    where co.is_leaf
  )
  select
    f.control_id,
    f.title,
    count(o.objective_id)::int as objectives,
    count(*) filter (where vs.coverage = 'satisfied')::int as satisfied,
    count(*) filter (where vs.narrative_approved and not vs.evidence_linked)::int as claims
  from fc_scope f
  left join objs o on o.control_id = f.control_id
  left join v_objective_state vs
    on vs.assessment_id = p_assessment and vs.objective_id = o.objective_id
  group by f.control_id, f.title
  order by f.control_id;
$$;

-- ---- onboarding: create system + assessment from wizard output ----
-- p_answers and p_plan are the raw wizard JSON; we persist a system and a
-- scoped assessment, seed assessment_control from the framework baseline,
-- and return the new assessment id for the app to route into.
create or replace function create_assessment_from_onboarding(
  p_org uuid,
  p_system_name text,
  p_framework text,
  p_answers jsonb,
  p_plan jsonb
)
returns uuid language plpgsql as $$
declare
  v_system uuid;
  v_assessment uuid;
begin
  insert into system (organization_id, name, boundary_description)
  values (p_org, p_system_name, p_plan->>'summary')
  on conflict (organization_id, name) do update set boundary_description = excluded.boundary_description
  returning id into v_system;

  insert into assessment (system_id, framework_id, name, end_state, status)
  values (v_system, p_framework,
          p_system_name || ' — ' || p_framework,
          coalesce(p_plan->>'end_state', '3pao_readiness'),
          'in_progress')
  returning id into v_assessment;

  -- seed assessment_control from baseline members of the framework
  insert into assessment_control (assessment_id, framework_control_id, is_baseline_member)
  select v_assessment, fc.id, true
  from framework_control fc
  where fc.framework_id = p_framework
    and fc.is_baseline_member;

  -- seed assessment_objective rows (gap by default) for every leaf under scope
  insert into assessment_objective (assessment_id, objective_id, coverage)
  select distinct v_assessment, co.objective_id, 'gap'::coverage_state
  from assessment_control ac
  join framework_control fc on fc.id = ac.framework_control_id
  join control_objective co on co.control_id = fc.control_id
  where ac.assessment_id = v_assessment
    and co.is_leaf;

  return v_assessment;
end $$;

-- ---- convenience: find or create the singleton org ----
create or replace function ensure_org(p_name text)
returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into organization (name) values (p_name)
  on conflict (name) do update set name = excluded.name
  returning id into v_id;
  return v_id;
end $$;
