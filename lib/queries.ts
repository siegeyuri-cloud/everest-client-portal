import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  PortalIdentity,
  NavGroup,
  JourneyPhase,
  PhaseState,
  BuildItem,
  CurrentFocus,
  Session,
  SessionStatus,
  KeyItem,
  KeyItemStatus,
  ResourceSection,
  LogisticsField,
  Recording,
  InternalNote,
  PortalDoc,
} from "@/components/portal/types";

/**
 * ────────────────────────────────────────────────────────────────────
 * STEP 12 — THE TRANSLATION LAYER
 * Fetches rows from Supabase and reshapes them into the exact types
 * the design components consume (components/portal/types.ts).
 *
 * Security note: row-level security (migration 0002) already filters
 * every query by the signed-in user's org membership + role, so these
 * functions never need to re-implement visibility rules. A staff user
 * literally cannot receive an executive-only row.
 *
 * RICH-CONTENT CONVENTION
 * Some design surfaces are richer than a single text column (a journey
 * phase can carry an investment block + deliverables; the overview hero
 * carries multiple paragraphs). Rather than adding columns for every
 * sub-field, rich content is stored as JSON in the existing text
 * columns (journey_phases.body, organizations.description). If the
 * column parses as JSON we use the rich structure; if not, it's
 * treated as plain paragraph text. The admin editors (later steps)
 * write this JSON through forms — no one ever hand-types it.
 * ────────────────────────────────────────────────────────────────────
 */

/* ---------- small helpers ---------- */

const pad2 = (n: number | null | undefined, fallback: number) =>
  String(n ?? fallback).padStart(2, "0");

const fmtDate = (iso: string | null | undefined) =>
  iso
    ? new Date(iso + (iso.length === 10 ? "T00:00:00" : "")).toLocaleDateString(
        "en-US",
        { year: "numeric", month: "long", day: "numeric" },
      )
    : "";

function tryJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  const s = raw.trim();
  if (!s.startsWith("{") && !s.startsWith("[")) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/** Plain text -> PhaseParagraph[], splitting on blank lines. */
function textToParagraphs(raw: string | null | undefined) {
  if (!raw) return [];
  return raw
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text) => ({ text }));
}

/* ---------- status maps (db enum -> design label) ---------- */

const SESSION_STATUS: Record<string, SessionStatus> = {
  upcoming: "Upcoming",
  in_progress: "In Progress",
  complete: "Complete",
};

const KEY_ITEM_STATUS: Record<string, KeyItemStatus> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  complete: "Complete",
};

const PHASE_STATE: Record<string, PhaseState> = {
  available: "available",
  current: "current",
  locked: "locked",
  complete: "available", // completed phases stay clickable/teal on the map
};

/* ---------- organization root ---------- */

export async function getOrgBySlug(sb: SupabaseClient, slug: string) {
  const { data, error } = await sb
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .single();
  if (error) throw error;
  return data;
}

/** Everything the portal needs, in one call. */
export async function getPortalData(sb: SupabaseClient, slug: string) {
  const org = await getOrgBySlug(sb, slug);

  const [
    phases,
    sessions,
    keyItems,
    categories,
    resources,
    logistics,
    notes,
    photos,
  ] = await Promise.all([
    sb.from("journey_phases").select("*").eq("organization_id", org.id).order("sort_order"),
    sb.from("sessions").select("*").eq("organization_id", org.id).order("sort_order"),
    sb.from("key_items").select("*").eq("organization_id", org.id).order("sort_order"),
    sb.from("resource_categories").select("*").eq("organization_id", org.id).eq("is_enabled", true).order("sort_order"),
    sb.from("resources").select("*").eq("organization_id", org.id).order("sort_order"),
    sb.from("logistics").select("*").eq("organization_id", org.id).order("sort_order"),
    sb.from("internal_notes").select("*").eq("organization_id", org.id).order("created_at"),
    sb.from("session_photos").select("*").eq("organization_id", org.id).order("sort_order"),
  ]);

  const err =
    phases.error || sessions.error || keyItems.error || categories.error ||
    resources.error || logistics.error || notes.error || photos.error;
  if (err) throw err;

  return {
    org,
    phases: phases.data ?? [],
    sessions: sessions.data ?? [],
    keyItems: keyItems.data ?? [],
    categories: categories.data ?? [],
    resources: resources.data ?? [],
    logistics: logistics.data ?? [],
    notes: notes.data ?? [],       // RLS: only admins ever receive rows here
    photos: photos.data ?? [],
  };
}

/* ---------- mappers: db row -> design shape ---------- */

type PhaseRich = {
  kicker?: string;
  investIntro?: string;
  investment?: { label: string; amount: string; caption: string };
  investmentVisibility?: "executive" | "all";
  paragraphs?: { lead?: string; text: string }[];
  deliverables?: { n: string; title: string; body: string }[];
  closing?: string;
};

