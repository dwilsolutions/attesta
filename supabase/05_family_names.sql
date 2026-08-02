-- ============================================================
-- Attesta fix · use full family names in the Review rollup
-- Replaces family_rollup so it labels families via family_label()
-- ("Access Control") instead of initcap on the raw code ("Ac").
-- Idempotent: create or replace. Run once in the SQL Editor.
-- ============================================================

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
           coalesce(vs.coverage, 'gap'::coverage_state)               as coverage,
           coalesce(vs.narrative_approved, false)                     as narrative_approved,
           coalesce(vs.evidence_linked, false)                        as evidence_linked
    from objs o
    left join v_objective_state vs
      on vs.assessment_id = p_assessment
     and vs.objective_id  = o.objective_id
  )
  select
    family                                                            as id,
    family_label(family)                                              as name,
    count(distinct control_id)::int                                   as controls,
    count(*)::int                                                     as objectives,
    count(*) filter (where coverage = 'satisfied')::int               as satisfied,
    count(*) filter (where narrative_approved and not evidence_linked)::int as claims
  from state
  group by family
  order by family;
$$;
