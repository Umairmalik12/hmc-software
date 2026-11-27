begin;

create or replace function public.hmc_is_admin()
returns boolean language sql stable security definer set search_path = public, auth
as $$
  select auth.uid() is not null and exists(
    select 1 from public.hmc_user_roles where user_id = auth.uid() and lower(btrim(role)) = 'admin'
  );
$$;

create or replace function public.hmc_module_for_collection(p_collection text)
returns text language sql immutable set search_path = public as $$
  select case p_collection
    when 'patientDetails' then 'operation-patients' when 'opdDetails' then 'opd'
    when 'inpatientDetails' then 'inpatient' when 'labDetails' then 'laboratory'
    when 'medicineDetails' then 'daily-medicines' when 'otFormData' then 'ot-medicine-records'
    when 'prescriptions' then 'prescriptions' when 'prescription' then 'prescriptions'
    when 'prescriptionMedicineCatalog' then 'medicine-catalog' when 'customMedicines' then 'medicine-catalog'
    when 'otMedicineCatalog' then 'ot-medicine-catalog' when 'expenseDetails' then 'expenses'
    when 'payments' then 'payments' when 'staffDetails' then 'staff'
    when 'staffDutyCatalog' then 'staff' when 'doctorCatalog' then 'doctors'
    when 'labTestCatalog' then 'lab-tests' when 'procedures' then 'procedures'
    when 'rooms' then 'rooms' else null end;
$$;

create or replace function public.hmc_has_permission(p_module text, p_action text)
returns boolean language sql stable security definer set search_path = public, auth as $$
  select auth.uid() is not null
    and p_module in ('operation-patients','opd','inpatient','laboratory','tokens','prescriptions',
      'medicine-catalog','daily-medicines','ot-medicine-catalog','ot-medicine-records',
      'expenses','payments','staff','doctors','lab-tests','procedures','rooms','reports')
    and p_action in ('view','create','edit','delete')
    and exists(select 1 from public.hmc_user_roles where user_id = auth.uid()
      and (lower(btrim(role)) = 'admin' or (lower(btrim(role)) in ('staff','user') and p_action in ('view','create'))));
$$;

do $$
declare policy_row record;
begin
  for policy_row in select schemaname,tablename,policyname from pg_policies
    where schemaname = 'public' and tablename in ('hmc_records','patient_token_slips')
  loop
    execute format('drop policy %I on %I.%I',policy_row.policyname,policy_row.schemaname,policy_row.tablename);
  end loop;
end;
$$;

alter table public.hmc_records enable row level security;
alter table public.patient_token_slips enable row level security;

create policy hmc_records_read on public.hmc_records for select to authenticated
  using(public.hmc_has_permission(public.hmc_module_for_collection(collection),'view'));
create policy hmc_records_create on public.hmc_records for insert to authenticated
  with check(public.hmc_has_permission(public.hmc_module_for_collection(collection),'create')
    and (public.hmc_is_admin() or (
      coalesce(data -> 'deleted','false'::jsonb) = 'false'::jsonb
      and coalesce(data ->> 'deletedAt','') = ''
    )));
create policy hmc_records_edit on public.hmc_records for update to authenticated
  using(public.hmc_is_admin()) with check(public.hmc_is_admin());
create policy hmc_records_delete on public.hmc_records for delete to authenticated using(public.hmc_is_admin());
create policy hmc_tokens_read on public.patient_token_slips for select to authenticated using(public.hmc_has_permission('tokens','view'));
create policy hmc_tokens_edit on public.patient_token_slips for update to authenticated using(public.hmc_is_admin()) with check(public.hmc_is_admin());
create policy hmc_tokens_delete on public.patient_token_slips for delete to authenticated using(public.hmc_is_admin());

revoke all on public.hmc_records, public.patient_token_slips from anon;
grant select,insert,update,delete on public.hmc_records to authenticated;
revoke insert,update,delete on public.patient_token_slips from authenticated;
grant select,delete on public.patient_token_slips to authenticated;
grant update(customer_name) on public.patient_token_slips to authenticated;
revoke insert,update,delete on public.hmc_user_roles from anon,authenticated;
grant select on public.hmc_user_roles to authenticated;
alter table public.hmc_user_roles enable row level security;
drop policy if exists hmc_accounts_read_own_role on public.hmc_user_roles;
create policy hmc_accounts_read_own_role on public.hmc_user_roles for select to authenticated using(user_id = auth.uid());

