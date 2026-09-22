import crypto from "crypto";

/**
 * Ticket Tailor configuration and client.
 *
 * Deliberately built so that almost nothing here depends on the API key.
 * When the key arrives it goes in one place (.env.local plus Vercel) and
 * unlocks exactly one capability: looking an order up after the fact.
 *
 * What works WITHOUT the API key:
 *   - receiving and verifying webhooks
 *   - applying a payment to a registration
 *   - issuing tickets
 *   - sending a buyer to checkout (the box office URL is public)
 *
 * What needs the API key:
 *   - fetchOrder(), a reconciliation fallback for when a webhook was
 *     missed or arrived malformed
 *
 * Environment variables:
 *   TICKETTAILOR_API_KEY         the blank. Owner-level access required.
 *   TICKETTAILOR_EVENT_ID        the event, e.g. ev_1234567
 *   TICKETTAILOR_WEBHOOK_SECRET  signing secret from the webhook settings
 *   TICKETTAILOR_BOX_OFFICE_URL  public checkout base, e.g.
 *                                https://buytickets.at/everestcollectivellc
 */

export const ttConfig = {
  apiKey: process.env.TICKETTAILOR_API_KEY ?? null,
  eventId: process.env.TICKETTAILOR_EVENT_ID ?? null,
  webhookSecret: process.env.TICKETTAILOR_WEBHOOK_SECRET ?? null,
  boxOfficeUrl: process.env.TICKETTAILOR_BOX_OFFICE_URL ?? null,
};

/** True once the API key is present. Only fetchOrder() cares. */
export function hasApiKey(): boolean {
  return Boolean(ttConfig.apiKey);
}

/** Everything the payment flow needs, none of which is the API key. */
export function isCheckoutConfigured(): boolean {
  return Boolean(ttConfig.eventId && ttConfig.boxOfficeUrl);
}

/**
 * Verify a webhook signature.
 *
 * HMAC-SHA256 over the raw body is the common pattern and what this
 * implements. Ticket Tailor's exact scheme must be confirmed against
 * their current docs before launch: if they sign differently (a
 * timestamped payload, a different digest, a prefixed header format),
 * only this function changes.
 *
 * Compared in constant time, because a naive === leaks the signature
 * one byte at a time to anyone willing to measure.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null
): { valid: boolean; reason?: string } {
  if (!ttConfig.webhookSecret) {
    return { valid: false, reason: "NO_SECRET_CONFIGURED" };
  }
  if (!signatureHeader) {
    return { valid: false, reason: "NO_SIGNATURE_HEADER" };
  }

  // Tolerate a "sha256=..." style prefix if they use one.
  const provided = signatureHeader.includes("=")
    ? signatureHeader.split("=").pop()!.trim()
    : signatureHeader.trim();

  const expected = crypto
    .createHmac("sha256", ttConfig.webhookSecret)
    .update(rawBody, "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(provided, "utf8");

  if (a.length !== b.length) return { valid: false, reason: "LENGTH_MISMATCH" };
  if (!crypto.timingSafeEqual(a, b)) return { valid: false, reason: "SIGNATURE_MISMATCH" };

  return { valid: true };
}

/**
 * Build the checkout URL a registrant is sent to after their details are
 * saved. The TCG- reference rides along so the webhook can match the
 * order back to the person without relying on email.
 *
 * The parameter name for carrying a reference through Ticket Tailor's
 * checkout must be confirmed against their docs. If it differs, change
 * REFERENCE_PARAM and nothing else. Email matching in
 * apply_gala_payment() is the fallback if the reference never arrives.
 */
const REFERENCE_PARAM = "ref";

export function buildCheckoutUrl(opts: {
  reference: string;
  email?: string | null;
  name?: string | null;
}): string | null {
  if (!isCheckoutConfigured()) return null;

  // The box office URL is already the event page. Appending eventId
  // gives a dead link; checked against the live site by hand.
  const url = new URL(ttConfig.boxOfficeUrl!.replace(/\/+$/, ""));

  url.searchParams.set(REFERENCE_PARAM, opts.reference);
  if (opts.email) url.searchParams.set("email", opts.email);
  if (opts.name) url.searchParams.set("name", opts.name);

  return url.toString();
}

