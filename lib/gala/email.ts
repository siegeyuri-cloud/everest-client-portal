import { Resend } from "resend";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * The confirmation card.
 *
 * Fires on registration complete, not on payment. Roughly 270 of 300
 * attendees are invited guests who never pay, so a payment-triggered
 * email would reach almost nobody.
 *
 * Two variants off one template:
 *   paid    a receipt and a thank you
 *   comped  their host is holding the seat, nothing to pay
 *
 * Sending never blocks a registration. A seat that saved but whose email
 * failed is recoverable and visible in the admin table. A seat that
 * failed to save because a mail provider was slow is not.
 */

const FROM = process.env.GALA_FROM_EMAIL ?? "The Collective Gala <gala@everestcollective.com>";
const REPLY_TO = process.env.GALA_REPLY_TO ?? "Reign.Bach@everestcollective.com";

const GOLD = "#C09551";
const NIGHT = "#0B1521";
const IVORY = "#F4EEE2";

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn("[gala/email] RESEND_API_KEY missing, nothing will send");
    return null;
  }
  return new Resend(key);
}

/** The event happens in Bartonville. Everyone reads the same date. */
function eventDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
    timeZone: "America/Chicago",
  });
}

function eventTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: "America/Chicago",
  });
}

const money = (cents: number) => "$" + Math.round(cents / 100).toLocaleString("en-US");

function esc(s: string | null | undefined) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as Record<string, string>)[c]
  );
}

type CardInput = {
  badgeReads: string;
  line: string;
  status: "paid" | "comped";
  amountCents: number;
  hostName: string | null;
  tableNumber: string | null;
  reference: string;
  ticketUrl: string | null;
  eventName: string;
  startsAt: string;
  venueName: string;
  venueAddress: string | null;
  contactEmail: string;
};

