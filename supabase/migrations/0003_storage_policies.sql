-- ============================================================
-- EVEREST CLIENT PORTAL — MIGRATION 0003: STORAGE ACCESS RULES
-- Run AFTER creating the private bucket "portal-files"
-- (Dashboard → Storage → New bucket). SQL Editor → paste ALL → Run.
-- Expect: "Success. No rows returned"
--
-- Files live at paths like:
--   southern-staffing-group/signed-agreements/msa.pdf
--   southern-staffing-group/sessions/<session-id>/photos/whiteboard-1.jpg
-- The FIRST folder in the path is always the organization slug —
-- these rules use that to keep every client inside their own folder.
--
-- In plain English:
--   • Bucket is private: no public links, ever
--   • Everest admins → upload / read / edit / delete anything
--   • Clients → read ONLY files inside their own org's folder
--     (the app hands them short-lived signed URLs)
--   • Clients cannot upload or delete anything (Phase 2 feature)
--   • Per-file visibility (e.g. an admin-only photo) is enforced by
--     the tables from 0002 — the app only creates signed URLs for
--     rows the user is allowed to see
-- ============================================================

-- Admins: full control over everything in portal-files
create policy "portal_files_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'portal-files' and public.is_everest_admin());

create policy "portal_files_admin_update" on storage.objects
  for update to authenticated
  using (bucket_id = 'portal-files' and public.is_everest_admin())
  with check (bucket_id = 'portal-files' and public.is_everest_admin());

create policy "portal_files_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'portal-files' and public.is_everest_admin());

-- Read: admins see all; members see only their own org's folder
create policy "portal_files_member_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'portal-files'
    and (
      public.is_everest_admin()
      or exists (
        select 1
        from public.organizations o
        where o.slug = (storage.foldername(name))[1]
          and public.is_org_member(o.id)
      )
    )
  );

-- ============================================================
-- DONE. Verify with:
--   select policyname from pg_policies
--   where schemaname = 'storage' and tablename = 'objects';
-- → expect the 4 portal_files_* policies listed.
-- ============================================================
