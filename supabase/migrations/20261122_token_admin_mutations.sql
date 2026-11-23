-- Only administrators may rename or delete issued tokens. Reading, printing,
-- token generation and daily token sequencing remain available to staff.
-- Apply to existing HMC databases; no token data is rewritten or removed.
begin;

alter table public.patient_token_slips enable row level security;

drop policy if exists "Authenticated users can delete patient tokens" on public.patient_token_slips;
drop policy if exists "Admins can delete patient tokens" on public.patient_token_slips;
create policy "Admins can delete patient tokens"
  on public.patient_token_slips for delete to authenticated
  using (public.hmc_is_admin());

drop policy if exists "Authenticated users can update token patient names" on public.patient_token_slips;
drop policy if exists "Admins can update token patient names" on public.patient_token_slips;
create policy "Admins can update token patient names"
  on public.patient_token_slips for update to authenticated
  using (public.hmc_is_admin())
  with check (public.hmc_is_admin() and length(trim(customer_name)) > 0);

revoke update on public.patient_token_slips from authenticated;
grant update (customer_name) on public.patient_token_slips to authenticated;
grant select, delete on public.patient_token_slips to authenticated;

commit;
