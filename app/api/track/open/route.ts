import { NextResponse } from "next/server";
import { createClient as svc } from "@supabase/supabase-js";
import { createClient as srv } from "@/lib/supabaseServer";

/**
 * POST /api/track/open — records a file open.
 *   who   -> the signed-in member (from the session cookie)
 *   what  -> kind + title sent by the client
 *   when  -> now()
 *   where -> Vercel geo headers on this request (city / region / country)
 * Always returns 200 so a tracking failure never disrupts opening a file.
 */
export async function POST(req: Request) {
  try {
    const sb = await srv();
    const { data: auth } = await sb.auth.getUser();
    if (!auth?.user) return NextResponse.json({ ok: false });

    const { slug, kind, fileId, title } = await req.json().catch(() => ({} as any));
    if (!slug || !kind) return NextResponse.json({ ok: false });

    const service = svc(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { data: org } = await service
      .from("organizations")
      .select("id")
      .eq("slug", String(slug))
      .single();
    if (!org) return NextResponse.json({ ok: false });

    const h = req.headers;
    const ip = (h.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    const cityRaw = h.get("x-vercel-ip-city");
    const city = cityRaw ? decodeURIComponent(cityRaw) : null;
    const region = h.get("x-vercel-ip-country-region") || null;
    const country = h.get("x-vercel-ip-country") || null;
    const user_agent = (h.get("user-agent") || "").slice(0, 400) || null;

    await service.from("file_access_events").insert({
      organization_id: org.id,
      user_id: auth.user.id,
      user_email: auth.user.email ?? null,
      file_kind: String(kind).slice(0, 40),
      file_id: fileId ? String(fileId).slice(0, 200) : null,
      file_title: title ? String(title).slice(0, 300) : null,
      ip,
      city,
      region,
      country,
      user_agent,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false });
  }
}
