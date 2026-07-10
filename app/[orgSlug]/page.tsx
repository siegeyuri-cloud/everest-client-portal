"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import ClientPortal from "@/components/portal/ClientPortal";
import type {
  JourneyPhase,
  Session,
  KeyItem,
  ResourceSection,
  LogisticsField,
  Recording,
  InternalNote,
  PortalDoc,
  PortalIdentity,
  NavGroup,
  BuildItem,
  CurrentFocus,
} from "@/components/portal/types";
import {
  getPortalData,
  mapPhase,
  mapSession,
  mapKeyItem,
  mapResourceSections,
  mapLogistics,
  mapInternalNotes,
  buildResourceUrls,
  mapRecordings,
  buildDocsMap,
  mapIdentityAndOverview,
  defaultNavGroups,
  setKeyItemStatus,
} from "@/lib/queries";

/**
 * STEP 13 — THE LIVE PORTAL  (/[orgSlug], e.g. /southern-staffing-group)
 * Auth is enforced by proxy.ts before this page ever renders; row-level
 * security filters every query by the viewer's role. This page just
 * fetches, maps db rows -> design shapes, and renders the design.
 */

type Loaded = {
  identity: PortalIdentity;
  navGroups: NavGroup[];
  isAdmin?: boolean;
  orgDescription?: string | null;
  hero: React.ComponentProps<typeof ClientPortal>["overviewHero"];
  focus: CurrentFocus;
  buildItems: BuildItem[];
  phases: JourneyPhase[];
  sessions: Session[];
  keyItems: KeyItem[];
  resourceSections: ResourceSection[];
  logistics: LogisticsField[];
  recordings: Recording[];
  internalNotes: InternalNote[];
  docs: Record<string, PortalDoc>;
};

export default function OrgPortalPage() {
  const params = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [data, setData] = React.useState<Loaded | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return; // proxy handles the redirect

        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email, is_everest_admin")
          .eq("id", user.id)
          .single();

        const bundle = await getPortalData(supabase, params.orgSlug);
        const { org, phases, sessions, keyItems, categories, resources, logistics, notes } =
          bundle;

        const isAdmin = !!profile?.is_everest_admin;

        // Viewer's role in this org decides whether price blocks render.
        let viewerRole: string | null = null;
        if (!isAdmin) {
          const { data: mem } = await supabase
            .from("organization_members")
            .select("role")
            .eq("organization_id", org.id)
            .eq("user_id", user.id)
            .is("deleted_at", null)
            .maybeSingle();
          viewerRole = mem?.role ?? null;
        }
        const canSeePrice = (vis?: string) =>
          isAdmin || viewerRole === "executive" || vis === "all";
        const { identity, hero, focus, buildItems } = mapIdentityAndOverview(org, phases);
        identity.userName = profile?.full_name || org.name;
        identity.userMeta = profile?.email ?? "";

        const docs = await buildDocsMap(supabase, resources);

        if (cancelled) return;
        setData({
          identity,
          navGroups: defaultNavGroups(isAdmin),
          isAdmin,
          orgDescription: org.description ?? null,
          hero,
          focus,
          buildItems,
          phases: phases.map(mapPhase).map((p: any) =>
            canSeePrice(p.investmentVisibility)
              ? p
              : { ...p, investment: undefined, investIntro: undefined },
          ),
          sessions: sessions.map((row: any, i: number) => mapSession(row, i, keyItems)),
          keyItems: await (async () => {
            const { data: ticks } = await supabase
              .from("key_item_completions")
              .select("key_item_id")
              .eq("user_id", user.id);
            const mine = new Set((ticks ?? []).map((t: any) => t.key_item_id));
            return keyItems
              .filter((k: any) => isAdmin || !k.assigned_user_id || k.assigned_user_id === user.id)
              .map((k) => mapKeyItem(k, isAdmin, viewerRole ?? "", mine));
          })(),
          resourceSections: mapResourceSections(categories, resources, await buildResourceUrls(supabase, resources)),
          logistics: mapLogistics(logistics),
          recordings: mapRecordings(sessions, resources),
          internalNotes: mapInternalNotes(notes),
          docs,
        });
      } catch {
        // Org doesn't exist, or RLS says this user can't see it.
        router.replace("/no-access");
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.orgSlug]);

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-storm">
        <div className="flex flex-col items-center gap-4 animate-fade-up">
          <img
            src="/assets/logo-horizontal-white.png"
            alt="Everest Collective"
            className="h-8 w-auto"
          />
          <span className="font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-ondark-muted">
            Preparing your workspace…
          </span>
        </div>
      </main>
    );
  }

  return (
    <ClientPortal
      identity={data.identity}
      navGroups={data.navGroups}
      adminHref={data.isAdmin ? "/admin" : undefined}
      overviewHero={data.hero}
      currentFocus={data.focus}
      buildItems={data.buildItems}
      journeyPhases={data.phases.filter((p: any) => (p.placement ?? "map") === "map")}
      lockedTeasers={data.phases
        .filter((p: any) => p.placement === "beyond")
        .map((p: any) => ({
          num: p.num,
          name: p.name,
          teaser: p.teaser || "Unlocks as the work progresses.",
        }))}
      sessions={data.sessions}
      keyItems={data.keyItems}
      resourceSections={data.resourceSections}
      logistics={data.logistics}
      recordings={data.recordings}
      internalNotes={data.internalNotes}
      docs={data.docs}
      teamPhoto={(() => { try { return JSON.parse(data.orgDescription ?? "")?.teamPhotoUrl || "/assets/team-session.jpeg"; } catch { return "/assets/team-session.jpeg"; } })()}
      contactEmail="hello@everestcollective.com"
      onSignOut={async () => {
        await supabase.auth.signOut();
        router.replace("/login");
      }}
    />
  );
}
