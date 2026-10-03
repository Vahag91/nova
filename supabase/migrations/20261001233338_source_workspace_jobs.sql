-- Additive workspace service. Existing chat, document and billing tables are untouched.
create table public.source_workspace_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,
  document_enabled boolean not null default false,
  transcript_enabled boolean not null default false,
  youtube_enabled boolean not null default false,
  upload_enabled boolean not null default false,
  per_device_daily integer not null default 50 check (per_device_daily between 1 and 10000),
  global_daily integer not null default 1000 check (global_daily between 1 and 1000000)
);
insert into public.source_workspace_settings(id) values(true);
create table public.source_workspace_jobs (
  id uuid primary key,
  owner_hash text not null check (owner_hash ~ '^[0-9a-f]{64}$'),
  client_hash text not null check (client_hash ~ '^[0-9a-f]{64}$'),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  source_type text not null check (source_type in ('document','transcript','youtube','upload')),
  status text not null default 'processing' check (status in ('processing','completed','failed','cancelled')),
  result jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  expires_at timestamptz not null default now() + interval '7 days'
);
create index source_workspace_jobs_owner_created on public.source_workspace_jobs(owner_hash,created_at desc);
create index source_workspace_jobs_client_created on public.source_workspace_jobs(client_hash,created_at desc);
create index source_workspace_jobs_created on public.source_workspace_jobs(created_at);
create index source_workspace_jobs_expiry on public.source_workspace_jobs(expires_at);
alter table public.source_workspace_settings enable row level security;
alter table public.source_workspace_jobs enable row level security;
revoke all on public.source_workspace_settings,public.source_workspace_jobs from public,anon,authenticated;
grant select on public.source_workspace_settings to service_role;
grant select,insert,update,delete on public.source_workspace_jobs to service_role;

-- A single settings-row lock serializes reservation, preventing quota races.
-- No identity, source text or quota claim is accepted directly from the app.
create function public.reserve_source_workspace_job(p_id uuid,p_owner text,p_client text,p_hash text,p_type text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare settings public.source_workspace_settings; existing public.source_workspace_jobs; total_count bigint; device_count bigint;
begin
  select * into settings from public.source_workspace_settings where id=true for update;
  select * into existing from public.source_workspace_jobs where id=p_id;
  if found then
    if existing.owner_hash<>p_owner or existing.client_hash<>p_client or existing.request_hash<>p_hash then
      return jsonb_build_object('code','REQUEST_CONFLICT');
    end if;
    return jsonb_build_object('created',false);
  end if;
  if settings.enabled is not true or (case p_type
    when 'document' then not settings.document_enabled when 'transcript' then not settings.transcript_enabled
    when 'youtube' then not settings.youtube_enabled when 'upload' then not settings.upload_enabled else true end) then
    return jsonb_build_object('code','NOT_CONFIGURED');
  end if;
  select count(*),count(*) filter(where client_hash=p_client) into total_count,device_count
    from public.source_workspace_jobs where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  if total_count>=settings.global_daily then return jsonb_build_object('code','SERVICE_BUSY'); end if;
  if device_count>=settings.per_device_daily then return jsonb_build_object('code','DAILY_LIMIT'); end if;
  if exists(select 1 from public.source_workspace_jobs where client_hash=p_client and status='processing'
    and created_at>now()-interval '3 minutes') then return jsonb_build_object('code','ALREADY_PROCESSING'); end if;
  insert into public.source_workspace_jobs(id,owner_hash,client_hash,request_hash,source_type)
    values(p_id,p_owner,p_client,p_hash,p_type);
  return jsonb_build_object('created',true);
end;
$$;
revoke all on function public.reserve_source_workspace_job(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reserve_source_workspace_job(uuid,text,text,text,text) to service_role;
-- Locking settings requires UPDATE, but never expose it to client roles.
grant update on public.source_workspace_settings to service_role;
select cron.schedule('source-workspace-expiry','23 * * * *',
  $cron$delete from public.source_workspace_jobs where expires_at < now();$cron$);
