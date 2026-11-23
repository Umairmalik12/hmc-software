-- Both catalogues remain readable. Staff may add genuinely new medicines;
-- existing rows, built-in/legacy overrides, deletion and restoration require admin.
begin;

drop policy if exists "Medicine catalogue creation permissions" on public.hmc_records;
create policy "Medicine catalogue creation permissions"
  on public.hmc_records as restrictive for insert to authenticated
  with check (
    collection not in ('prescriptionMedicineCatalog', 'otMedicineCatalog', 'customMedicines')
    or public.hmc_is_admin()
    or (
      collection in ('prescriptionMedicineCatalog', 'otMedicineCatalog')
      and record_id ~ '^[1-9][0-9]*$'
      and jsonb_typeof(data) = 'object' and data ->> 'id' = record_id
      and coalesce(data -> 'deleted', 'false'::jsonb) = 'false'::jsonb
      and (collection <> 'prescriptionMedicineCatalog' or coalesce(data -> 'active', 'true'::jsonb) = 'true'::jsonb)
    )
  );

drop policy if exists "Only admins can update medicine catalogues" on public.hmc_records;
create policy "Only admins can update medicine catalogues"
  on public.hmc_records as restrictive for update to authenticated
  using (collection not in ('prescriptionMedicineCatalog', 'otMedicineCatalog', 'customMedicines') or public.hmc_is_admin())
  with check (collection not in ('prescriptionMedicineCatalog', 'otMedicineCatalog', 'customMedicines') or public.hmc_is_admin());

drop policy if exists "Only admins can delete medicine catalogues" on public.hmc_records;
create policy "Only admins can delete medicine catalogues"
  on public.hmc_records as restrictive for delete to authenticated
  using (collection not in ('prescriptionMedicineCatalog', 'otMedicineCatalog', 'customMedicines') or public.hmc_is_admin());

commit;
