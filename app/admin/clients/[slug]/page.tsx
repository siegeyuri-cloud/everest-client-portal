"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import PhaseDetail from "@/components/portal/PhaseDetail";
import { flushSync } from "react-dom";
import { mapPhase, mapIdentityAndOverview } from "@/lib/queries";
import OverviewView from "@/components/portal/OverviewView";

/**
 * /admin/clients/[slug], the Portal Editor (Stage A).
 * Working tabs: Overview (org fields) and Members (invite / role / status).
 * Journey, Key Items, Resources, Sessions, Logistics, Notes arrive in later stages.
 */

type Org = {
  id: string;
  name: string;
  slug: string;
  engagement_type: string | null;
  status: string | null;
  portal_title: string | null;
  portal_subtitle: string | null;
  description: string | null;
};

type Phase = {
  id: string;
  phase_number: number;
  title: string;
  subtitle: string | null;
  status: string;
  teaser: string | null;
  body: string | null;
  is_locked: boolean;
  sort_order: number;
  placement: string;
};

type KeyItemRow = {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: string;
  priority: string;
  is_client_actionable: boolean;
  visibility: string;
  linked_session_id: string | null;
  linked_phase_id: string | null;
  linked_resource_id: string | null;
  check_role?: string | null;
  assigned_user_id?: string | null;
  completion_mode?: string | null;
  sort_order?: number | null;
};

type SessionRow = {
  id: string;
  title: string;
  session_date: string | null;
  status: string;
  objective: string | null;
  recap: string | null;
  visibility: string;
  sort_order: number | null;
  recording_resource_id?: string | null;
  thumbnail_url?: string | null;
  fathom_url?: string;
  transcript_url?: string;
  photos?: string[] | null;
};

type LogisticRow = {
  id: string;
  label: string;
  value: string | null;
  sort_order: number;
};

type Member = {
  id: string;
  role: string;
  status: string;
  user_id: string;
  profiles: { full_name: string | null; email: string | null } | null;
};

const TABS = ["Overview", "Members", "Journey", "Sessions", "Key Items", "Recordings", "Resources", "Logistics", "Notes"] as const;
const LIVE_TABS = new Set(["Overview", "Members", "Journey", "Sessions", "Key Items", "Recordings", "Resources", "Logistics", "Notes"]);

const label = "font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75";
const input =
  "w-full rounded bg-paper border border-line-subtle px-3.5 py-2.5 text-[15px] text-ink outline-none transition-shadow duration-200 ease-climb focus:border-teal focus:shadow-focus";
const btnGold =
  "rounded bg-gold px-5 py-2.5 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px disabled:opacity-60 transition-transform duration-150 active:scale-[0.97]";
const btnGhost =
  "rounded border border-line px-3.5 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04] transition-transform duration-150 active:scale-[0.97]";

function recapPreview(text: string): React.ReactNode {
  const inline = (t: string) => {
    const out: React.ReactNode[] = [];
    const re = /(\*\*\*[^*\n]+\*\*\*|\*\*(?:[^*\n]|\*(?!\*))+?\*\*|__(?:[^_\n]|_(?!_))+?__|\*[^\s*][^*\n]*?\*)/g;
    let last = 0, m: RegExpExecArray | null, k = 0;
    while ((m = re.exec(t))) {
      if (m.index > last) out.push(t.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith("***")) out.push(<strong key={k++} className="font-bold text-storm"><em>{tok.slice(3, -3)}</em></strong>);
      else if (tok.startsWith("**")) out.push(<strong key={k++} className="font-bold text-storm">{inline(tok.slice(2, -2))}</strong>);
      else if (tok.startsWith("__")) out.push(<u key={k++}>{tok.slice(2, -2)}</u>);
      else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
      last = m.index + tok.length;
    }
    if (last < t.length) out.push(t.slice(last));
    return out;
  };
  return text.split(/\n\s*\n/).map((para, i) => (
    <span key={i} className={"block" + (i > 0 ? " mt-3" : "")}>
      {para.split("\n").map((ln, j) => {
        const b = ln.match(/^\s*(?:[-\u2022\*])\s+(.*)$/);
        if (b) return (<span key={j} className="flex gap-2 pl-1"><span className="select-none text-gold">{"\u2022"}</span><span className="flex-1">{inline(b[1])}</span></span>);
        return <span key={j} className="block">{inline(ln)}</span>;
      })}
    </span>
  ));
}

