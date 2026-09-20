-- =====================================================================
-- Migration 0013 — The Collective Gala: foundation, content, codes
-- Everest Collective
--
-- Run this in the Supabase SQL Editor, then run the verification block
-- at the bottom before moving on to 0014.
--
-- What this migration establishes:
--   * Every number and string the public page shows becomes a row.
--     Nothing the public reads is ever a constant in the bundle again.
--   * The donation claim lives in exactly one field, so a change to it
--     is one edit rather than four.
--   * Invitation codes leave the client entirely. Anonymous users can
--     never read them, only ask a function whether one is valid.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------
do $$ begin
  create type gala_door as enum ('seat','host','guest','sponsor');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gala_code_kind as enum ('host','guest','vip');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gala_sponsor_status as enum ('pending','confirmed','declined');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------
create or replace function public.gala_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- =====================================================================
-- gala_settings  (single row)
-- =====================================================================
create table if not exists public.gala_settings (
  id                      integer primary key default 1 check (id = 1),

  event_name              text        not null,
  event_starts_at         timestamptz not null,
  event_ends_at           timestamptz not null,
  registration_closes_at  timestamptz not null,

  venue_name              text        not null,
  venue_address           text,
  map_url                 text,
  calendar_url            text,

  capacity                integer     not null default 300 check (capacity > 0),
  seat_price_cents        integer     not null default 25000,
  table_price_cents       integer     not null default 250000,

  -- The disputed sentence lives here and only here. Every place the page
  -- describes where the money goes reads this field.
  donation_language       text        not null,
  donation_language_approved_by text,
  donation_language_approved_at timestamptz,

  beneficiary_name        text        not null default 'Pregnancy Help 4 U',
  beneficiary_url         text        not null default 'https://pregnancyhelp4u.org',
  onepager_url            text,
  contact_email           text        not null default 'Reign.Bach@everestcollective.com',
  contact_phone           text,

  -- Public-facing switches. The checklist bar is now data, and it
  -- defaults to off, so it cannot ship visible by accident again.
  show_internal_checklist boolean     not null default false,
  show_seat_counter       boolean     not null default true,
  show_sponsor_wall       boolean     not null default true,
  registration_open       boolean     not null default true,

  tickettailor_event_id   text,

  updated_at              timestamptz not null default now()
);

drop trigger if exists trg_gala_settings_updated on public.gala_settings;
create trigger trg_gala_settings_updated before update on public.gala_settings
  for each row execute function public.gala_set_updated_at();

insert into public.gala_settings (
  id, event_name, event_starts_at, event_ends_at, registration_closes_at,
  venue_name, venue_address, map_url, calendar_url,
  capacity, donation_language, contact_phone, onepager_url
) values (
  1,
  'The Collective Gala',
  '2026-12-03 18:30:00-06',
  '2026-12-03 22:00:00-06',
  '2026-11-16 23:59:59-06',
  'The Reserve at Marty B''s',
  null,   -- UNCONFIRMED: street address still outstanding
  'https://www.google.com/maps/search/?api=1&query=The+Reserve+at+Marty+B%27s+Bartonville+TX',
  'https://thecollectivegala.com/the-collective.ics',
  300,
  'PENDING PH4U APPROVAL. Do not publish donation language until this field is replaced and approved_by is filled in.',
  '(541) 480-0759',
  null    -- UNCONFIRMED: sponsorship one-pager PDF
) on conflict (id) do nothing;

