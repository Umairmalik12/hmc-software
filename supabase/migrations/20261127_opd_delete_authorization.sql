-- Apply in Supabase SQL Editor after the existing HMC schema.
-- Delete one OPD encounter with explicit server-side authorization and feedback.
begin;

create or replace function public.hmc_delete_opd_visit(p_visit_id text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  account_role text;
  allowed boolean := false;
  removed_id text;
begin
  if auth.uid() is null then
    raise exception 'Your session expired. Sign in again.' using errcode = '28000';
  end if;
  if p_visit_id is null or btrim(p_visit_id) = '' then
    raise exception 'Select a valid OPD visit.' using errcode = '22023';
  end if;

  select role into account_role from public.hmc_user_roles where user_id = auth.uid();
  if account_role = 'admin' then
    allowed := true;
  elsif account_role is not null and to_regprocedure('public.hmc_has_permission(text,text)') is not null then
    allowed := public.hmc_has_permission('opd', 'delete');
  end if;
  if allowed is not true then
    raise exception 'Your database account role does not allow deleting OPD visits.' using errcode = '42501';
  end if;

  -- Use the same collection lock as the record RPC. MR numbers are never used
  -- to select another visit, and linked prescriptions are never cascaded away.
  perform pg_advisory_xact_lock(hashtext('opdDetails')::bigint);
  perform 1 from public.hmc_records
    where collection = 'opdDetails' and record_id = p_visit_id for update;
  if not found then
    raise exception 'This OPD visit has already been removed. Reload the list.' using errcode = 'P0002';
  end if;
  if exists (
    select 1 from public.hmc_records
    where collection in ('prescriptions', 'prescription') and data ->> 'opdVisitId' = p_visit_id
  ) then
    raise exception 'Delete the linked prescription before deleting this OPD visit.' using errcode = '23503';
  end if;

  delete from public.hmc_records
    where collection = 'opdDetails' and record_id = p_visit_id
    returning record_id into removed_id;
  if removed_id is null then
    raise exception 'The OPD visit could not be removed by the database.';
  end if;
  return jsonb_build_object('record_id', removed_id, 'deleted', true);
end;
$$;

revoke all on function public.hmc_delete_opd_visit(text) from public, anon;
grant execute on function public.hmc_delete_opd_visit(text) to authenticated;

notify pgrst, 'reload schema';
commit;
