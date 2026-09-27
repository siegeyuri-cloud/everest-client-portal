import { redirect, notFound } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabaseServer";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * Who is looking at a client's survey pages. Runs on the server before any
 * survey data is read. Everest admins can see every client; everyone else
 * must be an active member of that client's organization.
 */
export type OrgAccess = {
  org: { id: string; name: string; slug: string };
  userId: string;
  isEverestAdmin: boolean;
  role: string | null;
};

export async function getOrgAccess(slug: string): Promise<OrgAccess> {
  const sb = await createServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login");

  const service = createServiceClient();
  const [{ data: org }, { data: profile }] = await Promise.all([
    service.from("organizations").select("id, name, slug").eq("slug", slug).maybeSingle(),
    service.from("profiles").select("is_everest_admin").eq("id", auth.user.id).maybeSingle(),
  ]);
  if (!org) notFound();

  const isEverestAdmin = !!profile?.is_everest_admin;
  let role: string | null = null;
  if (!isEverestAdmin) {
    const { data: member } = await service
      .from("organization_members")
      .select("role")
      .eq("organization_id", org.id)
      .eq("user_id", auth.user.id)
      .eq("status", "active")
      .maybeSingle();
    role = member?.role ?? null;
    if (!role) redirect("/no-access");
  }
  return { org: org as OrgAccess["org"], userId: auth.user.id, isEverestAdmin, role };
}

export async function requireEverestAdmin(slug: string): Promise<OrgAccess> {
  const access = await getOrgAccess(slug);
  if (!access.isEverestAdmin) redirect("/no-access");
  return access;
}
