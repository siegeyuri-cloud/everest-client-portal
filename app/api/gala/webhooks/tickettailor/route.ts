import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseService";
import { verifyWebhookSignature, extractOrder, ttConfig } from "@/lib/tickettailor";

/**
 * POST /api/gala/webhooks/tickettailor
 *
 * Receives order notifications from Ticket Tailor.
 *
 * The ordering here is the whole design:
 *
 *   1. Verify the signature.
 *   2. Store the raw payload in gala_orders, verbatim, before believing
 *      any of it.
 *   3. Only then try to parse it and apply the payment.
 *
 * Step 2 before step 3 matters because the payload shape is unverified.
 * If the parser is wrong in November, the money is still recorded and the
 * fix is to correct extractOrder() and replay from gala_orders.payload.
 * A parser that runs first and throws loses the order entirely.
 *
 * Status codes are chosen for how Ticket Tailor will react:
 *   500 -> they retry. Used only when we failed to STORE the order.
 *   200 -> they stop. Used once the order is safely on disk, even if
 *          applying it failed, because a retry would not help and a
 *          retry storm would bury the real problem.
 */

export async function POST(req: Request) {
  const raw = await req.text();

  // ---------- 1. signature ----------
  const signature =
    req.headers.get("tickettailor-signature") ??
    req.headers.get("x-tickettailor-signature") ??
    req.headers.get("x-signature");

  const check = verifyWebhookSignature(raw, signature);

  if (!check.valid) {
    // In production an unverified webhook is refused outright. Anyone can
    // POST to this URL, and accepting unsigned payloads would let a
    // stranger mark registrations paid.
    if (process.env.NODE_ENV === "production") {
      console.error("[gala/webhook] rejected", check.reason);
      return NextResponse.json({ ok: false, error: "Invalid signature" }, { status: 401 });
    }
    // Locally, warn and carry on so the flow can be tested before the
    // secret exists.
    console.warn("[gala/webhook] signature not verified:", check.reason, "(allowed in dev)");
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error("[gala/webhook] body was not JSON");
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = extractOrder(payload);
  const supabase = createServiceClient();

  // ---------- 2. store raw, before trusting anything ----------
  const orderKey = parsed.orderId ?? `unparsed_${Date.now()}`;

  const { error: storeError } = await supabase
    .from("gala_orders")
    .upsert(
      {
        tickettailor_order_id: orderKey,
        event_id: parsed.eventId,
        reference: parsed.reference,
        buyer_email: parsed.email,
        buyer_name: parsed.name,
        total_cents: parsed.totalCents,
        currency: parsed.currency,
        status: "received",
        payload,
      },
      { onConflict: "tickettailor_order_id" }
    );

  if (storeError) {
    // The only case worth a retry. We have not recorded the money.
    console.error("[gala/webhook] FAILED TO STORE ORDER", orderKey, storeError);
    return NextResponse.json({ ok: false, error: "Storage failed" }, { status: 500 });
  }

  // ---------- 3. apply it ----------
  if (!parsed.orderId) {
    await supabase
      .from("gala_orders")
      .update({
        status: "failed",
        process_error: "Could not find an order id in the payload. Stored for replay.",
        processed_at: new Date().toISOString(),
      })
      .eq("tickettailor_order_id", orderKey);

    console.error("[gala/webhook] no order id in payload, stored as", orderKey);
    return NextResponse.json({ ok: true, stored: true, applied: false });
  }

  const { data: result, error: applyError } = await supabase.rpc("apply_gala_payment", {
    p: {
      tickettailor_order_id: parsed.orderId,
      reference: parsed.reference,
      email: parsed.email,
      amount_cents: parsed.totalCents,
      payment_method: "tickettailor",
    },
  });

  if (applyError) {
    await supabase
      .from("gala_orders")
      .update({
        status: "failed",
        process_error: String(applyError.message ?? applyError),
        processed_at: new Date().toISOString(),
      })
      .eq("tickettailor_order_id", parsed.orderId);

    console.error("[gala/webhook] apply_gala_payment failed", parsed.orderId, applyError);
    return NextResponse.json({ ok: true, stored: true, applied: false });
  }

  const matched = result?.matched === true;

  await supabase
    .from("gala_orders")
    .update({
      status: matched ? "processed" : "failed",
      process_error: matched
        ? null
        : `No registration matched. reference=${parsed.reference ?? "none"} email=${parsed.email ?? "none"}`,
      processed_at: new Date().toISOString(),
    })
    .eq("tickettailor_order_id", parsed.orderId);

  if (!matched) {
    // Money arrived for somebody we cannot identify. Loud on purpose:
    // this is a person who paid and will show up expecting a seat.
    console.error("[gala/webhook] UNMATCHED PAYMENT", {
      orderId: parsed.orderId,
      reference: parsed.reference,
      email: parsed.email,
      totalCents: parsed.totalCents,
    });
  } else if (result?.matched_by === "email") {
    // Worked, but on the weaker key. Worth a human glance.
    console.warn("[gala/webhook] matched on email rather than reference", {
      orderId: parsed.orderId,
      reference: result?.reference,
    });
  }

  return NextResponse.json({
    ok: true,
    stored: true,
    applied: matched,
    alreadyApplied: result?.already_applied ?? false,
    matchedBy: result?.matched_by ?? null,
    reference: result?.reference ?? null,
  });
}

/** GET returns configuration state. Useful for confirming a deploy. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "tickettailor webhook",
    configured: {
      webhookSecret: Boolean(ttConfig.webhookSecret),
      eventId: Boolean(ttConfig.eventId),
      apiKey: Boolean(ttConfig.apiKey),
      boxOfficeUrl: Boolean(ttConfig.boxOfficeUrl),
    },
  });
}
