import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * Internal alerts to the Everest team.
 *
 * Deliberately not sent for every registration. Three hundred attendees
 * times four recipients is twelve hundred emails, which becomes a filter
 * rule, and then the one that mattered gets missed too.
 *
 * So: money and tables interrupt people. Invited guests confirming do
 * not, because that is what the roster is for.
 *
 * Recipients live in gala_settings.notify_emails, so adding Reign's
 * assistant in November is an UPDATE, not a deploy.
 */

const FROM = process.env.GALA_FROM_EMAIL ?? "The Collective Gala <gala@everestcollective.com>";
const GOLD = "#C09551";

type Kind = "table_claimed" | "sponsor_committed" | "payment_received" | "seat_bought";

const HEADLINE: Record<Kind, string> = {
  table_claimed: "A table has been claimed",
  sponsor_committed: "A sponsor has committed",
  payment_received: "Payment received",
  seat_bought: "A seat has been bought",
};

const money = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

function esc(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]
  );
}

export async function notifyInternal(kind: Kind, registrationId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[gala/notify] RESEND_API_KEY missing, nothing will send");
    return { ok: false, reason: "NO_API_KEY" };
  }

  const supabase = createServiceClient();

  const { data: s } = await supabase
    .from("gala_settings").select("notify_emails, event_name").single();

  const to = (s?.notify_emails ?? []).filter(Boolean);
  if (to.length === 0) {
    console.warn("[gala/notify] notify_emails is empty, nobody to tell");
    return { ok: false, reason: "NO_RECIPIENTS" };
  }

  const { data: r } = await supabase
    .from("gala_roster").select("*").eq("id", registrationId).single();
  if (!r) return { ok: false, reason: "NO_SUCH_REGISTRATION" };

  const { data: cap } = await supabase.from("gala_capacity").select("*").single();
  const { data: sum } = await supabase.from("gala_summary").select("raised_cents").single();

  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const headline = HEADLINE[kind];

  const rows: Array<[string, string]> = [
    ["Who", r.full_name + " (" + r.email + ")"],
    ["Door", r.door],
  ];
  if (r.table_listed_as) rows.push(["Table listed as", r.table_listed_as]);
  if (r.sponsor_name) rows.push(["Company", r.sponsor_name + (r.sponsor_tier ? ", " + r.sponsor_tier : "")]);
  if (r.mobile) rows.push(["Phone", r.mobile]);

  // Reign follows up with every sponsor herself (Mike, Sept 23), so the
  // alert carries everything they typed rather than just the headline.
  if (kind === "sponsor_committed") {
    const { data: reg } = await supabase
      .from("gala_registrations").select("sponsor_id").eq("id", registrationId).single();
    if (reg?.sponsor_id) {
      const { data: sp } = await supabase
        .from("gala_sponsors").select("*").eq("id", reg.sponsor_id).single();
      const f = (sp ?? {}) as Record<string, unknown>;
      const str = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v.trim() : "");
      if (str(f.legal_name)) rows.push(["Legal name", str(f.legal_name)]);
      if (str(f.recognition_name)) rows.push(["Recognize as", str(f.recognition_name)]);
      const web = str(f.website) || str(f.website_url) || str(f.url);
      if (web) rows.push(["Website", web]);
    }
  }
  if (r.arrived_on_code) rows.push(["Their code", r.arrived_on_code]);
  rows.push(["Amount", r.amount_cents > 0 ? money(r.amount_cents) : "Nothing due"]);
  rows.push(["Seats committed", String(r.seats_committed)]);
  rows.push(["Their line", r.line]);
  if (r.seat_near) rows.push(["Wants to sit near", r.seat_near]);
  if (r.dietary) rows.push(["Dietary", r.dietary]);
  rows.push(["Reference", r.reference]);

  const rowHtml = rows.map(([k, v]) =>
    '<tr><td style="padding:7px 16px 7px 0;color:#64748b;font-size:14px;vertical-align:top;white-space:nowrap;">'
    + esc(k) + '</td><td style="padding:7px 0;color:#0f172a;font-size:14px;">' + esc(v) + '</td></tr>'
  ).join("");

  const standing = cap
    ? '<p style="margin:24px 0 0;padding-top:18px;border-top:1px solid #e2e8f0;font-size:14px;color:#475569;">'
      + '<strong style="color:#0f172a;">' + money(sum?.raised_cents ?? 0) + ' raised.</strong> '
      + cap.seats_taken + ' of ' + cap.capacity + ' seats taken, '
      + cap.seats_pending + ' in checkout, ' + cap.seats_remaining + ' open.</p>'
    : "";

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:24px 16px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif;">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;background:#fff;border:1px solid #e2e8f0;border-top:3px solid ' + GOLD + ';">'
    + '<tr><td style="padding:28px 28px 0;">'
    + '<p style="margin:0;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:' + GOLD + ';">'
    + esc(s?.event_name ?? "The Collective Gala") + '</p>'
    + '<h1 style="margin:8px 0 0;font-size:22px;font-weight:600;color:#0f172a;">' + esc(headline) + '</h1>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 0;">'
    + rowHtml + '</table>' + standing
    + (base ? '<p style="margin:24px 0 0;"><a href="' + base + '/admin/gala" style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;font-size:13px;padding:11px 22px;">Open the roster</a></p>' : "")
    + '</td></tr><tr><td style="padding:26px 28px 28px;"></td></tr></table></td></tr></table></body></html>';

  const text = [
    headline,
    "",
    ...rows.map(([k, v]) => k + ": " + v),
    "",
    cap ? money(sum?.raised_cents ?? 0) + " raised. " + cap.seats_taken + " of " + cap.capacity + " seats taken, " + cap.seats_remaining + " open." : "",
    base ? base + "/admin/gala" : "",
  ].filter(Boolean).join("\n");

  try {
    const { error } = await new Resend(key).emails.send({
      from: FROM,
      to,
      subject: headline + ": " + r.full_name
        + (r.amount_cents > 0 ? ", " + money(r.amount_cents) : ""),
      html, text,
    });
    if (error) {
      console.error("[gala/notify] send failed", kind, r.reference, error);
      return { ok: false, reason: String(error.message ?? error) };
    }
    return { ok: true };
  } catch (err: any) {
    console.error("[gala/notify] threw", kind, r.reference, err);
    return { ok: false, reason: String(err?.message ?? err) };
  }
}

