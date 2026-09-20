import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * POST /api/gala/register — completes a gala registration.
 *
 * Public and unauthenticated: guests register without a portal account.
 *
 * All the real work happens in register_gala_attendee() in Postgres, in one
 * transaction, so a half-written registration is not possible. This route
 * validates shape, calls it, and turns database exceptions into sentences a
 * person can act on.
 *
 * Unlike /api/track/open, this returns real status codes. A tracking failure
 * should be invisible; a registration failure must not be.
 */

const ERRORS: Record<string, { status: number; message: string }> = {
  REGISTRATION_CLOSED: {
    status: 503,
    message:
      "Registration has closed. Write to Reign.Bach@everestcollective.com and we will see what we can do.",
  },
  MISSING_REQUIRED_FIELDS: {
    status: 400,
    message: "We still need your name and email address.",
  },
  MISSING_LINE: {
    status: 400,
    message:
      "We need your line, the thing you could talk about for an hour. Specific beats short.",
  },
  MISSING_GUEST_LINE: {
    status: 400,
    message:
      "We need your guest's own line too. Theirs, not yours, which is why we ask for their email separately.",
  },
  INVALID_CODE: {
    status: 400,
    message:
      "We cannot find that code. It looks like COLLECTIVE-MIKE, with your host's first name, or COLLECTIVE-VIP-0000 if we invited you directly.",
  },
  EXPIRED_CODE: {
    status: 400,
    message:
      "That code has expired. Write to Reign.Bach@everestcollective.com and we will sort it out.",
  },
  CODE_FULL: {
    status: 409,
    message:
      "That table is full. Write to Reign.Bach@everestcollective.com and we will find you a seat.",
  },
  INVALID_TIER: {
    status: 400,
    message: "That sponsorship tier is no longer available.",
  },
  TIER_FULL: {
    status: 409,
    message:
      "That tier has been taken. Pick another, or call us and we will build one that fits.",
  },
  SOLD_OUT: {
    status: 409,
    message:
      "There are not enough seats left for that. Write to Reign.Bach@everestcollective.com and we will tell you what is actually open.",
  },
  PLUS_ONE_NOT_ALLOWED_ON_THIS_DOOR: {
    status: 400,
    message:
      "Your table already includes seats for your guests, so there is no need to add one here.",
  },
  INVALID_DOOR: { status: 400, message: "Something went wrong. Please start again." },
};

const DOORS = ["seat", "host", "guest", "sponsor"] as const;
type Door = (typeof DOORS)[number];

function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ ok: false, error: message, code }, { status });
}

export async function POST(req: Request) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return fail("We could not read that submission. Please try again.", 400);
  }

  // Honeypot. Real people never fill this; bots fill everything. Return a
  // plausible success so a scraper learns nothing from the difference.
  if (typeof body?.website === "string" && body.website.trim() !== "") {
    return NextResponse.json({ ok: true, data: { reference: "TCG-PENDING" } });
  }

  const door: Door | undefined = DOORS.includes(body?.door) ? body.door : undefined;
  if (!door) return fail("Please choose how you are joining us.", 400);

  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
    return fail("That email address does not look right.", 400);
  }

  const supabase = createServiceClient();

  // Double-submit guard. A second click, a retry, or a back-and-resubmit
  // should not create two people or two charges. If the same address
  // registered through the same door in the last two minutes, hand back what
  // we already saved.
  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data: recent } = await supabase
    .from("gala_registrations")
    .select("reference, status, amount_cents")
    .eq("email", email)
    .eq("door", door)
    .eq("is_plus_one", false)
    .gte("created_at", twoMinutesAgo)
    .limit(1)
    .maybeSingle();

  if (recent) {
    return NextResponse.json({
      ok: true,
      duplicate: true,
      data: {
        reference: recent.reference,
        status: recent.status,
        amount_cents: recent.amount_cents,
        requires_payment: (recent.amount_cents ?? 0) > 0,
      },
    });
  }

  const payload = {
    door,
    first_name: String(body?.first_name ?? "").trim(),
    last_name: String(body?.last_name ?? "").trim(),
    badge_name: body?.badge_name ? String(body.badge_name).trim() : null,
    email,
    mobile: body?.mobile ? String(body.mobile).trim() : null,
    line: String(body?.line ?? "").trim(),
    dietary: body?.dietary ? String(body.dietary).trim() : null,
    accessibility: body?.accessibility ? String(body.accessibility).trim() : null,
    seat_near: body?.seat_near ? String(body.seat_near).trim() : null,
    marketing_opt_in: body?.marketing_opt_in === true,
    code: body?.code ? String(body.code).trim() : null,
    table_name: body?.table_name ? String(body.table_name).trim() : null,
    tier_name: body?.tier_name ? String(body.tier_name).trim() : null,
    company: body?.company ?? null,
    plus_one: body?.plus_one ?? null,
    roster: Array.isArray(body?.roster) ? body.roster.slice(0, 20) : [],
  };

  const { data, error } = await supabase.rpc("register_gala_attendee", { p: payload });

  if (error) {
    const raw = String(error.message ?? "");
    const key = Object.keys(ERRORS).find((k) => raw.includes(k));

    if (key) {
      const { status, message } = ERRORS[key];
      return fail(message, status, key);
    }

    console.error("[gala/register] unmapped database error", {
      door,
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });

    return fail(
      "Something went wrong on our end and your seat was not saved. Nothing was charged. Please try again, or write to Reign.Bach@everestcollective.com.",
      500,
      "UNKNOWN"
    );
  }

  return NextResponse.json({ ok: true, data });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
