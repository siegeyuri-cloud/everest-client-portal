-- ============================================================
-- EVEREST CLIENT PORTAL — MIGRATION 0002: SECURITY RULES (RLS)
-- Run AFTER 0001. Supabase → SQL Editor → paste ALL → Run once.
-- Expect: "Success. No rows returned"
--
-- What this installs, in plain English:
--   • Everest admins (is_everest_admin = true) → see + edit everything
--   • Clients → see ONLY their own organization's content, filtered
--     by role: executives see 'all'+'executive', staff see 'all'+'staff',
--     'admin_only' and 'hidden' reach no client ever
--   • Clients can UPDATE exactly one thing: the status of a key item
--     flagged client-actionable — nothing else, enforced by a guard
--   • Internal notes: admins only, invisible to every client
--   • All writing (create/edit/delete content) → admins only
--   • The service_role key bypasses all of this by design — which is
--     why it stays server-side only
-- ============================================================

-- ------------------------------------------------------------
-- HELPER FUNCTIONS
-- "security definer" = these run with elevated rights, so policies
-- can ask "is this an admin?" / "is this a member?" without the
-- infinite-recursion trap of a table's policy querying itself.
-- ------------------------------------------------------------

create or replace function public.is_everest_admin()
returns boolean
language sql security definer set search_path = public stable
as $$
  select coalesce(
    (select is_everest_admin from public.profiles where id = auth.uid()),
    false
  );
$$;

create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql security definer set search_path = public stable
as $$
  select exists (
    select 1 from public.organization_members
    where organization_id = org_id
      and user_id = auth.uid()
      and status = 'active'
  );
$$;

create or replace function public.org_role(org_id uuid)
returns text
language sql security definer set search_path = public stable
as $$
  select role from public.organization_members
  where organization_id = org_id
    and user_id = auth.uid()
    and status = 'active'
  limit 1;
$$;

-- The core question every content table asks:
-- "may the current user view a row with this visibility, in this org?"
create or replace function public.can_view(org_id uuid, item_visibility text)
returns boolean
language sql security definer set search_path = public stable
as $$
  select public.is_everest_admin()
    or (
      public.is_org_member(org_id)
      and (
        item_visibility = 'all'
        or (item_visibility = 'executive'
            and public.org_role(org_id) in ('executive','admin'))
        or (item_visibility = 'staff'
            and public.org_role(org_id) in ('staff','admin'))
      )
    );
$$;
-- Note: 'admin_only' and 'hidden' match nothing above → clients never
-- see them. Everest admins pass via the first line.

-- ------------------------------------------------------------
-- PROFILES
-- Users see + edit their own profile; admins see all.
-- Column lockdown: normal users can change ONLY full_name and
-- avatar_url. email and is_everest_admin cannot be edited through
-- the app at all (service role / SQL only) — so nobody can promote
-- themselves to admin.
-- ------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_everest_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_everest_admin())
  with check (id = auth.uid() or public.is_everest_admin());

revoke update on public.profiles from authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ------------------------------------------------------------
-- ORGANIZATIONS
-- ------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (public.is_everest_admin() or public.is_org_member(id));

create policy organizations_admin_insert on public.organizations
  for insert to authenticated
  with check (public.is_everest_admin());

create policy organizations_admin_update on public.organizations
  for update to authenticated
  using (public.is_everest_admin())
  with check (public.is_everest_admin());

create policy organizations_admin_delete on public.organizations
  for delete to authenticated
  using (public.is_everest_admin());

-- ------------------------------------------------------------
-- ORGANIZATION MEMBERS
-- You can see your own membership rows; admins see + manage all.
-- ------------------------------------------------------------
create policy org_members_select on public.organization_members
  for select to authenticated
  using (user_id = auth.uid() or public.is_everest_admin());

create policy org_members_admin_insert on public.organization_members
  for insert to authenticated
  with check (public.is_everest_admin());

create policy org_members_admin_update on public.organization_members
  for update to authenticated
  using (public.is_everest_admin())
  with check (public.is_everest_admin());

create policy org_members_admin_delete on public.organization_members
  for delete to authenticated
  using (public.is_everest_admin());

-- ------------------------------------------------------------
-- JOURNEY PHASES (no visibility column — every member may see the
-- phase LIST; locked phases show title/teaser only, and the portal
-- code will not fetch `body` for locked phases)
-- ------------------------------------------------------------
create policy journey_phases_select on public.journey_phases
  for select to authenticated
  using (public.is_everest_admin() or public.is_org_member(organization_id));

create policy journey_phases_admin_insert on public.journey_phases
  for insert to authenticated
  with check (public.is_everest_admin());

create policy journey_phases_admin_update on public.journey_phases
  for update to authenticated
  using (public.is_everest_admin())
  with check (public.is_everest_admin());

