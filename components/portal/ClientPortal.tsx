"use client";

import * as React from "react";
import type {
  PortalIdentity,
  NavGroup,
  NavKey,
  JourneyPhase,
  BuildItem,
  CurrentFocus,
  Session,
  KeyItem,
  ResourceSection,
  LogisticsField,
  Recording,
  InternalNote,
  PortalDoc,
} from "./types";

import Sidebar from "./Sidebar";
import { createClient } from "@/lib/supabaseClient";
import { setKeyItemStatus, setKeyItemPersonalDone } from "@/lib/queries";
import TopBar from "./TopBar";
import OverviewView from "./OverviewView";
import JourneyView from "./JourneyView";
import SessionsView from "./SessionsView";
import KeyItemsList from "./KeyItemsList";
import RecordingsGrid from "./RecordingsGrid";
import ResourceList from "./ResourceList";
import LogisticsPanel from "./LogisticsPanel";
import InternalNotes from "./InternalNotes";
import ReviewDocumentModal from "./ReviewDocumentModal";
import PortalFooter from "./PortalFooter";

/**
 * ClientPortal — the composition shell.
 * Sidebar + sticky TopBar + the active view + review modal + footer.
 * Holds only UI state (active view, selected phase, key-item done flags,
 * open accordion sections, open document). NO data fetching, NO auth.
 *
 * Feed it your real data via props; defaults come from placeholder-data.ts
 * only when the example page passes them in.
 */
export interface ClientPortalProps {
  adminHref?: string; // admin-only ← Command Center link in the sidebar footer
  identity: PortalIdentity;
  navGroups: NavGroup[];
  overviewHero: React.ComponentProps<typeof OverviewView>["hero"];
  currentFocus: CurrentFocus;
  buildItems: BuildItem[];
  journeyPhases: JourneyPhase[];
  lockedTeasers: { num: string; name: string; teaser: string }[];
  sessions: Session[];
  keyItems: KeyItem[];
  resourceSections: ResourceSection[];
  logistics: LogisticsField[];
  recordings: Recording[];
  internalNotes: InternalNote[];
  docs: Record<string, PortalDoc>;
  teamPhoto: string;
  contactEmail: string;         // {contactEmail}
  onSignOut?: () => void;
}

const SCREEN_LABELS: Record<NavKey, string> = {
  overview: "Overview",
  journey: "Engagement Journey",
  sessions: "Working Sessions",
  keyItems: "Key Items",
  recordings: "Recordings",
  resources: "Resources",
  logistics: "Logistics",
  internal: "Team Notes (Internal)",
};

