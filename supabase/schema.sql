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
drop policy if exists "Authenticated users can update token patient names" on public.patient_token_slips;
create policy "Authenticated users can update token patient names"
  on public.patient_token_slips for update to authenticated
  using (true) with check (length(trim(customer_name)) > 0);
grant update (customer_name) on public.patient_token_slips to authenticated;
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
    on conflict (collection, record_id) do update
      set data = excluded.data,
          sort_order = excluded.sort_order,
          updated_at = now();
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
      insert into public.hmc_records (collection, record_id, data, sort_order, updated_at)
      values (
        p_collection,
        row_data ->> 'record_id',
        row_data -> 'data',
        (row_data ->> 'sort_order')::integer,
        now()
      )
      on conflict (collection, record_id) do update
        set data = excluded.data,
            sort_order = excluded.sort_order,
            updated_at = now();
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

-- BEGIN GENERATED HMC CATALOGUE SEEDS
-- All four catalogue defaults use public.hmc_records; no separate catalogue tables.
-- Run as the database owner in Supabase SQL Editor after the base schema exists.
-- Generated with: node scripts/generate-catalogue-sql.cjs
-- Re-running preserves existing rows, including renamed, inactive and deleted entries.
-- Patient records, payments, prescriptions and legacy customMedicines are unchanged.

begin;

do $$
begin
  if to_regclass('public.hmc_records') is null then
    raise exception 'Run supabase/schema.sql first to create the shared record tables and CRUD functions.';
  end if;
end;
$$;

-- procedures: 14 starter options.
insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('procedures', 'default-1', '{"id":"default-1","name":"Left nephrectomy","active":true}'::jsonb, 0),
  ('procedures', 'default-2', '{"id":"default-2","name":"Right nephrectomy","active":true}'::jsonb, 1),
  ('procedures', 'default-3', '{"id":"default-3","name":"Right pyelolithotomy","active":true}'::jsonb, 2),
  ('procedures', 'default-4', '{"id":"default-4","name":"Left pyelolithotomy","active":true}'::jsonb, 3),
  ('procedures', 'default-5', '{"id":"default-5","name":"IOU","active":true}'::jsonb, 4),
  ('procedures', 'default-6', '{"id":"default-6","name":"Cystoscopy","active":true}'::jsonb, 5),
  ('procedures', 'default-7', '{"id":"default-7","name":"Cystolithotomy","active":true}'::jsonb, 6),
  ('procedures', 'default-8', '{"id":"default-8","name":"Cystolitholopaxy","active":true}'::jsonb, 7),
  ('procedures', 'default-9', '{"id":"default-9","name":"Right URS L/C + DJS","active":true}'::jsonb, 8),
  ('procedures', 'default-10', '{"id":"default-10","name":"Left URS L/C + DJS","active":true}'::jsonb, 9),
  ('procedures', 'default-11', '{"id":"default-11","name":"B/L URS L/C + DJS","active":true}'::jsonb, 10),
  ('procedures', 'default-12', '{"id":"default-12","name":"Right ureterolithotomy","active":true}'::jsonb, 11),
  ('procedures', 'default-13', '{"id":"default-13","name":"Left ureterolithotomy","active":true}'::jsonb, 12),
  ('procedures', 'default-14', '{"id":"default-14","name":"Pyeloplasty (right or left)","active":true}'::jsonb, 13)
on conflict (collection, record_id) do nothing;

-- rooms: 4 starter options.
insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('rooms', 'default-1', '{"id":"default-1","name":"Room 1","active":true}'::jsonb, 0),
  ('rooms', 'default-2', '{"id":"default-2","name":"Room 2","active":true}'::jsonb, 1),
  ('rooms', 'default-3', '{"id":"default-3","name":"GW Bed 1","active":true}'::jsonb, 2),
  ('rooms', 'default-4', '{"id":"default-4","name":"GW Bed 2","active":true}'::jsonb, 3)
on conflict (collection, record_id) do nothing;