-- =====================================================================
-- gala_tiers  (sponsorship levels)
-- =====================================================================
create table if not exists public.gala_tiers (
  id            uuid primary key default gen_random_uuid(),
  name          text    not null unique,
  amount_cents  integer not null check (amount_cents > 0),
  seat_count    integer not null check (seat_count > 0),
  seats_label   text    not null,
  recognition   text    not null,
  cap           integer,            -- null means unlimited
  sort_order    integer not null default 0,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_gala_tiers_updated on public.gala_tiers;
create trigger trg_gala_tiers_updated before update on public.gala_tiers
  for each row execute function public.gala_set_updated_at();

insert into public.gala_tiers (name, amount_cents, seat_count, seats_label, recognition, cap, sort_order) values
  ('Presenting Sponsor', 1500000, 10, '10 seats, one table',
   'Name on the evening, remarks from the stage, largest logo on every piece', 1, 10),
  ('Gold Sponsor',        750000, 10, '10 seats, one table',
   'Recognition from the stage, logo on the program and the screen', 3, 20),
  ('Silver Sponsor',      250000,  4, '4 seats',
   'Logo on the program and the screen', null, 30),
  ('Bronze Sponsor',      100000,  2, '2 seats',
   'Name in the program', null, 40)
on conflict (name) do nothing;

-- =====================================================================
-- gala_faqs
-- =====================================================================
create table if not exists public.gala_faqs (
  id           uuid primary key default gen_random_uuid(),
  question     text    not null unique,
  answer       text    not null,
  sort_order   integer not null default 0,
  published    boolean not null default true,
  review_note  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

drop trigger if exists trg_gala_faqs_updated on public.gala_faqs;
create trigger trg_gala_faqs_updated before update on public.gala_faqs
  for each row execute function public.gala_set_updated_at();

insert into public.gala_faqs (question, answer, sort_order, published, review_note) values
  ('Is my ticket tax deductible?', 'No, and we would rather say that plainly than let you find out in April. Your ticket is a payment for admission to an Everest Collective event, not a gift to the charity, so there is no charitable receipt for it. What happens instead is that Everest Collective pays for the venue and the set up costs, and 100% of the proceeds from the event are donated to Pregnancy Help 4 U. If you want a deductible gift, give to PH4U directly and they will receipt you.', 10, false, 'Holds the donation claim. Republish once PH4U confirms the wording.'),
  ('Can I bring additional guests?', 'Yes, of course. Tickets are $250 apiece, so add a seat for each person you are bringing when you register. If you need more than a few, host a table, and if a table is more than you need, write to us and we will find the seats.', 20, true, null),
  ('What if my plans change?', 'Tell us before November 16 and we will release your seat to someone on the list. After that the dinner is already bought and the seating chart is already built, so the seat stays yours, and what you paid is still donated to Pregnancy Help 4 U.', 30, true, null),
  ('Can I donate without attending?', 'Yes, and that one is deductible. Give to Pregnancy Help 4 U directly, they receipt you, and you never have to put on a tuxedo.', 40, true, null),
  ('Is there a dress code minimum?', 'Black tie with a Texas accent. Tuxedos and gowns, and boots are welcome. If you own a dinner jacket that only comes out once a year, this is the night.', 50, true, null),
  ('Who do I contact?', 'Write to Reign.Bach@everestcollective.com or call the number in the footer. A person answers, and it is usually the same day.', 60, true, null)
on conflict (question) do nothing;

-- =====================================================================
-- gala_hosts  (the thirty table hosts)
-- =====================================================================
create table if not exists public.gala_hosts (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text,
  mobile          text,
  table_number    text,
  seats_total     integer not null default 10 check (seats_total between 1 and 20),
  committed_at    timestamptz,
  active          boolean not null default true,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_gala_hosts_updated on public.gala_hosts;
create trigger trg_gala_hosts_updated before update on public.gala_hosts
  for each row execute function public.gala_set_updated_at();

-- No seed rows. Hosts are created in the portal as they actually commit.
-- The four invented hosts in the current bundle are deliberately not here.

-- =====================================================================
-- gala_codes  (invitation codes, never readable by the public)
-- =====================================================================
create table if not exists public.gala_codes (
  id            uuid primary key default gen_random_uuid(),
  code          text    not null unique,
  kind          gala_code_kind not null,
  host_id       uuid references public.gala_hosts(id) on delete cascade,
  sponsor_id    uuid,   -- FK added in 0014 once gala_sponsors is populated
  max_uses      integer not null default 1 check (max_uses > 0),
  uses          integer not null default 0 check (uses >= 0),
  comped        boolean not null default false,
  invited_by    text,
  expires_at    timestamptz,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint gala_codes_uses_within_max check (uses <= max_uses),
  constraint gala_codes_host_required check (kind <> 'host' or host_id is not null)
);

create index if not exists idx_gala_codes_host on public.gala_codes(host_id);
create unique index if not exists idx_gala_codes_upper on public.gala_codes(upper(code));

drop trigger if exists trg_gala_codes_updated on public.gala_codes;
create trigger trg_gala_codes_updated before update on public.gala_codes
  for each row execute function public.gala_set_updated_at();

-- A host code carries max_uses = seats_total (the host occupies one of them).
-- A per-guest code carries max_uses = 1.
-- Which model you use is a data decision now, not a schema change.

-- =====================================================================
-- gala_sponsors
-- =====================================================================
create table if not exists public.gala_sponsors (
  id                uuid primary key default gen_random_uuid(),
  tier_id           uuid references public.gala_tiers(id) on delete restrict,
  legal_name        text not null,
  recognition_name  text,
  logo_path         text,           -- Supabase Storage object path
  website_url       text,
  contact_name      text,
  contact_email     text,
  contact_phone     text,
  status            gala_sponsor_status not null default 'pending',
  show_on_wall      boolean not null default false,
  amount_cents      integer,
  committed_at      timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_gala_sponsors_tier on public.gala_sponsors(tier_id);

drop trigger if exists trg_gala_sponsors_updated on public.gala_sponsors;
create trigger trg_gala_sponsors_updated before update on public.gala_sponsors
  for each row execute function public.gala_set_updated_at();

-- No seed rows. The twelve companies currently on the live sponsor wall
-- were demo data and are not carried forward.

alter table public.gala_codes
  drop constraint if exists gala_codes_sponsor_fk;
alter table public.gala_codes
  add constraint gala_codes_sponsor_fk
  foreign key (sponsor_id) references public.gala_sponsors(id) on delete cascade;

-- =====================================================================
-- Public read view for the sponsor wall
-- Confirmed AND explicitly flagged for display. Two locks, not one.
-- =====================================================================
create or replace view public.gala_sponsor_wall as
  select s.id, t.name as tier_name, t.sort_order,
         coalesce(s.recognition_name, s.legal_name) as display_name,
         s.logo_path, s.website_url
  from public.gala_sponsors s
  join public.gala_tiers t on t.id = s.tier_id
  where s.status = 'confirmed' and s.show_on_wall = true;

-- =====================================================================
-- Row Level Security
--
-- Model: anonymous visitors read published content only. Every write,
-- and every read of gala_codes or gala_hosts, happens server side in the
-- Next.js app using the service role key, which bypasses RLS. That keeps
-- the policy surface small enough to reason about.
-- =====================================================================
alter table public.gala_settings enable row level security;
alter table public.gala_tiers    enable row level security;
alter table public.gala_faqs     enable row level security;
alter table public.gala_hosts    enable row level security;
alter table public.gala_codes    enable row level security;
alter table public.gala_sponsors enable row level security;

drop policy if exists gala_settings_public_read on public.gala_settings;
create policy gala_settings_public_read on public.gala_settings
  for select to anon, authenticated using (true);

drop policy if exists gala_tiers_public_read on public.gala_tiers;
create policy gala_tiers_public_read on public.gala_tiers
  for select to anon, authenticated using (active = true);

drop policy if exists gala_faqs_public_read on public.gala_faqs;
create policy gala_faqs_public_read on public.gala_faqs
  for select to anon, authenticated using (published = true);

-- gala_hosts, gala_codes and gala_sponsors intentionally receive no
-- anon or authenticated policy. With RLS on and no policy, they are
-- unreadable to everyone except the service role. This is what stops
-- the codes being visible in view-source the way they are today.

grant select on public.gala_sponsor_wall to anon, authenticated;

-- =====================================================================
-- VERIFICATION — run this separately and read the output before 0014
-- =====================================================================
-- select 'settings' as t, count(*) from public.gala_settings
-- union all select 'tiers',    count(*) from public.gala_tiers
-- union all select 'faqs',     count(*) from public.gala_faqs
-- union all select 'faqs_held', count(*) from public.gala_faqs where published = false
-- union all select 'hosts',    count(*) from public.gala_hosts
-- union all select 'codes',    count(*) from public.gala_codes
-- union all select 'sponsors', count(*) from public.gala_sponsors;
--
-- Expect: settings 1, tiers 4, faqs 6, faqs_held 1, hosts 0, codes 0, sponsors 0.
