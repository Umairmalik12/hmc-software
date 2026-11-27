-- Central role/module/action permissions. Existing records are not changed.
begin;

create table if not exists public.hmc_role_module_permissions (
  role text not null,
  module_key text not null,
  can_create boolean not null default false,
  can_edit boolean not null default false,
  can_delete boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (role, module_key),
  check (module_key in (
    'operation-patients','opd','inpatient','laboratory','tokens','prescriptions',
    'medicine-catalog','daily-medicines','ot-medicine-catalog','ot-medicine-records',
    'expenses','payments','staff','doctors','lab-tests','procedures','rooms','reports'
  ))
);

alter table public.hmc_role_module_permissions enable row level security;
drop policy if exists "Users can read own role module permissions" on public.hmc_role_module_permissions;
create policy "Users can read own role module permissions"
  on public.hmc_role_module_permissions for select to authenticated
  using (role = (select role from public.hmc_user_roles where user_id = auth.uid()) or public.hmc_is_admin());
drop policy if exists "Only admins manage role module permissions" on public.hmc_role_module_permissions;
create policy "Only admins manage role module permissions"
  on public.hmc_role_module_permissions for all to authenticated
  using (public.hmc_is_admin()) with check (public.hmc_is_admin());
grant select, insert, update, delete on public.hmc_role_module_permissions to authenticated;

create or replace function public.hmc_module_for_collection(p_collection text)
returns text language sql immutable set search_path = public as $$
  select case p_collection
    when 'patientDetails' then 'operation-patients'
    when 'opdDetails' then 'opd'
    when 'inpatientDetails' then 'inpatient'
    when 'labDetails' then 'laboratory'
    when 'medicineDetails' then 'daily-medicines'
    when 'otFormData' then 'ot-medicine-records'
    when 'prescriptions' then 'prescriptions'
    when 'prescription' then 'prescriptions'
    when 'prescriptionMedicineCatalog' then 'medicine-catalog'
    when 'customMedicines' then 'medicine-catalog'
    when 'otMedicineCatalog' then 'ot-medicine-catalog'
    when 'expenseDetails' then 'expenses'
    when 'payments' then 'payments'
    when 'staffDetails' then 'staff'
    when 'staffDutyCatalog' then 'staff'
    when 'doctorCatalog' then 'doctors'
    when 'labTestCatalog' then 'lab-tests'
    when 'procedures' then 'procedures'
    when 'rooms' then 'rooms'
    else null
  end;
$$;

create or replace function public.hmc_has_permission(p_module text, p_action text)
returns boolean language plpgsql stable security definer set search_path = public, auth as $$
declare account_role text;
begin
  if auth.uid() is null then return false; end if;
  select role into account_role from public.hmc_user_roles where user_id = auth.uid();
  if account_role is null then return false; end if;
  if account_role = 'admin' then return true; end if;
  if p_action = 'view' then return true; end if;
  if p_action not in ('create','edit','delete') then return false; end if;
  return exists (
    select 1 from public.hmc_role_module_permissions p
    where p.role = account_role and p.module_key = p_module
      and case p_action when 'create' then p.can_create when 'edit' then p.can_edit when 'delete' then p.can_delete else false end
  );
end;
$$;

create or replace function public.hmc_is_soft_delete_transition(p_collection text,p_record_id text,p_new_data jsonb)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare old_data jsonb;
begin
  if not public.hmc_has_permission(public.hmc_module_for_collection(p_collection),'delete') then return false; end if;
  select data into old_data from public.hmc_records where collection=p_collection and record_id=p_record_id;
  if old_data is null or jsonb_typeof(p_new_data)<>'object' then return false; end if;
  if (old_data - 'active' - 'deleted' - 'deletedAt' - 'updatedAt') <> (p_new_data - 'active' - 'deleted' - 'deletedAt' - 'updatedAt') then return false; end if;
  return (coalesce(old_data -> 'active','true'::jsonb) <> 'false'::jsonb and p_new_data -> 'active' = 'false'::jsonb)
      or (coalesce(old_data -> 'deleted','false'::jsonb) <> 'true'::jsonb and p_new_data -> 'deleted' = 'true'::jsonb);
