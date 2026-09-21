import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabaseService";

/**
 * POST /api/gala/validate-code
 *
 * Answers "is this code real, and whose table is it" without the codes
 * table ever being readable from a browser. That is the whole point:
 * the old static page had every code sitting in view-source, so anyone
 * could read COLLECTIVE-SARAH and walk in on a comped seat.
 *
 * validate_gala_code() is security definer and granted to anon, so it
 * can answer the question while the table itself stays unreadable.
 *
 * Rate limited by reference to the caller's IP, because a code checker
 * is also a code guesser if you let someone run it ten thousand times.
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, number[]>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);

  // Keep the map from growing without bound on a long-lived instance.
  if (hits.size > 5000) {
    for (const [k, v] of hits) {
      if (v.every((t) => now - t > WINDOW_MS)) hits.delete(k);
    }
  }
  return recent.length > MAX_PER_WINDOW;
}

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { ok: false, valid: false, message: "Too many attempts. Wait a minute and try again." },
      { status: 429 }
    );
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, valid: false, message: "We could not read that." },
      { status: 400 }
    );
  }

  const code = String(body?.code ?? "").trim();
  if (code === "") {
    return NextResponse.json({
      ok: true,
      valid: false,
      message: "Enter the code from your invitation.",
    });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("validate_gala_code", { p_code: code });

  if (error) {
    console.error("[gala/validate-code] rpc failed", error.message);
    return NextResponse.json(
      {
        ok: false,
        valid: false,
        message:
          "Something went wrong on our end. Write to Reign.Bach@everestcollective.com and we will sort it out.",
      },
      { status: 500 }
    );
  }

  // The function returns a single row.
  const row = Array.isArray(data) ? data[0] : data;

  return NextResponse.json({
    ok: true,
    valid: row?.valid === true,
    message: row?.message ?? null,
    hostName: row?.host_name ?? null,
    tableNumber: row?.table_number ?? null,
    seatsRemaining: row?.seats_remaining ?? null,
    comped: row?.comped === true,
  });
}

export async function GET() {
  return NextResponse.json({ ok: false, error: "Method not allowed" }, { status: 405 });
}
