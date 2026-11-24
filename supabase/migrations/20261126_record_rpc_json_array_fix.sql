-- Apply after the role/module permissions migration. Fix JSON array argument checks.
-- Existing records and permissions are preserved.
begin;

create or replace function public.apply_hmc_record_changes(
  p_collection text, p_inserts jsonb, p_updates jsonb, p_delete_ids text[]
)
returns void language plpgsql security invoker set search_path = public as $$
declare row_data jsonb; affected_rows integer; module_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  module_key := public.hmc_module_for_collection(p_collection);
  if module_key is null then raise exception 'Unknown record module'; end if;
  if coalesce(array_length(p_delete_ids,1),0)>0 and not public.hmc_has_permission(module_key,'delete') then raise exception 'You do not have permission to delete records in this module'; end if;
  if coalesce(jsonb_array_length(p_inserts),0)>0 and not public.hmc_has_permission(module_key,'create') then raise exception 'You do not have permission to create records in this module'; end if;
  if coalesce(jsonb_array_length(p_updates),0)>0 and not public.hmc_has_permission(module_key,'edit') and not public.hmc_has_permission(module_key,'delete') and not public.hmc_has_permission(module_key,'create') then raise exception 'You do not have permission to modify records in this module'; end if;

  perform pg_advisory_xact_lock(hashtext(p_collection)::bigint);
  if coalesce(array_length(p_delete_ids,1),0)>0 then
    delete from public.hmc_records where collection=p_collection and record_id=any(p_delete_ids);
  end if;
  for row_data in select value from jsonb_array_elements(coalesce(p_inserts,'[]'::jsonb)) loop
    insert into public.hmc_records(collection,record_id,data,sort_order,updated_at)
    values(p_collection,row_data ->> 'record_id',row_data -> 'data',(row_data ->> 'sort_order')::integer,now())
    on conflict(collection,record_id) do update set data=excluded.data,sort_order=excluded.sort_order,updated_at=now();
  end loop;
  for row_data in select value from jsonb_array_elements(coalesce(p_updates,'[]'::jsonb)) loop
    if exists(select 1 from public.hmc_records where collection=p_collection and record_id=row_data ->> 'record_id') then
      if not public.hmc_has_permission(module_key,'edit') and not (public.hmc_has_permission(module_key,'delete') and public.hmc_is_soft_delete_transition(p_collection,row_data ->> 'record_id',row_data -> 'data')) then
        raise exception 'You do not have permission to edit this record';
      end if;
    elsif not public.hmc_has_permission(module_key,'create') then
      raise exception 'You do not have permission to create this record';
    end if;
    update public.hmc_records set data=row_data -> 'data',sort_order=(row_data ->> 'sort_order')::integer,updated_at=now()
      where collection=p_collection and record_id=row_data ->> 'record_id';
    get diagnostics affected_rows=row_count;
    if affected_rows=0 then
      insert into public.hmc_records(collection,record_id,data,sort_order,updated_at)
      values(p_collection,row_data ->> 'record_id',row_data -> 'data',(row_data ->> 'sort_order')::integer,now())
      on conflict(collection,record_id) do update set data=excluded.data,sort_order=excluded.sort_order,updated_at=now();
    end if;
  end loop;
end;
$$;

commit;
