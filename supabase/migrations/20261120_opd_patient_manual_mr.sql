-- Require entered OPD MR numbers without changing historical records.
-- Apply after 20261120_manual_operation_patient_mr.sql.
begin;

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

  if p_collection = 'patientDetails' then
    raise exception 'Enter the patient MR number. Operation patient MR numbers are not assigned automatically.';
  end if;

  if p_collection = 'opdDetails' then
    raise exception 'Enter the patient MR number. OPD patient MR numbers are not assigned automatically.';
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

create or replace function public.validate_opd_patient_mr()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  mr_number numeric;
begin
  if new.collection = 'opdDetails' then
    if jsonb_typeof(new.data -> 'patientId') is distinct from 'number' then
      raise exception 'Enter the patient MR number as a positive whole number.';
    end if;
    mr_number := (new.data ->> 'patientId')::numeric;
    if mr_number < 1 or mr_number > 9007199254740991 or trunc(mr_number) <> mr_number then
      raise exception 'Enter the patient MR number as a positive whole number.';
    end if;
    if new.record_id is distinct from trunc(mr_number)::text then
      raise exception 'The OPD patient record must use the entered MR number.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists hmc_opd_patient_manual_mr on public.hmc_records;
create trigger hmc_opd_patient_manual_mr
before insert or update of collection, record_id, data on public.hmc_records
for each row execute function public.validate_opd_patient_mr();

revoke all on function public.next_hmc_id(text) from public, anon;
grant execute on function public.next_hmc_id(text) to authenticated;

commit;