-- prescriptionMedicineCatalog: 90 starter options.
insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('prescriptionMedicineCatalog', 'default:mixel', '{"id":"default:mixel","name":"MIXEL","active":true}'::jsonb, 0),
  ('prescriptionMedicineCatalog', 'default:polymalt-f', '{"id":"default:polymalt-f","name":"POLYMALT-F","active":true}'::jsonb, 1),
  ('prescriptionMedicineCatalog', 'default:qsarten', '{"id":"default:qsarten","name":"QSARTEN","active":true}'::jsonb, 2),
  ('prescriptionMedicineCatalog', 'default:mediton', '{"id":"default:mediton","name":"MEDITON","active":true}'::jsonb, 3),
  ('prescriptionMedicineCatalog', 'default:cycin', '{"id":"default:cycin","name":"CYCIN","active":true}'::jsonb, 4),
  ('prescriptionMedicineCatalog', 'default:dayfort', '{"id":"default:dayfort","name":"DAYFORT","active":true}'::jsonb, 5),
  ('prescriptionMedicineCatalog', 'default:dypime', '{"id":"default:dypime","name":"DYPIME","active":true}'::jsonb, 6),
  ('prescriptionMedicineCatalog', 'default:vinzet', '{"id":"default:vinzet","name":"VINZET","active":true}'::jsonb, 7),
  ('prescriptionMedicineCatalog', 'default:molam', '{"id":"default:molam","name":"MOLAM","active":true}'::jsonb, 8),
  ('prescriptionMedicineCatalog', 'default:cebect', '{"id":"default:cebect","name":"CEBECT","active":true}'::jsonb, 9),
  ('prescriptionMedicineCatalog', 'default:mevet', '{"id":"default:mevet","name":"MEVET","active":true}'::jsonb, 10),
  ('prescriptionMedicineCatalog', 'default:militrium', '{"id":"default:militrium","name":"MILITRIUM","active":true}'::jsonb, 11),
  ('prescriptionMedicineCatalog', 'default:kineton', '{"id":"default:kineton","name":"KINETON","active":true}'::jsonb, 12),
  ('prescriptionMedicineCatalog', 'default:ectafin', '{"id":"default:ectafin","name":"ECTAFIN","active":true}'::jsonb, 13),
  ('prescriptionMedicineCatalog', 'default:abbacus', '{"id":"default:abbacus","name":"ABBACUS","active":true}'::jsonb, 14),
  ('prescriptionMedicineCatalog', 'default:azitma', '{"id":"default:azitma","name":"AZITMA","active":true}'::jsonb, 15),
  ('prescriptionMedicineCatalog', 'default:onato', '{"id":"default:onato","name":"ONATO","active":true}'::jsonb, 16),
  ('prescriptionMedicineCatalog', 'default:tpenta%20ir', '{"id":"default:tpenta%20ir","name":"TPENTA IR","active":true}'::jsonb, 17),
  ('prescriptionMedicineCatalog', 'default:montika', '{"id":"default:montika","name":"MONTIKA","active":true}'::jsonb, 18),
  ('prescriptionMedicineCatalog', 'default:peridone', '{"id":"default:peridone","name":"PERIDONE","active":true}'::jsonb, 19),
  ('prescriptionMedicineCatalog', 'default:mofest', '{"id":"default:mofest","name":"MOFEST","active":true}'::jsonb, 20),
  ('prescriptionMedicineCatalog', 'default:oxidil', '{"id":"default:oxidil","name":"OXIDIL","active":true}'::jsonb, 21),
  ('prescriptionMedicineCatalog', 'default:nivador', '{"id":"default:nivador","name":"NIVADOR","active":true}'::jsonb, 22),
  ('prescriptionMedicineCatalog', 'default:lacasil', '{"id":"default:lacasil","name":"LACASIL","active":true}'::jsonb, 23),
  ('prescriptionMedicineCatalog', 'default:trimetabol', '{"id":"default:trimetabol","name":"TRIMETABOL","active":true}'::jsonb, 24),
  ('prescriptionMedicineCatalog', 'default:slate', '{"id":"default:slate","name":"SLATE","active":true}'::jsonb, 25),
  ('prescriptionMedicineCatalog', 'default:caricef', '{"id":"default:caricef","name":"CARICEF","active":true}'::jsonb, 26),
  ('prescriptionMedicineCatalog', 'default:brino', '{"id":"default:brino","name":"BRINO","active":true}'::jsonb, 27),
  ('prescriptionMedicineCatalog', 'default:emflox', '{"id":"default:emflox","name":"EMFLOX","active":true}'::jsonb, 28),
  ('prescriptionMedicineCatalog', 'default:solplus', '{"id":"default:solplus","name":"SOLPLUS","active":true}'::jsonb, 29),
  ('prescriptionMedicineCatalog', 'default:cyntol', '{"id":"default:cyntol","name":"CYNTOL","active":true}'::jsonb, 30),
  ('prescriptionMedicineCatalog', 'default:prujex', '{"id":"default:prujex","name":"PRUJEX","active":true}'::jsonb, 31),
  ('prescriptionMedicineCatalog', 'default:diricin', '{"id":"default:diricin","name":"DIRICIN","active":true}'::jsonb, 32),
  ('prescriptionMedicineCatalog', 'default:molox', '{"id":"default:molox","name":"MOLOX","active":true}'::jsonb, 33),
  ('prescriptionMedicineCatalog', 'default:levocil', '{"id":"default:levocil","name":"LEVOCIL","active":true}'::jsonb, 34),
  ('prescriptionMedicineCatalog', 'default:helowic', '{"id":"default:helowic","name":"HELOWIC","active":true}'::jsonb, 35),
  ('prescriptionMedicineCatalog', 'default:lacasia', '{"id":"default:lacasia","name":"LACASIA","active":true}'::jsonb, 36),
  ('prescriptionMedicineCatalog', 'default:acasia', '{"id":"default:acasia","name":"ACASIA","active":true}'::jsonb, 37),
  ('prescriptionMedicineCatalog', 'default:realoza%20dr', '{"id":"default:realoza%20dr","name":"REALOZA DR","active":true}'::jsonb, 38),
  ('prescriptionMedicineCatalog', 'default:bactcid', '{"id":"default:bactcid","name":"BACTCID","active":true}'::jsonb, 39),
  ('prescriptionMedicineCatalog', 'default:deebo', '{"id":"default:deebo","name":"DEEBO","active":true}'::jsonb, 40),
  ('prescriptionMedicineCatalog', 'default:xetoplus', '{"id":"default:xetoplus","name":"XETOPLUS","active":true}'::jsonb, 41),
  ('prescriptionMedicineCatalog', 'default:ovelcin', '{"id":"default:ovelcin","name":"OVELCIN","active":true}'::jsonb, 42),
  ('prescriptionMedicineCatalog', 'default:laxcell', '{"id":"default:laxcell","name":"LAXCELL","active":true}'::jsonb, 43),
  ('prescriptionMedicineCatalog', 'default:mofloten', '{"id":"default:mofloten","name":"MOFLOTEN","active":true}'::jsonb, 44),
  ('prescriptionMedicineCatalog', 'default:ketocell', '{"id":"default:ketocell","name":"KETOCELL","active":true}'::jsonb, 45),
  ('prescriptionMedicineCatalog', 'default:uristat', '{"id":"default:uristat","name":"URISTAT","active":true}'::jsonb, 46),
  ('prescriptionMedicineCatalog', 'default:zantum', '{"id":"default:zantum","name":"ZANTUM","active":true}'::jsonb, 47),
  ('prescriptionMedicineCatalog', 'default:mirabet', '{"id":"default:mirabet","name":"MIRABET","active":true}'::jsonb, 48),
  ('prescriptionMedicineCatalog', 'default:vtig%20plus', '{"id":"default:vtig%20plus","name":"VTIG PLUS","active":true}'::jsonb, 49),
  ('prescriptionMedicineCatalog', 'default:vezitic', '{"id":"default:vezitic","name":"VEZITIC","active":true}'::jsonb, 50),
  ('prescriptionMedicineCatalog', 'default:ketoride', '{"id":"default:ketoride","name":"KETORIDE","active":true}'::jsonb, 51),
  ('prescriptionMedicineCatalog', 'default:maxflow', '{"id":"default:maxflow","name":"MAXFLOW","active":true}'::jsonb, 52),
  ('prescriptionMedicineCatalog', 'default:maxflow-d', '{"id":"default:maxflow-d","name":"MAXFLOW-D","active":true}'::jsonb, 53),
  ('prescriptionMedicineCatalog', 'default:ezumac', '{"id":"default:ezumac","name":"EZUMAC","active":true}'::jsonb, 54),
  ('prescriptionMedicineCatalog', 'default:cystalgon', '{"id":"default:cystalgon","name":"CYSTALGON","active":true}'::jsonb, 55),
  ('prescriptionMedicineCatalog', 'default:calamox', '{"id":"default:calamox","name":"CALAMOX","active":true}'::jsonb, 56),
  ('prescriptionMedicineCatalog', 'default:pregy', '{"id":"default:pregy","name":"PREGY","active":true}'::jsonb, 57),
  ('prescriptionMedicineCatalog', 'default:effiflox', '{"id":"default:effiflox","name":"EFFIFLOX","active":true}'::jsonb, 58),
  ('prescriptionMedicineCatalog', 'default:novidate', '{"id":"default:novidate","name":"NOVIDATE","active":true}'::jsonb, 59),
  ('prescriptionMedicineCatalog', 'default:tonoflex-p', '{"id":"default:tonoflex-p","name":"TONOFLEX-P","active":true}'::jsonb, 60),
  ('prescriptionMedicineCatalog', 'default:2sum', '{"id":"default:2sum","name":"2SUM","active":true}'::jsonb, 61),
  ('prescriptionMedicineCatalog', 'default:antial', '{"id":"default:antial","name":"ANTIAL","active":true}'::jsonb, 62),
  ('prescriptionMedicineCatalog', 'default:orglu', '{"id":"default:orglu","name":"ORGLU","active":true}'::jsonb, 63),
  ('prescriptionMedicineCatalog', 'default:ontive', '{"id":"default:ontive","name":"ONTIVE","active":true}'::jsonb, 64),
  ('prescriptionMedicineCatalog', 'default:silidate', '{"id":"default:silidate","name":"SILIDATE","active":true}'::jsonb, 65),
  ('prescriptionMedicineCatalog', 'default:itp', '{"id":"default:itp","name":"ITP","active":true}'::jsonb, 66),
  ('prescriptionMedicineCatalog', 'default:dicloran', '{"id":"default:dicloran","name":"DICLORAN","active":true}'::jsonb, 67),
  ('prescriptionMedicineCatalog', 'default:kinz', '{"id":"default:kinz","name":"KINZ","active":true}'::jsonb, 68),
  ('prescriptionMedicineCatalog', 'default:sildoso', '{"id":"default:sildoso","name":"SILDOSO","active":true}'::jsonb, 69),
  ('prescriptionMedicineCatalog', 'default:vitig%20plus', '{"id":"default:vitig%20plus","name":"VITIG PLUS","active":true}'::jsonb, 70),
  ('prescriptionMedicineCatalog', 'default:vitig', '{"id":"default:vitig","name":"VITIG","active":true}'::jsonb, 71),
  ('prescriptionMedicineCatalog', 'default:c-one', '{"id":"default:c-one","name":"C-ONE","active":true}'::jsonb, 72),
  ('prescriptionMedicineCatalog', 'default:urizak', '{"id":"default:urizak","name":"URIZAK","active":true}'::jsonb, 73),
  ('prescriptionMedicineCatalog', 'default:bone-care', '{"id":"default:bone-care","name":"BONE-CARE","active":true}'::jsonb, 74),
  ('prescriptionMedicineCatalog', 'default:ferro-one', '{"id":"default:ferro-one","name":"FERRO-ONE","active":true}'::jsonb, 75),
  ('prescriptionMedicineCatalog', 'default:mequine', '{"id":"default:mequine","name":"MEQUINE","active":true}'::jsonb, 76),
  ('prescriptionMedicineCatalog', 'default:quspar', '{"id":"default:quspar","name":"QUSPAR","active":true}'::jsonb, 77),
  ('prescriptionMedicineCatalog', 'default:bone-care-c', '{"id":"default:bone-care-c","name":"BONE-CARE-C","active":true}'::jsonb, 78),
  ('prescriptionMedicineCatalog', 'default:balatine', '{"id":"default:balatine","name":"BALATINE","active":true}'::jsonb, 79),
  ('prescriptionMedicineCatalog', 'default:carneo', '{"id":"default:carneo","name":"CARNEO","active":true}'::jsonb, 80),
  ('prescriptionMedicineCatalog', 'default:esoin', '{"id":"default:esoin","name":"ESOIN","active":true}'::jsonb, 81),
  ('prescriptionMedicineCatalog', 'default:nubrel-forte', '{"id":"default:nubrel-forte","name":"NUBREL-FORTE","active":true}'::jsonb, 82),
  ('prescriptionMedicineCatalog', 'default:bruffen', '{"id":"default:bruffen","name":"BRUFFEN","active":true}'::jsonb, 83),
  ('prescriptionMedicineCatalog', 'default:sangibon', '{"id":"default:sangibon","name":"SANGIBON","active":true}'::jsonb, 84),
  ('prescriptionMedicineCatalog', 'default:gavacison', '{"id":"default:gavacison","name":"GAVACISON","active":true}'::jsonb, 85),
  ('prescriptionMedicineCatalog', 'default:palmonive', '{"id":"default:palmonive","name":"PALMONIVE","active":true}'::jsonb, 86),
  ('prescriptionMedicineCatalog', 'default:citralka', '{"id":"default:citralka","name":"CITRALKA","active":true}'::jsonb, 87),
  ('prescriptionMedicineCatalog', 'default:toralac', '{"id":"default:toralac","name":"TORALAC","active":true}'::jsonb, 88),
  ('prescriptionMedicineCatalog', 'default:provas', '{"id":"default:provas","name":"PROVAS","active":true}'::jsonb, 89)
