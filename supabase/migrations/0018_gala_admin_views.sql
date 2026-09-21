-- Migration 0018 — gala admin flag and roster views.
-- Already applied to the database on 2026-09-21.

alter table public.profiles
  add column if not exists is_gala_admin boolean not null default false;

comment on column public.profiles.is_gala_admin is
  'Can view and manage The Collective Gala roster. Separate from is_everest_admin, which grants access to client portal data.';

update public.profiles
   set is_gala_admin = true
 where is_everest_admin = true
   and is_gala_admin = false;

create or replace view public.gala_roster as
  select
    r.id, r.reference, r.door, r.status,
    r.first_name, r.last_name,
    (r.first_name || ' ' || r.last_name) as full_name,
    coalesce(nullif(btrim(r.badge_name), ''), r.first_name) as badge_reads,
    r.email, r.mobile, r.line, r.dietary, r.accessibility, r.seat_near,
    h.full_name as host_name,
    coalesce(r.table_number, h.table_number) as table_number,
    c.code as arrived_on_code,
    coalesce(s.recognition_name, s.legal_name) as sponsor_name,
    t.name as sponsor_tier,
    r.is_plus_one,
    parent.reference as guest_of_reference,
    parent.first_name || ' ' || parent.last_name as guest_of_name,
    r.seats_committed, r.amount_cents,
    (r.amount_cents / 100.0) as amount_dollars,
    r.payment_method, r.tickettailor_order_id, r.paid_at,
    tk.token is not null as has_ticket,
    tk.token as ticket_token,
    tk.checked_in_at,
    tk.checked_in_at is not null as checked_in,
    r.hubspot_contact_id is not null as in_hubspot,
    r.hubspot_synced_at, r.hubspot_sync_error, r.marketing_opt_in,
    r.created_at, r.updated_at
  from public.gala_registrations r
  left join public.gala_hosts         h      on h.id = r.host_id
  left join public.gala_codes         c      on c.id = r.code_id
  left join public.gala_sponsors      s      on s.id = r.sponsor_id
  left join public.gala_tiers         t      on t.id = s.tier_id
  left join public.gala_tickets       tk     on tk.registration_id = r.id
  left join public.gala_registrations parent on parent.id = r.parent_registration_id;

create or replace view public.gala_summary as
  select
    (select capacity        from public.gala_capacity) as capacity,
    (select seats_taken     from public.gala_capacity) as seats_taken,
    (select seats_pending   from public.gala_capacity) as seats_pending,
    (select seats_remaining from public.gala_capacity) as seats_remaining,
    (select count(*) from public.gala_registrations)::integer as people_registered,
    (select count(*) from public.gala_registrations where status = 'paid')::integer    as people_paid,
    (select count(*) from public.gala_registrations where status = 'comped')::integer  as people_comped,
    (select count(*) from public.gala_registrations where status = 'pending')::integer as people_pending,
    (select coalesce(sum(amount_cents), 0) from public.gala_registrations where status = 'paid')::bigint    as raised_cents,
    (select coalesce(sum(amount_cents), 0) from public.gala_registrations where status = 'pending')::bigint as in_checkout_cents,
    (select count(*) from public.gala_hosts where active)::integer as hosts,
    (select count(*) from public.gala_sponsors where status = 'confirmed')::integer as sponsors_confirmed,
    (select count(*) from public.gala_tickets)::integer as tickets_issued,
    (select count(*) from public.gala_tickets where checked_in_at is not null)::integer as checked_in,
    (select count(*) from public.gala_orders where status = 'failed')::integer as orders_needing_attention,
    (select count(*) from public.gala_registrations
      where status in ('paid','comped')
        and id not in (select registration_id from public.gala_tickets))::integer as missing_tickets;

create or replace view public.gala_host_tally as
  select
    h.id, h.full_name as host_name, h.email as host_email,
    h.table_number, h.seats_total,
    coalesce(cd.max_uses, h.seats_total) as seats_allotted,
    coalesce(cd.uses, 0) as seats_claimed,
    coalesce(cd.max_uses, h.seats_total) - coalesce(cd.uses, 0) as seats_open,
    cd.code,
    (select count(*) from public.gala_registrations r where r.host_id = h.id) as people_registered,
    (select count(*) from public.gala_invitations i where i.host_id = h.id)   as people_invited,
    h.committed_at
  from public.gala_hosts h
  left join public.gala_codes cd on cd.host_id = h.id and cd.kind = 'host'
  where h.active;

revoke all on public.gala_roster     from anon, authenticated;
revoke all on public.gala_summary    from anon, authenticated;
revoke all on public.gala_host_tally from anon, authenticated;
