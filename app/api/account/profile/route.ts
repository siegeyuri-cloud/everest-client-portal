import { NextResponse } from "next/server";
import { createClient as svc } from "@supabase/supabase-js";
import { createClient as srv } from "@/lib/supabaseServer";

/** Self-service profile update: any signed-in user, own row only. */
export async function POST(req: Request) {
  try {
    const sb = await srv();
    const { data: auth } = await sb.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const form = await req.formData();
    const full_name = String(form.get("full_name") || "").slice(0, 120);
    const file = form.get("avatar") as File | null;
    const patch: any = {};
    if (full_name) patch.full_name = full_name;
    if (file && file.size > 0) {
      if (file.size > 5 * 1024 * 1024) return NextResponse.json({ error: "Photo too large (5 MB max)." }, { status: 400 });
      const service = svc(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
      const path = `avatars/${auth.user.id}-${Date.now()}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await service.storage.from("portal-files").upload(path, bytes, { contentType: file.type || "image/jpeg", upsert: true });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      const { data: signed } = await service.storage.from("portal-files").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signed?.signedUrl) patch.avatar_url = signed.signedUrl;
    }
    if (Object.keys(patch).length === 0) return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    const { error } = await sb.from("profiles").update(patch).eq("id", auth.user.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, avatar_url: patch.avatar_url ?? null });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Update failed." }, { status: 500 });
  }
}
