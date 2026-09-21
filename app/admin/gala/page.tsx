import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabaseServer";
import { createServiceClient } from "@/lib/supabaseService";
import GalaRoster from "./GalaRoster";

/**
 * /admin/gala — The Collective Gala roster.
 *
 * A server component on purpose. The existing /admin pages check
 * is_everest_admin in the browser, which is fine for a client list, but
 * this page carries 300 people's emails, mobile numbers, dietary needs
 * and accessibility requirements. A client-side check would fetch all of
 * that first and redirect second, meaning the data has already reached a
 * non-admin's machine. Here the check runs before anything is queried.
 */

export const dynamic = "force-dynamic";

export default async function GalaAdminPage() {
  const sb = await createServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("is_gala_admin, is_everest_admin, full_name")
    .eq("id", auth.user.id)
    .single();

  if (!profile?.is_gala_admin && !profile?.is_everest_admin) {
    redirect("/no-access");
  }

  const service = createServiceClient();

  const [{ data: summary }, { data: roster }, { data: hosts }, { data: settings }] =
    await Promise.all([
      service.from("gala_summary").select("*").single(),
      service.from("gala_roster").select("*").order("created_at", { ascending: false }),
      service.from("gala_host_tally").select("*").order("seats_claimed", { ascending: false }),
      service
        .from("gala_settings")
        .select("event_name, event_starts_at, registration_closes_at, registration_open")
        .single(),
    ]);

  return (
    <GalaRoster
      summary={summary ?? null}
      roster={roster ?? []}
      hosts={hosts ?? []}
      settings={settings ?? null}
    />
  );
}