/**
 * The sponsor's own confirmation. Sponsors are saved as pending, and the
 * guest confirmation only goes to comped seats, so until now a sponsor
 * who finished the form heard nothing at all.
 */
export async function sendSponsorThanks(registrationId: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[gala/notify] RESEND_API_KEY missing, sponsor thanks not sent");
    return { ok: false, reason: "NO_API_KEY" };
  }

  const supabase = createServiceClient();
  const { data: r } = await supabase
    .from("gala_roster").select("*").eq("id", registrationId).single();
  if (!r || !r.email) return { ok: false, reason: "NO_SUCH_REGISTRATION" };

  const first = esc(r.first_name || "there");
  const tier = r.sponsor_tier ? esc(r.sponsor_tier) : "a sponsorship";
  const company = r.sponsor_name ? " for " + esc(r.sponsor_name) : "";

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head>'
    + '<body style="margin:0;padding:0;background:#f8f5ef;">'
    + '<div style="max-width:560px;margin:0 auto;padding:40px 28px;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">'
    + '<div style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:' + GOLD + ';">The Collective Gala</div>'
    + '<h1 style="margin:14px 0 0;font-family:Georgia,serif;font-weight:400;font-size:30px;line-height:1.2;">Thank you, ' + first + '</h1>'
    + '<p style="margin:22px 0 0;font-size:15px;line-height:1.7;color:#334155;">We have your interest in ' + tier + company
    + ' for The Collective Gala on Thursday, December 3, at The Reserve at Marty B\'s in Bartonville.</p>'
    + '<p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#334155;">Reign Bach looks after every sponsor personally and will reach out to you directly to talk through recognition and payment.</p>'
    + '<p style="margin:16px 0 0;font-size:15px;line-height:1.7;color:#334155;">Questions before then? Write to Reign at '
    + '<a href="mailto:reign.bach@everestcollective.com" style="color:#7A5C24;">reign.bach@everestcollective.com</a>.</p>'
    + '<p style="margin:28px 0 0;font-size:13px;color:#64748b;">All proceeds are being donated to Pregnancy Help 4 U. Your reference is ' + esc(r.reference) + '.</p>'
    + '</div></body></html>';

  const text = "Thank you, " + (r.first_name || "there") + ".\n\n"
    + "We have your interest in " + (r.sponsor_tier || "a sponsorship")
    + (r.sponsor_name ? " for " + r.sponsor_name : "")
    + " for The Collective Gala on Thursday, December 3, at The Reserve at Marty B's in Bartonville.\n\n"
    + "Reign Bach looks after every sponsor personally and will reach out to you directly to talk through recognition and payment.\n\n"
    + "Questions before then? Write to Reign at reign.bach@everestcollective.com.\n\n"
    + "All proceeds are being donated to Pregnancy Help 4 U. Your reference is " + r.reference + ".";

  const { error } = await new Resend(key).emails.send({
    from: FROM,
    to: [r.email],
    subject: "Thank you for your interest in sponsoring The Collective Gala",
    html, text,
  });
  if (error) {
    console.error("[gala/notify] sponsor thanks failed", r.reference, error);
    return { ok: false, reason: "SEND_FAILED" };
  }
  return { ok: true };
}