export function mapPhase(row: any, index: number): JourneyPhase {
  const rich = tryJson<PhaseRich>(row.body);
  return {
    num: pad2(row.phase_number, index + 1),
    placement: row.placement ?? "map",
    name: row.title,
    kicker: rich?.kicker ?? row.subtitle ?? undefined,
    state: PHASE_STATE[row.status] ?? (row.is_locked ? "locked" : "available"),
    teaser: row.teaser ?? "",
    paragraphs: rich?.paragraphs ?? textToParagraphs(row.body),
    investIntro: rich?.investIntro,
    investment: rich?.investment,
    investmentVisibility: rich?.investmentVisibility ?? "executive",
    deliverables: rich?.deliverables,
    closing: rich?.closing,
  };
}

export function mapSession(row: any, index: number, keyItems: any[] = []): Session {
  return {
    num: pad2(index + 1, index + 1),
    title: row.title,
    objective: row.objective ?? "",
    date: row.session_date ? fmtDate(row.session_date) : "TBD",
    status: SESSION_STATUS[row.status] ?? "Upcoming",
    actionItemCount: keyItems.filter((k) => k.linked_session_id === row.id).length,
    hasRecording: !!row.recording_resource_id,
    recap: row.recap ?? "",
    photos: Array.isArray(row.photos) ? row.photos : [],
  };
}

export function mapKeyItem(row: any, isAdmin = false, viewerRole = "", myDoneIds: Set<string> = new Set()): KeyItem {
  return {
    id: row.id,
    label: row.title,
    category: row.category ?? "General",
    status: KEY_ITEM_STATUS[row.status] ?? "Not Started",
    required: row.priority === "required",
    done: row.completion_mode === "per_user" ? myDoneIds.has(row.id) : row.status === "complete",
    perUser: row.completion_mode === "per_user",
    docKey: row.linked_resource_id ?? undefined,
    // Clients can only toggle client-actionable items (mirrors the RLS rule),
    // so the UI never offers a write the database would refuse.
    readOnly:
      !isAdmin &&
      (!row.is_client_actionable ||
        ((row.check_role ?? "all") !== "all" && (row.check_role ?? "all") !== viewerRole)),
  };
}

export function mapResourceSections(
  categories: any[],
  resources: any[],
  urls: Record<string, string> = {},
): ResourceSection[] {
  return categories.map((cat, i) => ({
    num: pad2(cat.sort_order || i + 1, i + 1),
    title: cat.title,
    intro: cat.description ?? "",
    items: resources
      .filter((r) => r.category_id === cat.id)
      .map((r, j) => ({
        tone: (j % 2 === 0 ? "teal" : "gold") as "teal" | "gold",
        label: r.title,
        detail: r.description ?? "",
        href: urls[r.id] ?? "",
      })),
  }));
}

export function mapLogistics(rows: any[]): LogisticsField[] {
  return rows.map((r) => ({ label: r.label, value: r.value ?? "" }));
}

export function mapInternalNotes(rows: any[]): InternalNote[] {
  return rows.map((r) => ({ label: r.title ?? "Note", value: r.body ?? "" }));
}

export function mapRecordings(sessions: any[], resources: any[] = []): Recording[] {
  // Every session appears in the library; ones with a linked recording
  // resource are playable, the rest show the locked "posts later" panel.
  return sessions.map((s, i) => ({
    num: pad2(i + 1, i + 1),
    title: s.title,
    note: (() => { const t = (s.recap ?? s.objective ?? "").replace(/\*\*|__|\*/g, "").replace(/^[-\u2022]\s+/gm, "").replace(/\n+/g, " ").trim(); return t.length > 140 ? t.slice(0, 140).trimEnd() + "\u2026" : t; })(),
    duration: "—",
    available: !!s.recording_resource_id,
    url: resources.find((r) => r.id === s.recording_resource_id)?.url ?? "",
    transcriptUrl: (() => { const d = resources.find((r) => r.id === s.recording_resource_id)?.description ?? ""; return d.startsWith("http") ? d : ""; })(),
    lockNote: "Posts after the session",
    hasThumb: !!s.thumbnail_url,
    thumb: s.thumbnail_url ?? "",
  }));
}

/**
 * PortalDoc map for the review modal, keyed by resource id (the same id
 * key_items.linked_resource_id points at, so docKey lines up for free).
 * Storage files get a fresh 1-hour signed URL from the private bucket.
 */
export async function buildDocsMap(
  sb: SupabaseClient,
  resources: any[],
): Promise<Record<string, PortalDoc>> {
  const docs: Record<string, PortalDoc> = {};
  for (const r of resources) {
    if (r.type !== "pdf") continue;
    let url = r.url ?? "";
    if (!url && r.storage_path) {
      const { data } = await sb.storage
        .from("portal-files")
        .createSignedUrl(r.storage_path, 3600);
      url = data?.signedUrl ?? "";
    }
    if (url) docs[r.id] = { key: r.id, title: r.title, pdfUrl: url };
  }
  return docs;
}