on conflict (collection, record_id) do nothing;

-- otMedicineCatalog: 70 starter options.
insert into public.hmc_records (collection, record_id, data, sort_order)
values
  ('otMedicineCatalog', 'default:inj.%20avil', '{"id":"default:inj.%20avil","name":"INJ. AVIL","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 0),
  ('otMedicineCatalog', 'default:inj.%20decadron', '{"id":"default:inj.%20decadron","name":"INJ. DECADRON","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 1),
  ('otMedicineCatalog', 'default:inj.%20dermocuim', '{"id":"default:inj.%20dermocuim","name":"INJ. DERMOCUIM","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 2),
  ('otMedicineCatalog', 'default:inj.%20atropine', '{"id":"default:inj.%20atropine","name":"INJ. ATROPINE","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 3),
  ('otMedicineCatalog', 'default:inj.%20tramadol', '{"id":"default:inj.%20tramadol","name":"INJ. TRAMADOL","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 4),
  ('otMedicineCatalog', 'default:inj.%20torlac', '{"id":"default:inj.%20torlac","name":"INJ. TORLAC","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 5),
  ('otMedicineCatalog', 'default:inj.%20kinz', '{"id":"default:inj.%20kinz","name":"INJ. KINZ","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 6),
  ('otMedicineCatalog', 'default:inj.%20oxytocin', '{"id":"default:inj.%20oxytocin","name":"INJ. OXYTOCIN","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 7),
  ('otMedicineCatalog', 'default:inj.%20ibuprofen%20sp', '{"id":"default:inj.%20ibuprofen%20sp","name":"INJ. IBUPROFEN SP","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 8),
  ('otMedicineCatalog', 'default:inj.%20tranexamine%20500mg', '{"id":"default:inj.%20tranexamine%20500mg","name":"INJ. TRANEXAMINE 500MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 9),
  ('otMedicineCatalog', 'default:insulin%20contaf%20250mg', '{"id":"default:insulin%20contaf%20250mg","name":"INSULIN CONTAF 250MG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 10),
  ('otMedicineCatalog', 'default:inj.%20gentamicane%2040mg', '{"id":"default:inj.%20gentamicane%2040mg","name":"INJ. GENTAMICANE 40MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 11),
  ('otMedicineCatalog', 'default:inj.%20ketsol%20100mg', '{"id":"default:inj.%20ketsol%20100mg","name":"INJ. KETSOL 100MG","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 12),
  ('otMedicineCatalog', 'default:inj.%20sodium%20bicarba%2025ml', '{"id":"default:inj.%20sodium%20bicarba%2025ml","name":"INJ. SODIUM BICARBA 25ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 13),
  ('otMedicineCatalog', 'default:inj.%20flugel%20100ml', '{"id":"default:inj.%20flugel%20100ml","name":"INJ. FLUGEL 100ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 14),
  ('otMedicineCatalog', 'default:inj.%20provas%20infusion%20100ml', '{"id":"default:inj.%20provas%20infusion%20100ml","name":"INJ. PROVAS INFUSION 100ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 15),
  ('otMedicineCatalog', 'default:inj.%20hamilc%20500ml', '{"id":"default:inj.%20hamilc%20500ml","name":"INJ. HAMILC 500ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 16),
  ('otMedicineCatalog', 'default:inj.%20hamicl%20500ml', '{"id":"default:inj.%20hamicl%20500ml","name":"INJ. HAMICL 500ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 17),
  ('otMedicineCatalog', 'default:inj.%205%25%20d%2Fw%201000ml', '{"id":"default:inj.%205%25%20d%2Fw%201000ml","name":"INJ. 5% D/W 1000ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 18),
  ('otMedicineCatalog', 'default:inj.%20rld%201000ml', '{"id":"default:inj.%20rld%201000ml","name":"INJ. RLD 1000ML","genericName":"","category":"","type":"Injection","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 19),
  ('otMedicineCatalog', 'default:18g%20iv%20line', '{"id":"default:18g%20iv%20line","name":"18G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 20),
  ('otMedicineCatalog', 'default:20g%20iv%20line', '{"id":"default:20g%20iv%20line","name":"20G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 21),
  ('otMedicineCatalog', 'default:22g%20iv%20line', '{"id":"default:22g%20iv%20line","name":"22G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 22),
  ('otMedicineCatalog', 'default:24g%20iv%20line', '{"id":"default:24g%20iv%20line","name":"24G IV LINE","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 23),
  ('otMedicineCatalog', 'default:b.t%2Fset', '{"id":"default:b.t%2Fset","name":"B.T/SET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 24),
  ('otMedicineCatalog', 'default:d%2Fset', '{"id":"default:d%2Fset","name":"D/SET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 25),
  ('otMedicineCatalog', 'default:d%2Fs%205cc', '{"id":"default:d%2Fs%205cc","name":"D/S 5CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 26),
  ('otMedicineCatalog', 'default:d%2Fs%2010cc', '{"id":"default:d%2Fs%2010cc","name":"D/S 10CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 27),
  ('otMedicineCatalog', 'default:d%2Fs%2020cc', '{"id":"default:d%2Fs%2020cc","name":"D/S 20CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 28),
  ('otMedicineCatalog', 'default:d%2Fs%2050cc', '{"id":"default:d%2Fs%2050cc","name":"D/S 50CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 29),
  ('otMedicineCatalog', 'default:o.t%20cap', '{"id":"default:o.t%20cap","name":"O.T CAP","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 30),
  ('otMedicineCatalog', 'default:aprean', '{"id":"default:aprean","name":"APREAN","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 31),
  ('otMedicineCatalog', 'default:s.%20gloves%207%201%2F2', '{"id":"default:s.%20gloves%207%201%2F2","name":"S. GLOVES 7 1/2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 32),
  ('otMedicineCatalog', 'default:s.%20gloves%206%201%2F2', '{"id":"default:s.%20gloves%206%201%2F2","name":"S. GLOVES 6 1/2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 33),
  ('otMedicineCatalog', 'default:xylocaine%20gel', '{"id":"default:xylocaine%20gel","name":"XYLOCAINE GEL","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 34),
  ('otMedicineCatalog', 'default:lignocaine%20gel', '{"id":"default:lignocaine%20gel","name":"LIGNOCAINE GEL","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 35),
  ('otMedicineCatalog', 'default:nelton%20tube%2F10', '{"id":"default:nelton%20tube%2F10","name":"NELTON TUBE/10","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 36),
  ('otMedicineCatalog', 'default:nelton%20tube%2F12', '{"id":"default:nelton%20tube%2F12","name":"NELTON TUBE/12","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 37),
  ('otMedicineCatalog', 'default:feeding%20tube%2F6%2F8', '{"id":"default:feeding%20tube%2F6%2F8","name":"FEEDING TUBE/6/8","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 38),
  ('otMedicineCatalog', 'default:feeding%20tube%2F8', '{"id":"default:feeding%20tube%2F8","name":"FEEDING TUBE/8","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 39),
  ('otMedicineCatalog', 'default:feeding%20tube%2F10', '{"id":"default:feeding%20tube%2F10","name":"FEEDING TUBE/10","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 40),
  ('otMedicineCatalog', 'default:stomach%20tube%2F18', '{"id":"default:stomach%20tube%2F18","name":"STOMACH TUBE/18","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 41),
  ('otMedicineCatalog', 'default:gauze%20packet', '{"id":"default:gauze%20packet","name":"GAUZE PACKET","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 42),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F16', '{"id":"default:foley''s%20catheter%2F16","name":"FOLEY''S CATHETER/16","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 43),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F18', '{"id":"default:foley''s%20catheter%2F18","name":"FOLEY''S CATHETER/18","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 44),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F20', '{"id":"default:foley''s%20catheter%2F20","name":"FOLEY''S CATHETER/20","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 45),
  ('otMedicineCatalog', 'default:foley''s%20catheter%2F22', '{"id":"default:foley''s%20catheter%2F22","name":"FOLEY''S CATHETER/22","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 46),
  ('otMedicineCatalog', 'default:urine%20bag', '{"id":"default:urine%20bag","name":"URINE BAG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 47),
  ('otMedicineCatalog', 'default:drainage%20bag', '{"id":"default:drainage%20bag","name":"DRAINAGE BAG","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 48),
  ('otMedicineCatalog', 'default:sponges', '{"id":"default:sponges","name":"SPONGES","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 49),
  ('otMedicineCatalog', 'default:silk%20no.1', '{"id":"default:silk%20no.1","name":"SILK NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 50),
  ('otMedicineCatalog', 'default:silk%20no.2%2F0', '{"id":"default:silk%20no.2%2F0","name":"SILK NO.2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 51),
  ('otMedicineCatalog', 'default:silk%20no.3%2F0', '{"id":"default:silk%20no.3%2F0","name":"SILK NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 52),
  ('otMedicineCatalog', 'default:vicryl%20no.1', '{"id":"default:vicryl%20no.1","name":"VICRYL NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 53),
  ('otMedicineCatalog', 'default:vicryl%20no.2', '{"id":"default:vicryl%20no.2","name":"VICRYL NO.2","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 54),
  ('otMedicineCatalog', 'default:vicryl%20no.3%2F0', '{"id":"default:vicryl%20no.3%2F0","name":"VICRYL NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 55),
  ('otMedicineCatalog', 'default:vicryl%20no.4%2F0', '{"id":"default:vicryl%20no.4%2F0","name":"VICRYL NO.4/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 56),
  ('otMedicineCatalog', 'default:catgut%20no.1', '{"id":"default:catgut%20no.1","name":"CATGUT NO.1","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 57),
  ('otMedicineCatalog', 'default:catgut%20no.2%2F0', '{"id":"default:catgut%20no.2%2F0","name":"CATGUT NO.2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 58),
  ('otMedicineCatalog', 'default:catgut%20no.3%2F0', '{"id":"default:catgut%20no.3%2F0","name":"CATGUT NO.3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 59),
  ('otMedicineCatalog', 'default:catgut%20no.4%2F0', '{"id":"default:catgut%20no.4%2F0","name":"CATGUT NO.4/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 60),
  ('otMedicineCatalog', 'default:proline%202%2F0', '{"id":"default:proline%202%2F0","name":"PROLINE 2/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 61),
  ('otMedicineCatalog', 'default:proline%203%2F0', '{"id":"default:proline%203%2F0","name":"PROLINE 3/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 62),
  ('otMedicineCatalog', 'default:proline%206%2F0', '{"id":"default:proline%206%2F0","name":"PROLINE 6/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 63),
  ('otMedicineCatalog', 'default:proline%208%2F0', '{"id":"default:proline%208%2F0","name":"PROLINE 8/0","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 64),
  ('otMedicineCatalog', 'default:bild%20no.11', '{"id":"default:bild%20no.11","name":"BILD NO.11","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 65),
  ('otMedicineCatalog', 'default:bild%20no.15', '{"id":"default:bild%20no.15","name":"BILD NO.15","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 66),
  ('otMedicineCatalog', 'default:bild%20no.19', '{"id":"default:bild%20no.19","name":"BILD NO.19","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 67),
  ('otMedicineCatalog', 'default:bild%20no.24', '{"id":"default:bild%20no.24","name":"BILD NO.24","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 68),
  ('otMedicineCatalog', 'default:local%20100cc', '{"id":"default:local%20100cc","name":"LOCAL 100CC","genericName":"","category":"","type":"","strength":"","unit":"","description":"","active":true,"deleted":false}'::jsonb, 69)
on conflict (collection, record_id) do nothing;

commit;

-- Report persisted catalogue rows, including existing custom and inactive entries.
select collection,
       count(*) as total_records,
       count(*) filter (where coalesce(data->>'active', 'true') = 'true'
                          and coalesce(data->>'deleted', 'false') <> 'true') as active_records
from public.hmc_records
where collection in ('procedures', 'rooms', 'prescriptionMedicineCatalog', 'otMedicineCatalog')
group by collection
order by collection;
-- END GENERATED HMC CATALOGUE SEEDS
