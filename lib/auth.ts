import type { SupabaseClient } from "@supabase/supabase-js";

export async function getPostLoginPath(
  supabase: SupabaseClient
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "/login";

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_everest_admin")
    .eq("id", user.id)
    .single();

  if (profile?.is_everest_admin) return "/admin";

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (!memberships || memberships.length === 0) return "/no-access";

  const { data: orgs } = await supabase
    .from("organizations")
    .select("slug")
    .in(
      "id",
      memberships.map((m) => m.organization_id)
    );

  if (!orgs || orgs.length === 0) return "/no-access";

  // TODO (Step 12): organization selector when a user belongs to multiple orgs
  return `/${orgs[0].slug}`;
}