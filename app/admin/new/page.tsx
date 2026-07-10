"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

/**
 * /admin/new — Create New Client.
 * Portal Starting Point: Everest Default Template (full portal skeleton)
 * or Start Blank (org shell only). Optional first member invite.
 * Submits to /api/admin/create-client (server-side, service role).
 */

const slugify = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");

const label =
  "font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75";
const input =
  "w-full rounded bg-paper border border-line-subtle px-3.5 py-2.5 text-[15px] text-ink outline-none transition-shadow duration-200 ease-climb focus:border-teal focus:shadow-focus";

export default function NewClientPage() {
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [engagement, setEngagement] = React.useState("Discovery & Assessment Period");
  const [status, setStatus] = React.useState("In Progress");
  const [startingPoint, setStartingPoint] = React.useState<"template" | "blank">("template");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<"executive" | "staff">("executive");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError("Give the client a name.");
    if (!effectiveSlug) return setError("The URL slug can't be empty.");
    if (inviteEmail.trim() && !/^\S+@\S+\.\S+$/.test(inviteEmail.trim()))
      return setError("That doesn\u2019t look like an email address \u2014 e.g. name@company.com.");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/create-client", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: effectiveSlug,
          engagement_type: engagement.trim(),
          status: status.trim(),
          startingPoint,
          inviteEmail: inviteEmail.trim() || null,
          inviteRole,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
      router.replace("/admin");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-snow">
      <header className="bg-storm">
        <div className="mx-auto flex max-w-[1080px] items-center justify-between gap-4 px-9 py-6">
          <div className="flex items-center gap-4">
            <img src="/assets/logo-horizontal-white.png" alt="Everest Collective" className="h-7 w-auto" />
            <span className="border-l border-ondark-line pl-4 font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold">
              Command Center
            </span>
          </div>
          <Link href="/admin" className="font-condensed text-[12px] font-bold uppercase tracking-wide text-teal">
            ← All clients
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[720px] animate-fade-up px-9 pb-16 pt-12">
        <div className="flex flex-col gap-3.5 pb-8">
          <div className="h-1 w-11 bg-gold" />
          <div className="font-condensed text-[14px] font-bold uppercase tracking-eyebrow text-gold-deep">
            New Client
          </div>
          <h1 className="font-display text-[clamp(26px,3.5vw,36px)] uppercase leading-[1.1] tracking-display text-storm">
            Create a client portal
          </h1>
        </div>

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6 rounded-lg border border-line-subtle bg-paper p-8 shadow-sm">
          <label className="flex flex-col gap-1.5">
            <span className={label}>Organization name</span>
            <input
              className={input}
              placeholder="e.g. Acme Corporation"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={label}>Portal URL slug</span>
            <div className="flex items-center gap-2">
              <span className="whitespace-nowrap text-[13px] text-slate-50">clients.everestcollective.com/</span>
              <input
                className={input}
                value={effectiveSlug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
              />
            </div>
          </label>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className={label}>Engagement type</span>
              <input className={input} value={engagement} onChange={(e) => setEngagement(e.target.value)} />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={label}>Status</span>
              <select className={input} value={status} onChange={(e) => setStatus(e.target.value)}>
                <option>In Progress</option>
                <option>Onboarding</option>
                <option>Paused</option>
                <option>Complete</option>
              </select>
            </label>
          </div>

          {/* Portal starting point */}
          <div className="flex flex-col gap-3">
            <span className={label}>Portal starting point</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setStartingPoint("template")}
                className={[
                  "flex flex-col gap-1.5 rounded-md border-regular p-4 text-left transition-colors duration-200 ease-climb",
                  startingPoint === "template" ? "border-gold bg-gold-25" : "border-line-subtle bg-snow hover:border-line",
                ].join(" ")}
              >
                <span className="font-condensed text-[13px] font-bold uppercase tracking-label text-storm">
                  Everest Default Template
                </span>
                <span className="text-[12.5px] leading-relaxed text-slate-75">
                  Full skeleton: journey phases, key items, resource categories, and logistics — ready to customize.
                </span>
              </button>
              <button
                type="button"
                onClick={() => setStartingPoint("blank")}
                className={[
                  "flex flex-col gap-1.5 rounded-md border-regular p-4 text-left transition-colors duration-200 ease-climb",
                  startingPoint === "blank" ? "border-gold bg-gold-25" : "border-line-subtle bg-snow hover:border-line",
                ].join(" ")}
              >
                <span className="font-condensed text-[13px] font-bold uppercase tracking-label text-storm">
                  Start Blank
                </span>
                <span className="text-[12.5px] leading-relaxed text-slate-75">
                  Just the portal shell — add journey, items, and resources by hand.
                </span>
              </button>
            </div>
          </div>

          {/* Optional first invite */}
          <div className="flex flex-col gap-3 border-t border-line-subtle pt-6">
            <span className={label}>Invite the first member (optional)</span>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_160px]">
              <input
                className={input}
                type="email"
                placeholder="name@clientcompany.com — leave empty to skip"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className={input}
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as "executive" | "staff")}
              >
                <option value="executive">Executive</option>
                <option value="staff">Staff</option>
              </select>
            </div>
            <span className="text-[12px] italic text-slate-50">
              They'll get an email to set their password, then land on this portal automatically.
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2.5 rounded border border-error-line bg-error-bg px-3.5 py-3 animate-fade-up">
              <span className="h-2 w-2 flex-none rounded-full bg-error-dot" />
              <span className="text-[13px] font-medium leading-snug text-error-ink">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="rounded bg-gold px-5 py-3.5 font-condensed text-[15px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px disabled:opacity-60"
          >
            {busy ? "Creating…" : "Create client portal"}
          </button>
        </form>
      </main>
    </div>
  );
}
