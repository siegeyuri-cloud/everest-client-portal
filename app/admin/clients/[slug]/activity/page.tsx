import { createClient as srv } from "@/lib/supabaseServer";
import { createClient as svc } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

function fmt(ts: string) {
  try {
    return new Date(ts).toLocaleString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    });
  } catch { return ts; }
}

function where(e: any) {
  const parts = [e.city, e.region, e.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "\u2014";
}

/** /admin/clients/[slug]/activity — admin-only file access log for one client. */
export default async function ActivityPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const sb = await srv();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login");
  const { data: profile } = await sb.from("profiles").select("is_everest_admin").eq("id", auth.user.id).single();
  if (!profile?.is_everest_admin) redirect("/no-access");

  const service = svc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data: org } = await service.from("organizations").select("id, name, slug").eq("slug", slug).single();
  if (!org) redirect("/admin");

  const { data: eventsRaw } = await service
    .from("file_access_events")
    .select("*")
    .eq("organization_id", org.id)
    .order("opened_at", { ascending: false })
    .limit(500);
  const events = eventsRaw ?? [];

  return (
    <div className="min-h-screen bg-snow">
      <header className="bg-storm px-8 py-5">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <div className="font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold">Everest Collective &middot; Activity</div>
          <Link href={`/admin/clients/${org.slug}`} className="font-condensed text-[12px] font-bold uppercase tracking-label text-snow/80 transition-colors hover:text-snow">
            {"\u2190"} Back to editor
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-8 py-10">
        <div className="mb-1 font-condensed text-[12px] font-bold uppercase tracking-eyebrow text-gold-deep">File activity</div>
        <h1 className="font-display text-[30px] uppercase leading-[1.05] tracking-display text-storm">{org.name}</h1>
        <p className="mt-2 max-w-[720px] text-[13.5px] leading-relaxed text-slate-75">
          Who opened which file, when, and roughly where. Newest first. Tracking began when this feature shipped; opens from before then were not recorded.
        </p>

        {events.length === 0 ? (
          <div className="mt-8 rounded-lg border border-line-subtle bg-paper px-6 py-12 text-center text-[14px] text-slate-50">
            No file opens recorded yet.
          </div>
        ) : (
          <div className="mt-8 overflow-hidden rounded-lg border border-line-subtle bg-paper">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-line-subtle bg-mist">
                  <th className="px-5 py-3 font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75">File</th>
                  <th className="px-5 py-3 font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75">Member</th>
                  <th className="px-5 py-3 font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75">When</th>
                  <th className="px-5 py-3 font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75">Where</th>
                  <th className="px-5 py-3 font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75">Type</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e: any) => (
                  <tr key={e.id} className="border-b border-line-subtle last:border-0 transition-colors hover:bg-rowhover">
                    <td className="px-5 py-3 text-[13.5px] font-semibold text-storm">{e.file_title || e.file_id || "\u2014"}</td>
                    <td className="px-5 py-3 text-[13px] text-ink">{e.user_email || "\u2014"}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-[13px] text-slate-75">{fmt(e.opened_at)}</td>
                    <td className="px-5 py-3 text-[13px] text-slate-75">{where(e)}</td>
                    <td className="px-5 py-3">
                      <span className="rounded bg-teal-25 px-2 py-[3px] font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep">{e.file_kind}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-4 text-[12px] text-slate-50">Up to 500 most recent events. Location is approximate, city-level, derived from network address.</p>
      </main>
    </div>
  );
}
