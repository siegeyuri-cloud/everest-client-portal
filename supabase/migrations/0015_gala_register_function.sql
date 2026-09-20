-- =====================================================================
-- Migration 0015 — The Collective Gala: atomic registration
-- Everest Collective
--
-- Depends on 0013 and 0014.
--
-- register_gala_attendee() does the whole registration in one
-- transaction: the person, their plus-one, the host record and code if
-- they are claiming a table, the sponsor record if they are sponsoring,
-- the roster rows, and the code increment. Either all of it lands or
-- none of it does.
--
-- The code row is locked FOR UPDATE before its uses are checked, so two
-- people racing for the last seat at a host's table cannot both win.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Reference generator: TCG-XXXXXX, unambiguous alphabet.
-- No 0/O/1/I/5/S, because these get read aloud and typed off a card.
-- ---------------------------------------------------------------------
create or replace function public.gala_new_reference()
returns text
language plpgsql
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRTUVWXYZ2346789';
  candidate text;
  i integer;
begin
  for attempt in 1..10 loop
    candidate := 'TCG-';
    for i in 1..6 loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
    end loop;
    if not exists (select 1 from public.gala_registrations where reference = candidate) then
      return candidate;
    end if;
  end loop;
  raise exception 'Could not generate a unique reference after 10 attempts';
end $$;

-- ---------------------------------------------------------------------
-- Host code generator: COLLECTIVE-FIRSTNAME, numbered if taken.
-- ---------------------------------------------------------------------
create or replace function public.gala_new_host_code(p_name text)
returns text
language plpgsql
as $$
declare
  base text;
  candidate text;
  n integer := 1;
begin
  base := upper(regexp_replace(coalesce(p_name, 'HOST'), '[^A-Za-z0-9]', '', 'g'));
  if base = '' then base := 'HOST'; end if;
  base := left(base, 12);
  candidate := 'COLLECTIVE-' || base;

  while exists (select 1 from public.gala_codes where upper(code) = candidate) loop
    n := n + 1;
    candidate := 'COLLECTIVE-' || base || n::text;
  end loop;

  return candidate;
end $$;

