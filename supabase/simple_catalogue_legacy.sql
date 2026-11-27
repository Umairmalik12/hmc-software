create or replace function public.hmc_catalogue_uri_key(p_value text)
returns text language plpgsql immutable strict set search_path = public as $$
declare bytes bytea; result text := ''; i integer; b integer;
begin
  bytes := convert_to(lower(regexp_replace(btrim(p_value),'\s+',' ','g')),'UTF8');
  if length(bytes) = 0 then return ''; end if;
  for i in 0..length(bytes)-1 loop
    b := get_byte(bytes,i);
    if b between 48 and 57 or b between 65 and 90 or b between 97 and 122 or b in (33,39,40,41,42,45,46,95,126) then
      result := result || chr(b);
    else result := result || '%' || upper(lpad(to_hex(b),2,'0'));
    end if;
  end loop;
  return result;
end;
$$;

insert into public.hmc_records(collection,record_id,data,sort_order)
select 'prescriptionMedicineCatalog','legacy:' || public.hmc_catalogue_uri_key(name),
  jsonb_build_object('id','legacy:' || public.hmc_catalogue_uri_key(name),'name',name,'active',true),0
from (
  select distinct regexp_replace(btrim(value #>> '{}'),'\s+',' ','g') as name
  from public.hmc_records r cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.data) = 'array' then r.data else jsonb_build_array(r.data) end
  ) value where r.collection = 'customMedicines' and jsonb_typeof(value) = 'string'
) options where name <> '' and not exists (
  select 1 from public.hmc_records existing where existing.collection = 'prescriptionMedicineCatalog'
    and public.hmc_catalogue_uri_key(existing.data ->> 'name') = public.hmc_catalogue_uri_key(options.name)
) on conflict(collection,record_id) do nothing;

insert into public.hmc_records(collection,record_id,data,sort_order)
select 'staffDutyCatalog','legacy:' || public.hmc_catalogue_uri_key(name),
  jsonb_build_object('id','legacy:' || public.hmc_catalogue_uri_key(name),'name',name,'active',true),0
from (
  select distinct regexp_replace(btrim(assignment ->> 'duty'),'\s+',' ','g') as name
  from public.hmc_records r cross join lateral jsonb_array_elements(
    case when jsonb_typeof(r.data -> 'assignments') = 'array' then r.data -> 'assignments' else '[]'::jsonb end
  ) assignment where r.collection = 'staffDetails'
) options where nullif(name,'') is not null and not exists (
  select 1 from public.hmc_records existing where existing.collection = 'staffDutyCatalog'
    and (public.hmc_catalogue_uri_key(existing.data ->> 'name') = public.hmc_catalogue_uri_key(options.name)
      or exists(select 1 from jsonb_array_elements_text(case when jsonb_typeof(existing.data -> 'previousNames') = 'array'
        then existing.data -> 'previousNames' else '[]'::jsonb end) previous
        where public.hmc_catalogue_uri_key(previous) = public.hmc_catalogue_uri_key(options.name)))
) on conflict(collection,record_id) do nothing;

insert into public.hmc_records(collection,record_id,data,sort_order)
select 'doctorCatalog','legacy:' || public.hmc_catalogue_uri_key(name),
  jsonb_build_object('id','legacy:' || public.hmc_catalogue_uri_key(name),'name',name,'active',true),0
from (
  select distinct regexp_replace(btrim(value),'\s+',' ','g') as name from public.hmc_records r
  cross join lateral (values(r.data ->> 'drName'),(r.data ->> 'doctorName'),(r.data ->> 'surgeonName'),(r.data ->> 'suggestedDr')) names(value)
  where r.collection in ('patientDetails','opdDetails','inpatientDetails','labDetails','otFormData','medicineDetails','prescriptions','prescription')
) options where nullif(name,'') is not null
  and not exists(select 1 from public.hmc_records where collection = 'catalogueMigrations' and record_id = 'simple-doctor-import')
  and not exists(select 1 from public.hmc_records existing where existing.collection = 'doctorCatalog'
    and public.hmc_catalogue_uri_key(existing.data ->> 'name') = public.hmc_catalogue_uri_key(options.name))
on conflict do nothing;
insert into public.hmc_records(collection,record_id,data,sort_order)
values('catalogueMigrations','simple-doctor-import','{"completed":true}'::jsonb,0) on conflict do nothing;