end;
$$;

create or replace function public.hmc_default_create_permission(p_role text, p_module text)
returns boolean language sql immutable as $$
  select p_role = 'staff' and p_module in (
    'operation-patients','opd','inpatient','laboratory','tokens','daily-medicines',
    'ot-medicine-records','expenses','payments'
  );
$$;

insert into public.hmc_role_module_permissions (role,module_key,can_create,can_edit,can_delete)
select distinct r.role, m.module_key, public.hmc_default_create_permission(r.role,m.module_key), false, false
from public.hmc_user_roles r
cross join (values
 ('operation-patients'),('opd'),('inpatient'),('laboratory'),('tokens'),('prescriptions'),
 ('medicine-catalog'),('daily-medicines'),('ot-medicine-catalog'),('ot-medicine-records'),
 ('expenses'),('payments'),('staff'),('doctors'),('lab-tests'),('procedures'),('rooms'),('reports')
) as m(module_key)
on conflict (role,module_key) do nothing;

create or replace function public.hmc_get_my_permissions()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare account_role text; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  select role into account_role from public.hmc_user_roles where user_id = auth.uid();
  if account_role is null then raise exception 'Account role is not configured'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'moduleKey', p.module_key, 'view', true, 'create', p.can_create, 'edit', p.can_edit, 'delete', p.can_delete
  ) order by p.module_key), '[]'::jsonb) into result
  from public.hmc_role_module_permissions p where p.role = account_role;
  return jsonb_build_object('role', account_role, 'is_admin', account_role = 'admin', 'permissions', result);
end;
$$;

create or replace function public.hmc_get_permission_matrix()
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare result_roles jsonb; result_permissions jsonb;
begin
  if not public.hmc_is_admin() then raise exception 'Administrator access required'; end if;
  select coalesce(jsonb_agg(role order by role), '[]'::jsonb) into result_roles
    from (select distinct role from public.hmc_user_roles) roles;
  select coalesce(jsonb_agg(jsonb_build_object(
    'role', p.role, 'moduleKey', p.module_key, 'view', true, 'create', p.can_create, 'edit', p.can_edit, 'delete', p.can_delete
  ) order by p.role,p.module_key), '[]'::jsonb) into result_permissions
    from public.hmc_role_module_permissions p;
  return jsonb_build_object('roles', result_roles, 'permissions', result_permissions);
end;
$$;

create or replace function public.hmc_save_role_permissions(p_role text, p_permissions jsonb)
returns void language plpgsql security definer set search_path = public, auth as $$
declare item jsonb;
begin
  if not public.hmc_is_admin() then raise exception 'Administrator access required'; end if;
  if p_role = 'admin' then raise exception 'Admin permissions are always enabled'; end if;
  if not exists (select 1 from public.hmc_user_roles where role = p_role) then raise exception 'Role not found'; end if;
  if jsonb_typeof(p_permissions) <> 'array' or jsonb_array_length(p_permissions) <> 18 then raise exception 'Submit the complete module permission matrix'; end if;
  for item in select value from jsonb_array_elements(p_permissions) loop
    if not exists (select 1 from (values
      ('operation-patients'),('opd'),('inpatient'),('laboratory'),('tokens'),('prescriptions'),
      ('medicine-catalog'),('daily-medicines'),('ot-medicine-catalog'),('ot-medicine-records'),
      ('expenses'),('payments'),('staff'),('doctors'),('lab-tests'),('procedures'),('rooms'),('reports')
    ) modules(key) where key = item ->> 'moduleKey') then raise exception 'Unknown module'; end if;
    insert into public.hmc_role_module_permissions(role,module_key,can_create,can_edit,can_delete,updated_at)
    values (p_role,item ->> 'moduleKey',coalesce((item ->> 'create')::boolean,false),coalesce((item ->> 'edit')::boolean,false),coalesce((item ->> 'delete')::boolean,false),now())
    on conflict (role,module_key) do update set can_create=excluded.can_create,can_edit=excluded.can_edit,can_delete=excluded.can_delete,updated_at=now();
  end loop;
