-- Use the date and time selected in the token form; keep existing slips and counters.
create or replace function public.create_patient_token_at(p_customer_name text, p_token_date date, p_token_time text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  issued_at timestamptz;
  sequence_number integer;
  token_text text;
  local_time text;
  token_id bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0 then raise exception 'Patient name is required'; end if;
  if p_token_date is null or p_token_date < date '1900-01-01' or p_token_date > date '9999-12-31'
    or p_token_time is null or p_token_time !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
  then raise exception 'Select a valid token date and time'; end if;

  issued_at := (p_token_date + p_token_time::time) at time zone 'Asia/Karachi';
  insert into public.patient_token_daily_sequences (token_date, next_sequence)
  values (p_token_date, 2)
  on conflict (token_date)
  do update set next_sequence = public.patient_token_daily_sequences.next_sequence + 1
  returning next_sequence - 1 into sequence_number;

  token_text := 'A' || repeat('0', greatest(3 - length(sequence_number::text), 0)) || sequence_number::text;
  local_time := to_char(issued_at at time zone 'Asia/Karachi', 'HH12:MI AM');
  insert into public.patient_token_slips (token_number, sequence, customer_name, token_date, token_time, created_at)
  values (token_text, sequence_number, trim(p_customer_name), p_token_date, local_time, issued_at)
  returning id into token_id;

  return jsonb_build_object('id', token_id, 'token_number', token_text, 'sequence', sequence_number,
    'customer_name', trim(p_customer_name), 'token_date', to_char(p_token_date, 'YYYY-MM-DD'),
    'token_time', local_time, 'created_at', issued_at);
end;
$$;
revoke all on function public.create_patient_token_at(text, date, text) from public, anon;
grant execute on function public.create_patient_token_at(text, date, text) to authenticated;
