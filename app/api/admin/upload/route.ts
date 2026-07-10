import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabaseServer";

/**
 * Admin-only file upload into the private portal-files bucket.
 * Path convention: {org-slug}/{timestamp}-{safe-filename}
 * The service key never leaves the server; clients read via signed URLs.
 */
export async function POST(req: Request) {
  try {
    const sb = await createServerClient();
    const { data: auth } = await sb.auth.getUser();
    if (!auth?.user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const { data: profile } = await sb.from("profiles").select("is_everest_admin").eq("id", auth.user.id).single();
    if (!profile?.is_everest_admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const slug = String(form.get("slug") || "");
    if (!file || !slug) return NextResponse.json({ error: "Missing file or slug." }, { status: 400 });
    if (file.size > 50 * 1024 * 1024) return NextResponse.json({ error: "File too large (50 MB max)." }, { status: 400 });

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const storage_path = `${slug}/${Date.now()}-${safeName}`;

    const service = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } },
    );
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error } = await service.storage
      .from("portal-files")
      .upload(storage_path, bytes, { contentType: file.type || "application/octet-stream", upsert: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Photos need a stable URL to store in content JSON — sign for 10 years on request.
    let signed_url: string | null = null;
    if (String(form.get("sign") || "") === "long") {
      const { data: signed } = await service.storage
        .from("portal-files")
        .createSignedUrl(storage_path, 60 * 60 * 24 * 365 * 10);
      signed_url = signed?.signedUrl ?? null;
    }
    return NextResponse.json({ storage_path, signed_url });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Upload failed." }, { status: 500 });
  }
}