export default function ClientEditor() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);

  const [tab, setTab] = React.useState<(typeof TABS)[number]>("Overview");
  const [org, setOrg] = React.useState<Org | null>(null);
  const [members, setMembers] = React.useState<Member[]>([]);
  const [phases, setPhases] = React.useState<Phase[]>([]);
  const [openPhase, setOpenPhase] = React.useState<string | null>(null);
  const [items, setItems] = React.useState<KeyItemRow[]>([]);
  const [openItem, setOpenItem] = React.useState<string | null>(null);
  const [itemsDirty, setItemsDirty] = React.useState(false);
  const [sessionsRows, setSessionsRows] = React.useState<SessionRow[]>([]);
  const [openSession, setOpenSession] = React.useState<string | null>(null);
  const [sessionsDirty, setSessionsDirty] = React.useState(false);
  const [logistics, setLogistics] = React.useState<LogisticRow[]>([]);
  const [logisticsDirty, setLogisticsDirty] = React.useState(false);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);        // unsaved Overview edits
  const [phasesDirty, setPhasesDirty] = React.useState(false); // unsaved Journey edits
  const [showPreview, setShowPreview] = React.useState(false);
  const [openPhasePreviews, setOpenPhasePreviews] = React.useState<Record<string, boolean>>({});
  const [dragPhaseId, setDragPhaseId] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<any[]>([]);
  const [resourcesRows, setResourcesRows] = React.useState<any[]>([]);
  const [resourcesDirty, setResourcesDirty] = React.useState(false);
  const [uploadingId, setUploadingId] = React.useState<string | null>(null);
  const [notesRows, setNotesRows] = React.useState<any[]>([]);
  const [dirtyNoteIds, setDirtyNoteIds] = React.useState<Set<string>>(new Set());
  const [justCreated, setJustCreated] = React.useState<string | null>(null);
  const [orderSaving, setOrderSaving] = React.useState(false);
  const [uploadBusy, setUploadBusy] = React.useState<string | null>(null);
  const recapRef = React.useRef<Record<string, HTMLTextAreaElement | null>>({});
  const [dragSessionId, setDragSessionId] = React.useState<string | null>(null);
  const [sessionOrderDirty, setSessionOrderDirty] = React.useState(false);
  const [sessionOrderSaving, setSessionOrderSaving] = React.useState(false);
  const [dragItemId, setDragItemId] = React.useState<string | null>(null);
  const [itemOrderDirty, setItemOrderDirty] = React.useState(false);
  const [itemOrderSaving, setItemOrderSaving] = React.useState(false);
  const spotlight = (id: string) => {
    setJustCreated(id);
    // scroll to the new row once the reloaded list has rendered it
    let tries = 0;
    const seek = () => {
      const el = document.querySelector(`[data-spot="${id}"]`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
      else if (++tries < 10) setTimeout(seek, 220);
    };
    setTimeout(seek, 220);
    setTimeout(() => setJustCreated((cur) => (cur === id ? null : cur)), 3200);
  };
  const newRing = (id: string) => (justCreated === id ? " ring-2 ring-gold/70 rounded-md animate-fade-up" : "");
  const [previewKey, setPreviewKey] = React.useState(0);
  const [confirmBox, setConfirmBox] = React.useState<{ message: string; onYes: () => void } | null>(null);

  // Invite form
  const [invEmail, setInvEmail] = React.useState("");
  const [invRole, setInvRole] = React.useState<"executive" | "staff">("executive");

  const flash = (msg: string) => {
    setNotice(msg);
    setError(null);
    setTimeout(() => setNotice(null), 3500);
  };
  const fail = (msg: string) => {
    setError(msg);
    setNotice(null);
  };

  const editOrg = (patch: Partial<Org>) => {
    setOrg((o) => (o ? { ...o, ...patch } : o));
    setDirty(true);
  };
  const editPhase = (id: string, patch: Partial<Phase>) => {
    setPhases((ps) => ps.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setPhasesDirty(true);
  };

  const reloadOrg = React.useCallback(
    async (orgId: string) => {
      const { data } = await supabase
        .from("organizations")
        .select("id, name, slug, engagement_type, status, portal_title, portal_subtitle, description")
        .eq("id", orgId)
        .single();
      if (data) setOrg(data);
    },
    [supabase],
  );

  function discardEdits() {
    // Leaving without saving = the edits never happened. Reload every
    // section from the database so memory matches truth.
    setDirty(false);
    setPhasesDirty(false);
    setItemsDirty(false);
    setLogisticsDirty(false);
    setSessionsDirty(false);
    setResourcesDirty(false);
    setDirtyNoteIds(new Set());
    if (org) {
      reloadOrg(org.id);
      loadPhases(org.id);
      loadItems(org.id);
      loadSessions(org.id);
      loadLogistics(org.id);
      loadResources(org.id);
      reloadNotes();
    }
  }

  function switchTab(t: (typeof TABS)[number]) {
    if (dirty || phasesDirty || itemsDirty || logisticsDirty || sessionsDirty || sessionOrderDirty || itemOrderDirty || resourcesDirty || dirtyNoteIds.size > 0) {
      setConfirmBox({
        message: "You have unsaved changes. Leave this tab without saving?",
        onYes: () => {
          discardEdits();
          setTab(t);
        },
      });
      return;
    }
    setTab(t);
  }

  // Browser-level guard: refresh/close with unsaved edits triggers Chrome's warning.
  React.useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty || phasesDirty || itemsDirty || logisticsDirty || sessionsDirty || sessionOrderDirty || itemOrderDirty || resourcesDirty || dirtyNoteIds.size > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, phasesDirty, itemsDirty, logisticsDirty, sessionsDirty]);

  const loadPhases = React.useCallback(
    async (orgId: string) => {
      const { data } = await supabase
        .from("journey_phases")
        .select("id, phase_number, title, subtitle, status, teaser, body, is_locked, sort_order, placement")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true });
      setPhases((data as any) ?? []);
    },
    [supabase],
  );

  const loadItems = React.useCallback(
    async (orgId: string) => {
      const { data } = await supabase
        .from("key_items")
        .select("id, title, description, category, status, priority, is_client_actionable, visibility, linked_session_id, linked_phase_id, linked_resource_id, check_role, assigned_user_id, completion_mode, sort_order")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true });
      setItems((data as any) ?? []);
    },
    [supabase],
  );

  const loadLogistics = React.useCallback(
    async (orgId: string) => {
      const { data } = await supabase
        .from("logistics")
        .select("id, label, value, sort_order")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true });
      setLogistics((data as any) ?? []);
    },
    [supabase],
  );

  const loadSessions = React.useCallback(
    async (orgId: string) => {
      const { data } = await supabase
        .from("sessions")
        .select("id, title, session_date, status, objective, recap, visibility, sort_order, recording_resource_id, thumbnail_url, photos")
        .eq("organization_id", orgId)
        .order("sort_order", { ascending: true });
      setSessionsRows(((data as any) ?? []).map((row: any) => ({ ...row, fathom_url: "", transcript_url: "" })));
    },
    [supabase],
  );

  const loadMembers = React.useCallback(
    async (orgId: string) => {
      const { data } = await supabase
        .from("organization_members")
        .select("id, role, status, user_id, profiles(full_name, email)")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });
      setMembers((data as any) ?? []);
    },
    [supabase],
  );

  React.useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_everest_admin")
        .eq("id", user.id)
        .single();
      if (!profile?.is_everest_admin) {
        router.replace("/no-access");
        return;
      }
      const { data: organization } = await supabase
        .from("organizations")
        .select("id, name, slug, engagement_type, status, portal_title, portal_subtitle, description")
        .eq("slug", slug)
        .single();
      if (!organization) {
        router.replace("/admin");
        return;
      }
      setOrg(organization);
      loadMembers(organization.id);
      loadPhases(organization.id);
      loadItems(organization.id);
      loadLogistics(organization.id);
      loadSessions(organization.id);
      loadResources(organization.id);
      supabase.from("internal_notes").select("id, title, body, created_at").eq("organization_id", organization.id).order("created_at").then(({ data }) => setNotesRows((data as any) ?? []));
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const loadResources = React.useCallback(
    async (orgId: string) => {
      const [cats, res] = await Promise.all([
        supabase.from("resource_categories").select("id, title, description, sort_order, is_enabled").eq("organization_id", orgId).order("sort_order"),
        supabase.from("resources").select("id, category_id, title, description, type, url, storage_path, sort_order").eq("organization_id", orgId).order("sort_order"),
      ]);
      setCategories((cats.data as any) ?? []);
      setResourcesRows((res.data as any) ?? []);
    },
    [supabase],
  );

  async function savePhase(p: Phase) {
    const { error } = await supabase
      .from("journey_phases")
      .update({
        title: p.title,
        subtitle: p.subtitle,
        teaser: p.teaser,
        body: p.body,
        status: p.status,
        is_locked: p.status === "locked" || p.placement === "beyond",
        placement: p.placement ?? "map",
      })
      .eq("id", p.id);
    if (error) fail(error.message);
    else {
      flash("Phase saved.");
      setPhasesDirty(false);
    }
    if (org) loadPhases(org.id);
  }

  async function makeCurrent(p: Phase) {
    if (!org) return;
    // Demote any existing current phase to available, promote this one.
    const { error: demoteErr } = await supabase
      .from("journey_phases")
      .update({ status: "available", is_locked: false })
      .eq("organization_id", org.id)
      .eq("status", "current");
    const { error: promoteErr } = await supabase
      .from("journey_phases")
      .update({ status: "current", is_locked: false })
      .eq("id", p.id);
    const { error: orgErr } = await supabase
      .from("organizations")
      .update({ current_phase_id: p.id })
      .eq("id", org.id);
    const err = demoteErr ?? promoteErr ?? orgErr;
    err ? fail(err.message) : flash(`"${p.title}" is now the current phase.`);
    loadPhases(org.id);
  }

  async function addPhase() {
    if (!org) return;
    const nextNum = phases.length ? Math.max(...phases.map((p) => p.phase_number)) + 1 : 1;
    const { data: created, error } = await supabase.from("journey_phases").insert({
      organization_id: org.id,
      phase_number: nextNum,
      title: `New Phase ${nextNum}`,
      status: phases.length === 0 ? "current" : "locked",
      is_locked: phases.length !== 0,
      sort_order: nextNum,
      teaser: "",
      body: "",
      placement: "map",
    }).select("id").single();
    error ? fail(error.message) : flash("Phase added. Click it to edit.");
    loadPhases(org.id);
    if (created?.id) { setOpenPhase(created.id); spotlight(created.id); }
  }

  async function movePhase(p: Phase, dir: -1 | 1) {
    const idx = phases.findIndex((x) => x.id === p.id);
    const other = phases[idx + dir];
    if (!other || !org) return;
    await supabase.from("journey_phases").update({ sort_order: other.sort_order, phase_number: other.phase_number }).eq("id", p.id);
    await supabase.from("journey_phases").update({ sort_order: p.sort_order, phase_number: p.phase_number }).eq("id", other.id);
    loadPhases(org.id);
  }

  function deletePhase(p: Phase) {
    if (!org) return;
    setConfirmBox({
      message: `Delete phase “${p.title}”? This can’t be undone.`,
      onYes: async () => {
        const { error } = await supabase.from("journey_phases").delete().eq("id", p.id);
        error ? fail(error.message) : flash("Phase deleted.");
        loadPhases(org.id);
      },
    });
  }

  const editItem = (id: string, patch: Partial<KeyItemRow>) => {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setItemsDirty(true);
  };

  async function saveItem(it: KeyItemRow) {
    const { error } = await supabase
      .from("key_items")
      .update({
        title: it.title,
        description: it.description,
        category: it.category,
        status: it.status,
        priority: it.priority,
        linked_resource_id: it.linked_resource_id ?? null,
        check_role: (it as any).check_role ?? "all",
        assigned_user_id: (it as any).assigned_user_id ?? null,
        completion_mode: (it as any).completion_mode ?? "shared",
        is_client_actionable: it.is_client_actionable,
        visibility: it.visibility,
        linked_session_id: it.linked_session_id,
        linked_phase_id: it.linked_phase_id,
      })
      .eq("id", it.id);
    if (error) fail(error.message);
    else {
      flash("Key item saved.");
      setItemsDirty(false);
    }
    if (org) loadItems(org.id);
  }

  async function addItem() {
    if (!org) return;
    const { data: created, error } = await supabase.from("key_items").insert({
      organization_id: org.id,
      title: "New key item",
      status: "not_started",
      priority: "normal",
      is_client_actionable: true,
      visibility: "all",
      sort_order: items.length ? Math.max(...items.map((x: any) => x.sort_order || 0)) + 1 : 1,
    }).select("id").single();
    error ? fail(error.message) : flash("Key item added. Click it to edit.");
    loadItems(org.id);
    if (created?.id) { setOpenItem(created.id); spotlight(created.id); }
  }

  function deleteItem(it: KeyItemRow) {
    if (!org) return;
    setConfirmBox({
      message: `Delete key item “${it.title}”? This can’t be undone.`,
      onYes: async () => {
        const { error } = await supabase.from("key_items").delete().eq("id", it.id);
        error ? fail(error.message) : flash("Key item deleted.");
        loadItems(org.id);
      },
    });
  }

  const editSession = (id: string, patch: Partial<SessionRow>) => {
    setSessionsRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setSessionsDirty(true);
  };

  async function saveSession(sr: SessionRow) {
    // Fathom URL -> auto-managed hidden resource (created/updated/cleared here, never in the Resources tab)
    let recId = sr.recording_resource_id ?? null;
    const fathom = (sr as any).fathom_url?.trim?.() ?? "";
    if (fathom) {
      if (recId) {
        await supabase.from("resources").update({ url: fathom, title: `${sr.title} \u2014 recording` }).eq("id", recId);
      } else {
        const { data: created, error: cErr } = await supabase
          .from("resources")
          .insert({ organization_id: org!.id, category_id: null, title: `${sr.title} \u2014 recording`, description: "Session recording (Fathom)", type: "recording", url: fathom, storage_path: null, sort_order: 999 })
          .select("id").single();
        if (cErr) return fail(cErr.message);
        recId = created!.id;
      }
    } else if (recId && !sr.recording_resource_id) {
      recId = null;
    }
    const transcript = (sr as any).transcript_url?.trim?.() ?? "";
    if (recId && transcript) {
      await supabase.from("resources").update({ description: transcript }).eq("id", recId);
    }
    const { error } = await supabase
      .from("sessions")
      .update({
        title: sr.title,
        session_date: sr.session_date || null,
        status: sr.status,
        objective: sr.objective,
        recap: sr.recap,
        visibility: sr.visibility,
        recording_resource_id: recId,
        thumbnail_url: sr.thumbnail_url || null,
        photos: sr.photos ?? [],
      })
      .eq("id", sr.id);
    if (error) fail(error.message);
    else {
      flash("Session saved.");
      setSessionsDirty(false);
      if (org) { loadSessions(org.id); loadResources(org.id); }
    }
    if (org) loadSessions(org.id);
  }

  async function addSession() {
    if (!org) return;
    const next = sessionsRows.length ? Math.max(...sessionsRows.map((x) => x.sort_order ?? 0)) + 1 : 1;
    const { data: created, error } = await supabase.from("sessions").insert({
      organization_id: org.id,
      title: `Session ${next}`,
      status: "upcoming",
      visibility: "all",
      sort_order: next,
    }).select("id").single();
    error ? fail(error.message) : flash("Session added. Click it to edit.");
    loadSessions(org.id);
    if (created?.id) { setOpenSession(created.id); spotlight(created.id); }
  }

  function deleteSession(sr: SessionRow) {
    if (!org) return;
    setConfirmBox({
      message: `Delete session “${sr.title}”? This can’t be undone.`,
      onYes: async () => {
        const { error } = await supabase.from("sessions").delete().eq("id", sr.id);
        error ? fail(error.message) : flash("Session deleted.");
        loadSessions(org.id);
      },
    });
  }

  const editLogistic = (id: string, patch: Partial<LogisticRow>) => {
    setLogistics((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    setLogisticsDirty(true);
  };

  async function saveLogistics() {
    if (!org) return;
    for (const row of logistics) {
      const { error } = await supabase
        .from("logistics")
        .update({ label: row.label, value: row.value, sort_order: row.sort_order })
        .eq("id", row.id);
      if (error) {
        fail(error.message);
        return;
      }
    }
    flash("Logistics saved.");
    setLogisticsDirty(false);
    loadLogistics(org.id);
  }

  async function addLogistic() {
    if (!org) return;
    const next = logistics.length ? Math.max(...logistics.map((l) => l.sort_order)) + 1 : 1;
    const { error } = await supabase
      .from("logistics")
      .insert({ organization_id: org.id, label: "New field", value: "TBD", sort_order: next });
    error ? fail(error.message) : flash("Logistics field added.");
    loadLogistics(org.id);
  }

  function deleteLogistic(row: LogisticRow) {
    if (!org) return;
    setConfirmBox({
      message: `Delete logistics field “${row.label}”?`,
      onYes: async () => {
        const { error } = await supabase.from("logistics").delete().eq("id", row.id);
        error ? fail(error.message) : flash("Field deleted.");
        loadLogistics(org.id);
      },
    });
  }

  async function saveOverview(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setBusy(true);
    const { error } = await supabase
      .from("organizations")
      .update({
        name: org.name,
        engagement_type: org.engagement_type,
        status: org.status,
        portal_title: org.portal_title,
        portal_subtitle: org.portal_subtitle,
        description: org.description,
        updated_at: new Date().toISOString(),
      })
      .eq("id", org.id);
    setBusy(false);
    if (error) fail(error.message);
    else {
      flash("Overview saved.");
      setDirty(false);
    }
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!org || !invEmail.trim()) return;
    if (!/^\S+@\S+\.\S+$/.test(invEmail.trim())) {
      fail("That doesn’t look like an email address. Try something like name@company.com.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/admin/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: org.id, email: invEmail.trim(), role: invRole }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Invite failed.");
      setInvEmail("");
      flash(json.message ?? "Invite sent.");
      loadMembers(org.id);
    } catch (err: any) {
      fail(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setRole(m: Member, role: string) {
    const { error } = await supabase.from("organization_members").update({ role }).eq("id", m.id);
    error ? fail(error.message) : flash("Role updated.");
    if (org) loadMembers(org.id);
  }

  async function toggleStatus(m: Member) {
    const next = m.status === "disabled" ? "active" : "disabled";
    const { error } = await supabase.from("organization_members").update({ status: next }).eq("id", m.id);
    error ? fail(error.message) : flash(next === "disabled" ? "Member disabled." : "Member re-enabled.");
    if (org) loadMembers(org.id);
  }

  if (!org) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-snow font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-slate-50">
        Loading editor…
      </div>
    );
  }

  function reorderSessionOver(targetId: string) {
    if (!dragSessionId || dragSessionId === targetId) return;
    const apply = () =>
      flushSync(() =>
        setSessionsRows((prev) => {
          const list = [...prev];
          const from = list.findIndex((x) => x.id === dragSessionId);
          const to = list.findIndex((x) => x.id === targetId);
          if (from < 0 || to < 0 || from === to) return prev;
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          return list.map((x, idx) => ({ ...x, sort_order: idx + 1 }));
        })
      );
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(apply);
    } else apply();
    setSessionOrderDirty(true);
  }

  async function saveSessionOrder() {
    if (!org) return;
    setSessionOrderSaving(true);
    const w1 = await Promise.all(sessionsRows.map((x) => supabase.from("sessions").update({ sort_order: (x.sort_order ?? 0) + 1000 }).eq("id", x.id)));
    const e1 = w1.find((r) => r.error);
    if (e1?.error) { setSessionOrderSaving(false); return fail(e1.error.message); }
    const w2 = await Promise.all(sessionsRows.map((x) => supabase.from("sessions").update({ sort_order: x.sort_order ?? 0 }).eq("id", x.id)));
    const e2 = w2.find((r) => r.error);
    if (e2?.error) { setSessionOrderSaving(false); return fail(e2.error.message); }
    flash("Order saved.");
    setSessionOrderDirty(false);
    setSessionOrderSaving(false);
    loadSessions(org.id);
  }

  function reorderItemOver(targetId: string) {
    if (!dragItemId || dragItemId === targetId) return;
    const apply = () =>
      flushSync(() =>
        setItems((prev) => {
          const list = [...prev];
          const from = list.findIndex((x) => x.id === dragItemId);
          const to = list.findIndex((x) => x.id === targetId);
          if (from < 0 || to < 0 || from === to) return prev;
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          return list.map((x, idx) => ({ ...x, sort_order: idx + 1 }));
        })
      );
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(apply);
    } else apply();
    setItemOrderDirty(true);
  }

  async function saveItemOrder() {
    if (!org) return;
    setItemOrderSaving(true);
    const w1 = await Promise.all(items.map((x: any) => supabase.from("key_items").update({ sort_order: (x.sort_order || 0) + 1000 }).eq("id", x.id)));
    const e1 = w1.find((r) => r.error);
    if (e1?.error) { setItemOrderSaving(false); return fail(e1.error.message); }
    const w2 = await Promise.all(items.map((x: any) => supabase.from("key_items").update({ sort_order: x.sort_order }).eq("id", x.id)));
    const e2 = w2.find((r) => r.error);
    if (e2?.error) { setItemOrderSaving(false); return fail(e2.error.message); }
    flash("Order saved.");
    setItemOrderDirty(false);
    setItemOrderSaving(false);
    loadItems(org.id);
  }

  async function uploadThumb(lane: string, file: File, apply: (url: string) => void) {
    if (!org) return fail("Portal still loading, try again in a second.");
    setUploadBusy(lane);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", org.slug);
      fd.append("sign", "long");
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Upload failed (${res.status})`);
      const url = json.signed_url || json.url || json.signedUrl;
      if (!url) throw new Error("Upload succeeded but no URL came back.");
      apply(url);
      flash("Photo uploaded.");
    } catch (err: any) {
      console.error("Upload error:", err);
      fail(err?.message ?? "Upload failed.");
    } finally {
      setUploadBusy(null);
    }
  }
  function smartWrap(t: string, a0: number, b0: number, marker: string) {
    // trim selection edges so markers hug text; toggle off if already wrapped
    let a = a0, b = b0;
    while (a < b && /\s/.test(t[a])) a++;
    while (b > a && /\s/.test(t[b - 1])) b--;
    const sel = t.slice(a, b);
    const before = t.slice(0, a), after = t.slice(b);
    if ((() => { const ch = marker[0]; let l = 0; while (l < before.length && before[before.length - 1 - l] === ch) l++; let r = 0; while (r < after.length && after[r] === ch) r++; return l >= marker.length && r >= marker.length && !(marker === "*" && l === 2 && r === 2); })()) {
      // unwrap (toggle)
      return { next: before.slice(0, -marker.length) + sel + after.slice(marker.length), s: a - marker.length, e: b - marker.length };
    }
    if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length >= marker.length * 2) {
      const inner = sel.slice(marker.length, sel.length - marker.length);
      return { next: before + inner + after, s: a, e: a + inner.length };
    }
    const body = sel || "text";
    return { next: before + marker + body + marker + after, s: a + marker.length, e: a + marker.length + body.length };
  }

  function wrapRecap(sr: SessionRow, marker: string) {
    const ta = recapRef.current[sr.id];
    if (!ta) return;
    const t = sr.recap ?? "";
    const { next, s, e: e2 } = smartWrap(t, ta.selectionStart ?? t.length, ta.selectionEnd ?? t.length, marker);
    editSession(sr.id, { recap: next });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s, e2); });
  }

  async function saveOrder() {
    if (!org) return;
    setOrderSaving(true);
    // Two parallel waves instead of one-by-one: every write in a wave targets a
    // distinct value, so even a unique constraint can't collide, and the whole
    // save is ~2 round-trips instead of 2×N.
    const wave1 = await Promise.all(
      phases.map((ph) => supabase.from("journey_phases").update({ sort_order: ph.sort_order + 1000 }).eq("id", ph.id)),
    );
    const e1 = wave1.find((r) => r.error);
    if (e1?.error) { setOrderSaving(false); return fail(e1.error.message); }
    const wave2 = await Promise.all(
      phases.map((ph) =>
        supabase.from("journey_phases").update({ sort_order: ph.sort_order, phase_number: ph.phase_number }).eq("id", ph.id),
      ),
    );
    const e2 = wave2.find((r) => r.error);
    if (e2?.error) { setOrderSaving(false); return fail(e2.error.message); }
    flash("Order saved.");
    setPhasesDirty(false);
    setOrderSaving(false);
    loadPhases(org.id);
  }

  function reorderPhaseOver(targetId: string) {
    if (!dragPhaseId || dragPhaseId === targetId) return;
    const apply = () =>
      flushSync(() =>
        setPhases((prev) => {
          const list = [...prev];
          const from = list.findIndex((x) => x.id === dragPhaseId);
          const to = list.findIndex((x) => x.id === targetId);
          if (from < 0 || to < 0 || from === to) return prev;
          const [moved] = list.splice(from, 1);
          list.splice(to, 0, moved);
          return list.map((x, idx) => ({ ...x, phase_number: idx + 1, sort_order: idx + 1 }));
        })
      );
    // Animate the shuffle with View Transitions when the browser supports it
    if (typeof document !== "undefined" && (document as any).startViewTransition) {
      (document as any).startViewTransition(apply);
    } else {
      apply();
    }
    setPhasesDirty(true);
  }

  const editCat = (id: string, patch: any) => { setCategories((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))); setResourcesDirty(true); };
  const editRes = (id: string, patch: any) => { setResourcesRows((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x))); setResourcesDirty(true); };

  async function saveResources() {
    if (!org) return;
    for (const c of categories) {
      const { error } = await supabase.from("resource_categories").update({ title: c.title, description: c.description, sort_order: c.sort_order }).eq("id", c.id);
      if (error) return fail(error.message);
    }
    for (const r of resourcesRows) {
      const { error } = await supabase.from("resources").update({ title: r.title, description: r.description, category_id: r.category_id, type: r.type, url: r.url, storage_path: r.storage_path, sort_order: r.sort_order }).eq("id", r.id);
      if (error) return fail(error.message);
    }
    flash("Resources saved.");
    setResourcesDirty(false);
    loadResources(org.id);
  }

  async function addCategory() {
    if (!org) return;
    const next = categories.length ? Math.max(...categories.map((c) => c.sort_order || 0)) + 1 : 1;
    const { data: created, error } = await supabase.from("resource_categories").insert({ organization_id: org.id, title: "New category", description: "", sort_order: next, is_enabled: true }).select("id").single();
    error ? fail(error.message) : flash("Category added.");
    loadResources(org.id);
    if (created?.id) { spotlight(created.id); }
  }

  function deleteCategory(c: any) {
    if (!org) return;
    setConfirmBox({
      message: `Delete category \u201c${c.title}\u201d? Resources inside it keep existing but lose their category.`,
      onYes: async () => {
        const { error } = await supabase.from("resource_categories").delete().eq("id", c.id);
        error ? fail(error.message) : flash("Category deleted.");
        loadResources(org.id);
      },
    });
  }

  async function addResource() {
    if (!org) return;
    const next = resourcesRows.length ? Math.max(...resourcesRows.map((r) => r.sort_order || 0)) + 1 : 1;
    const { data: created, error } = await supabase.from("resources").insert({ organization_id: org.id, category_id: categories[0]?.id ?? null, title: "New resource", description: "", type: "pdf", url: "", storage_path: null, sort_order: next }).select("id").single();
    error ? fail(error.message) : flash("Resource added.");
    loadResources(org.id);
    if (created?.id) { spotlight(created.id); }
  }

  function deleteResource(r: any) {
    if (!org) return;
    setConfirmBox({
      message: `Delete resource \u201c${r.title}\u201d? Any key items pointing at it lose their document link.`,
      onYes: async () => {
        const { error } = await supabase.from("resources").delete().eq("id", r.id);
        error ? fail(error.message) : flash("Resource deleted.");
        loadResources(org.id);
      },
    });
  }

  async function uploadResourceFile(resourceId: string, file: File) {
    if (!org) return;
    setUploadingId(resourceId);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("slug", org.slug);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Upload failed");
      editRes(resourceId, { storage_path: json.storage_path, url: "" });
      flash("File uploaded \u2014 hit Save resources to publish it.");
    } catch (err: any) {
      fail(err.message);
    } finally {
      setUploadingId(null);
    }
  }

  async function reloadNotes() {
    if (!org) return;
    const { data } = await supabase.from("internal_notes").select("id, title, body, created_at").eq("organization_id", org.id).order("created_at");
    setNotesRows((data as any) ?? []);
  }
  async function addNote() {
    if (!org) return;
    const { data: created, error } = await supabase.from("internal_notes").insert({ organization_id: org.id, title: "New note", body: "" }).select("id").single();
    error ? fail(error.message) : flash("Note added.");
    reloadNotes();
    if (created?.id) { spotlight(created.id); }
  }
  async function saveNote(n: any) {
    const { error } = await supabase.from("internal_notes").update({ title: n.title, body: n.body }).eq("id", n.id);
    if (error) fail(error.message);
    else {
      flash("Note saved.");
      setDirtyNoteIds((d) => { const nd = new Set(d); nd.delete(n.id); return nd; });
    }
  }
  function deleteNote(n: any) {
    setConfirmBox({
      message: `Delete note \u201c${n.title}\u201d? Clients never saw it; your team will miss it.`,
      onYes: async () => {
        const { error } = await supabase.from("internal_notes").delete().eq("id", n.id);
        error ? fail(error.message) : flash("Note deleted.");
        reloadNotes();
      },
    });
  }

  function renderLivePreview(sectionDirty: boolean, saveLabel: string) {
    return (
      <div className="mt-6 flex flex-col gap-2 border-t border-line-subtle pt-5">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => setShowPreview((v) => !v)} className={btnGhost}>
            {showPreview ? "Hide live preview" : "Show live preview"}
          </button>
          {showPreview && (
            <button
              type="button"
              onClick={() => {
                if (sectionDirty) {
                  setConfirmBox({
                    message: `You have unsaved changes. The preview only shows saved data, so hit ${saveLabel} first, then refresh.`,
                    onYes: () => setConfirmBox(null),
                  });
                  return;
                }
                setPreviewKey((k) => k + 1);
              }}
              className={btnGhost}
            >
              ↻ Refresh preview
            </button>
          )}
          <span className="text-[12px] italic text-slate-50">Shows saved data. {saveLabel}, then refresh.</span>
        </div>
        {showPreview && (
          <iframe
            key={previewKey}
            src={`/${org?.slug ?? ""}`}
            title="Client portal preview"
            className="h-[640px] w-full rounded-lg border border-line-subtle bg-storm shadow-sm animate-fade-up"
          />
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-snow">
      <header className="bg-storm">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-9 py-6">
          <div className="flex items-center gap-4">
            <img src="/assets/logo-horizontal-white.png" alt="Everest Collective" className="h-7 w-auto" />
            <span className="border-l border-ondark-line pl-4 font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold">
              Portal Editor
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href={`/${org.slug}`} onClick={(e) => { if (dirty || phasesDirty || itemsDirty || logisticsDirty || sessionsDirty || sessionOrderDirty || itemOrderDirty || resourcesDirty || dirtyNoteIds.size > 0) { e.preventDefault(); setConfirmBox({ message: "You have unsaved changes. Leave the editor without saving?", onYes: () => router.push(`/${org.slug}`) }); } }} className="font-condensed text-[12px] font-bold uppercase tracking-wide text-ondark-muted transition-colors duration-200 ease-climb hover:text-teal">
              View portal →
            </Link>
            <Link href="/admin" onClick={(e) => { if (dirty || phasesDirty || itemsDirty || logisticsDirty || sessionsDirty || sessionOrderDirty || itemOrderDirty || resourcesDirty || dirtyNoteIds.size > 0) { e.preventDefault(); setConfirmBox({ message: "You have unsaved changes. Leave the editor without saving?", onYes: () => router.push("/admin") }); } }} className="font-condensed text-[12px] font-bold uppercase tracking-wide text-ondark-muted transition-colors duration-200 ease-climb hover:text-gold">
              ← All clients
            </Link>
          </div>
        </div>
      </header>

      <main key={tab} className="mx-auto max-w-[1080px] animate-fade-up px-9 pb-16 pt-10">
        {/* Motion tuning: silkier drag-reorder glide via View Transitions timing */}
        <style>{`
          ::view-transition-group(*) {
            animation-duration: 340ms;
            animation-timing-function: cubic-bezier(0.22, 0.61, 0.36, 1);
          }
        `}</style>
        <div className="flex flex-col gap-3.5 pb-7">
          <div className="h-1 w-11 bg-gold" />
          <div className="font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold-deep">
            Editing
          </div>
          <h1 className="font-display text-[clamp(24px,3vw,34px)] uppercase leading-[1.1] tracking-display text-storm">
            {org.name}
          </h1>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1 border-b border-line-subtle pb-0">
          {TABS.map((t) => {
            const live = LIVE_TABS.has(t);
            const active = tab === t;
            return (
              <button
                key={t}
                disabled={!live}
                onClick={() => live && switchTab(t)}
                title={live ? undefined : "Coming in the next stage"}
                className={[
                  "-mb-px border-b-2 px-4 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-label transition-colors duration-200 ease-climb",
                  active
                    ? "border-gold text-storm"
                    : live
                      ? "border-transparent text-slate-50 hover:text-storm"
                      : "cursor-not-allowed border-transparent text-slate-25",
                ].join(" ")}
              >
                {t}
                {!live && <span className="ml-1.5 text-[9px] tracking-normal">soon</span>}
              </button>
            );
          })}
        </div>

        {/* Feedback */}
        {(notice || error) && (
          <div
            className={[
              "mt-5 flex items-center gap-2.5 rounded border px-3.5 py-3 animate-fade-up",
              error ? "border-error-line bg-error-bg" : "border-teal bg-teal-50",
            ].join(" ")}
          >
            <span className={["h-2 w-2 flex-none rounded-full", error ? "bg-error-dot" : "bg-teal"].join(" ")} />
            <span className={["text-[13px] font-medium leading-snug", error ? "text-error-ink" : "text-storm"].join(" ")}>
              {error ?? notice}
            </span>
          </div>
        )}

        {/* ------- OVERVIEW ------- */}
        {tab === "Overview" && (
          <form onSubmit={saveOverview} className="mt-7 flex flex-col gap-5 rounded-lg border border-line-subtle bg-paper p-7 shadow-sm">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Organization name</span>
              <input className={input} value={org.name} onChange={(e) => editOrg({ name: e.target.value })} />
            </label>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className={label}>Engagement type</span>
                <input
                  className={input}
                  value={org.engagement_type ?? ""}
                  onChange={(e) => editOrg({ engagement_type: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className={label}>Status</span>
                <select className={input} value={org.status ?? "In Progress"} onChange={(e) => editOrg({ status: e.target.value })}>
                  <option>In Progress</option>
                  <option>Onboarding</option>
                  <option>Paused</option>
                  <option>Complete</option>
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Portal title</span>
              <input
                className={input}
                value={org.portal_title ?? ""}
                onChange={(e) => editOrg({ portal_title: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Portal subtitle</span>
              <input
                className={input}
                value={org.portal_subtitle ?? ""}
                onChange={(e) => editOrg({ portal_subtitle: e.target.value })}
              />
            </label>
            <div className="flex flex-col gap-1.5 border-t border-line-subtle pt-5">
              <span className={label}>Overview page content (hero, cards, photo)</span>
              <OverviewBodyBuilder
                key={org.id}
                initial={org.description}
                slug={org.slug}
                notify={(msg, bad) => (bad ? fail(msg) : flash(msg))}
                onChange={(description) => editOrg({ description })}
              />
            </div>
            {renderLivePreview(dirty, "Save Overview")}
            <div>
              <button type="submit" disabled={busy} className={btnGold}>
                {busy ? "Saving…" : "Save overview"}
              </button>
            </div>
          </form>
        )}

        {/* ------- JOURNEY ------- */}
        {tab === "Journey" && (
          <div className="mt-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className={label}>Phases · in order</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={saveOrder}
                  disabled={!phasesDirty || orderSaving}
                  className={
                    phasesDirty
                      ? "rounded bg-teal px-5 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-label text-white shadow-sm transition-all duration-200 ease-climb hover:bg-teal-deep"
                      : btnGhost + " opacity-40 cursor-not-allowed"
                  }
                >
                  {orderSaving && (
                    <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-1px]" />
                  )}
                  {orderSaving ? "Saving…" : "Save order"}
                </button>
                <button onClick={addPhase} className={btnGold}>
                  + Add phase
                </button>
              </div>
            </div>

            {phases.length === 0 ? (
              <div className="rounded-lg border-regular border-dashed border-slate-25 bg-paper px-8 py-12 text-center text-[14px] text-slate-75">
                No phases yet. Add the first checkpoint of this client&rsquo;s route.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-sm">
                {phases.map((p, i) => {
                  const open = openPhase === p.id;
                  return (
                    <div
                      key={p.id}
                      data-spot={p.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => reorderPhaseOver(p.id)}
                      onDrop={(e) => { e.preventDefault(); setDragPhaseId(null); }}
                      onDragEnd={() => setDragPhaseId(null)}
                      style={{ viewTransitionName: `phase-${p.id.replace(/[^a-zA-Z0-9-]/g, "")}` }}
                      className={[
                        i > 0 ? "border-t border-line-subtle" : "",
                        dragPhaseId === p.id ? "opacity-60 shadow-lg ring-1 ring-gold/60" : newRing(p.id),
                      ].join(" ")}
                    >
                      {/* Row header */}
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <span className="w-8 font-display text-[17px] text-teal-deep">
                          {String(p.phase_number).padStart(2, "0")}
                        </span>
                        <span
                          aria-hidden
                          draggable
                          onDragStart={(e) => {
                            if (openPhase) {
                              e.preventDefault();
                              setConfirmBox({
                                message: "Close the open phase first, and save your edits, before reordering the route.",
                                onYes: () => setConfirmBox(null),
                              });
                              return;
                            }
                            setDragPhaseId(p.id);
                          }}
                          onDragEnd={() => setDragPhaseId(null)}
                          className="cursor-grab select-none px-1 text-[15px] tracking-widest text-slate-50 transition-colors hover:text-storm active:cursor-grabbing"
                          title="Drag to reorder"
                        >⋮⋮</span>
                        <span className="min-w-[180px] flex-1 text-left text-[14.5px] font-semibold text-ink">
                          {p.title}
                        </span>
                        <span
                          className={[
                            "whitespace-nowrap rounded px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label",
                            p.status === "current"
                              ? "bg-gold text-storm"
                              : p.status === "locked"
                                ? "bg-black/[0.07] text-slate-75"
                                : "bg-teal-50 text-storm",
                          ].join(" ")}
                        >
                          {p.status}
                        </span>
                        {p.placement === "beyond" && (
                          <span className="whitespace-nowrap rounded bg-storm px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-gold">
                            Beyond the map
                          </span>
                        )}
                        {p.status !== "current" && (
                          <button onClick={() => makeCurrent(p)} className={btnGhost}>
                            Make current
                          </button>
                        )}
                        <button
                          onClick={() => setOpenPhase(open ? null : p.id)}
                          className="font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep"
                        >
                          {open ? "Close" : "Edit"}
                        </button>
                        <button onClick={() => deletePhase(p)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink transition-colors hover:text-error">Delete</button>
                      </div>

                      {/* Expanded editor */}
                      {open && (
                        <div className="flex flex-col gap-4 border-t border-line-subtle bg-snow px-5 py-5 animate-fade-up">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                              <span className={label}>Title</span>
                              <input className={input} value={p.title} onChange={(e) => editPhase(p.id, { title: e.target.value })} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className={label}>Subtitle (eyebrow, optional)</span>
                              <input className={input} value={p.subtitle ?? ""} onChange={(e) => editPhase(p.id, { subtitle: e.target.value })} />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1.5">
                            <span className={label}>Teaser (shown when locked)</span>
                            <input className={input} value={p.teaser ?? ""} onChange={(e) => editPhase(p.id, { teaser: e.target.value })} />
                          </label>
                          <div className="flex flex-col gap-1.5">
                            <span className={label}>Phase content</span>
                            <PhaseBodyBuilder
                              key={p.id}
                              initial={p.body}
                              onChange={(body) => editPhase(p.id, { body })}
                            />
                          </div>

                          {/* Retractable live preview of this phase card, renders your draft in real time */}
                          <div className="flex flex-col gap-1.5">
                            <button
                              type="button"
                              onClick={() => setOpenPhasePreviews((m) => ({ ...m, [p.id]: !m[p.id] }))}
                              className={`${btnGhost} self-start`}
                            >
                              {openPhasePreviews[p.id] ? "Hide card preview" : "Show card preview"}
                            </button>
                            {openPhasePreviews[p.id] && (
                              <div className="animate-fade-up overflow-hidden rounded-lg bg-granite px-7 py-7">
                                <PhaseDetail phase={mapPhase({ ...p }, Math.max(0, p.phase_number - 1))} />
                                <p className="mt-3 text-[11.5px] italic text-ondark-muted">
                                  Updates as you type. This is your draft, including unsaved edits. No refresh needed.
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2">
                              <span className={label}>Status</span>
                              <select
                                className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm"
                                value={p.status === "current" ? "current" : p.status}
                                onChange={(e) => editPhase(p.id, { status: e.target.value })}
                              >
                                {p.status === "current" && <option value="current">Current (use Make current)</option>}
                                <option value="available">Available</option>
                                <option value="locked">Locked</option>
                                <option value="complete">Complete</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Placement</span>
                              <select
                                className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm"
                                value={p.placement ?? "map"}
                                onChange={(e) => editPhase(p.id, { placement: e.target.value })}
                              >
                                <option value="map">On the route map</option>
                                <option value="beyond">Further up the mountain</option>
                              </select>
                            </label>
                            <button onClick={() => savePhase(phases.find((x) => x.id === p.id)!)} className={btnGold}>
                              Save phase
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <span className="text-[12px] italic text-slate-50">
              &ldquo;Make current&rdquo; unlocks the phase, demotes the previous current phase to available, and moves the
              client&rsquo;s &ldquo;you are here&rdquo; marker. Locked phases show only their teaser to clients.
            </span>
          </div>
        )}

        {/* ------- SESSIONS ------- */}
        {tab === "Sessions" && (
          <div className="mt-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className={label}>Sessions · in order</span>
              <div className="flex items-center gap-3">
                <button onClick={saveSessionOrder} disabled={!sessionOrderDirty || sessionOrderSaving} className={sessionOrderDirty ? "rounded bg-teal px-5 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-label text-white shadow-sm transition-all duration-200 ease-climb hover:bg-teal-deep" : btnGhost + " opacity-40 cursor-not-allowed"}>
                  {sessionOrderSaving && (<span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-1px]" />)}
                  {sessionOrderSaving ? "Saving…" : "Save order"}
                </button>
                <button onClick={addSession} className={btnGold}>+ Add session</button>
              </div>
            </div>
            {sessionsRows.length === 0 ? (
              <div className="rounded-lg border-regular border-dashed border-slate-25 bg-paper px-8 py-12 text-center text-[14px] text-slate-75">
                No sessions yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-sm">
                {sessionsRows.map((sr, i) => {
                  const open = openSession === sr.id;
                  return (
                    <div
                      key={sr.id}
                      data-spot={sr.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => reorderSessionOver(sr.id)}
                      onDrop={(e) => { e.preventDefault(); setDragSessionId(null); }}
                      style={{ viewTransitionName: `session-${sr.id.replace(/[^a-zA-Z0-9-]/g, "")}` }}
                      className={(i > 0 ? "border-t border-line-subtle" : "") + (dragSessionId === sr.id ? " opacity-60 shadow-lg ring-1 ring-gold/60" : newRing(sr.id))}
                    >
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <span
                          aria-hidden
                          draggable
                          onDragStart={(e) => {
                            if (openSession) {
                              e.preventDefault();
                              setConfirmBox({ message: "Close the open session first, and save your edits, before reordering.", onYes: () => setConfirmBox(null) });
                              return;
                            }
                            setDragSessionId(sr.id);
                          }}
                          onDragEnd={() => setDragSessionId(null)}
                          className="cursor-grab select-none px-1 text-[15px] tracking-widest text-slate-50 transition-colors hover:text-storm active:cursor-grabbing"
                          title="Drag to reorder"
                        >⋮⋮</span>
                        <button onClick={() => setOpenSession(open ? null : sr.id)} className="min-w-[200px] flex-1 text-left text-[14.5px] font-semibold text-ink">
                          {sr.title}
                        </button>
                        <span className="text-[12.5px] text-slate-50">{sr.session_date ?? "No date"}</span>
                        <span className={["whitespace-nowrap rounded px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label", sr.status === "complete" ? "bg-teal-50 text-storm" : sr.status === "in_progress" ? "bg-gold text-storm" : "bg-black/[0.06] text-slate-75"].join(" ")}>
                          {sr.status.replace("_", " ")}
                        </span>
                        <button onClick={() => setOpenSession(open ? null : sr.id)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep">
                          {open ? "Close" : "Edit"}
                        </button>
                        <button onClick={() => deleteSession(sr)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink transition-colors hover:text-error">Delete</button>
                      </div>
                      {open && (
                        <div className="flex flex-col gap-4 border-t border-line-subtle bg-snow px-5 py-5 animate-fade-up">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                              <span className={label}>Title</span>
                              <input className={input} value={sr.title} onChange={(e) => editSession(sr.id, { title: e.target.value })} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className={label}>Date</span>
                              <input type="date" className={input} value={sr.session_date ?? ""} onChange={(e) => editSession(sr.id, { session_date: e.target.value })} />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1.5">
                            <span className={label}>Objective</span>
                            <input className={input} value={sr.objective ?? ""} onChange={(e) => editSession(sr.id, { objective: e.target.value })} />
                          </label>
                          <label className="flex flex-col gap-1.5">
                            <span className={label}>Recap (shown after the session)</span>
                            <div className="flex items-center gap-1.5">
                              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapRecap(sr, "**")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] font-bold text-storm hover:border-teal" title="Bold">B</button>
                              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapRecap(sr, "*")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] italic text-storm hover:border-teal" title="Italic">I</button>
                              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapRecap(sr, "__")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] underline text-storm hover:border-teal" title="Underline">U</button>
                              <span className="ml-2 text-[11px] italic text-slate-50">select text, then B / I / U. Blank line = new paragraph.</span>
                            </div>
                            <textarea rows={5} ref={(el) => { recapRef.current[sr.id] = el; }} className={input} value={sr.recap ?? ""} onChange={(e) => editSession(sr.id, { recap: e.target.value })} />
                            {(sr.recap ?? "").trim() !== "" && (
                              <div className="w-full rounded border border-line-subtle bg-snow px-4 py-3">
                                <span className="mb-1 block font-condensed text-[10px] font-bold uppercase tracking-label text-slate-50">Live preview {"\u00b7"} what clients see</span>
                                <div className="text-[13.5px] leading-[1.7] text-slate-75">{recapPreview(sr.recap ?? "")}</div>
                              </div>
                            )}
                          </label>
                          {/* What the client needs to accomplish, attach key items to this session */}
                          <div className="flex flex-col gap-2 rounded border border-line-subtle bg-snow px-4 py-3.5">
                            <span className={label}>What they need to accomplish (linked key items: shows as an “action items →” button on this session)</span>
                            {items.length === 0 ? (
                              <span className="text-[12.5px] italic text-slate-50">No key items yet. Add them in the Key Items tab.</span>
                            ) : (
                              <div className="flex flex-col gap-1.5">
                                {items.map((it) => (
                                  <label key={it.id} className="flex items-center gap-2.5 text-[13px] text-ink">
                                    <input
                                      type="checkbox"
                                      checked={it.linked_session_id === sr.id}
                                      onChange={async (e) => {
                                        const { error } = await supabase
                                          .from("key_items")
                                          .update({ linked_session_id: e.target.checked ? sr.id : null })
                                          .eq("id", it.id);
                                        error ? fail(error.message) : flash(e.target.checked ? "Linked. Clients now see it on this session." : "Unlinked.");
                                        if (org) loadItems(org.id);
                                      }}
                                    />
                                    <span>{it.title}</span>
                                    <span className="font-condensed text-[10px] font-bold uppercase tracking-label text-slate-50">{it.category}</span>
                                  </label>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2">
                              <span className={label}>Status</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={sr.status} onChange={(e) => editSession(sr.id, { status: e.target.value })}>
                                <option value="upcoming">Upcoming</option>
                                <option value="in_progress">In progress</option>
                                <option value="complete">Complete</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Visibility</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={sr.visibility} onChange={(e) => editSession(sr.id, { visibility: e.target.value })}>
                                <option value="all">Everyone</option>
                                <option value="executive">Executives only</option>
                                <option value="staff">Staff only</option>
                                <option value="admin_only">Everest team only</option>
                                <option value="hidden">Hidden</option>
                              </select>
                            </label>
                            <label className="flex min-w-[280px] flex-1 items-center gap-2">
                              <span className={label}>Fathom recording URL</span>
                              <input className="flex-1 rounded border border-line-subtle bg-paper px-3 py-1.5 text-[13px] text-ink" placeholder={sr.recording_resource_id ? "Linked \u2014 paste a new URL to replace, or leave blank to keep" : "https://fathom.video/\u2026"} value={(sr as any).fathom_url ?? ""} onChange={(e) => editSession(sr.id, { fathom_url: e.target.value } as any)} />
                            </label>
                            <div className="flex w-full flex-col items-start gap-2">
                              <span className={label}>Recording thumbnail</span>
                              <div className="flex w-full flex-col gap-2">
                              {sr.thumbnail_url ? <img src={sr.thumbnail_url} alt="Thumbnail" className="h-16 w-28 rounded border border-line-subtle object-cover" /> : <span className="text-[12px] italic text-slate-50">No thumbnail yet</span>}
                              <button type="button" onClick={(ev) => ((ev.currentTarget.nextElementSibling as HTMLInputElement) || null)?.click()} className="w-fit cursor-pointer rounded border border-line-subtle bg-snow px-3 py-1.5 font-condensed text-[10.5px] font-bold uppercase tracking-label text-storm transition-colors hover:border-teal" disabled={!!uploadBusy}>{uploadBusy === "thumb-" + sr.id && (<span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-storm/30 border-t-storm align-[-1px]" />)}{uploadBusy === "thumb-" + sr.id ? "Uploading\u2026" : "Upload thumbnail png"}</button>
                              <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) uploadThumb("thumb-" + sr.id, f, async (url) => { editSession(sr.id, { thumbnail_url: url }); await supabase.from("sessions").update({ thumbnail_url: url }).eq("id", sr.id); }); ev.target.value = ""; }} />
                            </div>
                            <div className="flex w-full flex-col gap-2">
                              <span className={label}>Session photos</span>
                              <div className="flex flex-wrap items-center gap-3">
                                {(sr.photos ?? []).map((ph, pi) => (
                                  <span key={pi} className="relative inline-block">
                                    <img src={ph} alt={`Session photo ${pi + 1}`} className="h-16 w-24 rounded border border-line-subtle object-cover" />
                                    <button onClick={async () => { const next = (sr.photos ?? []).filter((_, j) => j !== pi); editSession(sr.id, { photos: next }); await supabase.from("sessions").update({ photos: next }).eq("id", sr.id); flash("Photo removed."); }} className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-error-ink text-[10px] font-bold text-white">×</button>
                                  </span>
                                ))}
                                <button type="button" onClick={(ev) => ((ev.currentTarget.nextElementSibling as HTMLInputElement) || null)?.click()} className="w-fit cursor-pointer rounded border border-line-subtle bg-snow px-3 py-1.5 font-condensed text-[10.5px] font-bold uppercase tracking-label text-storm transition-colors hover:border-teal" disabled={!!uploadBusy}>{uploadBusy === "photos-" + sr.id && (<span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-storm/30 border-t-storm align-[-1px]" />)}{uploadBusy === "photos-" + sr.id ? "Uploading\u2026" : "Upload sessions png"}</button>
                              <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) uploadThumb("photos-" + sr.id, f, async (url) => { const next = [ ...(sr.photos ?? []), url ]; editSession(sr.id, { photos: next }); await supabase.from("sessions").update({ photos: next }).eq("id", sr.id); }); ev.target.value = ""; }} />
                              </div>
                              <span className="text-[11.5px] italic text-slate-50">Any pictures taken in session. Clients see them on the session card.</span>
                            </div>
                            </div>
                            <button onClick={() => saveSession(sessionsRows.find((x) => x.id === sr.id)!)} className={btnGold}>Save session</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ------- KEY ITEMS ------- */}
        {tab === "Key Items" && (
          <div className="mt-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className={label}>Key items · the client checklist</span>
              <div className="flex items-center gap-3">
                <button onClick={saveItemOrder} disabled={!itemOrderDirty || itemOrderSaving} className={itemOrderDirty ? "rounded bg-teal px-5 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-label text-white shadow-sm transition-all duration-200 ease-climb hover:bg-teal-deep" : btnGhost + " opacity-40 cursor-not-allowed"}>
                  {itemOrderSaving && (<span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white align-[-1px]" />)}
                  {itemOrderSaving ? "Saving…" : "Save order"}
                </button>
                <button onClick={addItem} className={btnGold}>+ Add key item</button>
              </div>
            </div>
            {items.length === 0 ? (
              <div className="rounded-lg border-regular border-dashed border-slate-25 bg-paper px-8 py-12 text-center text-[14px] text-slate-75">
                No key items yet.
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-sm">
                {items.map((it, i) => {
                  const open = openItem === it.id;
                  return (
                    <div
                      key={it.id}
                      data-spot={it.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDragEnter={() => reorderItemOver(it.id)}
                      onDrop={(e) => { e.preventDefault(); setDragItemId(null); }}
                      style={{ viewTransitionName: `item-${it.id.replace(/[^a-zA-Z0-9-]/g, "")}` }}
                      className={(i > 0 ? "border-t border-line-subtle" : "") + (dragItemId === it.id ? " opacity-60 shadow-lg ring-1 ring-gold/60" : newRing(it.id))}
                    >
                      <div className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                        <span
                          aria-hidden
                          draggable
                          onDragStart={(e) => {
                            if (openItem) {
                              e.preventDefault();
                              setConfirmBox({ message: "Close the open item first, and save your edits, before reordering.", onYes: () => setConfirmBox(null) });
                              return;
                            }
                            setDragItemId(it.id);
                          }}
                          onDragEnd={() => setDragItemId(null)}
                          className="cursor-grab select-none px-1 text-[15px] tracking-widest text-slate-50 transition-colors hover:text-storm active:cursor-grabbing"
                          title="Drag to reorder"
                        >⋮⋮</span>
                        <button onClick={() => setOpenItem(open ? null : it.id)} className="min-w-[200px] flex-1 text-left text-[14.5px] font-semibold text-ink">
                          {it.title}
                        </button>
                        <span className="whitespace-nowrap rounded bg-black/[0.05] px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-slate-75">
                          {it.category || "General"}
                        </span>
                        {it.priority === "required" && (
                          <span className="whitespace-nowrap rounded bg-gold px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-storm">Required</span>
                        )}
                        <span className={["whitespace-nowrap rounded px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label", it.is_client_actionable ? "bg-teal-50 text-storm" : "bg-storm text-snow"].join(" ")}>
                          {it.is_client_actionable ? "Client task" : "Everest task"}
                        </span>
                        <button onClick={() => setOpenItem(open ? null : it.id)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep">
                          {open ? "Close" : "Edit"}
                        </button>
                        <button onClick={() => deleteItem(it)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink transition-colors hover:text-error">Delete</button>
                      </div>
                      {open && (
                        <div className="flex flex-col gap-4 border-t border-line-subtle bg-snow px-5 py-5 animate-fade-up">
                          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                              <span className={label}>Title</span>
                              <input className={input} value={it.title} onChange={(e) => editItem(it.id, { title: e.target.value })} />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className={label}>Category</span>
                              <input className={input} value={it.category ?? ""} onChange={(e) => editItem(it.id, { category: e.target.value })} />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1.5">
                            <span className={label}>Description (optional)</span>
                            <textarea rows={2} className={input} value={it.description ?? ""} onChange={(e) => editItem(it.id, { description: e.target.value })} />
                          </label>
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2">
                              <span className={label}>Status</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={it.status} onChange={(e) => editItem(it.id, { status: e.target.value })}>
                                <option value="not_started">Not started</option>
                                <option value="in_progress">In progress</option>
                                <option value="complete">Complete</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Priority</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={it.priority} onChange={(e) => editItem(it.id, { priority: e.target.value })}>
                                <option value="required">Required</option>
                                <option value="normal">Normal</option>
                                <option value="low">Low</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Visibility</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={it.visibility} onChange={(e) => editItem(it.id, { visibility: e.target.value })}>
                                <option value="all">Everyone</option>
                                <option value="executive">Executives only</option>
                                <option value="staff">Staff only</option>
                                <option value="admin_only">Everest team only</option>
                                <option value="hidden">Hidden</option>
                              </select>
                            </label>
                            <label className="flex cursor-pointer items-center gap-2">
                              <input type="checkbox" checked={it.is_client_actionable} onChange={(e) => editItem(it.id, { is_client_actionable: e.target.checked })} className="h-4 w-4 accent-[#FBAD18]" />
                              <span className={label}>Client can check this off</span>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Who can check it</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={(it as any).check_role ?? "all"} onChange={(e) => editItem(it.id, { check_role: e.target.value } as any)}>
                                <option value="all">Everyone</option>
                                <option value="executive">Executives only</option>
                                <option value="staff">Staff only</option>
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Assigned to</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={(it as any).assigned_user_id ?? ""} onChange={(e) => editItem(it.id, { assigned_user_id: e.target.value || null } as any)}>
                                <option value="">Whole organization</option>
                                {members.filter((m) => m.status !== "disabled").map((m) => (
                                  <option key={m.user_id} value={m.user_id}>{m.profiles?.full_name || m.profiles?.email || "Member"}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Completion</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={(it as any).completion_mode ?? "shared"} onChange={(e) => editItem(it.id, { completion_mode: e.target.value } as any)}>
                                <option value="shared">Shared, one check for the whole org</option>
                                <option value="per_user">Per member, everyone checks their own</option>
                              </select>
                            </label>
                          </div>
                          <div className="flex flex-wrap items-center gap-4">
                            <label className="flex items-center gap-2">
                              <span className={label}>Send client to phase</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={it.linked_phase_id ?? ""} onChange={(e) => editItem(it.id, { linked_phase_id: e.target.value || null })}>
                                <option value="">None</option>
                                {phases.map((ph) => (
                                  <option key={ph.id} value={ph.id}>{String(ph.phase_number).padStart(2, "0")} · {ph.title}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Send client to session</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={it.linked_session_id ?? ""} onChange={(e) => editItem(it.id, { linked_session_id: e.target.value || null })}>
                                <option value="">None</option>
                                {sessionsRows.map((sr) => (
                                  <option key={sr.id} value={sr.id}>{sr.title}</option>
                                ))}
                              </select>
                            </label>
                            <label className="flex items-center gap-2">
                              <span className={label}>Send client to document</span>
                              <select className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={it.linked_resource_id ?? ""} onChange={(e) => editItem(it.id, { linked_resource_id: e.target.value || null })}>
                                <option value="">None</option>
                                {resourcesRows.filter((r) => r.type === "pdf").map((r) => (
                                  <option key={r.id} value={r.id}>{r.title}</option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <div className="flex items-center gap-3">
                            <button onClick={() => saveItem(items.find((x) => x.id === it.id)!)} className={btnGold}>Save item</button>
                            <button onClick={() => deleteItem(it)} className="ml-auto font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink">Delete item</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
            <span className="text-[12px] italic text-slate-50">
              “Client can check this off” mirrors the database rule: unchecked, the item renders as a dimmed Everest-team checkbox for clients.
            </span>
          </div>
        )}

        {/* ------- LOGISTICS ------- */}
        {tab === "Recordings" && (
          <section className="mt-7 flex flex-col gap-4 animate-fade-up">
            <p className="text-[13px] italic text-slate-75">
              One row per session. Paste the Fathom link and thumbnail, and clients get a Watch button on the session and in their Recordings library.
            </p>
            <div className="overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-sm">
              {sessionsRows.map((sr, i) => (
                <div key={sr.id} className={["flex flex-col gap-3 px-5 py-4", i > 0 ? "border-t border-line-subtle" : ""].join(" ")}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="font-condensed text-[14px] font-bold uppercase tracking-label text-storm">{sr.title}</span>
                    <span className="text-[12px] text-slate-50">{sr.session_date || "no date"}</span>
                    {sr.recording_resource_id ? (
                      <span className="rounded bg-teal-50 px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-storm">Recording linked</span>
                    ) : (
                      <span className="rounded bg-black/[0.07] px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-slate-75">No recording</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <input className="min-w-[280px] flex-1 rounded border border-line-subtle bg-snow px-3 py-2 text-[13px] text-ink" placeholder={sr.recording_resource_id ? "Linked, paste a new Fathom URL to replace" : "https://fathom.video/…"} value={(sr as any).fathom_url ?? ""} onChange={(e) => editSession(sr.id, { fathom_url: e.target.value } as any)} />
                    <div className="flex items-center gap-3">
                      {sr.thumbnail_url ? <img src={sr.thumbnail_url} alt="Thumbnail" className="h-16 w-28 rounded border border-line-subtle object-cover" /> : <span className="text-[12px] italic text-slate-50">No thumbnail yet</span>}
                      <button type="button" onClick={(ev) => ((ev.currentTarget.nextElementSibling as HTMLInputElement) || null)?.click()} className="w-fit cursor-pointer rounded border border-line-subtle bg-snow px-3 py-1.5 font-condensed text-[10.5px] font-bold uppercase tracking-label text-storm transition-colors hover:border-teal" disabled={!!uploadBusy}>{uploadBusy === "thumb-" + sr.id && (<span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-storm/30 border-t-storm align-[-1px]" />)}{uploadBusy === "thumb-" + sr.id ? "Uploading\u2026" : "Upload thumbnail png"}</button>
                              <input type="file" accept="image/*" className="hidden" onChange={(ev) => { const f = ev.target.files?.[0]; if (f) uploadThumb("thumb-" + sr.id, f, async (url) => { editSession(sr.id, { thumbnail_url: url }); await supabase.from("sessions").update({ thumbnail_url: url }).eq("id", sr.id); }); ev.target.value = ""; }} />
                    </div>
                    <input className="min-w-[240px] flex-1 rounded border border-line-subtle bg-snow px-3 py-2 text-[13px] text-ink" placeholder={resourcesRows.find((r) => r.id === sr.recording_resource_id)?.description?.startsWith("http") ? `Linked: ${resourcesRows.find((r) => r.id === sr.recording_resource_id)?.description}` : "Transcript URL (we provide this)"} value={(sr as any).transcript_url ?? ""} onChange={(e) => editSession(sr.id, { transcript_url: e.target.value } as any)} />
                    <button onClick={() => saveSession(sessionsRows.find((x) => x.id === sr.id)!)} className={btnGold}>Save</button>
                  </div>
                </div>
              ))}
              {sessionsRows.length === 0 && (
                <div className="px-8 py-12 text-center text-[14px] text-slate-75">No sessions yet, add one in the Sessions tab first.</div>
              )}
            </div>
          </section>
        )}

        {tab === "Resources" && (
          <section className="mt-7 flex flex-col gap-6 animate-fade-up">
            <div className="rounded-lg border border-line-subtle bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-condensed text-[13px] font-bold uppercase tracking-label text-slate-75">Categories</h2>
                <button onClick={addCategory} className={btnGold}>+ Add category</button>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {categories.map((c) => (
                  <div key={c.id} data-spot={c.id} className={"flex flex-wrap items-center gap-3 rounded border border-line-subtle bg-snow px-4 py-3" + newRing(c.id)}>
                    <input className="min-w-[180px] flex-1 rounded border border-line-subtle bg-paper px-3 py-2 text-[13.5px] text-ink" value={c.title} onChange={(e) => editCat(c.id, { title: e.target.value })} />
                    <input className="min-w-[220px] flex-[2] rounded border border-line-subtle bg-paper px-3 py-2 text-[13.5px] text-ink" placeholder="Description shown to clients" value={c.description ?? ""} onChange={(e) => editCat(c.id, { description: e.target.value })} />
                    <button onClick={() => deleteCategory(c)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink">Delete</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-line-subtle bg-paper p-6 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-condensed text-[13px] font-bold uppercase tracking-label text-slate-75">Resources</h2>
                <button onClick={addResource} className={btnGold}>+ Add resource</button>
              </div>
              <div className="mt-4 flex flex-col gap-4">
                {resourcesRows.map((r) => (
                  <div key={r.id} data-spot={r.id} className={"flex flex-col gap-3 rounded border border-line-subtle bg-snow px-4 py-4" + newRing(r.id)}>
                    <div className="flex flex-wrap items-center gap-3">
                      <input className="min-w-[200px] flex-1 rounded border border-line-subtle bg-paper px-3 py-2 text-[13.5px] font-semibold text-ink" value={r.title} onChange={(e) => editRes(r.id, { title: e.target.value })} />
                      <select className="rounded border border-line-subtle bg-paper px-2.5 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={r.category_id ?? ""} onChange={(e) => editRes(r.id, { category_id: e.target.value || null })}>
                        <option value="">No category</option>
                        {categories.map((c) => (<option key={c.id} value={c.id}>{c.title}</option>))}
                      </select>
                      <select className="rounded border border-line-subtle bg-paper px-2.5 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={r.type} onChange={(e) => editRes(r.id, { type: e.target.value })}>
                        {["pdf", "link", "recording", "transcript"].map((t) => (<option key={t} value={t}>{t}</option>))}
                      </select>
                    </div>
                    <input className="rounded border border-line-subtle bg-paper px-3 py-2 text-[13px] text-ink" placeholder="Short description for clients" value={r.description ?? ""} onChange={(e) => editRes(r.id, { description: e.target.value })} />
                    <div className="flex flex-wrap items-center gap-3">
                      <input className="min-w-[260px] flex-1 rounded border border-line-subtle bg-paper px-3 py-2 text-[13px] text-ink" placeholder="External URL (leave blank when uploading a file)" value={r.url ?? ""} onChange={(e) => editRes(r.id, { url: e.target.value, storage_path: e.target.value ? null : r.storage_path })} />
                      <label className={`${btnGhost} cursor-pointer`}>
                        {uploadingId === r.id ? "Uploading\u2026" : r.storage_path ? "Replace file" : "Upload file"}
                        <input type="file" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadResourceFile(r.id, f); e.target.value = ""; }} />
                      </label>
                      {r.storage_path && <span className="font-condensed text-[10.5px] font-bold uppercase tracking-label text-teal-deep">File attached</span>}
                      <button onClick={() => deleteResource(r)} className="ml-auto font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5">
                <button onClick={saveResources} className={btnGold}>Save resources</button>
              </div>
            </div>
          </section>
        )}

        {tab === "Notes" && (
          <section className="mt-7 flex flex-col gap-4 animate-fade-up">
            <div className="flex items-center justify-between">
              <p className="text-[13px] italic text-slate-75">Internal Everest-team notes, clients never see this tab or these rows (blocked by the database, not just the UI).</p>
              <button onClick={addNote} className={btnGold}>+ Add note</button>
            </div>
            <div className="flex flex-col gap-4">
              {notesRows.map((n) => (
                <div key={n.id} data-spot={n.id} className={"flex flex-col gap-3 rounded-lg border border-line-subtle bg-paper p-5 shadow-sm" + newRing(n.id)}>
                  <input className="rounded border border-line-subtle bg-snow px-3 py-2 text-[14px] font-semibold text-ink" value={n.title ?? ""} onChange={(ev) => { setNotesRows((xs) => xs.map((x) => (x.id === n.id ? { ...x, title: ev.target.value } : x))); setDirtyNoteIds((d) => new Set(d).add(n.id)); }} />
                  <textarea rows={3} className="rounded border border-line-subtle bg-snow px-3 py-2 text-[13.5px] leading-relaxed text-ink" placeholder="What the team should know…" value={n.body ?? ""} onChange={(ev) => { setNotesRows((xs) => xs.map((x) => (x.id === n.id ? { ...x, body: ev.target.value } : x))); setDirtyNoteIds((d) => new Set(d).add(n.id)); }} />
                  <div className="flex items-center justify-between">
                    <button onClick={() => saveNote(notesRows.find((x) => x.id === n.id))} className={btnGold}>Save note</button>
                    <button onClick={() => deleteNote(n)} className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink">Delete</button>
                  </div>
                </div>
              ))}
              {notesRows.length === 0 && (
                <div className="rounded-lg border border-line-subtle bg-paper px-8 py-12 text-center text-[14px] text-slate-75">No notes yet, the first one is a click away.</div>
              )}
            </div>
          </section>
        )}

        {tab === "Logistics" && (
          <div className="mt-7 flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className={label}>Logistics fields</span>
              <div className="flex items-center gap-3">
                <button onClick={addLogistic} className={btnGhost}>+ Add field</button>
                <button onClick={saveLogistics} className={btnGold}>Save logistics</button>
              </div>
            </div>
            {logistics.length === 0 ? (
              <div className="rounded-lg border-regular border-dashed border-slate-25 bg-paper px-8 py-12 text-center text-[14px] text-slate-75">
                No logistics fields yet.
              </div>
            ) : (
              <div className="flex flex-col gap-2.5">
                {logistics.map((row) => (
                  <div key={row.id} className="grid grid-cols-1 items-center gap-2.5 rounded-lg border border-line-subtle bg-paper p-3.5 shadow-sm sm:grid-cols-[220px_1fr_auto]">
                    <input className={input} value={row.label} onChange={(e) => editLogistic(row.id, { label: e.target.value })} />
                    <input className={input} value={row.value ?? ""} onChange={(e) => editLogistic(row.id, { value: e.target.value })} />
                    <button onClick={() => deleteLogistic(row)} className="justify-self-end font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink">Delete</button>
                  </div>
                ))}
              </div>
            )}
            <span className="text-[12px] italic text-slate-50">Edit freely, then hit Save logistics, all rows save together.</span>
          </div>
        )}

        {/* ------- MEMBERS ------- */}
        {tab === "Members" && (
          <div className="mt-7 flex flex-col gap-6">
            {/* Invite */}
            {members.some((m: any) => m.deleted_at) && (
              <div className="mt-5 flex flex-col gap-2 rounded border border-line-subtle bg-snow px-4 py-3">
                <span className={label}>Removed members (restorable 30 days)</span>
                {members.filter((m: any) => m.deleted_at).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-3 text-[13px] text-slate-75">
                    <span>{m.profiles?.email ?? "Member"}</span>
                    <button onClick={async () => { await supabase.from("organization_members").update({ deleted_at: null }).eq("id", m.id); if (org) loadMembers(org.id); flash("Member restored."); }} className="ml-auto font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep hover:text-teal">Restore</button>
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={invite} noValidate className="flex flex-col gap-4 rounded-lg border border-line-subtle bg-paper p-6 shadow-sm">
              <span className={label}>Invite a member</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_170px_auto]">
                <input
                  className={input}
                  type="email"
                  placeholder="name@clientcompany.com"
                  value={invEmail}
                  onChange={(e) => setInvEmail(e.target.value)}
                />
                <select className={input} value={invRole} onChange={(e) => setInvRole(e.target.value as any)}>
                  <option value="executive">Executive</option>
                  <option value="staff">Staff</option>
                </select>
                <button type="submit" disabled={busy || !invEmail.trim()} className={btnGold}>
                  {busy ? "Sending…" : "Send invite"}
                </button>
              </div>
              <span className="text-[12px] italic text-slate-50">
                They receive an email, set a password, and land in this portal with the chosen role.
              </span>
            </form>

            {/* Member list */}
            <div className="overflow-hidden rounded-lg border border-line-subtle bg-paper shadow-sm">
              {members.length === 0 ? (
                <div className="px-6 py-10 text-center text-[14px] text-slate-50">No members yet.</div>
              ) : (
                members.filter((mm: any) => !mm.deleted_at).map((m, i) => (
                  <div
                    key={m.id}
                    className={[
                      "flex flex-wrap items-center gap-4 px-6 py-4",
                      i > 0 ? "border-t border-line-subtle" : "",
                      m.status === "disabled" ? "opacity-50" : "",
                    ].join(" ")}
                  >
                    <div className="flex min-w-[220px] flex-1 flex-col">
                      <span className="text-[14.5px] font-semibold text-ink">
                        {m.profiles?.full_name || m.profiles?.email || "Pending member"}
                      </span>
                      <span className="text-[12.5px] text-slate-50">{m.profiles?.email ?? ""}</span>
                    </div>
                    <span
                      className={[
                        "whitespace-nowrap rounded px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label",
                        m.status === "active" ? "bg-teal-50 text-storm" : "bg-black/[0.06] text-slate-75",
                      ].join(" ")}
                    >
                      {m.status}
                    </span>
                    <select className="rounded border border-line-subtle bg-snow px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm" value={m.role} onChange={(e) => setRole(m, e.target.value)}>
                      <option value="executive">Executive</option>
                      <option value="staff">Staff</option>
                    </select>
                    <button onClick={() => toggleStatus(m)} className={btnGhost}>
                      {m.status === "disabled" ? "Re-enable" : "Disable"}
                    </button>
                        <button
                          onClick={() =>
                            setConfirmBox({
                              message: `Remove ${m.profiles?.email ?? "this member"}? They lose access immediately. Restorable for 30 days.`,
                              onYes: async () => {
                                await supabase.from("organization_members").update({ deleted_at: new Date().toISOString() }).eq("id", m.id);
                                if (org) loadMembers(org.id);
                                flash("Member moved to trash.");
                              },
                            })
                          }
                          className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink transition-colors hover:text-error"
                        >
                          Remove
                        </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Branded confirm modal (replaces the browser's gray dialog) */}
      {confirmBox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-storm/70 px-6" onClick={() => setConfirmBox(null)}>
          <div
            className="w-full max-w-[440px] animate-fade-up overflow-hidden rounded-lg bg-paper shadow-login"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-1 bg-gold" />
            <div className="flex flex-col gap-4 px-8 pb-6 pt-7">
              <div className="flex flex-col gap-1.5">
                <div className="font-condensed text-[12px] font-bold uppercase tracking-eyebrow text-gold-deep">
                  Hold on
                </div>
                <div className="font-display text-[19px] uppercase leading-[1.15] tracking-display text-storm">
                  Are you sure?
                </div>
                <p className="text-[13.5px] leading-relaxed text-slate-75">{confirmBox.message}</p>
              </div>
              <div className="flex items-center gap-3 border-t border-line-subtle pt-4">
                <button
                  onClick={() => {
                    const go = confirmBox.onYes;
                    setConfirmBox(null);
                    go();
                  }}
                  className="rounded bg-gold px-5 py-2.5 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px"
                >
                  Yes, continue
                </button>
                <button
                  onClick={() => setConfirmBox(null)}
                  className="rounded border border-line px-4 py-2.5 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ================= Phase content builder =================
 * Visual editor for the rich phase layout. Serializes to the same JSON
 * convention the client portal renders, so the backend never changes shape.
 */
const bLabel = "font-condensed text-[10.5px] font-bold uppercase tracking-label text-slate-50";
const bInput =
  "w-full rounded bg-paper border border-line-subtle px-3 py-2 text-[14px] text-ink outline-none transition-shadow duration-200 ease-climb focus:border-teal focus:shadow-focus";
const bAdd =
  "self-start rounded border border-line px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]";
const bRemove = "font-condensed text-[10.5px] font-bold uppercase tracking-label text-error-ink";

type RichState = {
  kicker: string;
  investIntro: string;
  investment: { label: string; amount: string; caption: string; visibility: "executive" | "all" } | null;
  paragraphs: { lead: string; text: string }[];
  deliverables: { title: string; body: string }[];
  closing: string;
};

function parseRich(initial: string | null): RichState | null {
  if (!initial) return null;
  try {
    const j = JSON.parse(initial);
    if (typeof j !== "object" || j === null) return null;
    return {
      kicker: j.kicker ?? "",
      investIntro: j.investIntro ?? "",
      investment: j.investment
        ? { ...j.investment, caption: j.investment.caption ?? "", visibility: j.investmentVisibility === "all" ? "all" : "executive" }
        : null,
      paragraphs: (j.paragraphs ?? []).map((p: any) =>
        typeof p === "string" ? { lead: "", text: p } : { lead: p.lead ?? "", text: p.text ?? "" },
      ),
      deliverables: (j.deliverables ?? []).map((d: any) => ({ title: d.title ?? "", body: d.body ?? "" })),
      closing: j.closing ?? "",
    };
  } catch {
    return null;
  }
}

function serializeRich(r: RichState): string {
  const out: any = {};
  if (r.kicker.trim()) out.kicker = r.kicker.trim();
  if (r.investIntro.trim()) out.investIntro = r.investIntro.trim();
  if (r.investment) {
    out.investment = {
      label: r.investment.label,
      amount: r.investment.amount,
      caption: r.investment.caption,
    };
    out.investmentVisibility = r.investment.visibility;
  }
  const paras = r.paragraphs.filter((p) => p.text.trim() || p.lead.trim());
  if (paras.length) out.paragraphs = paras.map((p) => (p.lead.trim() ? { lead: p.lead.trim(), text: p.text } : { text: p.text }));
  const dels = r.deliverables.filter((d) => d.title.trim() || d.body.trim());
  if (dels.length) out.deliverables = dels.map((d, i) => ({ n: String(i + 1).padStart(2, "0"), title: d.title, body: d.body }));
  if (r.closing.trim()) out.closing = r.closing.trim();
  return JSON.stringify(out, null, 2);
}

const EMPTY_RICH: RichState = { kicker: "", investIntro: "", investment: null, paragraphs: [], deliverables: [], closing: "" };

function PhaseBodyBuilder({ initial, onChange }: { initial: string | null; onChange: (body: string) => void }) {
  const parsed = React.useMemo(() => parseRich(initial), []); // parse once per phase (component is keyed by phase id)
  const [mode, setMode] = React.useState<"simple" | "rich">(parsed ? "rich" : "simple");
  const [text, setText] = React.useState(parsed ? "" : (initial ?? ""));
  const [rich, setRich] = React.useState<RichState>(parsed ?? EMPTY_RICH);
  const taRefs = React.useRef<Record<number | string, HTMLTextAreaElement | null>>({});
  const selRef = React.useRef<Record<number | string, { a: number; b: number }>>({});
  const rememberSel = (i: number | string) => {
    const ta = taRefs.current[i];
    if (ta) selRef.current[i] = { a: ta.selectionStart, b: ta.selectionEnd };
  };
  const readSel = (i: number | string) => {
    const ta = taRefs.current[i]!;
    const rem = selRef.current[i];
    const live = document.activeElement === ta;
    return { a0: live ? ta.selectionStart : rem?.a ?? 0, b0: live ? ta.selectionEnd : rem?.b ?? 0 };
  };
  const smartWrapLocal = (t: string, a0: number, b0: number, marker: string) => {
    let a = a0, b = b0;
    while (a < b && /\s/.test(t[a])) a++;
    while (b > a && /\s/.test(t[b - 1])) b--;
    const sel = t.slice(a, b);
    const before = t.slice(0, a), after = t.slice(b);
    if ((() => { const ch = marker[0]; let l = 0; while (l < before.length && before[before.length - 1 - l] === ch) l++; let r = 0; while (r < after.length && after[r] === ch) r++; return l >= marker.length && r >= marker.length && !(marker === "*" && l === 2 && r === 2); })()) return { next: before.slice(0, -marker.length) + sel + after.slice(marker.length), s: a - marker.length, e: b - marker.length };
    if (sel.startsWith(marker) && sel.endsWith(marker) && sel.length >= marker.length * 2) { const inner = sel.slice(marker.length, sel.length - marker.length); return { next: before + inner + after, s: a, e: a + inner.length }; }
    const body = sel || "text";
    return { next: before + marker + body + marker + after, s: a + marker.length, e: a + marker.length + body.length };
  };
  const wrapSimple = (marker: string) => {
    const ta = taRefs.current["simple"];
    if (!ta) return;
    const { a0, b0 } = readSel("simple");
    const { next, s, e } = smartWrapLocal(ta.value, a0, b0, marker);
    setText(next);
    onChange(next);
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s, e); });
  };
  const wrapSel = (i: number, marker: string) => {
    const ta = taRefs.current[i];
    if (!ta) return;
    const { a0, b0 } = readSel(i);
    const { next, s, e } = smartWrapLocal(ta.value, a0, b0, marker);
    updRich({ paragraphs: rich.paragraphs.map((x, j) => (j === i ? { ...x, text: next } : x)) });
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(s, e); });
  };

  const updRich = (patch: Partial<RichState>) => {
    const next = { ...rich, ...patch };
    setRich(next);
    onChange(serializeRich(next));
  };

  return (
    <div className="flex flex-col gap-4 rounded-md border border-line-subtle bg-paper p-4">
      {/* Mode toggle */}
      <div className="flex items-center gap-2">
        {(["simple", "rich"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              if (m === mode) return;
              if (m === "rich") {
                const paragraphs = text.trim()
                  ? text.split(/\n\s*\n/).map((chunk) => ({ lead: "", text: chunk.trim() }))
                  : [];
                const next = { ...rich, paragraphs: rich.paragraphs.length ? rich.paragraphs : paragraphs };
                setRich(next);
                setMode("rich");
                onChange(serializeRich(next));
              } else {
                const flat = rich.paragraphs.map((p) => (p.lead ? `${p.lead} ${p.text}` : p.text)).join("\n\n");
                setText(flat);
                setMode("simple");
                onChange(flat);
              }
            }}
            className={[
              "rounded px-3 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label transition-colors duration-200 ease-climb",
              mode === m ? "bg-storm text-snow" : "border border-line-subtle text-slate-50 hover:text-storm",
            ].join(" ")}
          >
            {m === "simple" ? "Simple text" : "Rich layout"}
          </button>
        ))}
      </div>

      {mode === "simple" ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-1.5">
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSimple("**")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] font-bold text-storm hover:border-teal" title="Bold">B</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSimple("*")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] italic text-storm hover:border-teal" title="Italic">I</button>
            <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSimple("__")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] underline text-storm hover:border-teal" title="Underline">U</button>
            <span className="ml-1 text-[10.5px] italic text-slate-50">select text, then B / I / U</span>
          </div>
          <textarea
            rows={5}
            ref={(el) => { taRefs.current["simple"] = el; }}
            onSelect={() => rememberSel("simple")}
            onKeyUp={() => rememberSel("simple")}
            onMouseUp={() => rememberSel("simple")}
            className={bInput}
            placeholder="Plain paragraphs, separate with a blank line."
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              onChange(e.target.value);
            }}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {/* Kicker */}
          <label className="flex flex-col gap-1">
            <span className={bLabel}>Kicker (small gold eyebrow, e.g. “You are here”)</span>
            <input className={bInput} value={rich.kicker} onChange={(e) => updRich({ kicker: e.target.value })} />
          </label>

          {/* Paragraphs */}
          <div className="flex flex-col gap-2.5">
            <span className={bLabel}>Paragraphs (the bordered lines)</span>
            {rich.paragraphs.map((para, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded border border-line-subtle bg-snow p-3">
                <input
                  className={bInput}
                  placeholder="Bold opener (optional)"
                  value={para.lead}
                  onChange={(e) => updRich({ paragraphs: rich.paragraphs.map((x, j) => (j === i ? { ...x, lead: e.target.value } : x)) })}
                />
                <div className="flex items-center gap-1.5">
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSel(i, "**")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] font-bold text-storm hover:border-teal" title="Bold">B</button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSel(i, "*")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] italic text-storm hover:border-teal" title="Italic">I</button>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => wrapSel(i, "__")} className="rounded border border-line-subtle bg-paper px-2 py-0.5 text-[12px] underline text-storm hover:border-teal" title="Underline">U</button>
                  <span className="ml-1 text-[10.5px] italic text-slate-50">select text, then B / I / U, shows live in the card preview</span>
                </div>
                <textarea ref={(el) => { taRefs.current[i] = el; }} onSelect={() => rememberSel(i)} onKeyUp={() => rememberSel(i)} onMouseUp={() => rememberSel(i)}
                  rows={3}
                  className={bInput}
                  placeholder="Paragraph text"
                  value={para.text}
                  onChange={(e) => updRich({ paragraphs: rich.paragraphs.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })}
                />
                <button type="button" className={bRemove + " self-end"} onClick={() => updRich({ paragraphs: rich.paragraphs.filter((_, j) => j !== i) })}>
                  Remove line
                </button>
              </div>
            ))}
            <button type="button" className={bAdd} onClick={() => updRich({ paragraphs: [...rich.paragraphs, { lead: "", text: "" }] })}>
              + Add line
            </button>
          </div>

          {/* Price block */}
          <div className="flex flex-col gap-2.5">
            <span className={bLabel}>Price block (the dark square)</span>
            {rich.investment ? (
              <div className="flex flex-col gap-2 rounded border border-line-subtle bg-snow p-3">
                <input className={bInput} placeholder="Intro line above the block (optional)" value={rich.investIntro} onChange={(e) => updRich({ investIntro: e.target.value })} />
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <input className={bInput} placeholder="Label, e.g. Discovery Period" value={rich.investment.label} onChange={(e) => updRich({ investment: { ...rich.investment!, label: e.target.value } })} />
                  <input className={bInput} placeholder="Amount, e.g. $35,000" value={rich.investment.amount} onChange={(e) => updRich({ investment: { ...rich.investment!, amount: e.target.value } })} />
                  <input className={bInput} placeholder="Caption, e.g. Aug–Oct · three installments" value={rich.investment.caption} onChange={(e) => updRich({ investment: { ...rich.investment!, caption: e.target.value } })} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2">
                    <span className={bLabel}>Who can see the price</span>
                    <select
                      className="rounded border border-line-subtle bg-paper px-2.5 py-1.5 font-condensed text-[11px] font-bold uppercase tracking-label text-storm"
                      value={rich.investment.visibility}
                      onChange={(e) => updRich({ investment: { ...rich.investment!, visibility: e.target.value as "executive" | "all" } })}
                    >
                      <option value="executive">Executives only</option>
                      <option value="all">Everyone (incl. staff)</option>
                    </select>
                  </label>
                  <button type="button" className={bRemove} onClick={() => updRich({ investment: null, investIntro: "" })}>
                    Remove price block
                  </button>
                </div>
              </div>
            ) : (
              <button type="button" className={bAdd} onClick={() => updRich({ investment: { label: "", amount: "", caption: "", visibility: "executive" } })}>
                + Add price block
              </button>
            )}
          </div>

          {/* Deliverables */}
          <div className="flex flex-col gap-2.5">
            <span className={bLabel}>“What’s included” cards</span>
            {rich.deliverables.map((d, i) => (
              <div key={i} className="flex flex-col gap-1.5 rounded border border-line-subtle bg-snow p-3">
                <input className={bInput} placeholder="Card title" value={d.title} onChange={(e) => updRich({ deliverables: rich.deliverables.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                <textarea rows={2} className={bInput} placeholder="Card text" value={d.body} onChange={(e) => updRich({ deliverables: rich.deliverables.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} />
                <button type="button" className={bRemove + " self-end"} onClick={() => updRich({ deliverables: rich.deliverables.filter((_, j) => j !== i) })}>
                  Remove card
                </button>
              </div>
            ))}
            <button type="button" className={bAdd} onClick={() => updRich({ deliverables: [...rich.deliverables, { title: "", body: "" }] })}>
              + Add deliverable card
            </button>
          </div>

          {/* Closing */}
          <label className="flex flex-col gap-1">
            <span className={bLabel}>Closing line (italic sign-off)</span>
            <input className={bInput} value={rich.closing} onChange={(e) => updRich({ closing: e.target.value })} />
          </label>
        </div>
      )}
    </div>
  );
}


/* ============ Overview content builder ============
 * Edits the rich overview JSON (organizations.description) that the
 * client Overview page renders: hero paragraphs, focus card, build cards, photo.
 */
type OverviewState = {
  eyebrow: string;
  subtitle: string;
  paragraphs: string[];
  closingLead: string;
  closingAside: string;
  focus: { nextStep: string; owner: string; due: string; context: string };
  buildItems: { title: string; text: string }[];
  teamPhotoUrl: string;
};

const DEFAULT_CARDS = [
  { title: "Business Diagnostic", text: "A clear-eyed assessment of your current state based on data and stakeholder interviews." },
  { title: "Quantified Value Case", text: "A financial model identifying where value can be created or recovered." },
  { title: "Prioritized Roadmap", text: "A sequenced action plan ranking initiatives by impact and feasibility." },
  { title: "Recommended Engagement Plan", text: "A proposed scope, structure, and timeline for the ongoing work." },
  { title: "Executive Readout", text: "A presentation of findings and recommendations to your leadership team." },
];

function parseOverview(initial: string | null): OverviewState {
  const base: OverviewState = {
    eyebrow: "", subtitle: "", paragraphs: [], closingLead: "", closingAside: "",
    focus: { nextStep: "", owner: "", due: "", context: "" }, buildItems: [...DEFAULT_CARDS], teamPhotoUrl: "",
  };
  if (!initial) return base;
  try {
    const j = JSON.parse(initial);
    if (typeof j !== "object" || j === null) return { ...base, paragraphs: initial.split(/\n\s*\n/) };
    return {
      eyebrow: j.eyebrow ?? "", subtitle: j.subtitle ?? "",
      paragraphs: (j.paragraphs ?? []).map((p: any) => (typeof p === "string" ? p : p.text ?? "")),
      closingLead: j.closingLead ?? "", closingAside: j.closingAside ?? "",
      focus: { nextStep: j.focus?.nextStep ?? "", owner: j.focus?.owner ?? "", due: j.focus?.due ?? "", context: j.focus?.context ?? "" },
      buildItems: (j.buildItems?.length ? j.buildItems : DEFAULT_CARDS).map((b: any) => ({ title: b.title ?? "", text: b.text ?? "" })),
      teamPhotoUrl: j.teamPhotoUrl ?? "",
    };
  } catch {
    return { ...base, paragraphs: initial.split(/\n\s*\n/) };
  }
}

function serializeOverview(o: OverviewState): string {
  const out: any = {};
  if (o.eyebrow.trim()) out.eyebrow = o.eyebrow.trim();
  if (o.subtitle.trim()) out.subtitle = o.subtitle.trim();
  const paras = o.paragraphs.filter((p) => p.trim());
  if (paras.length) out.paragraphs = paras;
  if (o.closingLead.trim()) out.closingLead = o.closingLead.trim();
  if (o.closingAside.trim()) out.closingAside = o.closingAside.trim();
  const f: any = {};
  if (o.focus.nextStep.trim()) f.nextStep = o.focus.nextStep.trim();
  if (o.focus.owner.trim()) f.owner = o.focus.owner.trim();
  if (o.focus.due.trim()) f.due = o.focus.due.trim();
  if (o.focus.context.trim()) f.context = o.focus.context.trim();
  if (Object.keys(f).length) out.focus = f;
  const cards = o.buildItems.filter((b) => b.title.trim() || b.text.trim());
  if (cards.length) out.buildItems = cards;
  if (o.teamPhotoUrl.trim()) out.teamPhotoUrl = o.teamPhotoUrl.trim();
  return JSON.stringify(out, null, 2);
}

function OverviewBodyBuilder({ initial, onChange, slug, notify }: { initial: string | null; onChange: (v: string) => void; slug?: string; notify?: (msg: string, bad?: boolean) => void }) {
  const [photoBusy, setPhotoBusy] = React.useState(false);
  const [o, setO] = React.useState<OverviewState>(() => parseOverview(initial));
  const upd = (patch: Partial<OverviewState>) => {
    const next = { ...o, ...patch };
    setO(next);
    onChange(serializeOverview(next));
  };
  return (
    <div className="flex flex-col gap-5 rounded-md border border-line-subtle bg-snow p-4">
      <div className="flex flex-col gap-2.5">
        <span className={bLabel}>Hero paragraphs (the big intro under the title)</span>
        {o.paragraphs.map((p, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded border border-line-subtle bg-paper p-3">
            <textarea rows={3} className={bInput} value={p} onChange={(e) => upd({ paragraphs: o.paragraphs.map((x, j) => (j === i ? e.target.value : x)) })} />
            <button type="button" className={bRemove + " self-end"} onClick={() => upd({ paragraphs: o.paragraphs.filter((_, j) => j !== i) })}>Remove paragraph</button>
          </div>
        ))}
        <button type="button" className={bAdd} onClick={() => upd({ paragraphs: [...o.paragraphs, ""] })}>+ Add paragraph</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className={bLabel}>Focus card · next step</span>
          <input className={bInput} value={o.focus.nextStep} onChange={(e) => upd({ focus: { ...o.focus, nextStep: e.target.value } })} /></label>
        <label className="flex flex-col gap-1"><span className={bLabel}>Focus card · owner</span>
          <input className={bInput} value={o.focus.owner} onChange={(e) => upd({ focus: { ...o.focus, owner: e.target.value } })} /></label>
        <label className="flex flex-col gap-1"><span className={bLabel}>Focus card · due</span>
          <input className={bInput} value={o.focus.due} onChange={(e) => upd({ focus: { ...o.focus, due: e.target.value } })} /></label>
        <label className="flex flex-col gap-1"><span className={bLabel}>Focus card · context line</span>
          <input className={bInput} value={o.focus.context} onChange={(e) => upd({ focus: { ...o.focus, context: e.target.value } })} /></label>
      </div>

      <div className="flex flex-col gap-2.5">
        <span className={bLabel}>“What we’re building for you” cards</span>
        {o.buildItems.map((b, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded border border-line-subtle bg-paper p-3">
            <input className={bInput} placeholder="Card title" value={b.title} onChange={(e) => upd({ buildItems: o.buildItems.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
            <textarea rows={2} className={bInput} placeholder="Card text" value={b.text} onChange={(e) => upd({ buildItems: o.buildItems.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)) })} />
            <button type="button" className={bRemove + " self-end"} onClick={() => upd({ buildItems: o.buildItems.filter((_, j) => j !== i) })}>Remove card</button>
          </div>
        ))}
        <button type="button" className={bAdd} onClick={() => upd({ buildItems: [...o.buildItems, { title: "", text: "" }] })}>+ Add card</button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1"><span className={bLabel}>Closing lead (bold line by the photo)</span>
          <input className={bInput} value={o.closingLead} onChange={(e) => upd({ closingLead: e.target.value })} /></label>
        <label className="flex flex-col gap-1"><span className={bLabel}>Closing aside (italic line)</span>
          <input className={bInput} value={o.closingAside} onChange={(e) => upd({ closingAside: e.target.value })} /></label>
      </div>

      <label className="flex flex-col gap-1">
        <span className={bLabel}>Photo URL (blank = default team photo · uploads arrive with Resources)</span>
        <div className="flex flex-wrap items-center gap-3">
                  <input className={bInput} placeholder="/assets/team-session.jpeg" value={o.teamPhotoUrl} onChange={(e) => upd({ teamPhotoUrl: e.target.value })} />
                  <label className={`${btnGhost} cursor-pointer`}>
                    {photoBusy ? "Uploading…" : "Upload photo"}
                    <input type="file" accept="image/*" className="hidden" onChange={async (ev) => {
                      const f = ev.target.files?.[0]; ev.target.value = "";
                      if (!f || !slug) return;
                      setPhotoBusy(true);
                      try {
                        const fd = new FormData();
                        fd.append("file", f); fd.append("slug", slug); fd.append("sign", "long");
                        const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
                        const json = await res.json();
                        if (!res.ok) throw new Error(json.error || "Upload failed");
                        upd({ teamPhotoUrl: json.signed_url || "" });
                        notify?.("Photo uploaded, hit Save Overview to publish it.");
                      } catch (err: any) { notify?.(err.message, true); } finally { setPhotoBusy(false); }
                    }} />
                  </label>
                </div>
      </label>
    </div>
  );
}
