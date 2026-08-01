-- ============================================================
-- ATTESTA — control database
-- FedRAMP Rev 5 Class C first. Catalog 5.2.0 / OSCAL 1.2.2.
-- ============================================================

create extension if not exists "pgcrypto";

-- ---------- enums ----------

create type assessment_method as enum ('examine','interview','test');
create type objective_source  as enum ('nist-800-53a','nist-800-171a');
create type spine_relation    as enum ('baseline_selection','derived','peer');
create type mapping_relation  as enum ('equivalent','subset','superset','partial','addresses');
create type param_source      as enum ('fedramp','agency','csp');

create type impl_status       as enum ('implemented','partial','planned','not_applicable','inherited');
create type inheritance_type  as enum ('inherited','shared','customer','hybrid');
create type coverage_state    as enum ('satisfied','partial','gap','not_applicable');

create type doc_type          as enum ('ssp','policy','procedure','crm','plan');
create type doc_status        as enum ('draft','in_review','approved','superseded');
create type section_status    as enum ('draft','ai_suggested','human_edited','approved');
create type section_origin    as enum ('ingested','ai_generated','human_authored');

create type artifact_type     as enum (
  'config_export','screenshot','log_sample','interview_note',
  'attestation','inventory','csp_package_ref','diagram'
);
create type owner_scope       as enum ('organization','system','csp_published');
create type access_state      as enum ('ok','permission_denied','not_found','stale');

-- ============================================================
-- SPINE — 800-53 Rev 5. Reference data, shared by everything.
-- ============================================================

create table control (
  control_id        text primary key,              -- 'ac-2', 'ac-2.1'
  family            text not null,                 -- 'ac'
  title             text not null,
  statement         text,
  is_enhancement    boolean not null default false,
  parent_control_id text references control(control_id),
  is_withdrawn      boolean not null default false, -- 182 in catalog; never baseline members
  methods           assessment_method[] not null default '{}',  -- available at CONTROL level per OSCAL
  catalog_version   text not null                  -- '5.2.0'
);
create index on control (family);
create index on control (parent_control_id);
create index on control (family) where not is_withdrawn;

-- Objectives nest to depth 5. Leaves are the review/link grain; parents are nav.
create table control_objective (
  objective_id        text primary key,            -- 'ac-2_obj.d.3-2'
  control_id          text not null references control(control_id) on delete cascade,
  parent_objective_id text references control_objective(objective_id) on delete cascade,
  statement           text,                        -- null on container nodes
  is_leaf             boolean not null,
  depth               int not null,
  sequence            int not null,
  source              objective_source not null default 'nist-800-53a'
);
create index on control_objective (control_id, sequence);
create index on control_objective (parent_objective_id);
create index on control_objective (control_id) where is_leaf;

-- Only leaves may be authored against or linked to evidence.
-- Enforced by trigger (not CHECK: check constraints must be immutable and
-- may not query other tables; Postgres accepts such a CHECK but it is unsound).
create or replace function enforce_leaf_objective()
returns trigger language plpgsql as $$
begin
  if not coalesce((select is_leaf from control_objective
                   where objective_id = new.objective_id), false) then
    raise exception 'objective % is a container, not a leaf - cannot author or link against it',
      new.objective_id;
  end if;
  return new;
end $$;

-- ============================================================
-- FRAMEWORK PROJECTIONS
-- ============================================================

create table framework (
  id             text primary key,                 -- 'fedramp-class-c'
  name           text not null,
  version_pin    text not null,                    -- 'rev5-class-c-catalog-5.2.0-2026-05-11'
  spine_relation spine_relation not null,
  aliases        text[] default '{}'               -- {'moderate','fedramp-moderate-r5'}
);

create table framework_control (
  id                   uuid primary key default gen_random_uuid(),
  framework_id         text not null references framework(id) on delete cascade,
  framework_control_id text not null,              -- 'AC-02' or '3.1.1'
  control_id           text references control(control_id),
  title                text,
  statement            text,                       -- thin for FedRAMP, fat for CMMC
  is_baseline_member   boolean not null default false,
  unique (framework_id, framework_control_id)
);
create index on framework_control (framework_id) where is_baseline_member;
create index on framework_control (control_id);

