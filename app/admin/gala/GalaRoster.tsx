"use client";

import * as React from "react";
import Link from "next/link";

type Row = {
  id: string; reference: string; door: string; status: string;
  full_name: string; badge_reads: string; email: string; mobile: string | null;
  line: string; dietary: string | null; accessibility: string | null;
  seat_near: string | null; host_name: string | null; table_number: string | null;
  arrived_on_code: string | null; sponsor_name: string | null; sponsor_tier: string | null;
  is_plus_one: boolean; guest_of_name: string | null;
  seats_committed: number; amount_cents: number; payment_method: string;
  paid_at: string | null; has_ticket: boolean; checked_in: boolean;
  in_hubspot: boolean; hubspot_sync_error: string | null;
  marketing_opt_in: boolean; created_at: string;
};

type Summary = {
  capacity: number; seats_taken: number; seats_pending: number; seats_remaining: number;
  people_registered: number; people_paid: number; people_comped: number; people_pending: number;
  raised_cents: number; in_checkout_cents: number; hosts: number; sponsors_confirmed: number;
  tickets_issued: number; checked_in: number;
  orders_needing_attention: number; missing_tickets: number;
};

type Host = {
  id: string; host_name: string; host_email: string | null; table_number: string | null;
  seats_allotted: number; seats_claimed: number; seats_open: number;
  code: string | null; people_registered: number; people_invited: number;
};

type Settings = {
  event_name: string; event_starts_at: string;
  registration_closes_at: string; registration_open: boolean;
} | null;

const money = (c: number) => "$" + Math.round(c / 100).toLocaleString("en-US");
const DOORS = ["seat", "host", "guest", "sponsor"] as const;
const STATUSES = ["pending", "paid", "comped", "cancelled", "refunded"] as const;
const doorLabel: Record<string, string> = {
  seat: "Individual seat", host: "Table host",
  guest: "Invited guest", sponsor: "Sponsor",
};

function statusStyle(s: string) {
  if (s === "paid") return "bg-emerald-50 text-emerald-800 ring-emerald-200";
  if (s === "comped") return "bg-amber-50 text-amber-800 ring-amber-200";
  if (s === "pending") return "bg-slate-50 text-slate-600 ring-slate-200";
  return "bg-rose-50 text-rose-800 ring-rose-200";
}

