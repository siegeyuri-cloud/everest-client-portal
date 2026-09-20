-- =====================================================================
-- Migration 0017 — The Collective Gala: applying a payment
-- Everest Collective
--
-- Depends on 0013, 0014, 0015, 0016.
--
-- apply_gala_payment() takes what a payment processor tells us and turns
-- it into a paid registration plus issued tickets, in one transaction.
--
-- Three things this has to survive:
--
--   1. Webhooks fire twice. Calling this with the same order id a second
--      time must change nothing and report the same result, rather than
--      double-issuing tickets.
--
--   2. People pay with a different email than they typed. The reference
--      is the primary key for matching; email is the fallback, and a
--      fallback match is reported as such so the admin screen can flag
--      it rather than silently trusting it.
--
--   3. A plus-one is a separate row that nobody paid for directly. When
--      the buyer's payment lands, their guest has to become paid too, or
--      that guest shows up on the night with no ticket.
-- =====================================================================

create or replace function public.apply_gala_payment(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order_id    text := nullif(btrim(p->>'tickettailor_order_id'), '');
  v_reference   text := upper(nullif(btrim(p->>'reference'), ''));
  v_email       text := lower(nullif(btrim(p->>'email'), ''));
  v_amount      integer := coalesce((p->>'amount_cents')::integer, 0);
  v_method      gala_payment_method :=
                  coalesce((p->>'payment_method')::gala_payment_method, 'tickettailor');
  v_paid_at     timestamptz := coalesce((p->>'paid_at')::timestamptz, now());
  r             public.gala_registrations%rowtype;
  v_matched_by  text;
  v_ticket      text;
  v_issued      integer := 0;
begin
  if v_order_id is null and v_method = 'tickettailor' then
    raise exception 'MISSING_ORDER_ID';
  end if;

  -- ---------- idempotency: have we already applied this order? ----------
  if v_order_id is not null then
    select * into r from public.gala_registrations
      where tickettailor_order_id = v_order_id
        and is_plus_one = false
      limit 1;

    if found then
      return jsonb_build_object(
        'matched',         true,
        'already_applied', true,
        'matched_by',      'order_id',
        'registration_id', r.id,
        'reference',       r.reference,
        'status',          r.status,
        'tickets_issued',  0
      );
    end if;
  end if;

  -- ---------- match: reference first, email second ----------
  if v_reference is not null then
    select * into r from public.gala_registrations
      where reference = v_reference
        and is_plus_one = false
      for update;
    if found then v_matched_by := 'reference'; end if;
  end if;

  if not found and v_email is not null then
    -- Only ever fall back onto a registration that is actually waiting to
    -- be paid, so a paid guest's old row cannot absorb someone else's money.
    select * into r from public.gala_registrations
      where lower(email) = v_email
        and status = 'pending'
        and is_plus_one = false
      order by created_at desc
      limit 1
      for update;
    if found then v_matched_by := 'email'; end if;
  end if;

  if not found then
    return jsonb_build_object(
      'matched',        false,
      'reason',         'NO_MATCHING_REGISTRATION',
      'reference',      v_reference,
      'email',          v_email,
      'tickets_issued', 0
    );
  end if;

  -- ---------- mark the buyer paid ----------
  update public.gala_registrations
     set status                = 'paid',
         payment_method        = v_method,
         tickettailor_order_id = v_order_id,
         paid_at               = v_paid_at,
         amount_cents          = case when v_amount > 0 then v_amount else amount_cents end
   where id = r.id;

  -- ---------- carry the plus-one across ----------
  -- They never had their own transaction. If this is missed they arrive
  -- on the night with a pending registration and no ticket.
  -- The order id has to travel with them. 0014 constrains a row paying by
  -- 'tickettailor' to carry its order id, so setting the method without the
  -- id would violate that check and roll back the buyer's payment too.
  update public.gala_registrations
     set status                = 'paid',
         payment_method        = v_method,
         tickettailor_order_id = v_order_id,
         paid_at               = v_paid_at
   where parent_registration_id = r.id
     and status = 'pending';

  -- ---------- issue tickets ----------
  -- One per attending human, buyer and plus-one alike. ON CONFLICT keeps
  -- a replayed webhook from minting a second token for the same person.
  with people as (
    select id from public.gala_registrations where id = r.id
    union
    select id from public.gala_registrations where parent_registration_id = r.id
  )
  insert into public.gala_tickets (registration_id)
  select id from people
  on conflict (registration_id) do nothing;

  get diagnostics v_issued = row_count;

  select t.token into v_ticket
    from public.gala_tickets t where t.registration_id = r.id;

  return jsonb_build_object(
    'matched',         true,
    'already_applied', false,
    'matched_by',      v_matched_by,
    'registration_id', r.id,
    'reference',       r.reference,
    'email',           r.email,
    'first_name',      r.first_name,
    'last_name',       r.last_name,
    'door',            r.door,
    'status',          'paid',
    'amount_cents',    case when v_amount > 0 then v_amount else r.amount_cents end,
    'ticket_token',    v_ticket,
    'tickets_issued',  v_issued
  );
end $$;

revoke all on function public.apply_gala_payment(jsonb) from public;
revoke all on function public.apply_gala_payment(jsonb) from anon, authenticated;
grant execute on function public.apply_gala_payment(jsonb) to service_role;

-- =====================================================================
-- issue_gala_ticket — for the comped guests no payment ever covers
--
-- An invited guest is 'comped' the moment they register, so no webhook
-- will ever arrive for them. Roughly 270 of 300 attendees are in this
-- position, and they still need something to scan at the door.
-- =====================================================================
create or replace function public.issue_gala_ticket(p_registration_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r       public.gala_registrations%rowtype;
  v_token text;
begin
  select * into r from public.gala_registrations where id = p_registration_id;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'NO_SUCH_REGISTRATION');
  end if;

  if r.status not in ('paid', 'comped') then
    return jsonb_build_object('ok', false, 'reason', 'NOT_PAID_OR_COMPED',
                              'status', r.status);
  end if;

  insert into public.gala_tickets (registration_id)
  values (r.id)
  on conflict (registration_id) do nothing;

  select token into v_token from public.gala_tickets where registration_id = r.id;

  return jsonb_build_object('ok', true, 'reference', r.reference, 'token', v_token);
end $$;

revoke all on function public.issue_gala_ticket(uuid) from public;
revoke all on function public.issue_gala_ticket(uuid) from anon, authenticated;
grant execute on function public.issue_gala_ticket(uuid) to service_role;
