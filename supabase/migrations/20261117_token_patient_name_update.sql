-- Apply to existing projects to enable the token editor. Queue identity,
-- sequence, issue date and issue time remain immutable to authenticated users.
begin;
drop policy if exists "Authenticated users can update token patient names" on public.patient_token_slips;
create policy "Authenticated users can update token patient names"
  on public.patient_token_slips for update
  to authenticated
  using (true)
  with check (length(trim(customer_name)) > 0);
grant update (customer_name) on public.patient_token_slips to authenticated;
commit;
