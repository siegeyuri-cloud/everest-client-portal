-- 0019: events from everestcollective.com/discovery, for the dashboard
-- and so book / invite submissions are finally saved. Server-only (RLS on,
-- no policies), written by app/api/discovery/track.
create table if not exists public.discovery_events (
  id          bigint generated always as identity primary key,
  session_id  text not null check (char_length(session_id) between 8 and 64),
  event       text not null check (event in ('view','stage','question','complete','book','share')),
  detail      jsonb not null default '{}'::jsonb,
  email       text,
  referrer    text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index if not exists discovery_events_created_idx on public.discovery_events (created_at desc);
create index if not exists discovery_events_session_idx on public.discovery_events (session_id);
create index if not exists discovery_events_event_idx   on public.discovery_events (event, created_at desc);
alter table public.discovery_events enable row level security;
