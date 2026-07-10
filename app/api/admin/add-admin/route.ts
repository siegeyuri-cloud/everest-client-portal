import { NextResponse } from "next/server";
import { createClient as svc } from "@supabase/supabase-js";
import { createClient as srv } from "@/lib/supabaseServer";

/** Promote an email to Everest admin. Existing users are flagged instantly;
 *  new ones get an invite email and arrive as admins. Admin-only. */
export async function POST(req: Request) {
  try {
    const sb = await srv();
    const { data: auth } = await sb.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const { data: me } = await sb.from("profiles").select("is_everest_admin").eq("id", auth.user.id).single();
    if (!me?.is_everest_admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

    const { email } = await req.json();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ""))) {
      return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
    }
    const service = svc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
    const { data: existing } = await service.from("profiles").select("id").eq("email", email).maybeSingle();
    if (existing?.id) {
      const { error } = await service.from("profiles").update({ is_everest_admin: true }).eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, mode: "promoted" });
    }
    const site = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
    const { data: invited, error: invErr } = await service.auth.admin.inviteUserByEmail(email, { redirectTo: `${site}/set-password` });
    if (invErr) return NextResponse.json({ error: invErr.message }, { status: 500 });
    if (invited?.user?.id) {
      await service.from("profiles").update({ is_everest_admin: true }).eq("id", invited.user.id);
    }
    return NextResponse.json({ ok: true, mode: "invited" });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Failed." }, { status: 500 });
  }
}
