-- 0011: 30-day trash. Deleted orgs/members keep their data but lose all access;
-- restorable for 30 days from the admin side, invisible everywhere else.
alter table organizations add column deleted_at timestamptz;
alter table organization_members add column deleted_at timestamptz;