type HeroRich = {
  eyebrow?: string;
  subtitle?: string;
  paragraphs?: string[];
  closingLead?: string;
  closingAside?: string;
  focus?: Partial<CurrentFocus>;
  buildItems?: BuildItem[];
};

export function mapIdentityAndOverview(org: any, phases: any[]) {
  const rich = tryJson<HeroRich>(org.description) ?? {};

  const identity: PortalIdentity = {
    orgName: org.name,
    workspaceLabel: org.portal_title ?? "Partnership Workspace",
    portalUrl: `clients.everestcollective.com/${org.slug}`,
    engagementType: org.engagement_type ?? "",
    status: org.status ?? "In Progress",
    lastUpdated: fmtDate(org.updated_at),
    userName: "", // filled by the page from the signed-in profile
    userMeta: "",
    logoUrl: "/assets/logo-horizontal-white.png",
  };

  const hero = {
    eyebrow: rich.eyebrow ?? org.engagement_type ?? "",
    titleLine1: org.name,
    titleLine2: identity.workspaceLabel,
    subtitle: rich.subtitle ?? org.portal_subtitle ?? "",
    paragraphs:
      rich.paragraphs ?? (typeof org.description === "string" && !rich.eyebrow
        ? org.description.split(/\n\s*\n/).filter(Boolean)
        : []),
    closingLead: rich.closingLead ?? "",
    closingAside: rich.closingAside ?? "",
  };

  // Current Focus: derived from the phase map, overridable via description JSON
  const currentIdx = Math.max(0, phases.findIndex((p) => p.status === "current"));
  const current = phases[currentIdx];
  const progressPct = phases.length
    ? Math.round(((currentIdx + 0.5) / phases.length) * 100)
    : 0;

  const focus: CurrentFocus = {
    phase: current?.title ?? "",
    nextStep: rich.focus?.nextStep ?? "",
    owner: rich.focus?.owner ?? "Everest Collective",
    due: rich.focus?.due ?? "",
    progressPct: rich.focus?.progressPct ?? progressPct,
    progressLabel:
      rich.focus?.progressLabel ??
      (current ? `Phase ${currentIdx + 1} of ${phases.length} · ${current.title}` : ""),
    context: rich.focus?.context ?? "",
  };

  // Overview deliverable grid: explicit JSON, else current phase deliverables
  const phaseRich = tryJson<PhaseRich>(current?.body);
  const buildItems: BuildItem[] =
    rich.buildItems?.map((b: any) => ({ ...b, body: b.body ?? b.text ?? "" })) ??
    (phaseRich?.deliverables ?? []).map((d) => ({ title: d.title, body: d.body }));

  return { identity, hero, focus, buildItems };
}

/** Standard nav — Key Items badge count is computed live by ClientPortal. */
export function defaultNavGroups(isAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: "Engagement",
      items: [
        { key: "overview", label: "Overview" },
        { key: "journey", label: "Journey" },
        { key: "sessions", label: "Sessions" },
        { key: "keyItems", label: "Key Items", count: 0 },
      ],
    },
    {
      label: "Library",
      items: [
        { key: "recordings", label: "Recordings" },
        { key: "resources", label: "Resources" },
        { key: "logistics", label: "Logistics" },
      ],
    },
  ];
  if (isAdmin) {
    groups.push({
      label: "Everest Team",
      items: [{ key: "internal", label: "Team Notes" }],
    });
  }
  return groups;
}

/* ---------- writes (used by Step 14+) ---------- */

/** Client-side toggle for a key item (the one write clients may make). */
export async function setKeyItemStatus(
  sb: SupabaseClient,
  id: string,
  done: boolean,
) {
  const { error } = await sb
    .from("key_items")
    .update({ status: done ? "complete" : "in_progress" })
    .eq("id", id);
  if (error) throw error;
}

/** Per-user tick for 'per_user' items — one row per (item, member). */
export async function setKeyItemPersonalDone(
  sb: SupabaseClient,
  id: string,
  done: boolean,
) {
  const { data: auth } = await sb.auth.getUser();
  const uid = auth?.user?.id;
  if (!uid) throw new Error("Not signed in");
  if (done) {
    const { error } = await sb.from("key_item_completions").insert({ key_item_id: id, user_id: uid });
    if (error && !String(error.message).includes("duplicate")) throw error;
  } else {
    const { error } = await sb.from("key_item_completions").delete().eq("key_item_id", id).eq("user_id", uid);
    if (error) throw error;
  }
}

/** Open-links for every resource: external url as-is, uploads get 1-hour signed URLs. */
export async function buildResourceUrls(
  sb: SupabaseClient,
  resources: any[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const r of resources) {
    if (r.url) { out[r.id] = r.url; continue; }
    if (r.storage_path) {
      const { data } = await sb.storage.from("portal-files").createSignedUrl(r.storage_path, 3600);
      if (data?.signedUrl) out[r.id] = data.signedUrl;
    }
  }
  return out;
}