-- =====================================================================
-- register_gala_attendee
--
-- Input jsonb:
--   door              'seat' | 'host' | 'guest' | 'sponsor'   required
--   first_name, last_name, email, line                        required
--   badge_name, mobile, dietary, accessibility, seat_near     optional
--   marketing_opt_in  boolean                                 optional
--   code              string   (guest door)
--   table_name        string   (host door, how the table is listed)
--   tier_name         string   (sponsor door)
--   company           { legal_name, recognition_name, website_url,
--                       contact_name, contact_email, contact_phone }
--   plus_one          { first_name, last_name, email, mobile,
--                       badge_name, line, dietary, accessibility }
--   roster            [ { name, email } ]
--
-- Returns jsonb:
--   { reference, registration_id, status, amount_cents,
--     requires_payment, host_code, host_name, table_number }
-- =====================================================================
create or replace function public.register_gala_attendee(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_door          gala_door;
  v_settings      public.gala_settings%rowtype;
  v_code          public.gala_codes%rowtype;
  v_host          public.gala_hosts%rowtype;
  v_tier          public.gala_tiers%rowtype;
  v_sponsor_id    uuid;
  v_host_id       uuid;
  v_code_id       uuid;
  v_host_code     text;
  v_reference     text;
  v_reg_id        uuid;
  v_status        gala_registration_status;
  v_seats         integer := 1;
  v_amount        integer := 0;
  v_table_number  text;
  v_host_name     text;
  v_plus          jsonb := p->'plus_one';
  v_roster        jsonb := coalesce(p->'roster', '[]'::jsonb);
  v_row           jsonb;
  v_taken         integer;
begin
  -- ---------- gate ----------
  select * into v_settings from public.gala_settings where id = 1;
  if not v_settings.registration_open then
    raise exception 'REGISTRATION_CLOSED';
  end if;

  v_door := (p->>'door')::gala_door;

  if coalesce(btrim(p->>'first_name'), '') = ''
     or coalesce(btrim(p->>'last_name'), '') = ''
     or coalesce(btrim(p->>'email'), '') = '' then
    raise exception 'MISSING_REQUIRED_FIELDS';
  end if;

  if length(btrim(coalesce(p->>'line', ''))) < 8 then
    raise exception 'MISSING_LINE';
  end if;

  -- ---------- guest door: lock and check the code ----------
  if v_door = 'guest' then
    select * into v_code
      from public.gala_codes
     where upper(code) = upper(btrim(coalesce(p->>'code', '')))
       for update;

    if not found or not v_code.active then
      raise exception 'INVALID_CODE';
    end if;
    if v_code.expires_at is not null and v_code.expires_at < now() then
      raise exception 'EXPIRED_CODE';
    end if;
    if v_code.uses >= v_code.max_uses then
      raise exception 'CODE_FULL';
    end if;

    v_code_id := v_code.id;
    v_host_id := v_code.host_id;
    v_sponsor_id := v_code.sponsor_id;

    if v_host_id is not null then
      select * into v_host from public.gala_hosts where id = v_host_id;
      v_table_number := v_host.table_number;
      v_host_name := v_host.full_name;
    end if;

    -- A guest on a host or sponsor code is already inside that party's
    -- allocation, so they commit nothing further. A comped VIP was never
    -- inside anyone's allocation, so they commit their own seat.
    v_seats  := case when v_host_id is null and v_sponsor_id is null then 1 else 0 end;
    v_amount := 0;
    v_status := 'comped';  -- nothing owed: the host or sponsor already paid

  -- ---------- individual seat ----------
  elsif v_door = 'seat' then
    v_seats  := 1;
    v_amount := v_settings.seat_price_cents;
    v_status := 'pending';

  -- ---------- table host ----------
  elsif v_door = 'host' then
    v_seats  := 10;
    v_amount := v_settings.table_price_cents;
    v_status := 'pending';

    insert into public.gala_hosts (full_name, email, mobile, seats_total, committed_at, notes)
    values (
      coalesce(nullif(btrim(p->>'table_name'), ''),
               btrim(p->>'first_name') || ' ' || btrim(p->>'last_name')),
      btrim(p->>'email'),
      nullif(btrim(p->>'mobile'), ''),
      10, now(),
      'Created by self-registration'
    )
    returning * into v_host;

    v_host_id   := v_host.id;
    v_host_name := v_host.full_name;
    v_host_code := public.gala_new_host_code(btrim(p->>'first_name'));

    insert into public.gala_codes (code, kind, host_id, max_uses, uses, comped)
    values (v_host_code, 'host', v_host_id, 10, 1, false)
    returning id into v_code_id;

  -- ---------- corporate sponsor ----------
  elsif v_door = 'sponsor' then
    select * into v_tier from public.gala_tiers
      where name = btrim(p->>'tier_name') and active = true;
    if not found then
      raise exception 'INVALID_TIER';
    end if;

    if v_tier.cap is not null then
      select count(*) into v_taken from public.gala_sponsors
        where tier_id = v_tier.id and status <> 'declined';
      if v_taken >= v_tier.cap then
        raise exception 'TIER_FULL';
      end if;
    end if;

    v_seats  := v_tier.seat_count;
    v_amount := v_tier.amount_cents;
    v_status := 'pending';

    insert into public.gala_sponsors (
      tier_id, legal_name, recognition_name, website_url,
      contact_name, contact_email, contact_phone, amount_cents, status
    ) values (
      v_tier.id,
      coalesce(nullif(btrim(p#>>'{company,legal_name}'), ''), btrim(p->>'last_name')),
      nullif(btrim(p#>>'{company,recognition_name}'), ''),
      nullif(btrim(p#>>'{company,website_url}'), ''),
      nullif(btrim(p#>>'{company,contact_name}'), ''),
      nullif(btrim(p#>>'{company,contact_email}'), ''),
      nullif(btrim(p#>>'{company,contact_phone}'), ''),
      v_tier.amount_cents,
      'pending'
    )
    returning id into v_sponsor_id;

    v_host_code := public.gala_new_host_code(
      coalesce(nullif(btrim(p#>>'{company,recognition_name}'), ''),
               nullif(btrim(p#>>'{company,legal_name}'), ''),
               btrim(p->>'last_name')));

    insert into public.gala_codes (code, kind, sponsor_id, max_uses, uses, comped)
    values (v_host_code, 'guest', v_sponsor_id, v_tier.seat_count, 1, true)
    returning id into v_code_id;

  else
    raise exception 'INVALID_DOOR';
  end if;

  -- ---------- capacity ----------
  -- Held seats count against the room. seats_remaining only subtracts
  -- paid and comped, so a pending checkout would be invisible and thirty
  -- hosts could each pass this check while none had paid yet. Subtract
  -- seats_pending too. Stale pendings are released by a cleanup job,
  -- not by pretending they are not holding anything.
  if v_seats > 0 then
    if (select seats_remaining - seats_pending from public.gala_capacity) < v_seats then
      raise exception 'SOLD_OUT';
    end if;
  end if;

  -- ---------- the person ----------
  v_reference := public.gala_new_reference();

  insert into public.gala_registrations (
    reference, door, status,
    first_name, last_name, badge_name, email, mobile, line,
    dietary, accessibility, seat_near,
    code_id, host_id, sponsor_id, table_number,
    seats_committed, amount_cents, marketing_opt_in
  ) values (
    v_reference, v_door, v_status,
    btrim(p->>'first_name'), btrim(p->>'last_name'),
    nullif(btrim(p->>'badge_name'), ''), lower(btrim(p->>'email')),
    nullif(btrim(p->>'mobile'), ''), btrim(p->>'line'),
    nullif(btrim(p->>'dietary'), ''), nullif(btrim(p->>'accessibility'), ''),
    nullif(btrim(p->>'seat_near'), ''),
    v_code_id, v_host_id, v_sponsor_id, v_table_number,
    v_seats, v_amount, coalesce((p->>'marketing_opt_in')::boolean, false)
  )
  returning id into v_reg_id;

  -- ---------- plus-one, their own record and their own line ----------
  if v_plus is not null and coalesce(btrim(v_plus->>'first_name'), '') <> '' then
    if v_door <> 'seat' then
      raise exception 'PLUS_ONE_NOT_ALLOWED_ON_THIS_DOOR';
    end if;
    if length(btrim(coalesce(v_plus->>'line', ''))) < 8 then
      raise exception 'MISSING_GUEST_LINE';
    end if;

    if (select seats_remaining - seats_pending from public.gala_capacity) < 1 then
      raise exception 'SOLD_OUT';
    end if;

    insert into public.gala_registrations (
      reference, door, status,
      first_name, last_name, badge_name, email, mobile, line,
      dietary, accessibility,
      host_id, sponsor_id, table_number,
      parent_registration_id, is_plus_one,
      seats_committed, amount_cents
    ) values (
      public.gala_new_reference(), v_door, v_status,
      btrim(v_plus->>'first_name'), btrim(v_plus->>'last_name'),
      nullif(btrim(v_plus->>'badge_name'), ''), lower(btrim(v_plus->>'email')),
      nullif(btrim(v_plus->>'mobile'), ''), btrim(v_plus->>'line'),
      nullif(btrim(v_plus->>'dietary'), ''), nullif(btrim(v_plus->>'accessibility'), ''),
      v_host_id, v_sponsor_id, v_table_number,
      v_reg_id, true,
      1, 0
    );

    v_amount := v_amount + v_settings.seat_price_cents;
    update public.gala_registrations
       set amount_cents = v_amount
     where id = v_reg_id;
  end if;

  -- ---------- roster rows the host or sponsor named ----------
  if jsonb_typeof(v_roster) = 'array' then
    for v_row in select * from jsonb_array_elements(v_roster) loop
      if coalesce(btrim(v_row->>'name'), '') <> ''
         or coalesce(btrim(v_row->>'email'), '') <> '' then
        insert into public.gala_invitations (host_id, sponsor_id, code_id, full_name, email)
        values (v_host_id, v_sponsor_id, v_code_id,
                nullif(btrim(v_row->>'name'), ''),
                lower(nullif(btrim(v_row->>'email'), '')));
      end if;
    end loop;
  end if;

  -- ---------- burn the seat on the code ----------
  if v_door = 'guest' then
    update public.gala_codes set uses = uses + 1 where id = v_code_id;
  end if;

  return jsonb_build_object(
    'reference',        v_reference,
    'registration_id',  v_reg_id,
    'status',           v_status,
    'amount_cents',     v_amount,
    'requires_payment', (v_amount > 0),
    'host_code',        v_host_code,
    'host_name',        v_host_name,
    'table_number',     v_table_number
  );
end $$;

-- Callable only by server code. The public page reaches this through an
-- API route, never directly, so that rate limiting and bot checks have
-- somewhere to live.
revoke all on function public.register_gala_attendee(jsonb) from public;
revoke all on function public.register_gala_attendee(jsonb) from anon, authenticated;
