-- ============================================================
-- ATTESTA — bootstrap Krome
-- Stands up the Eccalon org, Krome system, and its Class C
-- assessment, then seeds control + objective rows so the
-- Review stage has a live target. Idempotent-ish: safe to run
-- once after 01→03. Re-running creates a second assessment.
-- ============================================================

do $$
declare
  v_org uuid;
  v_system uuid;
  v_assessment uuid;
begin
  -- org
  v_org := ensure_org('Eccalon');

  -- system
  insert into system (organization_id, name, boundary_description)
  values (v_org, 'Krome', 'Azure Government / M365 GCC — FedRAMP Rev 5 Class C boundary')
  on conflict (organization_id, name) do update
    set boundary_description = excluded.boundary_description
  returning id into v_system;

  -- assessment (only if Krome has none yet)
  select id into v_assessment
  from assessment
  where system_id = v_system and framework_id = 'fedramp-class-c'
  limit 1;

  if v_assessment is null then
    insert into assessment (system_id, framework_id, name, end_state, status)
    values (v_system, 'fedramp-class-c', 'Krome — FedRAMP Rev 5 Class C',
            '3pao_readiness', 'in_progress')
    returning id into v_assessment;

    -- baseline controls into scope
    insert into assessment_control (assessment_id, framework_control_id, is_baseline_member)
    select v_assessment, fc.id, true
    from framework_control fc
    where fc.framework_id = 'fedramp-class-c' and fc.is_baseline_member;

    -- every leaf objective under those controls, gap by default
    insert into assessment_objective (assessment_id, objective_id, coverage)
    select distinct v_assessment, co.objective_id, 'gap'::coverage_state
    from assessment_control ac
    join framework_control fc on fc.id = ac.framework_control_id
    join control_objective co on co.control_id = fc.control_id
    where ac.assessment_id = v_assessment and co.is_leaf;
  end if;

  raise notice 'Krome assessment: %', v_assessment;
end $$;

-- verification
select 'controls in scope' as metric, count(*)::text as value
from assessment_control ac
join assessment a on a.id = ac.assessment_id
join system s on s.id = a.system_id
where s.name = 'Krome' and ac.is_baseline_member
union all
select 'leaf objectives in scope', count(*)::text
from assessment_objective ao
join assessment a on a.id = ao.assessment_id
join system s on s.id = a.system_id
where s.name = 'Krome';
