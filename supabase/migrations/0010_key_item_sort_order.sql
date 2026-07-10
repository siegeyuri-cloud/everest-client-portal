-- 0010: drag-reorderable key items. Backfills existing rows by creation date.
alter table key_items add column sort_order int;
update key_items set sort_order = sub.rn
from (
  select id, row_number() over (partition by organization_id order by created_at) as rn
  from key_items
) sub
where key_items.id = sub.id;
