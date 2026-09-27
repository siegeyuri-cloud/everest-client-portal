import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/lib/supabaseServer";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * /admin/discovery: engagement on everestcollective.com/discovery.
 *
 * Same shape as /admin/gala: the admin check runs on the server before
 * anything is queried, because the leads list carries names and emails.
 * Reads discovery_events (migration 0019). Until that table exists the
 * page says so instead of failing; leads are still emailed meanwhile.
 */

export const dynamic = "force-dynamic";

const DAYS = 30;
const TZ = process.env.DISCOVERY_TZ ?? "America/New_York";

type Row = {
  session_id: string;
  event: string;
  detail: Record<string, any> | null;
  email: string | null;
  created_at: string;
};
type Service = ReturnType<typeof createServiceClient>;

async function loadEvents(service: Service, since: string) {
  const rows: Row[] = [];
  for (let from = 0; from < 200000; from += 1000) {
    const { data, error } = await service
      .from("discovery_events")
      .select("session_id, event, detail, email, created_at")
      .gte("created_at", since)
      .order("created_at", { ascending: true })
      .range(from, from + 999);
    if (error) return { rows, error: error.message };
    const page = (data ?? []) as Row[];
    rows.push(...page.filter((r) => !r.session_id.startsWith("testprobe")));
    if (page.length < 1000) break;
  }
  return { rows, error: null as string | null };
}

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: TZ });
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) + "%" : "n/a");
const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export default async function DiscoveryDashboardPage() {
  const sb = await createServerClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) redirect("/login");

  const { data: profile } = await sb
    .from("profiles")
    .select("is_everest_admin")
    .eq("id", auth.user.id)
    .single();
  if (!profile?.is_everest_admin) redirect("/no-access");

  const since = new Date(Date.now() - DAYS * 86400000).toISOString();
  const { rows, error } = await loadEvents(createServiceClient(), since);

  type S = { part1: boolean; part2: boolean; maxQ: number; complete: boolean; email: boolean };
  const sessions = new Map<string, S>();
  const days = new Map<string, Set<string>>();
  for (let i = DAYS - 1; i >= 0; i--) days.set(dayKey(new Date(Date.now() - i * 86400000).toISOString()), new Set());

  for (const r of rows) {
    let s = sessions.get(r.session_id);
    if (!s) { s = { part1: false, part2: false, maxQ: 0, complete: false, email: false }; sessions.set(r.session_id, s); }
    if (r.event === "view") days.get(dayKey(r.created_at))?.add(r.session_id);
    if (r.event === "stage" && r.detail?.stage === "part1") s.part1 = true;
    if (r.event === "stage" && r.detail?.stage === "part2") { s.part1 = true; s.part2 = true; }
    if (r.event === "question") s.maxQ = Math.max(s.maxQ, Number(r.detail?.n) || 0);
    if (r.event === "complete") s.complete = true;
    if (r.event === "book" || r.event === "share") s.email = true;
  }

  const all = [...sessions.values()];
  const visitors = all.length;
  const count = (f: (s: S) => boolean) => all.filter(f).length;
  const completed = count((s) => s.complete);
  const gaveEmail = count((s) => s.email);
  const leads = rows.filter((r) => r.event === "book" || r.event === "share").reverse();

  const funnel: Array<[string, number]> = [
    ["Visited", visitors],
    ["Started", count((s) => s.part1)],
    ["Reached Part 2", count((s) => s.part2)],
    ...Array.from({ length: 10 }, (_, i) => ["Answered question " + (i + 1), count((s) => s.maxQ >= i + 1)] as [string, number]),
    ["Saw results", completed],
    ["Gave an email", gaveEmail],
  ];

  const daily = [...days.entries()].map(([d, set]) => [d, set.size] as [string, number]);
  const peak = Math.max(1, ...daily.map(([, n]) => n));

  const cards: Array<[string, string, string]> = [
    ["Visitors", String(visitors), "unique sessions, " + DAYS + " days"],
    ["Completion rate", pct(completed, visitors), completed + " saw their results"],
    ["Email capture", pct(gaveEmail, visitors), gaveEmail + " gave an email"],
    ["Leads", String(leads.length), "conversations and invites"],
  ];

  return (
    <main className="mx-auto max-w-5xl px-6 py-10 text-slate-800">
      <h1 className="text-2xl font-semibold">Discovery dashboard</h1>
      <p className="mt-1 text-sm text-slate-500">everestcollective.com/discovery, last {DAYS} days</p>

      {error && (
        <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Visits are not being saved yet: the discovery_events table (migration 0019) still needs to be
          created in Supabase. Book a Conversation and Invite Someone leads are still emailed to the team
          and added to HubSpot in the meantime.
          <div className="mt-2 text-xs text-amber-700">Database said: {error}</div>
        </div>
      )}

      <section className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {cards.map(([label, value, sub]) => (
          <div key={label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
            <div className="mt-1 text-xs text-slate-500">{sub}</div>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Daily visitors</h2>
        <div className="mt-4 flex h-40 items-end gap-1 rounded-lg border border-slate-200 bg-white p-3">
          {daily.map(([d, n]) => (
            <div key={d} className="flex-1" title={d + ": " + n}>
              <div className="w-full rounded-t bg-sky-600" style={{ height: Math.max(2, (n / peak) * 120) + "px" }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>{daily[0]?.[0]}</span>
          <span>peak {peak === 1 && daily.every(([, n]) => n === 0) ? 0 : peak} a day</span>
          <span>{daily[daily.length - 1]?.[0]}</span>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Where people drop off</h2>
        <div className="mt-4 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {funnel.map(([label, n], i) => {
            const prev = i === 0 ? n : funnel[i - 1][1];
            const lost = prev - n;
            return (
              <div key={label} className="flex items-center gap-3 border-b border-slate-100 px-4 py-2 text-sm last:border-b-0">
                <div className="w-44 shrink-0">{label}</div>
                <div className="h-3 flex-1 rounded bg-slate-100">
                  <div className="h-3 rounded bg-sky-600" style={{ width: visitors ? (n / visitors) * 100 + "%" : "0%" }} />
                </div>
                <div className="w-12 text-right font-medium">{n}</div>
                <div className="w-12 text-right text-slate-500">{pct(n, visitors)}</div>
                <div className="w-20 text-right text-xs text-rose-600">{i > 0 && lost > 0 ? "-" + lost + " here" : ""}</div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Recent leads</h2>
        {leads.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No leads recorded yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr><th className="px-4 py-2">When</th><th className="px-4 py-2">Type</th><th className="px-4 py-2">Name</th><th className="px-4 py-2">Email</th><th className="px-4 py-2">Company</th><th className="px-4 py-2">Result</th></tr>
              </thead>
              <tbody>
                {leads.slice(0, 50).map((r, i) => (
                  <tr key={r.session_id + i} className="border-t border-slate-100">
                    <td className="whitespace-nowrap px-4 py-2 text-slate-500">{when(r.created_at)}</td>
                    <td className="px-4 py-2">{r.event === "book" ? "Conversation" : "Invite"}</td>
                    <td className="px-4 py-2">{String(r.detail?.name ?? "")}</td>
                    <td className="px-4 py-2">{r.email ?? String(r.detail?.email ?? "")}</td>
                    <td className="px-4 py-2">{String(r.detail?.company ?? "")}</td>
                    <td className="px-4 py-2 text-slate-500">{String(r.detail?.headline ?? "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