end;
$$;

create or replace function public.hmc_reset_role_permissions(p_role text)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.hmc_is_admin() then raise exception 'Administrator access required'; end if;
  if p_role = 'admin' then raise exception 'Admin permissions are always enabled'; end if;
  if not exists (select 1 from public.hmc_user_roles where role = p_role) then raise exception 'Role not found'; end if;
  insert into public.hmc_role_module_permissions(role,module_key,can_create,can_edit,can_delete,updated_at)
  select p_role,m.module_key,public.hmc_default_create_permission(p_role,m.module_key),false,false,now()
  from (values
    ('operation-patients'),('opd'),('inpatient'),('laboratory'),('tokens'),('prescriptions'),
    ('medicine-catalog'),('daily-medicines'),('ot-medicine-catalog'),('ot-medicine-records'),
    ('expenses'),('payments'),('staff'),('doctors'),('lab-tests'),('procedures'),('rooms'),('reports')
  ) m(module_key)
  on conflict (role,module_key) do update set can_create=excluded.can_create,can_edit=false,can_delete=false,updated_at=now();
end;
$$;

drop policy if exists "Only admins can update expenses" on public.hmc_records;
drop policy if exists "Only admins can delete expenses" on public.hmc_records;
drop policy if exists "Only admins can update medicine catalogues" on public.hmc_records;
drop policy if exists "Only admins can delete medicine catalogues" on public.hmc_records;
drop policy if exists "Only admins can create prescriptions" on public.hmc_records;
drop policy if exists "Only admins can update prescriptions" on public.hmc_records;
drop policy if exists "Only admins can delete prescriptions" on public.hmc_records;

drop policy if exists "Admins can delete HMC records" on public.hmc_records;
create policy "Authenticated users may delete HMC records"
  on public.hmc_records for delete to authenticated using (true);

drop policy if exists "Role permissions control HMC record creation" on public.hmc_records;
create policy "Role permissions control HMC record creation" on public.hmc_records as restrictive for insert to authenticated
  with check (public.hmc_has_permission(public.hmc_module_for_collection(collection),'create'));
drop policy if exists "Role permissions control HMC record edits" on public.hmc_records;
create policy "Role permissions control HMC record edits" on public.hmc_records as restrictive for update to authenticated
  using (public.hmc_has_permission(public.hmc_module_for_collection(collection),'edit') or public.hmc_has_permission(public.hmc_module_for_collection(collection),'delete'))
  with check (public.hmc_has_permission(public.hmc_module_for_collection(collection),'edit') or (public.hmc_has_permission(public.hmc_module_for_collection(collection),'delete') and public.hmc_is_soft_delete_transition(collection,record_id,data)));
drop policy if exists "Role permissions control HMC record deletion" on public.hmc_records;
create policy "Role permissions control HMC record deletion" on public.hmc_records as restrictive for delete to authenticated
  using (public.hmc_has_permission(public.hmc_module_for_collection(collection),'delete'));

