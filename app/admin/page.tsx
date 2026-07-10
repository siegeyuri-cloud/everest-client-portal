"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * /admin — Everest Admin Portal (v1: client list).
 * Admins only; the proxy guarantees a session and getPostLoginPath sends
 * non-admins away, but we belt-and-suspenders check is_everest_admin too.
 */

type OrgRow = {
  id: string;
  name: string;
  slug: string;
  engagement_type: string | null;
  status: string | null;
  updated_at: string;
  members: number;
  deleted_at?: string | null;
};


const TRASH_DAYS = 30;
const daysLeft = (deletedAt: string) =>
  Math.max(0, TRASH_DAYS - Math.floor((Date.now() - new Date(deletedAt).getTime()) / 86400000));

export default function AdminDashboard() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [orgs, setOrgs] = React.useState<OrgRow[] | null>(null);
  const [adminEmail, setAdminEmail] = React.useState("");
  const [adminMsg, setAdminMsg] = React.useState<string | null>(null);
  async function addAdmin(e: React.FormEvent) {
    e.preventDefault();
    setAdminMsg(null);
    const res = await fetch("/api/admin/add-admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: adminEmail }) });
    const json = await res.json();
    setAdminMsg(res.ok ? (json.mode === "promoted" ? "Promoted to admin." : "Admin invite sent.") : json.error);
    if (res.ok) setAdminEmail("");
  }
  const [me, setMe] = React.useState<string>("");

  React.useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("email, is_everest_admin")
        .eq("id", user.id)
        .single();
      if (!profile?.is_everest_admin) {
        router.replace("/no-access");
        return;
      }
      setMe(profile.email ?? "");

      const [{ data: organizations }, { data: memberships }] = await Promise.all([
        supabase
          .from("organizations")
          .select("id, name, slug, engagement_type, status, updated_at, deleted_at")
          .order("updated_at", { ascending: false }),
        supabase.from("organization_members").select("organization_id"),
      ]);

      const counts = new Map<string, number>();
      (memberships ?? []).forEach((m: any) =>
        counts.set(m.organization_id, (counts.get(m.organization_id) ?? 0) + 1),
      );

      setOrgs(
        (organizations ?? []).map((o: any) => ({
          ...o,
          members: counts.get(o.id) ?? 0,
        })),
      );
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const live = (orgs ?? []).filter((o: any) => !o.deleted_at);
  const trashed = (orgs ?? []).filter((o: any) => o.deleted_at && daysLeft(o.deleted_at) > 0);

  async function trashOrg(o: any) {
    if (!confirm(`Move "${o.name}" to trash? Their whole portal goes offline immediately. You can restore it within ${TRASH_DAYS} days.`)) return;
    await supabase.from("organizations").update({ deleted_at: new Date().toISOString() }).eq("id", o.id);
    setOrgs((xs) => (xs ?? []).map((x) => (x.id === o.id ? { ...x, deleted_at: new Date().toISOString() } : x)));
  }
  async function restoreOrg(o: any) {
    await supabase.from("organizations").update({ deleted_at: null }).eq("id", o.id);
    setOrgs((xs) => (xs ?? []).map((x) => (x.id === o.id ? { ...x, deleted_at: null } : x)));
  }


  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

  return (
    <div className="min-h-screen bg-snow">
      {/* Header */}
      <header className="bg-storm">
        <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 px-9 py-6">
          <div className="flex items-center gap-4">
            <img src="/assets/logo-horizontal-white.png" alt="Everest Collective" className="h-7 w-auto" />
            <span className="border-l border-ondark-line pl-4 font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold">
              Admin Portal
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-[12.5px] text-ondark-muted">{me}</span>
            <a href="/settings" className="font-condensed text-[12px] font-bold uppercase tracking-wide text-ondark-muted transition-colors hover:text-teal">Settings</a>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              className="font-condensed text-[12px] font-bold uppercase tracking-wide text-teal"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[1080px] animate-fade-up px-9 pb-16 pt-12">
        <div className="flex flex-wrap items-end justify-between gap-6 pb-8">
          <div className="flex flex-col gap-3.5">
            <div className="h-1 w-11 bg-gold" />
            <div className="font-condensed text-[14px] font-bold uppercase tracking-eyebrow text-gold-deep">
              All Clients
            </div>
            <h1 className="font-display text-[clamp(26px,3.5vw,38px)] uppercase leading-[1.1] tracking-display text-storm">
              Client Portals
            </h1>
          </div>
          <Link
            href="/admin/new"
            className="rounded bg-gold px-5 py-3 font-condensed text-[14px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px"
          >
            + New Client
          </Link>
        </div>

        {!orgs ? (
          <div className="py-16 text-center font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-slate-50">
            Loading clients…
          </div>
        ) : live.length === 0 ? (
          <div className="rounded-lg border-regular border-dashed border-slate-25 bg-paper px-8 py-14 text-center">
            <div className="text-[15px] text-slate-75">No clients yet — create the first one.</div>
          </div>
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-[18px]">
            {live.map((o) => (
              <div
                key={o.id}
                className="flex flex-col gap-4 rounded-lg border border-line-subtle bg-paper p-6 shadow-sm transition-[transform,box-shadow] duration-[320ms] ease-climb hover:-translate-y-1 hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="font-display text-[19px] uppercase leading-[1.15] tracking-display text-storm">
                      {o.name}
                    </div>
                    <div className="font-condensed text-[11px] uppercase tracking-label text-slate-50">
                      /{o.slug}
                    </div>
                  </div>
                  <span className="whitespace-nowrap rounded bg-teal-50 px-2.5 py-1 font-condensed text-[10.5px] font-bold uppercase tracking-label text-storm">
                    {o.status ?? "—"}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 text-[13px] text-slate-75">
                  <span>{o.engagement_type ?? "No engagement type"}</span>
                  <span>
                    {o.members} member{o.members === 1 ? "" : "s"} · Updated {fmt(o.updated_at)}
                  </span>
                </div>

                <div className="mt-auto flex items-center gap-2.5 border-t border-line-subtle pt-4">
                  <Link
                    href={`/${o.slug}`}
                    className="rounded border border-line px-3.5 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]"
                  >
                    Open portal
                  </Link>
                  <Link
                    href={`/admin/clients/${o.slug}`}
                    className="rounded bg-storm px-3.5 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-snow transition-[background] duration-200 ease-climb hover:bg-granite"
                  >
                    Edit portal
                  </Link>
                  <button onClick={(e) => { e.preventDefault(); trashOrg(o); }} className="font-condensed text-[11px] font-bold uppercase tracking-label text-error-ink transition-colors hover:text-error">
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <section className="mt-12 rounded-lg border border-line-subtle bg-paper p-6 shadow-sm">
          <h2 className="font-condensed text-[13px] font-bold uppercase tracking-label text-slate-75">Everest team admins</h2>
          <p className="mt-1 text-[12.5px] italic text-slate-50">Admins see every client, every editor, every note. Existing accounts are promoted instantly; new emails get an invite and arrive as admins.</p>
          <form onSubmit={addAdmin} noValidate className="mt-4 flex flex-wrap items-center gap-3">
            <input type="email" placeholder="name@everestcollective.com" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} className="min-w-[280px] flex-1 rounded border border-line-subtle bg-snow px-4 py-2.5 text-[14px] text-ink outline-none focus:border-teal" />
            <button type="submit" className="rounded bg-gold px-5 py-2.5 font-condensed text-[12px] font-bold uppercase tracking-label text-storm transition-transform duration-150 hover:bg-gold-deep active:scale-[0.97]">+ Add admin</button>
          </form>
          {adminMsg && <div className="mt-3 text-[13px] text-slate-75">{adminMsg}</div>}
        </section>

        {trashed.length > 0 && (
          <section className="mt-12">
            <h2 className="font-condensed text-[13px] font-bold uppercase tracking-label text-slate-75">Trash</h2>
            <p className="mt-1 text-[12.5px] italic text-slate-50">Deleted clients are offline and locked out. Restore within 30 days; after that they are gone for good.</p>
            <div className="mt-4 flex flex-col gap-3">
              {trashed.map((o: any) => (
                <div key={o.id} className="flex flex-wrap items-center gap-4 rounded-lg border border-line-subtle bg-paper px-5 py-4 opacity-80 shadow-sm">
                  <span className="text-[14.5px] font-semibold text-ink">{o.name}</span>
                  <span className="font-condensed text-[10.5px] font-bold uppercase tracking-label text-error-ink">{daysLeft(o.deleted_at)} days left</span>
                  <button onClick={() => restoreOrg(o)} className="ml-auto rounded bg-teal px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-white transition-all hover:bg-teal-deep">
                    Restore
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