create table control_mapping (
  framework_control_id uuid not null references framework_control(id) on delete cascade,
  control_id           text not null references control(control_id) on delete cascade,
  relation             mapping_relation not null,
  notes                text,
  primary key (framework_control_id, control_id)
);

-- FedRAMP ODPs. Objective prose contains {{ insert: param, ac-02_odp.04 }} —
-- these resolve at render time.
create table framework_parameter (
  framework_id   text not null references framework(id) on delete cascade,
  control_id     text not null references control(control_id) on delete cascade,
  param_key      text not null,                    -- 'ac-02_odp.04'  (zero-padded)
  label          text,
  assigned_value text,
  source         param_source not null default 'fedramp',
  primary key (framework_id, control_id, param_key)
);

-- ============================================================
-- ORG / SYSTEM / ASSESSMENT — the lenses
-- ============================================================

create table organization (
  id   uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table system (
  id                   uuid primary key default gen_random_uuid(),
  organization_id      uuid not null references organization(id) on delete cascade,
  name                 text not null,              -- 'Krome'
  boundary_description text,
  unique (organization_id, name)
);

create table assessment (
  id           uuid primary key default gen_random_uuid(),
  system_id    uuid not null references system(id) on delete cascade,
  framework_id text not null references framework(id),
  name         text not null,
  end_state    text,                               -- '3pao_readiness'
  status       text,
  target_date  date,
  created_at   timestamptz not null default now()
);
create index on assessment (system_id);

create table assessment_control (
  id                    uuid primary key default gen_random_uuid(),
  assessment_id         uuid not null references assessment(id) on delete cascade,
  framework_control_id  uuid not null references framework_control(id),
  implementation_status impl_status,
  responsible_role      text,
  inherited_from        text,                      -- 'Azure Government'
  inheritance_type      inheritance_type,
  is_baseline_member    boolean not null default true,  -- false = agency-added
  unique (assessment_id, framework_control_id)
);

create table assessment_objective (
  id            uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references assessment(id) on delete cascade,
  objective_id  text not null references control_objective(objective_id),
  coverage      coverage_state not null default 'gap',
  assessor_note text,
  updated_at    timestamptz not null default now(),
  unique (assessment_id, objective_id)
);
create trigger assessment_objective_leaf_check
  before insert or update on assessment_objective
  for each row execute function enforce_leaf_objective();
create index on assessment_objective (assessment_id, coverage);

create table control_responsibility (               -- the CRM, as data
  id                      uuid primary key default gen_random_uuid(),
  assessment_id           uuid not null references assessment(id) on delete cascade,
  control_id              text not null references control(control_id),
  provider_responsibility text,
  customer_responsibility text,
  artifact_id             uuid,                    -- fk added after artifact
  unique (assessment_id, control_id)
);

-- ============================================================
-- DOCUMENTS — Attesta-owned, mutable, objective-grained
-- ============================================================

create table source_upload (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organization(id) on delete cascade,
  filename        text not null,
  content_hash    text,
  storage_ref     text,
  parsed_at       timestamptz,
  parse_status    text,
  uploaded_at     timestamptz not null default now()
);

create table document (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references organization(id) on delete cascade,
  doc_type         doc_type not null,
  title            text not null,
  framework_id     text references framework(id),
  version          int not null default 1,
  status           doc_status not null default 'draft',
  source_upload_id uuid references source_upload(id),
  created_at       timestamptz not null default now(),
  approved_by      text,
  approved_at      timestamptz
);
create index on document (organization_id, doc_type);

create table document_section (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references document(id) on delete cascade,
  organization_id   uuid not null references organization(id) on delete cascade,
  objective_id      text not null references control_objective(objective_id),
  body_text         text,
  status            section_status not null default 'draft',
  origin            section_origin not null,
  source_span_ref   text,                          -- page/offset in the upload
  ai_recommendation text,                          -- beside body_text, never overwriting
  ai_rationale      text,
  approved_by       text,
  approved_at       timestamptz,
  updated_at        timestamptz not null default now(),
  unique (document_id, objective_id)
);
create trigger document_section_leaf_check
  before insert or update on document_section
  for each row execute function enforce_leaf_objective();
create index on document_section (organization_id, objective_id);
create index on document_section (objective_id) where status = 'approved';

-- ============================================================
-- EVIDENCE — SharePoint-indexed, immutable
-- ============================================================

create table artifact (
  id                 uuid primary key default gen_random_uuid(),
  organization_id    uuid not null references organization(id) on delete cascade,
  system_id          uuid references system(id),   -- null = org-wide
  owner_scope        owner_scope not null default 'system',
  title              text not null,
  artifact_type      artifact_type not null,
  method             assessment_method,            -- descriptor, not enforced
  sharepoint_item_id text,
  sharepoint_url     text,
  content_hash       text,                         -- Graph quickXorHash when API lands
  last_verified_at   timestamptz,
  access_state       access_state not null default 'ok',
  valid_from         date,
  valid_until        date,
  created_at         timestamptz not null default now()
);
create index on artifact (organization_id, artifact_type);
create index on artifact (access_state) where access_state <> 'ok';

alter table control_responsibility
  add constraint control_responsibility_artifact_fk
  foreign key (artifact_id) references artifact(id);

create table artifact_objective_link (             -- reciprocity: objective-scoped, not assessment-scoped
  artifact_id  uuid not null references artifact(id) on delete cascade,
  objective_id text not null references control_objective(objective_id) on delete cascade,
  excerpt_ref  text,
  linked_by    text,
  linked_at    timestamptz not null default now(),
  confidence   text,
  primary key (artifact_id, objective_id)
);
create trigger artifact_objective_link_leaf_check
  before insert or update on artifact_objective_link
  for each row execute function enforce_leaf_objective();
create index on artifact_objective_link (objective_id);

create table assessment_artifact_exception (
  assessment_id uuid not null references assessment(id) on delete cascade,
  artifact_id   uuid not null references artifact(id) on delete cascade,
  objective_id  text not null references control_objective(objective_id) on delete cascade,
  excluded      boolean not null default true,
  reason        text,
  primary key (assessment_id, artifact_id, objective_id)
);

-- ============================================================
-- DERIVED — never stored
-- ============================================================

create view v_objective_state as
select
  ao.assessment_id,
  co.control_id,
  co.objective_id,
  co.statement,
  (ds.id is not null and ds.status = 'approved') as narrative_approved,
  exists (
    select 1 from artifact_objective_link aol
    join artifact a on a.id = aol.artifact_id
    left join assessment_artifact_exception ex
      on ex.assessment_id = ao.assessment_id
     and ex.artifact_id   = aol.artifact_id
     and ex.objective_id  = aol.objective_id
     and ex.excluded
    where aol.objective_id = co.objective_id
      and a.access_state = 'ok'
      and (a.valid_until is null or a.valid_until >= current_date)
      and ex.artifact_id is null
  ) as evidence_linked,
  ao.coverage
from assessment_objective ao
join control_objective co on co.objective_id = ao.objective_id
join assessment asm       on asm.id = ao.assessment_id
join system s             on s.id = asm.system_id
left join document_section ds
  on ds.objective_id = co.objective_id
 and ds.organization_id = s.organization_id;

-- The row that matters: narrative claims it, nothing proves it.
create view v_unproven_claims as
select * from v_objective_state
where narrative_approved and not evidence_linked;

create view v_control_coverage as
select
  assessment_id,
  control_id,
  count(*)                                     as objectives_total,
  count(*) filter (where coverage='satisfied') as objectives_satisfied,
  round(100.0 * count(*) filter (where coverage='satisfied') / nullif(count(*),0), 1) as pct
from v_objective_state
group by assessment_id, control_id;

create view v_readiness as
select
  ac.assessment_id,
  count(distinct vc.control_id) as controls_in_scope,
  round(avg(vc.pct), 1)         as readiness_pct
from assessment_control ac
join framework_control fc on fc.id = ac.framework_control_id
join v_control_coverage vc
  on vc.assessment_id = ac.assessment_id
 and vc.control_id    = fc.control_id
where ac.is_baseline_member
group by ac.assessment_id;
