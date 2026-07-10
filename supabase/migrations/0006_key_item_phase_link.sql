-- 0006: key items can point the client at a journey phase (session links already exist)
alter table key_items
  add column if not exists linked_phase_id uuid references journey_phases(id) on delete set null;
