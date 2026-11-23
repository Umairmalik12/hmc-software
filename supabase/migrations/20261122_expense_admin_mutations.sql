-- Staff may read expenses and register new, non-deleted expenses. Only admins
-- may update, delete or restore saved expenses. Existing records and all other
-- collections keep their current permissions and contents.
begin;

drop policy if exists "Expense creation must start recorded" on public.hmc_records;
create policy "Expense creation must start recorded"
  on public.hmc_records as restrictive for insert to authenticated
  with check (
    collection <> 'expenseDetails' or public.hmc_is_admin() or (
      data ->> 'id' = record_id
      and coalesce(data -> 'deleted', 'false'::jsonb) = 'false'::jsonb
      and coalesce(data ->> 'deletedAt', '') = ''
    )
  );

drop policy if exists "Only admins can update expenses" on public.hmc_records;
create policy "Only admins can update expenses"
  on public.hmc_records as restrictive for update to authenticated
  using (collection <> 'expenseDetails' or public.hmc_is_admin())
  with check (collection <> 'expenseDetails' or public.hmc_is_admin());

drop policy if exists "Only admins can delete expenses" on public.hmc_records;
create policy "Only admins can delete expenses"
  on public.hmc_records as restrictive for delete to authenticated
  using (collection <> 'expenseDetails' or public.hmc_is_admin());

commit;
