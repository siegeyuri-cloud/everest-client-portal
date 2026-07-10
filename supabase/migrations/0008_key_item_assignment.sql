-- 0008: personal task lists — a key item can be assigned to one member.
-- NULL = whole-organization item (shared, visible to all, as before).
-- Assigned = appears only in that member's list (admins always see all).

alter table key_items
  add column assigned_user_id uuid references profiles(id) on delete set null;
