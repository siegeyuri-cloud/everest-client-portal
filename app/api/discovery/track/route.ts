import { NextResponse, after } from "next/server";
import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabaseService";
import { renderLeadEmail } from "@/lib/discovery/lead-email";

/**
 * Events from the Discovery page on everestcollective.com (a static page on
 * SiteGround). The page shipped as a demo with no backend, so until now
 * "Book a Conversation" and "Invite Someone" submissions were thrown away.
 *
 * Every event is stored for the dashboard. Finishes and both contact forms
 * also email the team, and the contact forms go into HubSpot. That work
 * runs in after(), so Vercel cannot freeze it halfway.
 *
 * The page sends text/plain so the browser skips the CORS preflight.
 */

const ALLOWED_ORIGINS = ["https://everestcollective.com", "https://www.everestcollective.com"];
const EVENTS = new Set(["view", "stage", "question", "complete", "book", "share"]);
const NOTIFY = (process.env.DISCOVERY_NOTIFY_EMAILS
  ?? "mike.fromhold@everestcollective.com,brittany.tipton@everestcollective.com,yuri.siege@everestcollective.com")
  .split(",").map((s) => s.trim()).filter(Boolean);
const FROM = process.env.DISCOVERY_FROM_EMAIL ?? "Everest Discovery <discovery@everestcollective.com>";

function cors(origin: string | null) {
  const h: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) h["Access-Control-Allow-Origin"] = origin;
  return h;
}

function esc(v: unknown) {
  return String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]
  );
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: cors(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const headers = cors(req.headers.get("origin"));
  const raw = await req.text();
  if (raw.length > 20000) return NextResponse.json({ ok: false }, { status: 413, headers });

  let body: any = null;
  try { body = JSON.parse(raw); } catch { body = null; }
  const session = String(body?.session ?? "");
  const event = String(body?.event ?? "");
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(session) || !EVENTS.has(event)) {
    return NextResponse.json({ ok: false }, { status: 400, headers });
  }
  const detail: Record<string, any> = body?.detail && typeof body.detail === "object" ? body.detail : {};
  const email = typeof detail.email === "string" ? detail.email.trim().toLowerCase().slice(0, 200) : "";

  const supabase = createServiceClient();
  const { error } = await supabase.from("discovery_events").insert({
    session_id: session,
    event,
    detail,
    email: email || null,
    referrer: String(body?.referrer ?? "").slice(0, 500) || null,
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
  });
  // A failed save must not lose a lead. The team email and HubSpot still
  // go out; only the dashboard misses the event. (discovery_events may not
  // exist yet: the migration is waiting on database access.)
  if (error) console.error("[discovery/track] insert failed", event, error.message);

  if (event === "book" || event === "share" || event === "complete") {
    after(() => followUp(event, detail).catch((e) => console.error("[discovery/track] follow-up threw", event, e)));
  }
  return NextResponse.json({ ok: true, stored: !error }, { headers });
}

async function followUp(event: string, d: Record<string, any>) {
  const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const tasks: Promise<unknown>[] = [];

  const key = process.env.RESEND_API_KEY;
  if (key && NOTIFY.length) {
    let subject = "";
    const rows: Array<[string, string]> = [];
    if (event === "book") {
      subject = "Discovery: " + (s(d.name) || "Someone") + " wants a conversation";
      rows.push(["Name", s(d.name)], ["Email", s(d.email)], ["Phone", s(d.phone)], ["Company", s(d.company)], ["Role", s(d.role)]);
    } else if (event === "share") {
      subject = "Discovery: a colleague was invited";
      rows.push(["Colleague", s(d.name)], ["Their email", s(d.email)], ["Note", s(d.note)]);
    } else {
      subject = "Discovery completed" + (s(d.headline) ? ": " + s(d.headline) : "");
    }
    if (s(d.headline)) rows.push(["Result", s(d.headline)]);
    if (Array.isArray(d.picks) && d.picks.length) rows.push(["Challenges picked", d.picks.map(String).join(", ")]);
    if (Array.isArray(d.dims)) {
      for (const x of d.dims) rows.push([String(x?.name ?? ""), "today " + x?.actual + ", target " + x?.desired + ", gap " + x?.gap]);
    }
    if (s(d.oneThing)) rows.push(["One thing", s(d.oneThing)]);

    const kept = rows.filter(([, v]) => v);
    let html = '<div style="font-family:Helvetica,Arial,sans-serif;font-size:14px;max-width:560px;color:#0f172a;">'
      + '<h2 style="font-weight:500;margin:0 0 16px;">' + esc(subject) + "</h2><table>"
      + kept.map(([k, v]) => '<tr><td style="padding:6px 16px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap;">'
        + esc(k) + '</td><td style="padding:6px 0;">' + esc(v) + "</td></tr>").join("")
      + "</table></div>";
    const text = kept.map(([k, v]) => k + ": " + v).join("\n");
    // Booking alerts use the Claude Design template; other alerts keep the plain layout for now.
    if (event === "book") html = renderLeadEmail(d).html;
    tasks.push(
      new Resend(key).emails.send({ from: FROM, to: NOTIFY, subject, html, text })
        .then((r) => { if (r.error) console.error("[discovery/track] email failed", event, r.error); }),
    );
  }

  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (token && (event === "book" || event === "share") && s(d.email)) {
    const [first, ...rest] = s(d.name).split(/\s+/);
    const properties: Record<string, string> = { email: s(d.email).toLowerCase() };
    if (first) properties.firstname = first;
    if (rest.length) properties.lastname = rest.join(" ");
    if (event === "book") {
      if (s(d.phone)) properties.phone = s(d.phone);
      if (s(d.company)) properties.company = s(d.company);
      if (s(d.role)) properties.jobtitle = s(d.role);
    }
    tasks.push(
      fetch("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ inputs: [{ idProperty: "email", id: properties.email, properties }] }),
      }).then(async (r) => {
        if (!r.ok) console.error("[discovery/track] hubspot upsert failed", r.status, (await r.text()).slice(0, 400));
      }),
    );
  }

  await Promise.all(tasks);
}
