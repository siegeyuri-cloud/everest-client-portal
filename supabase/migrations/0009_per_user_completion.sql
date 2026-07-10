-- 0009: per-user completion. An item is either 'shared' (one checkbox for
-- the whole org — the executive checks it, everyone sees it done) or
-- 'per_user' (every member checks their own copy; user A done ≠ user B done).

alter table key_items
  add column completion_mode text not null default 'shared'
  check (completion_mode in ('shared', 'per_user'));

create table key_item_completions (
  key_item_id uuid not null references key_items(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  completed_at timestamptz not null default now(),
  primary key (key_item_id, user_id)
);

alter table key_item_completions enable row level security;

-- you may read your own ticks; Everest admins may read everyone's
create policy kic_select on key_item_completions for select to authenticated
  using (
    user_id = auth.uid()
    or exists (select 1 from profiles p where p.id = auth.uid() and p.is_everest_admin)
  );

-- you may tick only for yourself, only on items inside an org you belong to
create policy kic_insert on key_item_completions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from key_items k
      join organization_members m on m.organization_id = k.organization_id
      where k.id = key_item_id and m.user_id = auth.uid() and m.status <> 'disabled'
    )
  );

-- you may untick only your own
create policy kic_delete on key_item_completions for delete to authenticated
  using (user_id = auth.uid());