create or replace function public.apply_hmc_record_changes(
  p_collection text, p_inserts jsonb, p_updates jsonb, p_delete_ids text[]
)
returns void language plpgsql security invoker set search_path = public as $$
declare row_data jsonb; affected_rows integer; module_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  module_key := public.hmc_module_for_collection(p_collection);
  if module_key is null then raise exception 'Unknown record module'; end if;
  if coalesce(array_length(p_delete_ids,1),0)>0 and not public.hmc_has_permission(module_key,'delete') then raise exception 'You do not have permission to delete records in this module'; end if;
  if coalesce(jsonb_array_length(p_inserts),0)>0 and not public.hmc_has_permission(module_key,'create') then raise exception 'You do not have permission to create records in this module'; end if;
  if coalesce(jsonb_array_length(p_updates),0)>0 and not public.hmc_has_permission(module_key,'edit') and not public.hmc_has_permission(module_key,'delete') and not public.hmc_has_permission(module_key,'create') then raise exception 'You do not have permission to modify records in this module'; end if;

  perform pg_advisory_xact_lock(hashtext(p_collection)::bigint);
  if coalesce(array_length(p_delete_ids,1),0)>0 then
    delete from public.hmc_records where collection=p_collection and record_id=any(p_delete_ids);
  end if;
  for row_data in select value from jsonb_array_elements(coalesce(p_inserts,'[]'::jsonb)) loop
    insert into public.hmc_records(collection,record_id,data,sort_order,updated_at)
    values(p_collection,row_data ->> 'record_id',row_data -> 'data',(row_data ->> 'sort_order')::integer,now())
    on conflict(collection,record_id) do update set data=excluded.data,sort_order=excluded.sort_order,updated_at=now();
  end loop;
  for row_data in select value from jsonb_array_elements(coalesce(p_updates,'[]'::jsonb)) loop
    if exists(select 1 from public.hmc_records where collection=p_collection and record_id=row_data ->> 'record_id') then
      if not public.hmc_has_permission(module_key,'edit') and not (public.hmc_has_permission(module_key,'delete') and public.hmc_is_soft_delete_transition(p_collection,row_data ->> 'record_id',row_data -> 'data')) then
        raise exception 'You do not have permission to edit this record';
      end if;
    elsif not public.hmc_has_permission(module_key,'create') then
      raise exception 'You do not have permission to create this record';
    end if;
    update public.hmc_records set data=row_data -> 'data',sort_order=(row_data ->> 'sort_order')::integer,updated_at=now()
      where collection=p_collection and record_id=row_data ->> 'record_id';
    get diagnostics affected_rows=row_count;
    if affected_rows=0 then
      insert into public.hmc_records(collection,record_id,data,sort_order,updated_at)
      values(p_collection,row_data ->> 'record_id',row_data -> 'data',(row_data ->> 'sort_order')::integer,now())
      on conflict(collection,record_id) do update set data=excluded.data,sort_order=excluded.sort_order,updated_at=now();
    end if;
  end loop;
end;
$$;

drop policy if exists "Admins can delete patient tokens" on public.patient_token_slips;
drop policy if exists "Authenticated users can delete patient tokens" on public.patient_token_slips;
create policy "Authenticated users may delete patient tokens"
  on public.patient_token_slips for delete to authenticated using (true);
drop policy if exists "Admins can update token patient names" on public.patient_token_slips;
drop policy if exists "Authenticated users can update token patient names" on public.patient_token_slips;
create policy "Authenticated users may update token patient names"
  on public.patient_token_slips for update to authenticated using (true) with check (length(trim(customer_name)) > 0);
drop policy if exists "Token creation follows role permissions" on public.patient_token_slips;
create policy "Token creation follows role permissions" on public.patient_token_slips as restrictive for insert to authenticated
  with check (public.hmc_has_permission('tokens','create'));
drop policy if exists "Token edits follow role permissions" on public.patient_token_slips;
create policy "Token edits follow role permissions" on public.patient_token_slips as restrictive for update to authenticated
  using (public.hmc_has_permission('tokens','edit')) with check (public.hmc_has_permission('tokens','edit'));
drop policy if exists "Token deletion follows role permissions" on public.patient_token_slips;
create policy "Token deletion follows role permissions" on public.patient_token_slips as restrictive for delete to authenticated
  using (public.hmc_has_permission('tokens','delete'));

