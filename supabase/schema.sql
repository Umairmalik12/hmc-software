create table if not exists public.hmc_user_roles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  role text not null check (role in ('admin', 'staff'))
);

create table if not exists public.hmc_records (
  collection text not null,
  record_id text not null,
  data jsonb not null,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (collection, record_id)
);

alter table public.hmc_records
  add column if not exists sort_order integer not null default 0;

create table if not exists public.hmc_id_sequences (
  collection text primary key,
  next_id bigint not null check (next_id > 0)
);

create table if not exists public.patient_token_slips (
  id bigint generated always as identity primary key,
  token_number text not null,
  sequence integer not null check (sequence > 0),
  customer_name text not null check (length(trim(customer_name)) > 0),
  token_date date not null,
  token_time text not null,
  created_at timestamptz not null,
  unique (token_date, sequence),
  unique (token_date, token_number)
);

create table if not exists public.patient_token_daily_sequences (
  token_date date primary key,
  next_sequence integer not null check (next_sequence > 0)
);

create index if not exists patient_token_slips_created_at_idx
  on public.patient_token_slips (created_at desc);

create or replace function public.hmc_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.hmc_user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

alter table public.hmc_user_roles enable row level security;
alter table public.hmc_records enable row level security;
alter table public.hmc_id_sequences enable row level security;
alter table public.patient_token_slips enable row level security;
alter table public.patient_token_daily_sequences enable row level security;

drop policy if exists "Users can read their own HMC role" on public.hmc_user_roles;
create policy "Users can read their own HMC role"
  on public.hmc_user_roles for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Authenticated users can read HMC records" on public.hmc_records;
create policy "Authenticated users can read HMC records"
  on public.hmc_records for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can insert HMC records" on public.hmc_records;
create policy "Authenticated users can insert HMC records"
  on public.hmc_records for insert
  to authenticated
  with check (true);

drop policy if exists "Authenticated users can update HMC records" on public.hmc_records;
create policy "Authenticated users can update HMC records"
  on public.hmc_records for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "Admins can delete HMC records" on public.hmc_records;
create policy "Admins can delete HMC records"
  on public.hmc_records for delete
  to authenticated
  using (public.hmc_is_admin());

drop policy if exists "Authenticated users can read patient tokens" on public.patient_token_slips;
create policy "Authenticated users can read patient tokens"
  on public.patient_token_slips for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can delete patient tokens" on public.patient_token_slips;
create policy "Authenticated users can delete patient tokens"
  on public.patient_token_slips for delete
  to authenticated
  using (true);

revoke all on public.hmc_user_roles, public.hmc_id_sequences, public.patient_token_daily_sequences from anon, authenticated;
grant select on public.hmc_user_roles to authenticated;
grant select, insert, update, delete on public.hmc_records to authenticated;
grant select, delete on public.patient_token_slips to authenticated;
grant usage, select on sequence public.patient_token_slips_id_seq to authenticated;

create or replace function public.apply_hmc_record_changes(
  p_collection text,
  p_inserts jsonb,
  p_updates jsonb,
  p_delete_ids text[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  row_data jsonb;
  affected_rows integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_collection)::bigint);

  if coalesce(array_length(p_delete_ids, 1), 0) > 0 then
    delete from public.hmc_records
    where collection = p_collection and record_id = any(p_delete_ids);
    get diagnostics affected_rows = row_count;
    if affected_rows <> array_length(p_delete_ids, 1) then
      raise exception 'One or more % records could not be deleted', p_collection;
    end if;
  end if;

  for row_data in select value from jsonb_array_elements(coalesce(p_inserts, '[]'::jsonb))
  loop
    insert into public.hmc_records (collection, record_id, data, sort_order, updated_at)
    values (
      p_collection,
      row_data ->> 'record_id',
      row_data -> 'data',
      (row_data ->> 'sort_order')::integer,
      now()
    )
    on conflict (collection, record_id) do nothing;
    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      raise exception 'Record ID % already exists in %', row_data ->> 'record_id', p_collection;
    end if;
  end loop;

  for row_data in select value from jsonb_array_elements(coalesce(p_updates, '[]'::jsonb))
  loop
    update public.hmc_records
      set data = row_data -> 'data',
          sort_order = (row_data ->> 'sort_order')::integer,
          updated_at = now()
      where collection = p_collection and record_id = row_data ->> 'record_id';
    get diagnostics affected_rows = row_count;
    if affected_rows = 0 then
      raise exception 'Record ID % was not found in %', row_data ->> 'record_id', p_collection;
    end if;
  end loop;
end;
$$;

create or replace function public.next_hmc_id(p_collection text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  allocated_id bigint;
  current_max bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  perform pg_advisory_xact_lock(hashtext(p_collection)::bigint);
  select coalesce(max(record_id::bigint), 0)
    into current_max
    from public.hmc_records
    where collection = p_collection and record_id ~ '^[0-9]+$';

  insert into public.hmc_id_sequences (collection, next_id)
  values (p_collection, current_max + 2)
  on conflict (collection)
  do update set next_id = greatest(public.hmc_id_sequences.next_id, current_max + 1) + 1
  returning next_id - 1 into allocated_id;

  return allocated_id;
end;
$$;

create or replace function public.create_patient_token(p_customer_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  generated_at timestamptz := clock_timestamp();
  local_date date := (generated_at at time zone 'Asia/Karachi')::date;
  sequence_number integer;
  token_text text;
  local_time text;
  token_id bigint;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then
    raise exception 'Patient name is required';
  end if;

  insert into public.patient_token_daily_sequences (token_date, next_sequence)
  values (local_date, 2)
  on conflict (token_date)
  do update set next_sequence = public.patient_token_daily_sequences.next_sequence + 1
  returning next_sequence - 1 into sequence_number;

  token_text := 'A' || repeat('0', greatest(3 - length(sequence_number::text), 0)) || sequence_number::text;
  local_time := to_char(generated_at at time zone 'Asia/Karachi', 'HH12:MI AM');

  insert into public.patient_token_slips (
    token_number, sequence, customer_name, token_date, token_time, created_at
  )
  values (
    token_text, sequence_number, trim(p_customer_name), local_date, local_time, generated_at
  )
  returning id into token_id;

  return jsonb_build_object(
    'id', token_id,
    'token_number', token_text,
    'sequence', sequence_number,
    'customer_name', trim(p_customer_name),
    'token_date', to_char(local_date, 'YYYY-MM-DD'),
    'token_time', local_time,
    'created_at', generated_at
  );
end;
$$;

revoke all on function public.hmc_is_admin() from public, anon;
revoke all on function public.apply_hmc_record_changes(text, jsonb, jsonb, text[]) from public, anon;
revoke all on function public.next_hmc_id(text) from public, anon;
revoke all on function public.create_patient_token(text) from public, anon;
grant execute on function public.hmc_is_admin() to authenticated;
grant execute on function public.apply_hmc_record_changes(text, jsonb, jsonb, text[]) to authenticated;
grant execute on function public.next_hmc_id(text) to authenticated;
grant execute on function public.create_patient_token(text) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'hmc_records'
    ) then
      execute 'alter publication supabase_realtime add table public.hmc_records';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'patient_token_slips'
    ) then
      execute 'alter publication supabase_realtime add table public.patient_token_slips';
    end if;
  end if;
end;
$$;
