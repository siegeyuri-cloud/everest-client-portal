-- 0020: Leader values survey (client survey framework).
-- One survey round per client per cycle. Each client has its own values,
-- each value has its behaviors, raters score their own leader 1 to 5.
--
-- Privacy rules built into the schema:
--   * A response is never linked to the invite it came from.
--   * Responses keep only the date, not the time, so they cannot be
--     matched to the moment an invite was used.
--   * Submitting goes through submit_survey_response(), one atomic step
--     that validates the link, requires every behavior, and burns the link.
--   * Report views return counts; the app hides any leader below the
--     round's anonymity_threshold (minimum 3).
-- All tables are server-only (RLS on, no policies), like discovery_events.

create table if not exists public.survey_rounds (
  id                  uuid primary key default gen_random_uuid(),
  organization_id     uuid not null references public.organizations(id) on delete cascade,
  title               text not null default 'Leader values survey',
  status              text not null default 'draft' check (status in ('draft','open','closed')),
  anonymity_threshold int  not null default 3 check (anonymity_threshold >= 3),
  scale_labels        jsonb not null default '["Rarely","Some of the time","About half the time","Most of the time","All of the time"]'::jsonb,
  opened_at           timestamptz,
  closed_at           timestamptz,
  created_by          uuid references public.profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists survey_rounds_org_idx on public.survey_rounds (organization_id, created_at desc);

create table if not exists public.survey_values (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.survey_rounds(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists survey_values_round_idx on public.survey_values (round_id, sort_order);

create table if not exists public.survey_behaviors (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.survey_rounds(id) on delete cascade,
  value_id   uuid not null references public.survey_values(id) on delete cascade,
  text       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists survey_behaviors_value_idx on public.survey_behaviors (value_id, sort_order);
create index if not exists survey_behaviors_round_idx on public.survey_behaviors (round_id);

create table if not exists public.survey_teams (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.survey_rounds(id) on delete cascade,
  name       text not null,
  sort_order int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists survey_teams_round_idx on public.survey_teams (round_id, sort_order);

create table if not exists public.survey_leaders (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references public.survey_rounds(id) on delete cascade,
  team_id    uuid references public.survey_teams(id) on delete set null,
  name       text not null,
  email      text,
  profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists survey_leaders_round_idx on public.survey_leaders (round_id, team_id);

-- One private link per rater. Only a SHA-256 hash of the link token is stored.
create table if not exists public.survey_invites (
  id          uuid primary key default gen_random_uuid(),
  round_id    uuid not null references public.survey_rounds(id) on delete cascade,
  leader_id   uuid not null references public.survey_leaders(id) on delete cascade,
  token_hash  text not null unique,
  rater_email text,
  sent_at     timestamptz,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists survey_invites_leader_idx on public.survey_invites (leader_id);

-- Deliberately no invite_id, and a date instead of a timestamp.
create table if not exists public.survey_responses (
  id           uuid primary key default gen_random_uuid(),
  round_id     uuid not null references public.survey_rounds(id) on delete cascade,
  leader_id    uuid not null references public.survey_leaders(id) on delete cascade,
  submitted_on date not null default current_date
);
create index if not exists survey_responses_leader_idx on public.survey_responses (round_id, leader_id);

create table if not exists public.survey_answers (
  response_id uuid not null references public.survey_responses(id) on delete cascade,
  behavior_id uuid not null references public.survey_behaviors(id) on delete cascade,
  score       smallint not null check (score between 1 and 5),
  primary key (response_id, behavior_id)
);
create index if not exists survey_answers_behavior_idx on public.survey_answers (behavior_id);

alter table public.survey_rounds    enable row level security;
alter table public.survey_values    enable row level security;
alter table public.survey_behaviors enable row level security;
alter table public.survey_teams     enable row level security;
alter table public.survey_leaders   enable row level security;
alter table public.survey_invites   enable row level security;
alter table public.survey_responses enable row level security;
alter table public.survey_answers   enable row level security;

-- Atomic submit. Returns 'ok', 'invalid', 'used', 'closed' or 'incomplete'.
create or replace function public.submit_survey_response(p_token_hash text, p_answers jsonb)
returns text
language plpgsql security definer set search_path = public
as $fn$
declare
  v_invite   public.survey_invites%rowtype;
  v_status   text;
  v_expected int;
  v_given    int;
  v_response uuid;
begin
  select * into v_invite from public.survey_invites where token_hash = p_token_hash for update;
  if not found then return 'invalid'; end if;
  if v_invite.used_at is not null then return 'used'; end if;

  select status into v_status from public.survey_rounds where id = v_invite.round_id;
  if v_status is distinct from 'open' then return 'closed'; end if;

  select count(*) into v_expected from public.survey_behaviors where round_id = v_invite.round_id;
  select count(*) into v_given
    from jsonb_each_text(coalesce(p_answers, '{}'::jsonb)) a
    join public.survey_behaviors b on b.id::text = a.key and b.round_id = v_invite.round_id
   where a.value ~ '^[1-5]$';
  if v_expected = 0 or v_given <> v_expected then return 'incomplete'; end if;

  update public.survey_invites set used_at = now() where id = v_invite.id;
  insert into public.survey_responses (round_id, leader_id)
       values (v_invite.round_id, v_invite.leader_id)
    returning id into v_response;
  insert into public.survey_answers (response_id, behavior_id, score)
       select v_response, a.key::uuid, a.value::smallint
         from jsonb_each_text(p_answers) a
         join public.survey_behaviors b on b.id::text = a.key and b.round_id = v_invite.round_id;
  return 'ok';
end
$fn$;
revoke all on function public.submit_survey_response(text, jsonb) from public, anon, authenticated;
grant execute on function public.submit_survey_response(text, jsonb) to service_role;

-- Report building blocks. The app applies the anonymity threshold.
create or replace view public.survey_leader_behavior_scores
with (security_invoker = true) as
select r.round_id, r.leader_id, a.behavior_id,
       round(avg(a.score)::numeric, 2) as avg_score,
       count(*)::int as n
  from public.survey_answers a
  join public.survey_responses r on r.id = a.response_id
 group by r.round_id, r.leader_id, a.behavior_id;

create or replace view public.survey_leader_counts
with (security_invoker = true) as
select l.round_id, l.id as leader_id, l.team_id,
       (select count(*) from public.survey_responses r where r.leader_id = l.id)::int as responses,
       (select count(*) from public.survey_invites i where i.leader_id = l.id)::int as invites
  from public.survey_leaders l;