create or replace function public.create_patient_token(p_customer_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  generated_at timestamptz := clock_timestamp();
  local_date date := (generated_at at time zone 'Asia/Karachi')::date;
  sequence_number integer; token_text text; local_time text; token_id bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.hmc_has_permission('tokens','create') then raise exception 'You do not have permission to create patient tokens'; end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then raise exception 'Patient name is required'; end if;
  insert into public.patient_token_daily_sequences(token_date,next_sequence) values(local_date,2)
  on conflict(token_date) do update set next_sequence=public.patient_token_daily_sequences.next_sequence+1 returning next_sequence-1 into sequence_number;
  token_text := 'A' || repeat('0',greatest(3-length(sequence_number::text),0)) || sequence_number::text;
  local_time := to_char(generated_at at time zone 'Asia/Karachi','HH12:MI AM');
  insert into public.patient_token_slips(token_number,sequence,customer_name,token_date,token_time,created_at)
  values(token_text,sequence_number,trim(p_customer_name),local_date,local_time,generated_at) returning id into token_id;
  return jsonb_build_object('id',token_id,'token_number',token_text,'sequence',sequence_number,'customer_name',trim(p_customer_name),'token_date',to_char(local_date,'YYYY-MM-DD'),'token_time',local_time,'created_at',generated_at);
end;
$$;

create or replace function public.create_patient_token_at(p_customer_name text,p_token_date date,p_token_time text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare issued_at timestamptz; sequence_number integer; token_text text; local_time text; token_id bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.hmc_has_permission('tokens','create') then raise exception 'You do not have permission to create patient tokens'; end if;
  if p_customer_name is null or length(trim(p_customer_name))=0 then raise exception 'Patient name is required'; end if;
  if p_token_date is null or p_token_date < date '1900-01-01' or p_token_date > date '9999-12-31' or p_token_time is null or p_token_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Select a valid token date and time'; end if;
  issued_at := (p_token_date+p_token_time::time) at time zone 'Asia/Karachi';
  insert into public.patient_token_daily_sequences(token_date,next_sequence) values(p_token_date,2)
  on conflict(token_date) do update set next_sequence=public.patient_token_daily_sequences.next_sequence+1 returning next_sequence-1 into sequence_number;
  token_text := 'A'||repeat('0',greatest(3-length(sequence_number::text),0))||sequence_number::text;
  local_time := to_char(issued_at at time zone 'Asia/Karachi','HH12:MI AM');
  insert into public.patient_token_slips(token_number,sequence,customer_name,token_date,token_time,created_at) values(token_text,sequence_number,trim(p_customer_name),p_token_date,local_time,issued_at) returning id into token_id;
  return jsonb_build_object('id',token_id,'token_number',token_text,'sequence',sequence_number,'customer_name',trim(p_customer_name),'token_date',to_char(p_token_date,'YYYY-MM-DD'),'token_time',local_time,'created_at',issued_at);
end;
$$;

revoke all on function public.hmc_module_for_collection(text) from public, anon;
revoke all on function public.hmc_has_permission(text,text) from public, anon;
revoke all on function public.hmc_is_soft_delete_transition(text,text,jsonb) from public, anon;
revoke all on function public.hmc_get_my_permissions() from public, anon;
revoke all on function public.hmc_get_permission_matrix() from public, anon;
revoke all on function public.hmc_save_role_permissions(text,jsonb) from public, anon;
revoke all on function public.hmc_reset_role_permissions(text) from public, anon;
grant execute on function public.hmc_module_for_collection(text) to authenticated;
grant execute on function public.hmc_has_permission(text,text) to authenticated;
grant execute on function public.hmc_is_soft_delete_transition(text,text,jsonb) to authenticated;
grant execute on function public.hmc_get_my_permissions() to authenticated;
grant execute on function public.hmc_get_permission_matrix() to authenticated;
grant execute on function public.hmc_save_role_permissions(text,jsonb) to authenticated;
grant execute on function public.hmc_reset_role_permissions(text) to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') and not exists (
    select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='hmc_role_module_permissions'
  ) then execute 'alter publication supabase_realtime add table public.hmc_role_module_permissions'; end if;
end $$;

commit;
