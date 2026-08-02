-- Attesta · clean the {{ insert: param, xxx_odp.NN }} placeholders in
-- objective statements so they read as normal FedRAMP prose.
-- Display-only; exact FedRAMP values populated in a later pass. Idempotent.

update control_objective
set statement = regexp_replace(
      statement,
      '\{\{\s*insert:\s*param,\s*[a-z0-9_\.\-]+\s*\}\}',
      '[assignment: organization-defined value]',
      'gi')
where statement like '%insert: param%';

select count(*) as remaining_placeholders
from control_objective
where statement like '%insert: param%';
