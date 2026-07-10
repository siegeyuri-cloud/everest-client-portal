import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabaseServer";

/**
 * POST /api/admin/invite — add a member to an organization.
 * Handles both brand-new users (Supabase invite email) and existing users
 * (straight to membership). Admin-only; service key stays server-side.
 */
export async function POST(request: Request) {
  try {
    const { organizationId, email, role } = await request.json();
    if (!organizationId || !email) {
      return NextResponse.json({ error: "organizationId and email are required." }, { status: 400 });
    }
    const safeRole = role === "staff" ? "staff" : "executive";

    // Caller must be an Everest admin.
    const cookieClient = await createServerClient();
    const {
      data: { user },
    } = await cookieClient.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    const { data: profile } = await cookieClient
      .from("profiles")
      .select("is_everest_admin")
      .eq("id", user.id)
      .single();
    if (!profile?.is_everest_admin) return NextResponse.json({ error: "Admins only." }, { status: 403 });

    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Existing user? (profiles mirrors auth users via trigger)
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .maybeSingle();

    let userId: string;
    let message: string;

    if (existing) {
      userId = existing.id;
      message = `${email} already has an account — added to this portal.`;
    } else {
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/set-password`;
      const { data: invite, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo });
      if (invErr || !invite?.user) {
        return NextResponse.json({ error: invErr?.message ?? "Invite failed." }, { status: 500 });
      }
      userId = invite.user.id;
      message = `Invite sent to ${email}.`;
    }

    // Membership (skip if already a member).
    const { data: already } = await admin
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", userId)
      .maybeSingle();
    if (already) {
      return NextResponse.json({ error: "That person is already a member of this portal." }, { status: 409 });
    }

    const { error: memErr } = await admin.from("organization_members").insert({
      organization_id: organizationId,
      user_id: userId,
      role: safeRole,
      status: "active",
    });
    if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

    await admin.from("activity_log").insert({
      organization_id: organizationId,
      actor_id: user.id,
      action: "member_invited",
      entity_type: "organization_member",
      metadata: { email, role: safeRole },
    });

    return NextResponse.json({ ok: true, message });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error." }, { status: 500 });
  }
}
