"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/** /settings: your name and photo. Everest-branded, self-service. */
export default function AccountSettings() {
  const supabase = React.useMemo(() => createClient(), []);
  const router = useRouter();
  const [name, setName] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState<string | null>(null);
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }
      const { data: p } = await supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single();
      setName(p?.full_name ?? "");
      setAvatarUrl(p?.avatar_url ?? null);
    })();
  }, [supabase, router]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null); setErr(null);
    try {
      const fd = new FormData();
      fd.append("full_name", name);
      if (file) fd.append("avatar", file);
      const res = await fetch("/api/account/profile", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Update failed");
      if (json.avatar_url) setAvatarUrl(json.avatar_url);
      setFile(null);
      setMsg("Saved. Your profile is updated.");
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-storm px-6">
      <form onSubmit={save} className="w-full max-w-[440px] animate-fade-up overflow-hidden rounded-lg bg-paper shadow-login">
        <div className="bg-granite px-8 py-6">
          <div className="font-condensed text-[11px] font-bold uppercase tracking-eyebrow text-gold">Account</div>
          <h1 className="mt-1 font-display text-[26px] uppercase tracking-display text-white">Your Profile</h1>
        </div>
        <div className="flex flex-col gap-5 px-8 py-7">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-storm">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                <span className="font-display text-[22px] uppercase text-gold">{(name || "?").slice(0, 1)}</span>
              )}
            </div>
            <label className="cursor-pointer rounded border border-line-subtle bg-snow px-4 py-2 font-condensed text-[11px] font-bold uppercase tracking-label text-storm transition-colors hover:border-teal">
              {file ? file.name.slice(0, 22) : "Choose photo"}
              <input type="file" accept="image/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <label className="flex flex-col gap-1.5">
            <span className="font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75">Your name</span>
            <input className="rounded border border-line-subtle bg-snow px-4 py-3 text-[14px] text-ink outline-none transition-shadow focus:border-teal focus:shadow-focus" value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" />
          </label>
          {err && <div className="rounded bg-error-ink/10 px-4 py-2.5 text-[13px] text-error-ink">{err}</div>}
          {msg && <div className="rounded bg-teal-50 px-4 py-2.5 text-[13px] text-storm">{msg}</div>}
          <div className="flex items-center justify-between">
            <button type="submit" disabled={busy} className="rounded bg-gold px-6 py-3 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-transform duration-150 hover:bg-gold-deep active:scale-[0.97]">
              {busy ? "Saving\u2026" : "Save profile"}
            </button>
            <button type="button" onClick={() => router.back()} className="font-condensed text-[11px] font-bold uppercase tracking-label text-slate-50 hover:text-storm">Back</button>
          </div>
        </div>
      </form>
    </div>
  );
}
