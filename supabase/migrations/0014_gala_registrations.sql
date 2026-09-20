-- =====================================================================
-- Migration 0014 — The Collective Gala: registrations, money, tickets
-- Everest Collective
--
-- Depends on 0013. Run that first.
--
-- What this migration establishes:
--   * One row per human, across all four doors, paid or comped.
--     Plus-ones are their own row with their own line.
--   * Capacity is derived, never stored. No constant can drift again.
--   * Invitation codes are validated through a function, so the page
--     can ask "is this valid" without the codes table ever being read.
--   * Every Ticket Tailor webhook is stored raw before it is trusted,
--     so a bad parse is replayable instead of lost.
--   * HubSpot sync state lives per row, so a failed push is visible
--     rather than a person quietly missing from the CRM.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------
do $$ begin
  create type gala_registration_status as enum
    ('pending','paid','comped','cancelled','refunded');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gala_payment_method as enum
    ('tickettailor','check','wire','cash','in_kind','none');
exception when duplicate_object then null; end $$;

do $$ begin
  create type gala_order_status as enum
    ('received','processed','failed','ignored');
exception when duplicate_object then null; end $$;

-- =====================================================================
-- gala_registrations — one row per attending human
-- =====================================================================
create table if not exists public.gala_registrations (
  id                      uuid primary key default gen_random_uuid(),

  -- Human-readable handle carried into Ticket Tailor checkout and back
  -- out again on the webhook. This is the primary match key; email is
  -- the fallback, because people pay with a spouse's address.
  reference               text not null unique,

  door                    gala_door not null,
  status                  gala_registration_status not null default 'pending',

  -- ---------------- the person ----------------
  first_name              text not null,
  last_name               text not null,
  badge_name              text,
  email                   text not null,
  mobile                  text,

  -- The hour-without-notes answer. Not nullable on purpose: this field
  -- drives the badges, the table cards and the introductions, and a
  -- registration without it is a seat with nobody interesting in it.
  line                    text not null check (length(btrim(line)) >= 8),

  dietary                 text,
  accessibility           text,
  seat_near               text,

  -- ---------------- linkage ----------------
  code_id                 uuid references public.gala_codes(id)    on delete set null,
  host_id                 uuid references public.gala_hosts(id)    on delete set null,
  sponsor_id              uuid references public.gala_sponsors(id) on delete set null,

  -- A plus-one is a full record pointing at whoever bought the seat.
  parent_registration_id  uuid references public.gala_registrations(id) on delete cascade,
  is_plus_one             boolean not null default false,

  table_number            text,

  -- ---------------- money ----------------
  -- seats_committed is what this row takes out of the 300, which is not
  -- the same as the number of people in the row. A table host is one
  -- person committing ten seats.
  seats_committed         integer not null default 1 check (seats_committed >= 0),
  amount_cents            integer not null default 0 check (amount_cents >= 0),

  payment_method          gala_payment_method not null default 'none',
  tickettailor_order_id   text,
  paid_at                 timestamptz,

  -- ---------------- HubSpot ----------------
  hubspot_contact_id      text,
  hubspot_deal_id         text,
  hubspot_synced_at       timestamptz,
  hubspot_sync_error      text,
  hubspot_sync_attempts   integer not null default 0,
  marketing_opt_in        boolean not null default false,

  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now(),

  constraint gala_reg_email_shape
    check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$'),

  -- A plus-one must name its parent, and nothing else may.
  constraint gala_reg_plus_one_parent
    check ((is_plus_one = false and parent_registration_id is null)
        or (is_plus_one = true  and parent_registration_id is not null)),

  -- Paid means we know how. A card payment must carry its Ticket Tailor
  -- order; a sponsor who wires $15,000 or posts a check never touches
  -- Ticket Tailor at all, and must still be recordable as paid.
  constraint gala_reg_paid_has_method
    check (status <> 'paid' or payment_method <> 'none'),
  constraint gala_reg_tt_has_order
    check (payment_method <> 'tickettailor' or tickettailor_order_id is not null)
);

