-- 0007: who may check a key item off — everyone, executives, or staff.
-- UI enforces this AND the database enforces it (restrictive policy ANDs
-- with all existing update policies, so it tightens without replacing them).

alter table key_items
  add column check_role text not null default 'all'
  check (check_role in ('all', 'executive', 'staff'));

create policy key_items_check_role_gate on key_items
  as restrictive for update to authenticated
  using (
    check_role = 'all'
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_everest_admin)
    or exists (
      select 1 from organization_members m
      where m.organization_id = key_items.organization_id
        and m.user_id = auth.uid()
        and m.role = check_role
    )
  );