/**
 * Fetch an order from Ticket Tailor. The one thing that needs the key.
 *
 * Returns null rather than throwing when unconfigured, so callers can
 * treat "no key yet" and "order not found" the same way: fall back to
 * what the webhook already told us.
 */
export async function fetchOrder(orderId: string): Promise<any | null> {
  if (!hasApiKey()) {
    console.warn("[tickettailor] fetchOrder called without an API key");
    return null;
  }

  // Ticket Tailor uses HTTP Basic with the key as the username and an
  // empty password. Confirm against their current docs before relying on
  // this in production.
  const auth = Buffer.from(`${ttConfig.apiKey}:`).toString("base64");

  try {
    const res = await fetch(`https://api.tickettailor.com/v1/orders/${orderId}`, {
      headers: { Authorization: `Basic ${auth}`, Accept: "application/json" },
    });

    if (!res.ok) {
      console.error("[tickettailor] fetchOrder failed", res.status, orderId);
      return null;
    }
    return await res.json();
  } catch (err) {
    console.error("[tickettailor] fetchOrder threw", err);
    return null;
  }
}

/**
 * Pull the fields we care about out of a webhook payload.
 *
 * Written defensively on purpose. The exact shape of Ticket Tailor's
 * payload is unverified, so every field is looked for in several
 * plausible places and the raw payload is stored regardless. If this
 * guesses wrong, the fix is to correct this function and replay from
 * gala_orders.payload rather than to go hunting for lost money.
 */
export function extractOrder(payload: any): {
  orderId: string | null;
  eventId: string | null;
  reference: string | null;
  email: string | null;
  name: string | null;
  totalCents: number | null;
  currency: string;
  status: string | null;
} {
  const o = payload?.order ?? payload?.data ?? payload ?? {};

  const pick = (...vals: any[]) =>
    vals.find((v) => v !== undefined && v !== null && String(v).trim() !== "") ?? null;

  const orderId = pick(o.id, o.order_id, payload?.id, payload?.order_id);
  const email = pick(o.email, o.buyer_email, o.buyer?.email, o.customer?.email);

  const first = pick(o.first_name, o.buyer?.first_name, o.customer?.first_name) ?? "";
  const last = pick(o.last_name, o.buyer?.last_name, o.customer?.last_name) ?? "";
  const name = pick(o.name, o.buyer_name, `${first} ${last}`.trim());

  // The reference could arrive as a top-level field, inside metadata, or
  // as an answer to a checkout question. Look in all three, then fall
  // back to scanning for the TCG- shape anywhere in the payload.
  let reference =
    pick(o.reference, o.ref, o.external_id, o.metadata?.ref, o.metadata?.reference) ?? null;

  if (!reference && Array.isArray(o.custom_questions)) {
    for (const q of o.custom_questions) {
      const a = String(q?.answer ?? "");
      if (/^TCG-[A-Z0-9]{6}$/i.test(a.trim())) {
        reference = a.trim();
        break;
      }
    }
  }

  if (!reference) {
    const m = JSON.stringify(payload ?? {}).match(/TCG-[A-Z0-9]{6}/i);
    if (m) reference = m[0];
  }

  const rawTotal = pick(o.total, o.total_paid, o.amount, o.total_amount);
  let totalCents: number | null = null;
  if (rawTotal !== null) {
    const n = Number(rawTotal);
    // Ticket Tailor may report minor units already. A $2,500 table is
    // 250000 minor units; anything under 1000 is far more likely dollars.
    totalCents = Number.isFinite(n) ? (Number.isInteger(n) && n >= 1000 ? n : Math.round(n * 100)) : null;
  }

  return {
    orderId: orderId ? String(orderId) : null,
    eventId: pick(o.event_id, o.event?.id, payload?.event_id),
    reference: reference ? String(reference).toUpperCase() : null,
    email: email ? String(email).toLowerCase() : null,
    name: name ? String(name) : null,
    totalCents,
    currency: String(pick(o.currency, o.currency_code) ?? "USD").toUpperCase(),
    status: pick(o.status, payload?.status, payload?.event),
  };
}
