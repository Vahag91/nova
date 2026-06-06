create table public.ai_content_reports (
  id uuid primary key default gen_random_uuid(),
  content_type text not null
    check (content_type in ('chat_response', 'generated_image', 'edited_image')),
  content_id text null
    check (content_id is null or char_length(content_id) <= 256),
  user_id text null
    check (user_id is null or char_length(user_id) <= 256),
  device_id text not null
    check (char_length(trim(device_id)) between 1 and 256),
  reason text not null
    check (reason in (
      'sexual',
      'violence_self_harm',
      'hate_harassment',
      'child_safety',
      'scam_deceptive',
      'other'
    )),
  details text null
    check (details is null or char_length(details) <= 2000),
  prompt text null
    check (prompt is null or char_length(prompt) <= 16000),
  output_text text null
    check (output_text is null or char_length(output_text) <= 32000),
  image_url text null
    check (
      image_url is null
      or (
        char_length(image_url) <= 2048
        and image_url !~* '^(data:|file:)'
      )
    ),
  image_storage_path text null
    check (image_storage_path is null or char_length(image_storage_path) <= 1024),
  model text null
    check (model is null or char_length(model) <= 128),
  source_screen text null
    check (source_screen is null or source_screen in ('chat', 'create_image_generating', 'image_viewer')),
  app_version text null
    check (app_version is null or char_length(app_version) <= 64),
  platform text not null default 'android'
    check (platform in ('android', 'ios')),
  status text not null default 'pending'
    check (status in ('pending', 'reviewed', 'dismissed', 'action_taken')),
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 8192),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_ai_content_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_content_reports_updated_at
before update on public.ai_content_reports
for each row execute function public.set_ai_content_reports_updated_at();

alter table public.ai_content_reports enable row level security;

revoke all on public.ai_content_reports from anon, authenticated;

grant insert (
  content_type,
  content_id,
  device_id,
  reason,
  details,
  prompt,
  output_text,
  image_url,
  image_storage_path,
  model,
  source_screen,
  app_version,
  platform,
  metadata
) on public.ai_content_reports to anon, authenticated;

create policy "app clients submit ai content reports"
on public.ai_content_reports
for insert
to anon, authenticated
with check (
  device_id = coalesce(
    coalesce(current_setting('request.headers', true), '{}')::json ->> 'x-device-id',
    ''
  )
  and status = 'pending'
);
