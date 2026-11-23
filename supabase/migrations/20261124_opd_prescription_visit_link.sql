-- Give each OPD encounter its own stable record key while keeping MR in data.patientId.
-- Existing numeric record keys remain valid and are exposed by the app as legacy visit IDs.
begin;

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
  end if;
  return new;
end;
$$;

create unique index if not exists hmc_prescription_one_per_opd_visit
  on public.hmc_records ((data ->> 'opdVisitId'))
  where collection = 'prescriptions'
    and jsonb_typeof(data) = 'object'
    and nullif(btrim(data ->> 'opdVisitId'), '') is not null;

drop policy if exists "Only admins can create prescriptions" on public.hmc_records;
create policy "Only admins can create prescriptions"
  on public.hmc_records as restrictive for insert to authenticated
  with check (collection not in ('prescriptions', 'prescription') or public.hmc_is_admin());

drop policy if exists "Only admins can update prescriptions" on public.hmc_records;
create policy "Only admins can update prescriptions"
  on public.hmc_records as restrictive for update to authenticated
  using (collection not in ('prescriptions', 'prescription') or public.hmc_is_admin())
  with check (collection not in ('prescriptions', 'prescription') or public.hmc_is_admin());

drop policy if exists "Only admins can delete prescriptions" on public.hmc_records;
create policy "Only admins can delete prescriptions"
  on public.hmc_records as restrictive for delete to authenticated
  using (collection not in ('prescriptions', 'prescription') or public.hmc_is_admin());

commit;