export default function GalaRoster({
  summary, roster, hosts, settings,
}: { summary: Summary | null; roster: Row[]; hosts: Host[]; settings: Settings }) {
  const [tab, setTab] = React.useState<"people" | "hosts">("people");
  const [query, setQuery] = React.useState("");
  const [door, setDoor] = React.useState("all");
  const [status, setStatus] = React.useState("all");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster.filter((r) => {
      if (door !== "all" && r.door !== door) return false;
      if (status !== "all" && r.status !== status) return false;
      if (!q) return true;
      return [r.full_name, r.email, r.reference, r.line, r.host_name, r.sponsor_name, r.table_number]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q));
    });
  }, [roster, query, door, status]);

  function downloadCsv() {
    const cols = ["reference","full_name","badge_reads","email","mobile","door","status","line",
      "dietary","accessibility","seat_near","host_name","table_number","sponsor_name",
      "is_plus_one","guest_of_name","amount_cents","payment_method","paid_at",
      "has_ticket","checked_in","created_at"];
    const esc = (v: unknown) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const csv = [cols.join(","), ...filtered.map((r) => cols.map((c) => esc((r as any)[c])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "gala-roster-" + new Date().toISOString().slice(0, 10) + ".csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const pct = summary && summary.capacity
    ? Math.round((summary.seats_taken / summary.capacity) * 100) : 0;

  return (
    <main className="mx-auto max-w-[1400px] px-6 py-10">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <Link href="/admin" className="text-sm text-slate-500 hover:text-slate-800">Admin</Link>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">
            {settings?.event_name ?? "The Collective Gala"}
          </h1>
          {settings && (
            <p className="mt-1 text-sm text-slate-500">
              {new Date(settings.event_starts_at).toLocaleDateString("en-US",
                { weekday: "long", month: "long", day: "numeric", year: "numeric",
                  timeZone: "America/Chicago" })}
              {settings.registration_open
                ? ". Registration closes " + new Date(settings.registration_closes_at)
                    .toLocaleDateString("en-US", { month: "long", day: "numeric",
                      timeZone: "America/Chicago" }) + "."
                : ". Registration is closed."}
            </p>
          )}
        </div>
        <button onClick={downloadCsv}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50">
          Download {filtered.length === roster.length ? "roster" : "filtered rows"} as CSV
        </button>
      </div>

      {summary && (
        <div className="mt-8 grid gap-px overflow-hidden rounded-lg bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-white p-5">
            <div className="text-sm text-slate-500">Raised</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{money(summary.raised_cents)}</div>
            {summary.in_checkout_cents > 0 && (
              <div className="mt-1 text-sm text-slate-500">{money(summary.in_checkout_cents)} still in checkout</div>
            )}
          </div>
          <div className="bg-white p-5">
            <div className="text-sm text-slate-500">Seats taken</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">
              {summary.seats_taken}<span className="text-lg font-normal text-slate-400"> of {summary.capacity}</span>
            </div>
            <div className="mt-3 h-1 w-full bg-slate-100">
              <div className="h-1 bg-[#C09551]" style={{ width: pct + "%" }} />
            </div>
          </div>
          <div className="bg-white p-5">
            <div className="text-sm text-slate-500">People</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{summary.people_registered}</div>
            <div className="mt-1 text-sm text-slate-500">
              {summary.people_paid} paid, {summary.people_comped} comped
              {summary.people_pending > 0 ? ", " + summary.people_pending + " unpaid" : ""}
            </div>
          </div>
          <div className="bg-white p-5">
            <div className="text-sm text-slate-500">Tickets issued</div>
            <div className="mt-1 text-3xl font-semibold text-slate-900">{summary.tickets_issued}</div>
            <div className="mt-1 text-sm text-slate-500">{summary.checked_in} checked in</div>
          </div>
        </div>
      )}

      {summary && (summary.orders_needing_attention > 0 || summary.missing_tickets > 0) && (
        <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          {summary.orders_needing_attention > 0 && (
            <p>{summary.orders_needing_attention} payment{summary.orders_needing_attention === 1 ? "" : "s"} arrived
              that could not be matched to a registration. Someone paid and is not on the list.</p>
          )}
          {summary.missing_tickets > 0 && (
            <p className="mt-1">{summary.missing_tickets} confirmed{" "}
              {summary.missing_tickets === 1 ? "attendee has" : "attendees have"} no ticket issued.
              They will arrive with nothing to scan.</p>
          )}
        </div>
      )}

      <div className="mt-10 flex gap-6 border-b border-slate-200">
        {(["people", "hosts"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={"-mb-px border-b-2 pb-3 text-sm font-medium " + (tab === t
              ? "border-[#C09551] text-slate-900"
              : "border-transparent text-slate-500 hover:text-slate-800")}>
            {t === "people" ? "Who is coming (" + roster.length + ")" : "Tables (" + hosts.length + ")"}
          </button>
        ))}
      </div>

      {tab === "people" ? (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a name, email, reference, or what they talk about"
              className="min-w-[320px] flex-1 rounded border border-slate-300 px-3 py-2 text-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none" />
            <select value={door} onChange={(e) => setDoor(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Every door</option>
              {DOORS.map((d) => <option key={d} value={d}>{doorLabel[d]}</option>)}
            </select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}
              className="rounded border border-slate-300 px-3 py-2 text-sm">
              <option value="all">Any status</option>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {filtered.length === 0 ? (
            <p className="mt-10 text-sm text-slate-500">
              {roster.length === 0
                ? "Nobody has registered yet. Rows appear here the moment someone completes the form."
                : "No one matches those filters."}
            </p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[1100px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="py-2 pr-4 font-medium">Name</th>
                    <th className="py-2 pr-4 font-medium">Door</th>
                    <th className="py-2 pr-4 font-medium">Status</th>
                    <th className="py-2 pr-4 font-medium">Table</th>
                    <th className="py-2 pr-4 font-medium">Talks about</th>
                    <th className="py-2 pr-4 font-medium">Needs</th>
                    <th className="py-2 pr-4 text-right font-medium">Paid</th>
                    <th className="py-2 pr-4 font-medium">Ticket</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-900">{r.full_name}</div>
                        <div className="text-slate-500">{r.email}</div>
                        {r.mobile && <div className="text-slate-400">{r.mobile}</div>}
                        <div className="mt-1 font-mono text-xs text-slate-400">{r.reference}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {doorLabel[r.door] ?? r.door}
                        {r.is_plus_one && r.guest_of_name && (
                          <div className="text-slate-400">guest of {r.guest_of_name}</div>
                        )}
                        {r.sponsor_name && <div className="text-slate-400">{r.sponsor_name}</div>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className={"inline-block rounded px-2 py-0.5 text-xs ring-1 " + statusStyle(r.status)}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {r.table_number ?? <span className="text-slate-300">not seated</span>}
                        {r.host_name && <div className="text-slate-400">{r.host_name}</div>}
                      </td>
                      <td className="py-3 pr-4 text-slate-700">
                        <div className="max-w-[24rem]">{r.line}</div>
                        <div className="mt-1 text-xs text-slate-400">badge: {r.badge_reads}</div>
                      </td>
                      <td className="py-3 pr-4 text-slate-600">
                        {r.dietary && <div>{r.dietary}</div>}
                        {r.accessibility && <div className="text-amber-700">{r.accessibility}</div>}
                        {!r.dietary && !r.accessibility && <span className="text-slate-300">none</span>}
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums text-slate-700">
                        {r.amount_cents > 0 ? money(r.amount_cents) : <span className="text-slate-300">nothing due</span>}
                      </td>
                      <td className="py-3 pr-4">
                        {r.checked_in ? <span className="text-emerald-700">checked in</span>
                          : r.has_ticket ? <span className="text-slate-600">issued</span>
                          : <span className="text-slate-300">none</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="mt-6">
          {hosts.length === 0 ? (
            <p className="text-sm text-slate-500">
              No tables claimed yet. A host appears here when someone registers through the table host door.
            </p>
          ) : (
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500">
                  <th className="py-2 pr-4 font-medium">Host</th>
                  <th className="py-2 pr-4 font-medium">Table</th>
                  <th className="py-2 pr-4 font-medium">Code</th>
                  <th className="py-2 pr-4 text-right font-medium">Claimed</th>
                  <th className="py-2 pr-4 text-right font-medium">Open</th>
                  <th className="py-2 pr-4 text-right font-medium">Invited</th>
                </tr>
              </thead>
              <tbody>
                {hosts.map((h) => (
                  <tr key={h.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-900">{h.host_name}</div>
                      {h.host_email && <div className="text-slate-500">{h.host_email}</div>}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">
                      {h.table_number ?? <span className="text-slate-300">not assigned</span>}
                    </td>
                    <td className="py-3 pr-4 font-mono text-xs text-slate-600">{h.code}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-900">
                      {h.seats_claimed} of {h.seats_allotted}
                    </td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600">{h.seats_open}</td>
                    <td className="py-3 pr-4 text-right tabular-nums text-slate-600">{h.people_invited}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