function buildCard(i: CardInput) {
  const paid = i.status === "paid";

  const opening = paid
    ? "Thank you. Your seat at " + esc(i.eventName) + " is confirmed."
    : i.hostName
      ? esc(i.hostName) + " is holding a seat for you at " + esc(i.eventName) + ", and it is now confirmed."
      : "Your seat at " + esc(i.eventName) + " is confirmed.";

  const moneyLine = paid
    ? '<tr><td style="padding:6px 0;color:rgba(244,238,226,0.6);font-size:14px;">Paid</td><td style="padding:6px 0;color:' + IVORY + ';font-size:14px;text-align:right;">' + money(i.amountCents) + '</td></tr>'
    : '<tr><td style="padding:6px 0;color:rgba(244,238,226,0.6);font-size:14px;">Your seat</td><td style="padding:6px 0;color:' + IVORY + ';font-size:14px;text-align:right;">Nothing to pay</td></tr>';

  const tableLine = i.tableNumber
    ? '<tr><td style="padding:6px 0;color:rgba(244,238,226,0.6);font-size:14px;">Table</td><td style="padding:6px 0;color:' + IVORY + ';font-size:14px;text-align:right;">' + esc(i.tableNumber) + '</td></tr>'
    : "";

  const ticketBlock = i.ticketUrl
    ? '<tr><td style="padding:28px 0 0;" align="center"><a href="' + esc(i.ticketUrl) + '" style="display:inline-block;background:' + GOLD + ';color:#0B1521;text-decoration:none;font-size:13px;letter-spacing:0.14em;text-transform:uppercase;padding:15px 34px;font-family:Helvetica,Arial,sans-serif;">Open your ticket</a></td></tr><tr><td style="padding:12px 0 0;color:rgba(244,238,226,0.45);font-size:12px;" align="center">Save this link. You will show it at the door.</td></tr>'
    : "";

  const html = '<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#07101a;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07101a;padding:32px 16px;"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:' + NIGHT + ';border-top:3px solid ' + GOLD + ';"><tr><td style="padding:40px 36px 0;">'
    + '<p style="margin:0;font-family:Georgia,serif;font-size:21px;line-height:1.5;color:' + IVORY + ';">' + opening + '</p>'
    + '<p style="margin:22px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.65;color:rgba(244,238,226,0.75);">Your badge will read <strong style="color:' + IVORY + ';">' + esc(i.badgeReads) + '</strong>, and underneath it, what you told us you could talk about for an hour:</p>'
    + '<p style="margin:14px 0 0;padding:16px 18px;background:rgba(192,149,81,0.1);border-left:2px solid ' + GOLD + ';font-family:Georgia,serif;font-size:16px;line-height:1.55;color:' + IVORY + ';">' + esc(i.line) + '</p>'
    + '<p style="margin:18px 0 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:rgba(244,238,226,0.6);">Expect a stranger to walk up and ask you about it. That is the whole idea.</p>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:30px 0 0;border-top:1px solid rgba(192,149,81,0.2);font-family:Helvetica,Arial,sans-serif;">'
    + '<tr><td style="padding:14px 0 6px;color:rgba(244,238,226,0.6);font-size:14px;">When</td><td style="padding:14px 0 6px;color:' + IVORY + ';font-size:14px;text-align:right;">' + eventDate(i.startsAt) + ', ' + eventTime(i.startsAt) + '</td></tr>'
    + '<tr><td style="padding:6px 0;color:rgba(244,238,226,0.6);font-size:14px;">Where</td><td style="padding:6px 0;color:' + IVORY + ';font-size:14px;text-align:right;">' + esc(i.venueName) + (i.venueAddress ? "<br>" + esc(i.venueAddress) : "") + '</td></tr>'
    + tableLine + moneyLine
    + '<tr><td style="padding:6px 0;color:rgba(244,238,226,0.6);font-size:14px;">Reference</td><td style="padding:6px 0;color:' + IVORY + ';font-size:14px;text-align:right;font-family:monospace;">' + esc(i.reference) + '</td></tr>'
    + '</table>'
    + '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' + ticketBlock + '</table>'
    + '<p style="margin:32px 0 0;padding-top:20px;border-top:1px solid rgba(192,149,81,0.2);font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:rgba(244,238,226,0.5);">Black tie with a Texas accent. Questions, changes, or a seat you need moved, write to <a href="mailto:' + esc(i.contactEmail) + '" style="color:' + GOLD + ';">' + esc(i.contactEmail) + '</a> and a person will answer.</p>'
    + '</td></tr><tr><td style="padding:28px 36px 36px;"><p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:rgba(244,238,226,0.3);">Everest Collective</p></td></tr></table></td></tr></table></body></html>';

  const text = [
    opening.replace(/&amp;/g, "&").replace(/&#39;/g, "'"),
    "",
    "Badge: " + i.badgeReads,
    "Your line: " + i.line,
    "",
    "When: " + eventDate(i.startsAt) + ", " + eventTime(i.startsAt),
    "Where: " + i.venueName + (i.venueAddress ? ", " + i.venueAddress : ""),
    i.tableNumber ? "Table: " + i.tableNumber : "",
    paid ? "Paid: " + money(i.amountCents) : "Your seat: nothing to pay",
    "Reference: " + i.reference,
    "",
    i.ticketUrl ? "Your ticket: " + i.ticketUrl : "",
    "",
    "Questions: " + i.contactEmail,
  ].filter(Boolean).join("\n");

  const subject = paid
    ? "You are in. " + i.eventName + ", " + eventDate(i.startsAt)
    : "Your seat is confirmed. " + i.eventName + ", " + eventDate(i.startsAt);

  return { subject, html, text };
}

/**
 * Send the confirmation for one registration. Idempotent by
 * confirmation_sent_at unless force is passed.
 */
export async function sendGalaConfirmation(
  registrationId: string,
  opts: { force?: boolean } = {}
): Promise<{ ok: boolean; reason?: string; messageId?: string }> {
  const supabase = createServiceClient();

  const { data: r, error } = await supabase
    .from("gala_roster").select("*").eq("id", registrationId).single();

  if (error || !r) return { ok: false, reason: "NO_SUCH_REGISTRATION" };
  if (r.status !== "paid" && r.status !== "comped") {
    return { ok: false, reason: "NOT_CONFIRMED_YET" };
  }
  if (r.confirmation_sent_at && !opts.force) {
    return { ok: true, reason: "ALREADY_SENT" };
  }

  const { data: s } = await supabase
    .from("gala_settings")
    .select("event_name, event_starts_at, venue_name, venue_address, contact_email")
    .single();

  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/+$/, "");
  const ticketUrl = r.ticket_token && base ? base + "/gala/ticket/" + r.ticket_token : null;

  const { subject, html, text } = buildCard({
    badgeReads: r.badge_reads,
    line: r.line,
    status: r.status as "paid" | "comped",
    amountCents: r.amount_cents ?? 0,
    hostName: r.host_name,
    tableNumber: r.table_number,
    reference: r.reference,
    ticketUrl,
    eventName: s?.event_name ?? "The Collective Gala",
    startsAt: s?.event_starts_at ?? new Date().toISOString(),
    venueName: s?.venue_name ?? "The Reserve at Marty B's",
    venueAddress: s?.venue_address ?? null,
    contactEmail: s?.contact_email ?? REPLY_TO,
  });

  const client = resend();
  if (!client) return { ok: false, reason: "NO_API_KEY" };

  try {
    const { data, error: sendError } = await client.emails.send({
      from: FROM, to: r.email, replyTo: REPLY_TO, subject, html, text,
    });

    if (sendError) {
      await supabase.from("gala_registrations")
        .update({ confirmation_error: String(sendError.message ?? sendError) })
        .eq("id", registrationId);
      console.error("[gala/email] send failed", r.reference, sendError);
      return { ok: false, reason: String(sendError.message ?? sendError) };
    }

    await supabase.from("gala_registrations")
      .update({ confirmation_sent_at: new Date().toISOString(), confirmation_error: null })
      .eq("id", registrationId);

    return { ok: true, messageId: data?.id };
  } catch (err: any) {
    await supabase.from("gala_registrations")
      .update({ confirmation_error: String(err?.message ?? err) })
      .eq("id", registrationId);
    console.error("[gala/email] threw", r.reference, err);
    return { ok: false, reason: String(err?.message ?? err) };
  }
}

/** Send to a registration and their plus-one. */
export async function sendGalaConfirmationGroup(registrationId: string) {
  const supabase = createServiceClient();
  const { data: children } = await supabase
    .from("gala_registrations").select("id")
    .eq("parent_registration_id", registrationId);

  const ids = [registrationId, ...(children ?? []).map((c: any) => c.id)];
  return Promise.all(ids.map((id) => sendGalaConfirmation(id)));
}
