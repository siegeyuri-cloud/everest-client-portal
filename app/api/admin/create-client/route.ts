import { NextResponse } from "next/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabaseServer";

/**
 * POST /api/admin/create-client
 * Runs entirely server-side. Two clients are used deliberately:
 *  1. Cookie client — identifies the caller and verifies is_everest_admin.
 *  2. Service-role client — performs the creation + invite (bypasses RLS;
 *     the key never leaves the server).
 */

const DEFAULT_JOURNEY = [
  { n: 1, title: "Partnership Setup", subtitle: "Basecamp", status: "available", locked: false,
    teaser: "Agreements signed, contacts confirmed, kickoff scheduled.",
    body: "Agreements signed, leadership contacts confirmed, and the kickoff scheduled. The foundation for everything that follows." },
  { n: 2, title: "Discovery & Assessment", subtitle: "You Are Here", status: "current", locked: false,
    teaser: "The structured discovery period — building an evidence-based picture.",
    body: "A structured discovery period: stakeholder interviews, data review, and a clear-eyed view of the current state before any roadmap." },
  { n: 3, title: "Findings & Priorities", subtitle: null, status: "locked", locked: true,
    teaser: "What the discovery surfaced, and what matters most.",
    body: "The findings from discovery, organized into the priorities that will drive the engagement." },
  { n: 4, title: "Strategy & Roadmap", subtitle: null, status: "locked", locked: true,
    teaser: "The sequenced plan — what to tackle first and why.",
    body: "A sequenced action plan ranking initiatives by impact and feasibility." },
  { n: 5, title: "Implementation Support", subtitle: null, status: "locked", locked: true,
    teaser: "Putting the plan to work, together.",
    body: "Hands-on support as the roadmap moves from paper into the business." },
  { n: 6, title: "Executive Readout", subtitle: null, status: "locked", locked: true,
    teaser: "Findings, recommendations, and the decision on what's next.",
    body: "A presentation of findings and recommendations to leadership, with a documented summary." },
];

const DEFAULT_KEY_ITEMS = [
  { title: "Signed MSA", category: "Legal / Onboarding", priority: "required", actionable: false },
  { title: "Signed NDA", category: "Legal / Onboarding", priority: "required", actionable: false },
  { title: "Confirm leadership contacts", category: "Setup", priority: "normal", actionable: true },
  { title: "Confirm kickoff session", category: "Setup", priority: "normal", actionable: true },
  { title: "Share relevant business context and documents", category: "Discovery", priority: "normal", actionable: true },
  { title: "Schedule stakeholder interviews", category: "Discovery", priority: "normal", actionable: true },
  { title: "Prepare executive readout materials", category: "Readout", priority: "normal", actionable: false },
];

const DEFAULT_CATEGORIES = [
  "Partnership Setup",
  "Signed Agreements",
  "Discovery & Assessment Materials",
  "Stakeholder Interviews",
  "Business Diagnostic",
  "Scoreboards & Metrics",
  "Growth Strategy",
  "Executive Readout",
  "Recommended Engagement Plan",
];

const DEFAULT_LOGISTICS = ["Dates", "Location", "Food", "Room Setup", "Materials", "Attendees"];

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, slug, engagement_type, status, startingPoint, inviteEmail, inviteRole } = body;

    if (!name || !slug) {
      return NextResponse.json({ error: "Name and slug are required." }, { status: 400 });
    }

    // 1. Who is calling? Must be an Everest admin.
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
    if (!profile?.is_everest_admin) {
      return NextResponse.json({ error: "Admins only." }, { status: 403 });
    }

    // 2. Service-role client for the actual work.
    const admin = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Create the organization.
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .insert({
        name,
        slug,
        engagement_type: engagement_type || null,
        status: status || "In Progress",
        portal_title: "Partnership Workspace",
        created_by: user.id,
      })
      .select("id, slug")
      .single();

    if (orgErr) {
      const msg = orgErr.message.includes("duplicate")
        ? `The slug "${slug}" is already taken — pick another.`
        : orgErr.message;
      return NextResponse.json({ error: msg }, { status: 409 });
    }

    // 3. Template records (client-specific copies — editing one client never touches another).
    if (startingPoint === "template") {
      const { error: phaseErr } = await admin.from("journey_phases").insert(
        DEFAULT_JOURNEY.map((p) => ({
          organization_id: org.id,
          phase_number: p.n,
          title: p.title,
          subtitle: p.subtitle,
          status: p.status,
          is_locked: p.locked,
          sort_order: p.n,
          teaser: p.teaser,
          body: p.body,
        })),
      );
      if (phaseErr) throw phaseErr;

      const { data: currentPhase } = await admin
        .from("journey_phases")
        .select("id")
        .eq("organization_id", org.id)
        .eq("status", "current")
        .single();
      if (currentPhase) {
        await admin.from("organizations").update({ current_phase_id: currentPhase.id }).eq("id", org.id);
      }

      const { error: kiErr } = await admin.from("key_items").insert(
        DEFAULT_KEY_ITEMS.map((k) => ({
          organization_id: org.id,
          title: k.title,
          category: k.category,
          status: "not_started",
          priority: k.priority,
          is_client_actionable: k.actionable,
          visibility: "all",
        })),
      );
      if (kiErr) throw kiErr;

      const { error: catErr } = await admin.from("resource_categories").insert(
        DEFAULT_CATEGORIES.map((title, i) => ({
          organization_id: org.id,
          title,
          sort_order: i + 1,
          visibility: title === "Signed Agreements" ? "executive" : "all",
        })),
      );
      if (catErr) throw catErr;

      const { error: logErr } = await admin.from("logistics").insert(
        DEFAULT_LOGISTICS.map((label, i) => ({
          organization_id: org.id,
          label,
          value: "TBD",
          sort_order: i + 1,
        })),
      );
      if (logErr) throw logErr;
    }

    // 4. Optional first invite.
    let invited: string | null = null;
    if (inviteEmail) {
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/set-password`;
      const { data: invite, error: invErr } = await admin.auth.admin.inviteUserByEmail(inviteEmail, {
        redirectTo,
      });
      if (invErr) {
        // Org exists; surface the invite problem without failing the whole creation.
        invited = `Invite failed: ${invErr.message}`;
      } else if (invite?.user) {
        const { error: memErr } = await admin.from("organization_members").insert({
          organization_id: org.id,
          user_id: invite.user.id,
          role: inviteRole === "staff" ? "staff" : "executive",
          status: "active",
        });
        invited = memErr ? `Membership failed: ${memErr.message}` : inviteEmail;
      }
    }

    // 5. Activity log (best-effort).
    await admin.from("activity_log").insert({
      organization_id: org.id,
      actor_id: user.id,
      action: "client_created",
      entity_type: "organization",
      entity_id: org.id,
      metadata: { startingPoint, invited },
    });

    return NextResponse.json({ ok: true, slug: org.slug, invited });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? "Unexpected error." }, { status: 500 });
  }
}
