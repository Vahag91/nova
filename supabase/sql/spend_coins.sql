-- Ensure ledger can store job identifiers for idempotency
alter table coins_ledger
  add column if not exists job_id uuid;

-- ensure idempotency on (device_id, job_id)
create unique index if not exists coins_ledger_device_job_uidx
  on coins_ledger (device_id, job_id)
  where job_id is not null;

-- Atomically spend coins for a device. Inserts a negative delta in the ledger
-- and returns the new balance. Caller must supply a stable job_id so repeated
-- calls for the same generation are idempotent.
create or replace function spend_coins(
  p_device_id text,
  p_amount integer,
  p_job_id uuid,
  p_source text default 'app:spend'
)
returns table(balance integer, charged integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  current_balance integer;
begin
  if coalesce(p_device_id, '') = '' then
    raise exception 'device_id-required';
  end if;

  if coalesce(p_amount, 0) <= 0 then
    raise exception 'amount-must-be-positive';
  end if;

  if p_job_id is null then
    raise exception 'job_id-required';
  end if;

  -- prevent concurrent spends
  perform pg_advisory_xact_lock(hashtext(p_device_id));

  -- idempotent: if we already charged this job, just return balance
  if exists (
    select 1
    from coins_ledger
    where device_id = p_device_id
      and job_id = p_job_id
  ) then
    select coalesce(sum(delta), 0)::integer
      into current_balance
    from coins_ledger
    where device_id = p_device_id;

    return query select current_balance, 0;
    return;
  end if;

  -- current balance
  select coalesce(sum(delta), 0)::integer
    into current_balance
  from coins_ledger
  where device_id = p_device_id;

  if current_balance < p_amount then
    raise exception 'insufficient-coins'
      using message = format(
        'Not enough coins for device %s: balance=%s required=%s',
        p_device_id, current_balance, p_amount
      );
  end if;

  -- write spend
  insert into coins_ledger (device_id, delta, source, product_id, job_id)
  values (
    p_device_id,
    -p_amount,
    coalesce(nullif(p_source, ''), 'app:spend'),
    null,
    p_job_id
  );

  -- we know what the new balance is
  current_balance := current_balance - p_amount;

  return query select current_balance, p_amount;
end;
$$;

grant execute on function spend_coins(text, integer, uuid, text) to service_role;
