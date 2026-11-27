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
