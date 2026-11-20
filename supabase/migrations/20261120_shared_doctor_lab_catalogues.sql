
begin;

create unique index if not exists hmc_clinical_catalog_name_key
on public.hmc_records (collection, lower(regexp_replace(btrim(data ->> 'name'), '\s+', ' ', 'g')))
where collection in ('doctorCatalog', 'labTestCatalog');

insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('labTestCatalog', 'default-1', '{"id":"default-1","name":"RPM","active":true}'::jsonb, 0),
  ('labTestCatalog', 'default-2', '{"id":"default-2","name":"H/B","active":true}'::jsonb, 1),
  ('labTestCatalog', 'default-3', '{"id":"default-3","name":"CUE","active":true}'::jsonb, 2),
  ('labTestCatalog', 'default-4', '{"id":"default-4","name":"RBS","active":true}'::jsonb, 3),
  ('labTestCatalog', 'default-5', '{"id":"default-5","name":"CBC","active":true}'::jsonb, 4),
  ('labTestCatalog', 'default-6', '{"id":"default-6","name":"S/E","active":true}'::jsonb, 5),
  ('labTestCatalog', 'default-7', '{"id":"default-7","name":"Uric Acid","active":true}'::jsonb, 6),
  ('labTestCatalog', 'default-8', '{"id":"default-8","name":"Anti-HCV","active":true}'::jsonb, 7),
  ('labTestCatalog', 'default-9', '{"id":"default-9","name":"HBS AG","active":true}'::jsonb, 8),
  ('labTestCatalog', 'default-10', '{"id":"default-10","name":"PSA","active":true}'::jsonb, 9),
  ('labTestCatalog', 'default-11', '{"id":"default-11","name":"Blood Group","active":true}'::jsonb, 10),
  ('labTestCatalog', 'default-12', '{"id":"default-12","name":"Cross Match","active":true}'::jsonb, 11),
  ('labTestCatalog', 'default-13', '{"id":"default-13","name":"LFTs","active":true}'::jsonb, 12),
  ('labTestCatalog', 'default-14', '{"id":"default-14","name":"Lipo-Profile","active":true}'::jsonb, 13),
  ('labTestCatalog', 'default-15', '{"id":"default-15","name":"X-ray","active":true}'::jsonb, 14)
on conflict do nothing;

with names as (
  select regexp_replace(btrim(value), '\s+', ' ', 'g') as name
  from public.hmc_records r
  cross join lateral jsonb_array_elements_text(jsonb_build_array(
    r.data ->> 'drName', r.data ->> 'surgeonName', r.data ->> 'doctorName', r.data ->> 'suggestedDr'
  )) as values_used(value)
  where r.collection in ('patientDetails', 'opdDetails', 'inpatientDetails', 'medicineDetails', 'otFormData', 'labDetails')
    and not exists (select 1 from public.hmc_records where collection = 'catalogueMigrations' and record_id = 'doctor-lab-initial-import')
), distinct_names as (
  select lower(name) as name_key, min(name) as name from names where name <> '' group by lower(name)
)
insert into public.hmc_records (collection, record_id, data, sort_order)
select 'doctorCatalog', 'existing-' || md5(name_key),
  jsonb_build_object('id', 'existing-' || md5(name_key), 'name', name, 'active', true), 0
from distinct_names n
where not exists (
  select 1 from public.hmc_records existing
  where existing.collection = 'doctorCatalog'
    and lower(regexp_replace(btrim(existing.data ->> 'name'), '\s+', ' ', 'g')) = n.name_key
)
on conflict do nothing;

with names as (
  select regexp_replace(btrim(value), '\s+', ' ', 'g') as name
  from public.hmc_records r
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(r.data -> 'testName') = 'array' then r.data -> 'testName'
      else to_jsonb(string_to_array(coalesce(r.data ->> 'testName', ''), ',')) end
  ) as tests_used(value)
  where r.collection = 'labDetails'
    and not exists (select 1 from public.hmc_records where collection = 'catalogueMigrations' and record_id = 'doctor-lab-initial-import')
), distinct_names as (
  select lower(name) as name_key, min(name) as name from names where name <> '' group by lower(name)
)
insert into public.hmc_records (collection, record_id, data, sort_order)
select 'labTestCatalog', 'existing-' || md5(name_key),
  jsonb_build_object('id', 'existing-' || md5(name_key), 'name', name, 'active', true), 0
from distinct_names n
where not exists (
  select 1 from public.hmc_records existing
  where existing.collection = 'labTestCatalog'
    and lower(regexp_replace(btrim(existing.data ->> 'name'), '\s+', ' ', 'g')) = n.name_key
)
on conflict do nothing;

insert into public.hmc_records (collection, record_id, data)
values ('catalogueMigrations', 'doctor-lab-initial-import', '{"id":"doctor-lab-initial-import","complete":true}'::jsonb)
on conflict do nothing;

commit;