create index if not exists idx_gala_reg_status   on public.gala_registrations(status);
create index if not exists idx_gala_reg_door     on public.gala_registrations(door);
create index if not exists idx_gala_reg_host     on public.gala_registrations(host_id);
create index if not exists idx_gala_reg_sponsor  on public.gala_registrations(sponsor_id);
create index if not exists idx_gala_reg_parent   on public.gala_registrations(parent_registration_id);
create index if not exists idx_gala_reg_email    on public.gala_registrations(lower(email));
create index if not exists idx_gala_reg_ttorder  on public.gala_registrations(tickettailor_order_id);

-- Unsynced rows, for the HubSpot retry job to pick up.
create index if not exists idx_gala_reg_hubspot_pending
  on public.gala_registrations(created_at)
  where hubspot_contact_id is null and status <> 'cancelled';

drop trigger if exists trg_gala_reg_updated on public.gala_registrations;
create trigger trg_gala_reg_updated before update on public.gala_registrations
  for each row execute function public.gala_set_updated_at();

-- Deliberately NOT a unique constraint on email. Duplicates are worth
-- warning about in the admin screen, not worth throwing a 500 at a donor
-- on the night registration closes.

-- =====================================================================
-- gala_invitations — roster rows a host or sponsor has named but who
-- have not registered themselves yet
-- =====================================================================
create table if not exists public.gala_invitations (
  id                uuid primary key default gen_random_uuid(),
  host_id           uuid references public.gala_hosts(id)    on delete cascade,
  sponsor_id        uuid references public.gala_sponsors(id) on delete cascade,
  code_id           uuid references public.gala_codes(id)    on delete set null,

  full_name         text,
  email             text,

  sent_at           timestamptz,
  send_error        text,
  registration_id   uuid references public.gala_registrations(id) on delete set null,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint gala_inv_owner
    check (num_nonnulls(host_id, sponsor_id) = 1)
);

create index if not exists idx_gala_inv_host    on public.gala_invitations(host_id);
create index if not exists idx_gala_inv_sponsor on public.gala_invitations(sponsor_id);

drop trigger if exists trg_gala_inv_updated on public.gala_invitations;
create trigger trg_gala_inv_updated before update on public.gala_invitations
  for each row execute function public.gala_set_updated_at();

-- =====================================================================
-- gala_orders — raw Ticket Tailor webhook mirror
--
-- Every webhook is written here verbatim before anything is believed.
-- If the parse is wrong we fix the parser and replay from payload,
-- rather than discovering in December that money arrived and vanished.
-- =====================================================================
create table if not exists public.gala_orders (
  id                      uuid primary key default gen_random_uuid(),
  tickettailor_order_id   text not null unique,
  event_id                text,
  reference               text,
  buyer_email             text,
  buyer_name              text,
  total_cents             integer,
  currency                text default 'USD',
  status                  gala_order_status not null default 'received',
  payload                 jsonb not null,
  process_error           text,
  received_at             timestamptz not null default now(),
  processed_at            timestamptz
);

create index if not exists idx_gala_orders_ref    on public.gala_orders(reference);
create index if not exists idx_gala_orders_email  on public.gala_orders(lower(buyer_email));
create index if not exists idx_gala_orders_status on public.gala_orders(status);

-- =====================================================================
-- gala_tickets — one scannable credential per attending human,
-- including the comped guests Ticket Tailor will never know about
-- =====================================================================
create table if not exists public.gala_tickets (
  id                uuid primary key default gen_random_uuid(),
  registration_id   uuid not null unique
                      references public.gala_registrations(id) on delete cascade,

  -- Random, unguessable, carried in the QR as a signed URL path.
  token             text not null unique default encode(gen_random_bytes(18), 'hex'),

  issued_at         timestamptz not null default now(),
  checked_in_at     timestamptz,
  checked_in_by     text,
  scan_count        integer not null default 0,
  voided_at         timestamptz,
  void_reason       text
);

create index if not exists idx_gala_tickets_checked on public.gala_tickets(checked_in_at);

-- =====================================================================
-- Capacity, derived
--
-- seats_committed is what a row takes out of the 300. A table host is
-- one person holding ten. A guest arriving on that host's code is
-- already inside those ten, so they commit zero. A comped VIP arriving
-- on a VIP code was never inside anyone's table, so they commit one.
-- The application sets seats_committed at registration time; this view
-- only adds it up, so the number can never disagree with the rows.
-- =====================================================================
create or replace view public.gala_capacity as
  select
    s.capacity,
    coalesce(sum(r.seats_committed) filter (
      where r.status in ('paid','comped')), 0)::integer            as seats_taken,
    coalesce(sum(r.seats_committed) filter (
      where r.status = 'pending'), 0)::integer                     as seats_pending,
    (s.capacity - coalesce(sum(r.seats_committed) filter (
      where r.status in ('paid','comped')), 0))::integer           as seats_remaining,
    count(*) filter (where r.status in ('paid','comped'))::integer as people_confirmed
  from public.gala_settings s
  left join public.gala_registrations r on true
  where s.id = 1
  group by s.capacity;