create or replace function public.apply_hmc_record_changes(
  p_collection text, p_inserts jsonb, p_updates jsonb, p_delete_ids text[]
) returns void language plpgsql security definer set search_path = public, auth as $$
declare module_key text; item jsonb; row_id text; removed text; previous jsonb; is_update boolean;
begin
  if auth.uid() is null then raise exception 'Sign in again to save changes.' using errcode = '28000'; end if;
  module_key := public.hmc_module_for_collection(p_collection);
  if module_key is null then raise exception 'Unknown record module.' using errcode = '22023'; end if;
  if jsonb_typeof(coalesce(p_inserts,'[]'::jsonb)) <> 'array'
    or jsonb_typeof(coalesce(p_updates,'[]'::jsonb)) <> 'array' then
    raise exception 'Invalid record changes.' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtext('hmc-clinical-write')::bigint);
  for row_id in select distinct unnest(coalesce(p_delete_ids,array[]::text[])) loop
    if not public.hmc_has_permission(module_key,'delete') then raise exception 'Only Admin can delete records.' using errcode = '42501'; end if;
    if p_collection = 'opdDetails' then
      perform public.hmc_delete_opd_visit(row_id);
    else
      delete from public.hmc_records where collection = p_collection and record_id = row_id returning record_id into removed;
      if removed is null then raise exception 'This record no longer exists. Refresh the list.' using errcode = 'P0002'; end if;
    end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_inserts,'[]'::jsonb) || coalesce(p_updates,'[]'::jsonb)) loop
    row_id := item ->> 'record_id';
    if nullif(btrim(row_id),'') is null or not(item ? 'data') then
      raise exception 'A record ID and data are required.' using errcode = '22023';
    end if;
    select data into previous from public.hmc_records where collection = p_collection and record_id = row_id;
    is_update := found;
    if is_update then
      if not public.hmc_has_permission(module_key,'edit') then raise exception 'Only Admin can edit existing records.' using errcode = '42501'; end if;
      update public.hmc_records set data = item -> 'data', sort_order = coalesce((item ->> 'sort_order')::integer,sort_order), updated_at = now()
        where collection = p_collection and record_id = row_id;
    else
      if not public.hmc_has_permission(module_key,'create') then raise exception 'Your account cannot add records.' using errcode = '42501'; end if;
      if not public.hmc_is_admin() and (
        coalesce(item #> '{data,deleted}','false'::jsonb) <> 'false'::jsonb or coalesce(item #>> '{data,deletedAt}','') <> ''
      ) then raise exception 'New records cannot be marked deleted.' using errcode = '42501'; end if;
      if exists(select 1 from jsonb_array_elements(coalesce(p_updates,'[]'::jsonb)) changed where changed ->> 'record_id' = row_id) then
        raise exception 'This record no longer exists. Refresh the list.' using errcode = 'P0002';
      end if;
      insert into public.hmc_records(collection,record_id,data,sort_order,updated_at)
        values(p_collection,row_id,item -> 'data',coalesce((item ->> 'sort_order')::integer,0),now());
    end if;
  end loop;
end;
$$;

create or replace function public.hmc_insert_record(p_collection text,p_record_id text,p_data jsonb,p_sort_order integer default 0)
returns void language plpgsql security definer set search_path = public,auth as $$
begin
  perform pg_advisory_xact_lock(hashtext('hmc-clinical-write')::bigint);
  if exists(select 1 from public.hmc_records where collection = p_collection and record_id = p_record_id) then
    raise exception 'This record ID already exists. Refresh the list before adding a new record.' using errcode = '23505';
  end if;
  perform public.apply_hmc_record_changes(p_collection,
    jsonb_build_array(jsonb_build_object('record_id',p_record_id,'data',p_data,'sort_order',p_sort_order)), '[]'::jsonb,array[]::text[]);
end;
$$;

create or replace function public.hmc_delete_opd_visit(p_visit_id text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare visit_data jsonb; removed text;
begin
  if not public.hmc_has_permission('opd','delete') then raise exception 'Only Admin can delete OPD visits.' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtext('hmc-clinical-write')::bigint);
  select data into visit_data from public.hmc_records where collection = 'opdDetails' and record_id = p_visit_id for update;
  if not found then raise exception 'This OPD visit no longer exists. Refresh the list.' using errcode = 'P0002'; end if;
  update public.hmc_records set data =
    (data - 'opdVisitId') || jsonb_build_object('sourceOpdVisitId',p_visit_id,'patient',
      coalesce(data -> 'patient','{}'::jsonb) || case
        when nullif(data #>> '{patient,refId}','') is null then jsonb_build_object('refId',visit_data ->> 'patientId')
        else '{}'::jsonb end), updated_at = now()
    where collection in ('prescriptions','prescription') and data ->> 'opdVisitId' = p_visit_id;
  delete from public.hmc_records where collection = 'opdDetails' and record_id = p_visit_id returning record_id into removed;
  if removed is null then raise exception 'The database could not delete this OPD visit.'; end if;
  return jsonb_build_object('deleted',true,'record_id',removed);
end;
$$;

create or replace function public.hmc_simple_access_version()
returns integer language sql stable security invoker set search_path = public,auth
as $$ select case when auth.uid() is not null then 1 else 0 end; $$;

create or replace function public.hmc_validate_prescription_visit()
returns trigger language plpgsql security definer set search_path = public,auth as $$
declare visit_key text;
begin
  if new.collection not in ('prescriptions','prescription') then return new; end if;
  visit_key := nullif(new.data ->> 'opdVisitId','');
  if visit_key is null then return new; end if;
  perform 1 from public.hmc_records where collection = 'opdDetails' and record_id = visit_key for key share;
  if not found then
    if tg_op = 'INSERT' then raise exception 'The selected OPD visit no longer exists. Reload the OPD list.' using errcode = '23503'; end if;
    if visit_key is distinct from old.data ->> 'opdVisitId' then
      raise exception 'The selected OPD visit no longer exists. Reload the OPD list.' using errcode = '23503';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists hmc_prescription_visit_check on public.hmc_records;
create trigger hmc_prescription_visit_check before insert or update of collection,data on public.hmc_records
  for each row execute function public.hmc_validate_prescription_visit();
revoke all on function public.hmc_validate_prescription_visit() from public,anon,authenticated;

revoke all on function public.hmc_is_admin(),public.hmc_module_for_collection(text),public.hmc_has_permission(text,text),
  public.apply_hmc_record_changes(text,jsonb,jsonb,text[]),public.hmc_insert_record(text,text,jsonb,integer),
  public.hmc_delete_opd_visit(text),public.hmc_simple_access_version() from public,anon;
grant execute on function public.hmc_is_admin(),public.hmc_module_for_collection(text),public.hmc_has_permission(text,text),
  public.apply_hmc_record_changes(text,jsonb,jsonb,text[]),public.hmc_insert_record(text,text,jsonb,integer),
  public.hmc_delete_opd_visit(text),public.hmc_simple_access_version() to authenticated;

do $$
declare proc record;
begin
  for proc in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('hmc_get_permission_matrix','hmc_save_role_permissions','hmc_reset_role_permissions','hmc_get_my_permissions')
  loop
    execute format('revoke all on function %s from public,anon,authenticated',proc.signature);
  end loop;
  if to_regclass('public.hmc_role_module_permissions') is not null then
    revoke all on public.hmc_role_module_permissions from anon,authenticated;
  end if;
end;
$$;

create or replace function public.hmc_issue_patient_token(p_customer_name text,p_token_date date,p_token_time text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare next_number integer; issued_at timestamptz; saved public.patient_token_slips;
begin
  if not public.hmc_has_permission('tokens','create') then
    raise exception 'Sign in with an assigned hospital account.' using errcode = '42501';
  end if;
  if nullif(btrim(p_customer_name),'') is null then raise exception 'Enter the patient name.'; end if;
  if length(btrim(p_customer_name)) > 120 then raise exception 'Use 120 characters or fewer for the patient name.'; end if;
  if p_token_date is null or p_token_date < date '1900-01-01' or p_token_date > date '9999-12-31'
    or p_token_time is null or p_token_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Select a valid token date and time.';
  end if;
  perform pg_advisory_xact_lock(164836,p_token_date - date '2000-01-01');
  with occupied as (
    select sequence::bigint as number from public.patient_token_slips where token_date = p_token_date
    union
    select case when token_number ~ '^A[0-9]+$' and length(ltrim(substr(token_number,2),'0')) between 1 and 10
      then ltrim(substr(token_number,2),'0')::bigint else null end
    from public.patient_token_slips where token_date = p_token_date
  ), candidates as (
    select 1::bigint as number union select number + 1 from occupied where number < 2147483647
  )
  select min(candidate.number)::integer into next_number from candidates candidate
    where candidate.number between 1 and 2147483647 and not exists(
      select 1 from occupied used where used.number = candidate.number
    );
  if next_number is null then raise exception 'No token numbers are available for this date.'; end if;
  issued_at := (p_token_date + p_token_time::time) at time zone 'Asia/Karachi';
  insert into public.patient_token_slips(token_number,sequence,customer_name,token_date,token_time,created_at)
    values('A' || lpad(next_number::text,greatest(2,length(next_number::text)),'0'),next_number,btrim(p_customer_name),
      p_token_date,to_char(issued_at at time zone 'Asia/Karachi','HH12:MI AM'),issued_at) returning * into saved;
  return to_jsonb(saved);
end;
$$;

create or replace function public.create_patient_token_at(p_customer_name text,p_token_date date,p_token_time text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
begin
  return public.hmc_issue_patient_token(p_customer_name,p_token_date,p_token_time);
end;
$$;

create or replace function public.create_patient_token(p_customer_name text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare local_now timestamp := clock_timestamp() at time zone 'Asia/Karachi';
begin
  return public.hmc_issue_patient_token(p_customer_name,local_now::date,to_char(local_now,'HH24:MI'));
end;
$$;

create or replace function public.hmc_mutate_patient_token(p_id bigint,p_action text,p_customer_name text default null)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare saved public.patient_token_slips; token_day date;
begin
  if p_action is null or p_action not in ('edit','delete') then raise exception 'Invalid token action.'; end if;
  if not public.hmc_is_admin() then raise exception 'Only Admin can change saved tokens.' using errcode = '42501'; end if;
  select token_date into token_day from public.patient_token_slips where id = p_id;
  if not found then raise exception 'This token no longer exists. Refresh the list.' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(164836,token_day - date '2000-01-01');
  if p_action = 'delete' then
    delete from public.patient_token_slips where id = p_id returning * into saved;
  else
    if nullif(btrim(p_customer_name),'') is null then raise exception 'Enter the patient name.'; end if;
    if length(btrim(p_customer_name)) > 120 then raise exception 'Use 120 characters or fewer for the patient name.'; end if;
    update public.patient_token_slips set customer_name = btrim(p_customer_name) where id = p_id returning * into saved;
  end if;
  if not found then raise exception 'This token no longer exists. Refresh the list.' using errcode = 'P0002'; end if;
  return case when p_action = 'delete' then jsonb_build_object('id',saved.id,'deleted',true) else to_jsonb(saved) end;
end;
$$;

revoke all on function public.hmc_issue_patient_token(text,date,text),public.create_patient_token(text),
  public.create_patient_token_at(text,date,text),public.hmc_mutate_patient_token(bigint,text,text) from public,anon;
grant execute on function public.hmc_issue_patient_token(text,date,text),public.create_patient_token(text),
  public.create_patient_token_at(text,date,text),public.hmc_mutate_patient_token(bigint,text,text) to authenticated;

insert into public.hmc_records(collection,record_id,data,sort_order)
select entry ->> 'collection',entry ->> 'record_id',entry -> 'data',0
from jsonb_array_elements($hmc_defaults$
[{"collection":"prescriptionMedicineCatalog","record_id":"default:mixel","data":{"id":"default:mixel","name":"MIXEL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:polymalt-f","data":{"id":"default:polymalt-f","name":"POLYMALT-F","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:qsarten","data":{"id":"default:qsarten","name":"QSARTEN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:mediton","data":{"id":"default:mediton","name":"MEDITON","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:cycin","data":{"id":"default:cycin","name":"CYCIN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:dayfort","data":{"id":"default:dayfort","name":"DAYFORT","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:dypime","data":{"id":"default:dypime","name":"DYPIME","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:vinzet","data":{"id":"default:vinzet","name":"VINZET","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:molam","data":{"id":"default:molam","name":"MOLAM","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:cebect","data":{"id":"default:cebect","name":"CEBECT","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:mevet","data":{"id":"default:mevet","name":"MEVET","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:militrium","data":{"id":"default:militrium","name":"MILITRIUM","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:kineton","data":{"id":"default:kineton","name":"KINETON","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ectafin","data":{"id":"default:ectafin","name":"ECTAFIN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:abbacus","data":{"id":"default:abbacus","name":"ABBACUS","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:azitma","data":{"id":"default:azitma","name":"AZITMA","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:onato","data":{"id":"default:onato","name":"ONATO","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:tpenta%20ir","data":{"id":"default:tpenta%20ir","name":"TPENTA IR","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:montika","data":{"id":"default:montika","name":"MONTIKA","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:peridone","data":{"id":"default:peridone","name":"PERIDONE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:mofest","data":{"id":"default:mofest","name":"MOFEST","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:oxidil","data":{"id":"default:oxidil","name":"OXIDIL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:nivador","data":{"id":"default:nivador","name":"NIVADOR","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:lacasil","data":{"id":"default:lacasil","name":"LACASIL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:trimetabol","data":{"id":"default:trimetabol","name":"TRIMETABOL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:slate","data":{"id":"default:slate","name":"SLATE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:caricef","data":{"id":"default:caricef","name":"CARICEF","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:brino","data":{"id":"default:brino","name":"BRINO","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:emflox","data":{"id":"default:emflox","name":"EMFLOX","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:solplus","data":{"id":"default:solplus","name":"SOLPLUS","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:cyntol","data":{"id":"default:cyntol","name":"CYNTOL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:prujex","data":{"id":"default:prujex","name":"PRUJEX","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:diricin","data":{"id":"default:diricin","name":"DIRICIN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:molox","data":{"id":"default:molox","name":"MOLOX","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:levocil","data":{"id":"default:levocil","name":"LEVOCIL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:helowic","data":{"id":"default:helowic","name":"HELOWIC","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:lacasia","data":{"id":"default:lacasia","name":"LACASIA","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:acasia","data":{"id":"default:acasia","name":"ACASIA","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:realoza%20dr","data":{"id":"default:realoza%20dr","name":"REALOZA DR","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:bactcid","data":{"id":"default:bactcid","name":"BACTCID","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:deebo","data":{"id":"default:deebo","name":"DEEBO","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:xetoplus","data":{"id":"default:xetoplus","name":"XETOPLUS","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ovelcin","data":{"id":"default:ovelcin","name":"OVELCIN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:laxcell","data":{"id":"default:laxcell","name":"LAXCELL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:mofloten","data":{"id":"default:mofloten","name":"MOFLOTEN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ketocell","data":{"id":"default:ketocell","name":"KETOCELL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:uristat","data":{"id":"default:uristat","name":"URISTAT","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:zantum","data":{"id":"default:zantum","name":"ZANTUM","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:mirabet","data":{"id":"default:mirabet","name":"MIRABET","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:vtig%20plus","data":{"id":"default:vtig%20plus","name":"VTIG PLUS","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:vezitic","data":{"id":"default:vezitic","name":"VEZITIC","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ketoride","data":{"id":"default:ketoride","name":"KETORIDE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:maxflow","data":{"id":"default:maxflow","name":"MAXFLOW","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:maxflow-d","data":{"id":"default:maxflow-d","name":"MAXFLOW-D","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ezumac","data":{"id":"default:ezumac","name":"EZUMAC","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:cystalgon","data":{"id":"default:cystalgon","name":"CYSTALGON","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:calamox","data":{"id":"default:calamox","name":"CALAMOX","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:pregy","data":{"id":"default:pregy","name":"PREGY","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:effiflox","data":{"id":"default:effiflox","name":"EFFIFLOX","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:novidate","data":{"id":"default:novidate","name":"NOVIDATE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:tonoflex-p","data":{"id":"default:tonoflex-p","name":"TONOFLEX-P","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:2sum","data":{"id":"default:2sum","name":"2SUM","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:antial","data":{"id":"default:antial","name":"ANTIAL","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:orglu","data":{"id":"default:orglu","name":"ORGLU","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ontive","data":{"id":"default:ontive","name":"ONTIVE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:silidate","data":{"id":"default:silidate","name":"SILIDATE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:itp","data":{"id":"default:itp","name":"ITP","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:dicloran","data":{"id":"default:dicloran","name":"DICLORAN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:kinz","data":{"id":"default:kinz","name":"KINZ","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:sildoso","data":{"id":"default:sildoso","name":"SILDOSO","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:vitig%20plus","data":{"id":"default:vitig%20plus","name":"VITIG PLUS","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:vitig","data":{"id":"default:vitig","name":"VITIG","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:c-one","data":{"id":"default:c-one","name":"C-ONE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:urizak","data":{"id":"default:urizak","name":"URIZAK","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:bone-care","data":{"id":"default:bone-care","name":"BONE-CARE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:ferro-one","data":{"id":"default:ferro-one","name":"FERRO-ONE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:mequine","data":{"id":"default:mequine","name":"MEQUINE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:quspar","data":{"id":"default:quspar","name":"QUSPAR","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:bone-care-c","data":{"id":"default:bone-care-c","name":"BONE-CARE-C","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:balatine","data":{"id":"default:balatine","name":"BALATINE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:carneo","data":{"id":"default:carneo","name":"CARNEO","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:esoin","data":{"id":"default:esoin","name":"ESOIN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:nubrel-forte","data":{"id":"default:nubrel-forte","name":"NUBREL-FORTE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:bruffen","data":{"id":"default:bruffen","name":"BRUFFEN","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:sangibon","data":{"id":"default:sangibon","name":"SANGIBON","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:gavacison","data":{"id":"default:gavacison","name":"GAVACISON","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:palmonive","data":{"id":"default:palmonive","name":"PALMONIVE","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:citralka","data":{"id":"default:citralka","name":"CITRALKA","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:toralac","data":{"id":"default:toralac","name":"TORALAC","active":true}},{"collection":"prescriptionMedicineCatalog","record_id":"default:provas","data":{"id":"default:provas","name":"PROVAS","active":true}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20avil","data":{"id":"default:inj.%20avil","name":"INJ. AVIL","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20decadron","data":{"id":"default:inj.%20decadron","name":"INJ. DECADRON","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20dermocuim","data":{"id":"default:inj.%20dermocuim","name":"INJ. DERMOCUIM","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20atropine","data":{"id":"default:inj.%20atropine","name":"INJ. ATROPINE","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20tramadol","data":{"id":"default:inj.%20tramadol","name":"INJ. TRAMADOL","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20torlac","data":{"id":"default:inj.%20torlac","name":"INJ. TORLAC","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20kinz","data":{"id":"default:inj.%20kinz","name":"INJ. KINZ","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20oxytocin","data":{"id":"default:inj.%20oxytocin","name":"INJ. OXYTOCIN","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20ibuprofen%20sp","data":{"id":"default:inj.%20ibuprofen%20sp","name":"INJ. IBUPROFEN SP","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20tranexamine%20500mg","data":{"id":"default:inj.%20tranexamine%20500mg","name":"INJ. TRANEXAMINE 500MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:insulin%20contaf%20250mg","data":{"id":"default:insulin%20contaf%20250mg","name":"INSULIN CONTAF 250MG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20gentamicane%2040mg","data":{"id":"default:inj.%20gentamicane%2040mg","name":"INJ. GENTAMICANE 40MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20ketsol%20100mg","data":{"id":"default:inj.%20ketsol%20100mg","name":"INJ. KETSOL 100MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20sodium%20bicarba%2025ml","data":{"id":"default:inj.%20sodium%20bicarba%2025ml","name":"INJ. SODIUM BICARBA 25ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20flugel%20100ml","data":{"id":"default:inj.%20flugel%20100ml","name":"INJ. FLUGEL 100ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20provas%20infusion%20100ml","data":{"id":"default:inj.%20provas%20infusion%20100ml","name":"INJ. PROVAS INFUSION 100ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20hamilc%20500ml","data":{"id":"default:inj.%20hamilc%20500ml","name":"INJ. HAMILC 500ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20hamicl%20500ml","data":{"id":"default:inj.%20hamicl%20500ml","name":"INJ. HAMICL 500ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%205%25%20d%2Fw%201000ml","data":{"id":"default:inj.%205%25%20d%2Fw%201000ml","name":"INJ. 5% D/W 1000ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:inj.%20rld%201000ml","data":{"id":"default:inj.%20rld%201000ml","name":"INJ. RLD 1000ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:18g%20iv%20line","data":{"id":"default:18g%20iv%20line","name":"18G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:20g%20iv%20line","data":{"id":"default:20g%20iv%20line","name":"20G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:22g%20iv%20line","data":{"id":"default:22g%20iv%20line","name":"22G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:24g%20iv%20line","data":{"id":"default:24g%20iv%20line","name":"24G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:b.t%2Fset","data":{"id":"default:b.t%2Fset","name":"B.T/SET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:d%2Fset","data":{"id":"default:d%2Fset","name":"D/SET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:d%2Fs%205cc","data":{"id":"default:d%2Fs%205cc","name":"D/S 5CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:d%2Fs%2010cc","data":{"id":"default:d%2Fs%2010cc","name":"D/S 10CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:d%2Fs%2020cc","data":{"id":"default:d%2Fs%2020cc","name":"D/S 20CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:d%2Fs%2050cc","data":{"id":"default:d%2Fs%2050cc","name":"D/S 50CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:o.t%20cap","data":{"id":"default:o.t%20cap","name":"O.T CAP","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:aprean","data":{"id":"default:aprean","name":"APREAN","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:s.%20gloves%207%201%2F2","data":{"id":"default:s.%20gloves%207%201%2F2","name":"S. GLOVES 7 1/2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:s.%20gloves%206%201%2F2","data":{"id":"default:s.%20gloves%206%201%2F2","name":"S. GLOVES 6 1/2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:xylocaine%20gel","data":{"id":"default:xylocaine%20gel","name":"XYLOCAINE GEL","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:lignocaine%20gel","data":{"id":"default:lignocaine%20gel","name":"LIGNOCAINE GEL","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:nelton%20tube%2F10","data":{"id":"default:nelton%20tube%2F10","name":"NELTON TUBE/10","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:nelton%20tube%2F12","data":{"id":"default:nelton%20tube%2F12","name":"NELTON TUBE/12","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:feeding%20tube%2F6%2F8","data":{"id":"default:feeding%20tube%2F6%2F8","name":"FEEDING TUBE/6/8","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:feeding%20tube%2F8","data":{"id":"default:feeding%20tube%2F8","name":"FEEDING TUBE/8","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:feeding%20tube%2F10","data":{"id":"default:feeding%20tube%2F10","name":"FEEDING TUBE/10","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:stomach%20tube%2F18","data":{"id":"default:stomach%20tube%2F18","name":"STOMACH TUBE/18","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:gauze%20packet","data":{"id":"default:gauze%20packet","name":"GAUZE PACKET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:foley's%20catheter%2F16","data":{"id":"default:foley's%20catheter%2F16","name":"FOLEY'S CATHETER/16","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:foley's%20catheter%2F18","data":{"id":"default:foley's%20catheter%2F18","name":"FOLEY'S CATHETER/18","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:foley's%20catheter%2F20","data":{"id":"default:foley's%20catheter%2F20","name":"FOLEY'S CATHETER/20","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:foley's%20catheter%2F22","data":{"id":"default:foley's%20catheter%2F22","name":"FOLEY'S CATHETER/22","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:urine%20bag","data":{"id":"default:urine%20bag","name":"URINE BAG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:drainage%20bag","data":{"id":"default:drainage%20bag","name":"DRAINAGE BAG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:sponges","data":{"id":"default:sponges","name":"SPONGES","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:silk%20no.1","data":{"id":"default:silk%20no.1","name":"SILK NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:silk%20no.2%2F0","data":{"id":"default:silk%20no.2%2F0","name":"SILK NO.2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:silk%20no.3%2F0","data":{"id":"default:silk%20no.3%2F0","name":"SILK NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:vicryl%20no.1","data":{"id":"default:vicryl%20no.1","name":"VICRYL NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:vicryl%20no.2","data":{"id":"default:vicryl%20no.2","name":"VICRYL NO.2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:vicryl%20no.3%2F0","data":{"id":"default:vicryl%20no.3%2F0","name":"VICRYL NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:vicryl%20no.4%2F0","data":{"id":"default:vicryl%20no.4%2F0","name":"VICRYL NO.4/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:catgut%20no.1","data":{"id":"default:catgut%20no.1","name":"CATGUT NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:catgut%20no.2%2F0","data":{"id":"default:catgut%20no.2%2F0","name":"CATGUT NO.2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:catgut%20no.3%2F0","data":{"id":"default:catgut%20no.3%2F0","name":"CATGUT NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:catgut%20no.4%2F0","data":{"id":"default:catgut%20no.4%2F0","name":"CATGUT NO.4/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:proline%202%2F0","data":{"id":"default:proline%202%2F0","name":"PROLINE 2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:proline%203%2F0","data":{"id":"default:proline%203%2F0","name":"PROLINE 3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:proline%206%2F0","data":{"id":"default:proline%206%2F0","name":"PROLINE 6/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:proline%208%2F0","data":{"id":"default:proline%208%2F0","name":"PROLINE 8/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:bild%20no.11","data":{"id":"default:bild%20no.11","name":"BILD NO.11","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:bild%20no.15","data":{"id":"default:bild%20no.15","name":"BILD NO.15","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:bild%20no.19","data":{"id":"default:bild%20no.19","name":"BILD NO.19","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:bild%20no.24","data":{"id":"default:bild%20no.24","name":"BILD NO.24","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"otMedicineCatalog","record_id":"default:local%20100cc","data":{"id":"default:local%20100cc","name":"LOCAL 100CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}},{"collection":"procedures","record_id":"default-1","data":{"id":"default-1","name":"Left nephrectomy","active":true}},{"collection":"procedures","record_id":"default-2","data":{"id":"default-2","name":"Right nephrectomy","active":true}},{"collection":"procedures","record_id":"default-3","data":{"id":"default-3","name":"Right pyelolithotomy","active":true}},{"collection":"procedures","record_id":"default-4","data":{"id":"default-4","name":"Left pyelolithotomy","active":true}},{"collection":"procedures","record_id":"default-5","data":{"id":"default-5","name":"IOU","active":true}},{"collection":"procedures","record_id":"default-6","data":{"id":"default-6","name":"Cystoscopy","active":true}},{"collection":"procedures","record_id":"default-7","data":{"id":"default-7","name":"Cystolithotomy","active":true}},{"collection":"procedures","record_id":"default-8","data":{"id":"default-8","name":"Cystolitholopaxy","active":true}},{"collection":"procedures","record_id":"default-9","data":{"id":"default-9","name":"Right URS L/C + DJS","active":true}},{"collection":"procedures","record_id":"default-10","data":{"id":"default-10","name":"Left URS L/C + DJS","active":true}},{"collection":"procedures","record_id":"default-11","data":{"id":"default-11","name":"B/L URS L/C + DJS","active":true}},{"collection":"procedures","record_id":"default-12","data":{"id":"default-12","name":"Right ureterolithotomy","active":true}},{"collection":"procedures","record_id":"default-13","data":{"id":"default-13","name":"Left ureterolithotomy","active":true}},{"collection":"procedures","record_id":"default-14","data":{"id":"default-14","name":"Pyeloplasty (right or left)","active":true}},{"collection":"rooms","record_id":"default-1","data":{"id":"default-1","name":"Room 1","active":true}},{"collection":"rooms","record_id":"default-2","data":{"id":"default-2","name":"Room 2","active":true}},{"collection":"rooms","record_id":"default-3","data":{"id":"default-3","name":"GW Bed 1","active":true}},{"collection":"rooms","record_id":"default-4","data":{"id":"default-4","name":"GW Bed 2","active":true}},{"collection":"labTestCatalog","record_id":"default-1","data":{"id":"default-1","name":"RPM","active":true}},{"collection":"labTestCatalog","record_id":"default-2","data":{"id":"default-2","name":"H/B","active":true}},{"collection":"labTestCatalog","record_id":"default-3","data":{"id":"default-3","name":"CUE","active":true}},{"collection":"labTestCatalog","record_id":"default-4","data":{"id":"default-4","name":"RBS","active":true}},{"collection":"labTestCatalog","record_id":"default-5","data":{"id":"default-5","name":"CBC","active":true}},{"collection":"labTestCatalog","record_id":"default-6","data":{"id":"default-6","name":"S/E","active":true}},{"collection":"labTestCatalog","record_id":"default-7","data":{"id":"default-7","name":"Uric Acid","active":true}},{"collection":"labTestCatalog","record_id":"default-8","data":{"id":"default-8","name":"Anti-HCV","active":true}},{"collection":"labTestCatalog","record_id":"default-9","data":{"id":"default-9","name":"HBS AG","active":true}},{"collection":"labTestCatalog","record_id":"default-10","data":{"id":"default-10","name":"PSA","active":true}},{"collection":"labTestCatalog","record_id":"default-11","data":{"id":"default-11","name":"Blood Group","active":true}},{"collection":"labTestCatalog","record_id":"default-12","data":{"id":"default-12","name":"Cross Match","active":true}},{"collection":"labTestCatalog","record_id":"default-13","data":{"id":"default-13","name":"LFTs","active":true}},{"collection":"labTestCatalog","record_id":"default-14","data":{"id":"default-14","name":"Lipo-Profile","active":true}},{"collection":"labTestCatalog","record_id":"default-15","data":{"id":"default-15","name":"X-ray","active":true}},{"collection":"staffDutyCatalog","record_id":"default:ot%20in-charge","data":{"id":"default:ot%20in-charge","name":"OT in-charge","active":true}},{"collection":"staffDutyCatalog","record_id":"default:counter%20%2F%20reception","data":{"id":"default:counter%20%2F%20reception","name":"Counter / reception","active":true}},{"collection":"staffDutyCatalog","record_id":"default:room%20%2F%20ward%20care","data":{"id":"default:room%20%2F%20ward%20care","name":"Room / ward care","active":true}},{"collection":"staffDutyCatalog","record_id":"default:patient%20medicines","data":{"id":"default:patient%20medicines","name":"Patient medicines","active":true}},{"collection":"staffDutyCatalog","record_id":"default:opd%20checking","data":{"id":"default:opd%20checking","name":"OPD checking","active":true}}]
$hmc_defaults$::jsonb) entry on conflict(collection,record_id) do nothing;

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

notify pgrst, 'reload schema';
commit;