export default function ClientPortal(props: ClientPortalProps) {
  const {
    adminHref,
    identity,
    navGroups,
    overviewHero,
    currentFocus,
    buildItems,
    journeyPhases,
    lockedTeasers,
    sessions,
    resourceSections,
    logistics,
    recordings,
    internalNotes,
    docs,
    teamPhoto,
    contactEmail,
    onSignOut,
  } = props;

  const [view, setView] = React.useState<NavKey>("overview");
  const [selectedPhase, setSelectedPhase] = React.useState(0); // starts at phase 01
  const [openResources, setOpenResources] = React.useState<string[]>(
    resourceSections[0] ? [resourceSections[0].num] : [],
  );
  const [openDocKey, setOpenDocKey] = React.useState<string | null>(null);

  // Key-item done flags kept in local state so the checkboxes are interactive.
  const [keyItems, setKeyItems] = React.useState<KeyItem[]>(props.keyItems);

  const [highlightRec, setHighlightRec] = React.useState<string | null>(null);
  const openCount = keyItems.filter((i) => !i.done).length;

  // Reflect the live "open items" count into the Key Items nav badge.
  const groupsWithCount: NavGroup[] = navGroups.map((g) => ({
    ...g,
    items: g.items.map((it) => (it.key === "keyItems" ? { ...it, count: openCount } : it)),
  }));

  const go = (key: NavKey) => {
    setView(key);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  };

  const supabase = React.useMemo(() => createClient(), []);
  const toggleKeyItem = (id: string) => {
    const target = keyItems.find((it) => it.id === id);
    if (!target) return;
    const nextDone = !target.done;
    setKeyItems((items) =>
      items.map((it) => (it.id === id ? { ...it, done: nextDone, status: nextDone ? "Complete" : "In Progress" } : it)),
    );
    (target.perUser ? setKeyItemPersonalDone(supabase, id, nextDone) : setKeyItemStatus(supabase, id, nextDone)).catch(() => {
      // RLS or network said no — put the checkbox back to the truth
      setKeyItems((items) =>
        items.map((it) => (it.id === id ? { ...it, done: !nextDone, status: target.status } : it)),
      );
    });
  };

  const toggleResource = (num: string) =>
    setOpenResources((open) =>
      open.includes(num) ? open.filter((n) => n !== num) : [...open, num],
    );

  const openDoc = docs[openDocKey ?? ""] ?? null;
  const openDocItem = keyItems.find((i) => i.docKey === openDocKey);

  const markReviewed = () => {
    if (openDocItem) toggleKeyItemDone(openDocItem.id, true);
    setOpenDocKey(null);
  };
  const toggleKeyItemDone = (id: string, done: boolean) => {
    setKeyItems((items) =>
      items.map((it) => (it.id === id ? { ...it, done, status: done ? "Complete" : it.status } : it)),
    );
    const it = keyItems.find((k) => k.id === id);
    (it?.perUser ? setKeyItemPersonalDone(supabase, id, done) : setKeyItemStatus(supabase, id, done)).catch(() => {});
  };

  return (
    <div className="flex min-h-screen">
      <Sidebar
        adminHref={adminHref}
        logoUrl={identity.logoUrl}
        workspaceLabel={identity.workspaceLabel}
        orgName={identity.orgName}
        userName={identity.userName}
        userMeta={identity.userMeta}
        groups={groupsWithCount}
        active={view}
        onNavigate={go}
        onSignOut={onSignOut}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar
          activeLabel={SCREEN_LABELS[view]}
          portalUrl={identity.portalUrl}
          lastUpdated={identity.lastUpdated}
          status={identity.status}
        />

        {view === "overview" && (
          <OverviewView
            hero={overviewHero}
            focus={currentFocus}
            buildItems={buildItems}
            teamPhoto={teamPhoto}
            onViewJourney={() => go("journey")}
          />
        )}

        {view === "journey" && (
          <JourneyView
            phases={journeyPhases}
            lockedTeasers={lockedTeasers}
            selectedIndex={selectedPhase}
            onSelect={setSelectedPhase}
          />
        )}

        {view === "sessions" && (
          <SessionsView sessions={sessions} onOpenResources={() => go("resources")} onViewKeyItems={() => go("keyItems")} onViewRecordings={(num) => { setHighlightRec(num); go("recordings"); }} />
        )}

        {view === "keyItems" && (
          <KeyItemsList items={keyItems} onToggle={toggleKeyItem} onOpenDoc={setOpenDocKey} onJump={(v) => go(v as any)} />
        )}

        {view === "recordings" && <RecordingsGrid recordings={recordings} teamPhoto={teamPhoto} highlightNum={highlightRec} />}

        {view === "resources" && (
          <ResourceList
            sections={resourceSections}
            openNums={openResources}
            onToggle={toggleResource}
          />
        )}

        {view === "logistics" && <LogisticsPanel fields={logistics} />}

        {view === "internal" && <InternalNotes notes={internalNotes} />}

        <PortalFooter
          logoUrl={identity.logoUrl}
          contact={contactEmail}
          lastUpdated={identity.lastUpdated}
        />
      </main>

      <ReviewDocumentModal
        doc={openDoc}
        reviewed={!!openDocItem?.done}
        onClose={() => setOpenDocKey(null)}
        onReview={markReviewed}
      />
    </div>
  );
}
