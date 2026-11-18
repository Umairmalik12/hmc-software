-- Repair older deployments that reject a missing ID in p_updates.
-- Run the whole file in Supabase SQL Editor as the database owner.
-- This upgrades the shared CRUD RPC for all catalogues and clinical records.
-- No tables, catalogue entries, patient histories or role policies are replaced.
-- SECURITY INVOKER and the existing row-level security remain in effect.
begin;

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

revoke all on function public.apply_hmc_record_changes(text, jsonb, jsonb, text[]) from public, anon;
grant execute on function public.apply_hmc_record_changes(text, jsonb, jsonb, text[]) to authenticated;

commit;
