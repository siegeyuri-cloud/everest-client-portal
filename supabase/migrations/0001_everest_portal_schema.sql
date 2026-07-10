-- ============================================================
-- EVEREST CLIENT PORTAL — SCHEMA MIGRATION 0001
-- Where to run: Supabase Dashboard → SQL Editor → paste ALL of
-- this into one query → Run. Expect: "Success. No rows returned"
-- Creates all 14 tables + automation. Run ONCE.
-- ============================================================

-- ------------------------------------------------------------
-- 1. PROFILES
-- One row per user, mirrors Supabase Auth users.
-- is_everest_admin is the global flag for Mike/Brittany/Rain/Yuri:
-- it powers "admins can see and edit everything" in the security
-- rules (Step 6). Org-level roles live in organization_members.
-- ------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  is_everest_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile row whenever a user is created in
-- Supabase Auth (covers invites AND normal signups).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ------------------------------------------------------------
-- 2. ORGANIZATIONS (one row per client, e.g. Southern Staffing Group)
-- current_phase_id gets its foreign key AFTER journey_phases
-- exists (the two tables point at each other).
-- ------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  engagement_type text,
  status text,
  portal_title text,
  portal_subtitle text,
  description text,
  current_phase_id uuid,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 3. ORGANIZATION MEMBERS (who belongs to which client portal)
-- ------------------------------------------------------------
create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin','executive','staff')),
  status text not null default 'invited' check (status in ('invited','active','disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ------------------------------------------------------------
-- 4. PORTAL TABS
-- ------------------------------------------------------------
create table public.portal_tabs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  slug text not null,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 5. JOURNEY PHASES (the dot-by-dot expedition map)
-- ------------------------------------------------------------
create table public.journey_phases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  phase_number integer,
  title text not null,
  subtitle text,
  status text not null default 'locked' check (status in ('available','current','locked','complete')),
  body text,
  teaser text,
  is_locked boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now journey_phases exists, wire up organizations.current_phase_id
alter table public.organizations
  add constraint organizations_current_phase_id_fkey
  foreign key (current_phase_id) references public.journey_phases(id) on delete set null;

-- ------------------------------------------------------------
-- 6. SESSIONS (workshops / retreats / kickoffs)
-- recording_resource_id + transcript_resource_id get their
-- foreign keys AFTER resources exists (circular reference).
-- ------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  session_date date,
  status text not null default 'upcoming' check (status in ('upcoming','complete','in_progress')),
  objective text,
  recap text,
  thumbnail_url text,
  recording_resource_id uuid,
  transcript_resource_id uuid,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 7. RESOURCE CATEGORIES
-- ------------------------------------------------------------
create table public.resource_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  sort_order integer not null default 0,
  is_enabled boolean not null default true,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 8. RESOURCES (files, links, recordings, transcripts)
-- ------------------------------------------------------------
create table public.resources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  category_id uuid references public.resource_categories(id) on delete set null,
  title text not null,
  description text,
  type text not null default 'other' check (type in ('pdf','link','image','video','recording','transcript','doc','other')),
  url text,
  storage_path text,
  linked_session_id uuid references public.sessions(id) on delete set null,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Now resources exists, wire up the session recording/transcript links
alter table public.sessions
  add constraint sessions_recording_resource_id_fkey
    foreign key (recording_resource_id) references public.resources(id) on delete set null,
  add constraint sessions_transcript_resource_id_fkey
    foreign key (transcript_resource_id) references public.resources(id) on delete set null;

-- ------------------------------------------------------------
-- 9. KEY ITEMS (checklist: Signed MSA, Signed NDA, etc.)
-- ------------------------------------------------------------
create table public.key_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text not null,
  description text,
  category text,
  status text not null default 'not_started' check (status in ('not_started','in_progress','complete')),
  priority text not null default 'normal' check (priority in ('required','normal','low')),
  is_client_actionable boolean not null default false,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  due_date date,
  linked_session_id uuid references public.sessions(id) on delete set null,
  linked_resource_id uuid references public.resources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 10. LOGISTICS (dates, location, food, room setup, materials, attendees)
-- ------------------------------------------------------------
create table public.logistics (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  label text not null,
  value text,
  sort_order integer not null default 0,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 11. INTERNAL NOTES (admin-only, never visible to clients)
-- ------------------------------------------------------------
create table public.internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  title text,
  body text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 12. VISIBILITY OVERRIDES (per-item fine-tuning)
-- ------------------------------------------------------------
create table public.visibility_overrides (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  content_type text not null,
  content_id uuid not null,
  staff_visible boolean not null default true,
  executive_visible boolean not null default true,
  client_visible boolean not null default true,
  admin_only boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 13. ACTIVITY LOG (audit trail; created_at only, no updates)
-- ------------------------------------------------------------
create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- 14. SESSION PHOTOS (whiteboards, workshop + retreat photos)
-- ------------------------------------------------------------
create table public.session_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  storage_path text not null,
  caption text,
  sort_order integer not null default 0,
  visibility text not null default 'all' check (visibility in ('all','executive','staff','admin_only','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AUTOMATION: keep updated_at accurate on every edit
-- (powers "Last updated" on the admin dashboard for free)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','organizations','organization_members','portal_tabs',
    'journey_phases','sessions','key_items','resource_categories',
    'resources','logistics','internal_notes','visibility_overrides',
    'session_photos'
  ]
  loop
    execute format(
      'create trigger set_updated_at before update on public.%I
       for each row execute function public.set_updated_at()', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- INDEXES (fast lookups by org, membership, and visibility)
-- ------------------------------------------------------------
create index idx_org_members_org on public.organization_members (organization_id);
create index idx_org_members_user on public.organization_members (user_id);
create index idx_portal_tabs_org_vis on public.portal_tabs (organization_id, visibility);
create index idx_journey_phases_org on public.journey_phases (organization_id, sort_order);
create index idx_sessions_org_vis on public.sessions (organization_id, visibility);
create index idx_key_items_org_vis on public.key_items (organization_id, visibility);
create index idx_resource_categories_org_vis on public.resource_categories (organization_id, visibility);
create index idx_resources_org_vis on public.resources (organization_id, visibility);
create index idx_resources_category on public.resources (category_id);
create index idx_resources_session on public.resources (linked_session_id);
create index idx_logistics_org_vis on public.logistics (organization_id, visibility);
create index idx_internal_notes_org on public.internal_notes (organization_id);
create index idx_visibility_overrides_org on public.visibility_overrides (organization_id);
create index idx_visibility_overrides_content on public.visibility_overrides (content_type, content_id);
create index idx_activity_log_org on public.activity_log (organization_id);
create index idx_session_photos_org_vis on public.session_photos (organization_id, visibility);
create index idx_session_photos_session on public.session_photos (session_id, sort_order);

-- ------------------------------------------------------------
-- ROW LEVEL SECURITY: switched ON for every table.
-- With RLS on and no policies yet, the tables are LOCKED —
-- nobody can read or write through the app until Step 6 adds
-- the access rules. Locked-by-default is exactly what we want.
-- ------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.portal_tabs enable row level security;
alter table public.journey_phases enable row level security;
alter table public.sessions enable row level security;
alter table public.key_items enable row level security;
alter table public.resource_categories enable row level security;
alter table public.resources enable row level security;
alter table public.logistics enable row level security;
alter table public.internal_notes enable row level security;
alter table public.visibility_overrides enable row level security;
alter table public.activity_log enable row level security;
alter table public.session_photos enable row level security;

-- ============================================================
-- DONE. Verify: Table Editor → schema "public" → 14 tables,
-- each showing an "RLS enabled" badge.
-- ============================================================
