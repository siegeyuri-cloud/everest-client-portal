-- 0012: photos taken during sessions, shown as a gallery on the client card.
alter table sessions add column photos jsonb default '[]'::jsonb;
