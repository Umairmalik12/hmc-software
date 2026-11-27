create or replace function public.hmc_issue_patient_token(p_customer_name text,p_token_date date,p_token_time text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare next_number integer; issued_at timestamptz; saved public.patient_token_slips;
begin
  if not public.hmc_has_permission('tokens','create') then
    raise exception 'Sign in with an assigned hospital account.' using errcode = '42501';
  end if;
  if nullif(btrim(p_customer_name),'') is null then raise exception 'Enter the patient name.'; end if;
  if length(btrim(p_customer_name)) > 120 then raise exception 'Use 120 characters or fewer for the patient name.'; end if;
  if p_token_date is null or p_token_date < date '1900-01-01' or p_token_date > date '9999-12-31'
    or p_token_time is null or p_token_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then
    raise exception 'Select a valid token date and time.';
  end if;
  perform pg_advisory_xact_lock(164836,p_token_date - date '2000-01-01');
  with occupied as (
    select sequence::bigint as number from public.patient_token_slips where token_date = p_token_date
    union
    select case when token_number ~ '^A[0-9]+$' and length(ltrim(substr(token_number,2),'0')) between 1 and 10
      then ltrim(substr(token_number,2),'0')::bigint else null end
    from public.patient_token_slips where token_date = p_token_date
  ), candidates as (
    select 1::bigint as number union select number + 1 from occupied where number < 2147483647
  )
  select min(candidate.number)::integer into next_number from candidates candidate
    where candidate.number between 1 and 2147483647 and not exists(
      select 1 from occupied used where used.number = candidate.number
    );
  if next_number is null then raise exception 'No token numbers are available for this date.'; end if;
  issued_at := (p_token_date + p_token_time::time) at time zone 'Asia/Karachi';
  insert into public.patient_token_slips(token_number,sequence,customer_name,token_date,token_time,created_at)
    values('A' || lpad(next_number::text,greatest(2,length(next_number::text)),'0'),next_number,btrim(p_customer_name),
      p_token_date,to_char(issued_at at time zone 'Asia/Karachi','HH12:MI AM'),issued_at) returning * into saved;
  return to_jsonb(saved);
end;
$$;

create or replace function public.create_patient_token_at(p_customer_name text,p_token_date date,p_token_time text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
begin
  return public.hmc_issue_patient_token(p_customer_name,p_token_date,p_token_time);
end;
$$;

create or replace function public.create_patient_token(p_customer_name text)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare local_now timestamp := clock_timestamp() at time zone 'Asia/Karachi';
begin
  return public.hmc_issue_patient_token(p_customer_name,local_now::date,to_char(local_now,'HH24:MI'));
end;
$$;

create or replace function public.hmc_mutate_patient_token(p_id bigint,p_action text,p_customer_name text default null)
returns jsonb language plpgsql security definer set search_path = public,auth as $$
declare saved public.patient_token_slips; token_day date;
begin
  if p_action is null or p_action not in ('edit','delete') then raise exception 'Invalid token action.'; end if;
  if not public.hmc_is_admin() then raise exception 'Only Admin can change saved tokens.' using errcode = '42501'; end if;
  select token_date into token_day from public.patient_token_slips where id = p_id;
  if not found then raise exception 'This token no longer exists. Refresh the list.' using errcode = 'P0002'; end if;
  perform pg_advisory_xact_lock(164836,token_day - date '2000-01-01');
  if p_action = 'delete' then
    delete from public.patient_token_slips where id = p_id returning * into saved;
  else
    if nullif(btrim(p_customer_name),'') is null then raise exception 'Enter the patient name.'; end if;
    if length(btrim(p_customer_name)) > 120 then raise exception 'Use 120 characters or fewer for the patient name.'; end if;
    update public.patient_token_slips set customer_name = btrim(p_customer_name) where id = p_id returning * into saved;
  end if;
  if not found then raise exception 'This token no longer exists. Refresh the list.' using errcode = 'P0002'; end if;
  return case when p_action = 'delete' then jsonb_build_object('id',saved.id,'deleted',true) else to_jsonb(saved) end;
end;
$$;

revoke all on function public.hmc_issue_patient_token(text,date,text),public.create_patient_token(text),
  public.create_patient_token_at(text,date,text),public.hmc_mutate_patient_token(bigint,text,text) from public,anon;
grant execute on function public.hmc_issue_patient_token(text,date,text),public.create_patient_token(text),
  public.create_patient_token_at(text,date,text),public.hmc_mutate_patient_token(bigint,text,text) to authenticated;