-- =====================================================================
-- validate_gala_code
--
-- The public page calls this instead of reading gala_codes. It answers
-- the question and nothing more: valid or not, whose table, how many
-- seats are left, whether it is comped. The codes themselves never
-- cross the wire, which is the whole point of 0013's empty policy set.
-- =====================================================================
create or replace function public.validate_gala_code(p_code text)
returns table (
  valid           boolean,
  message         text,
  host_name       text,
  table_number    text,
  seats_remaining integer,
  comped          boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code   text := upper(btrim(coalesce(p_code, '')));
  c        public.gala_codes%rowtype;
  h        public.gala_hosts%rowtype;
  v_open   boolean;
begin
  if v_code = '' then
    return query select false, 'Enter the code from your invitation.',
                        null::text, null::text, null::integer, false;
    return;
  end if;

  select registration_open into v_open from public.gala_settings where id = 1;
  if not coalesce(v_open, false) then
    return query select false, 'Registration for this event has closed.',
                        null::text, null::text, null::integer, false;
    return;
  end if;

  select * into c from public.gala_codes where upper(code) = v_code;

  if not found or not c.active then
    return query select false,
      'We cannot find that code. It looks like COLLECTIVE-MIKE, with your host''s first name, or COLLECTIVE-VIP-0000 if we invited you directly.',
      null::text, null::text, null::integer, false;
    return;
  end if;

  if c.expires_at is not null and c.expires_at < now() then
    return query select false, 'That code has expired. Write to us and we will sort it out.',
                        null::text, null::text, null::integer, false;
    return;
  end if;

  if c.host_id is not null then
    select * into h from public.gala_hosts where id = c.host_id;
  end if;

  if c.uses >= c.max_uses then
    return query select false,
      coalesce(h.full_name, 'That host') || '''s table is full. Write to Reign.Bach@everestcollective.com and we will find you a seat.',
      h.full_name, h.table_number, 0, c.comped;
    return;
  end if;

  return query select true, null::text,
                      h.full_name, h.table_number,
                      (c.max_uses - c.uses)::integer, c.comped;
end $$;

revoke all on function public.validate_gala_code(text) from public;
grant execute on function public.validate_gala_code(text) to anon, authenticated;

-- =====================================================================
-- Row Level Security
--
-- Same model as 0013. RLS on, no anon or authenticated policy anywhere.
-- Registrations, orders and tickets are readable only by the service
-- role, which is to say only by server code in the Next.js app. The
-- public page reaches them through API routes, never directly.
-- =====================================================================
alter table public.gala_registrations enable row level security;
alter table public.gala_invitations   enable row level security;
alter table public.gala_orders        enable row level security;
alter table public.gala_tickets       enable row level security;

grant select on public.gala_capacity to anon, authenticated;

-- =====================================================================
-- VERIFICATION — run separately
-- =====================================================================
-- select 'registrations' as t, count(*) from public.gala_registrations
-- union all select 'invitations', count(*) from public.gala_invitations
-- union all select 'orders',      count(*) from public.gala_orders
-- union all select 'tickets',     count(*) from public.gala_tickets;
-- -- Expect all four at 0.
--
-- select * from public.gala_capacity;
-- -- Expect capacity 300, seats_taken 0, seats_pending 0,
-- --        seats_remaining 300, people_confirmed 0.
--
-- select * from public.validate_gala_code('COLLECTIVE-NOBODY');
-- -- Expect valid = false with the "cannot find that code" message.
-- -- This proves the function answers without the table being readable.
--
-- select tablename, rowsecurity,
--        (select count(*) from pg_policies p
--          where p.schemaname = 'public' and p.tablename = t.tablename) as policy_count
-- from pg_tables t
-- where schemaname = 'public' and tablename like 'gala_%'
-- order by tablename;
-- -- Expect 10 tables. The four new ones all true / 0.