create policy journey_phases_admin_delete on public.journey_phases
  for delete to authenticated
  using (public.is_everest_admin());

-- ------------------------------------------------------------
-- STANDARD CONTENT TABLES (uniform rules, generated in a loop):
-- portal_tabs, sessions, resource_categories, resources,
-- logistics, session_photos
--   read  → can_view(org, visibility)
--   write → Everest admins only
-- ------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'portal_tabs','sessions','resource_categories',
    'resources','logistics','session_photos'
  ]
  loop
    execute format('create policy %I on public.%I for select to authenticated
      using (public.can_view(organization_id, visibility))', t || '_select', t);
    execute format('create policy %I on public.%I for insert to authenticated
      with check (public.is_everest_admin())', t || '_admin_insert', t);
    execute format('create policy %I on public.%I for update to authenticated
      using (public.is_everest_admin())
      with check (public.is_everest_admin())', t || '_admin_update', t);
    execute format('create policy %I on public.%I for delete to authenticated
      using (public.is_everest_admin())', t || '_admin_delete', t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- KEY ITEMS — same as above PLUS the one client write in the app:
-- members may update items flagged is_client_actionable.
-- ------------------------------------------------------------
create policy key_items_select on public.key_items
  for select to authenticated
  using (public.can_view(organization_id, visibility));

create policy key_items_admin_insert on public.key_items
  for insert to authenticated
  with check (public.is_everest_admin());

create policy key_items_update on public.key_items
  for update to authenticated
  using (
    public.is_everest_admin()
    or (is_client_actionable = true and public.is_org_member(organization_id))
  )
  with check (
    public.is_everest_admin()
    or (is_client_actionable = true and public.is_org_member(organization_id))
  );

create policy key_items_admin_delete on public.key_items
  for delete to authenticated
  using (public.is_everest_admin());

-- Guard: non-admins may change ONLY the status column. Any attempt
-- to sneak a change into title/visibility/actionable/etc. is rejected
-- at the database level, no matter how the request was crafted.
create or replace function public.key_items_client_guard()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if public.is_everest_admin() then
    return new;
  end if;
  if new.organization_id      is distinct from old.organization_id
    or new.title              is distinct from old.title
    or new.description        is distinct from old.description
    or new.category           is distinct from old.category
    or new.priority           is distinct from old.priority
    or new.is_client_actionable is distinct from old.is_client_actionable
    or new.visibility         is distinct from old.visibility
    or new.due_date           is distinct from old.due_date
    or new.linked_session_id  is distinct from old.linked_session_id
    or new.linked_resource_id is distinct from old.linked_resource_id
  then
    raise exception 'Clients may only update the status of a key item';
  end if;
  return new;
end;
$$;

create trigger key_items_client_guard
  before update on public.key_items
  for each row execute function public.key_items_client_guard();

-- ------------------------------------------------------------
-- INTERNAL NOTES — Everest admins only, in every direction.
-- No client, executive, or staff policy exists → invisible to them.
-- ------------------------------------------------------------
create policy internal_notes_admin_select on public.internal_notes
  for select to authenticated using (public.is_everest_admin());
create policy internal_notes_admin_insert on public.internal_notes
  for insert to authenticated with check (public.is_everest_admin());
create policy internal_notes_admin_update on public.internal_notes
  for update to authenticated
  using (public.is_everest_admin()) with check (public.is_everest_admin());
create policy internal_notes_admin_delete on public.internal_notes
  for delete to authenticated using (public.is_everest_admin());

-- ------------------------------------------------------------
-- VISIBILITY OVERRIDES — members may read (the portal uses them to
-- fine-tune what renders); only admins write.
-- ------------------------------------------------------------
create policy visibility_overrides_select on public.visibility_overrides
  for select to authenticated
  using (public.is_everest_admin() or public.is_org_member(organization_id));
create policy visibility_overrides_admin_insert on public.visibility_overrides
  for insert to authenticated with check (public.is_everest_admin());
create policy visibility_overrides_admin_update on public.visibility_overrides
  for update to authenticated
  using (public.is_everest_admin()) with check (public.is_everest_admin());
create policy visibility_overrides_admin_delete on public.visibility_overrides
  for delete to authenticated using (public.is_everest_admin());

-- ------------------------------------------------------------
-- ACTIVITY LOG — append-only. Admins read; any signed-in user may
-- record an action as themselves. No updates or deletes, ever.
-- ------------------------------------------------------------
create policy activity_log_admin_select on public.activity_log
  for select to authenticated using (public.is_everest_admin());
create policy activity_log_insert on public.activity_log
  for insert to authenticated
  with check (public.is_everest_admin() or actor_id = auth.uid());

-- ============================================================
-- DONE. Every table now has explicit access rules.
-- Nothing here touches file storage — that's Step 7 (bucket +
-- storage policies).
-- ============================================================
