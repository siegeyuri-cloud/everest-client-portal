"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { getPostLoginPath } from "@/lib/auth";

/** /set-password — first-login password screen for invited users, in the brand. */
export default function SetPasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace("/login?error=link-expired");
      else setReady(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== confirm) return setError("Passwords don't match.");
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    const path = await getPostLoginPath(supabase);
    router.replace(path);
    router.refresh();
  }

  const fieldLabel =
    "font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75";
  const fieldInput =
    "w-full rounded bg-snow border border-line-subtle px-3.5 py-2.5 text-[15px] text-ink outline-none transition-shadow duration-200 ease-climb focus:border-teal focus:shadow-focus";

  if (!ready) return null;

  return (
    <section className="box-border flex min-h-screen flex-col items-center justify-center gap-8 bg-granite px-6 py-[72px]">
      <img src="/assets/logo-horizontal-white.png" alt="Everest Collective" className="h-11 w-auto" />

      <div className="w-full max-w-[440px] animate-fade-up overflow-hidden rounded-lg bg-paper shadow-login">
        <div className="h-1 bg-gold" />
        <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-10 pb-8 pt-10">
          <div className="flex flex-col gap-2">
            <div className="font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold-deep">
              Account Access
            </div>
            <div className="font-display text-[25px] uppercase leading-[1.1] tracking-display text-storm">
              Reset your password
            </div>
            <div className="text-[13px] leading-relaxed text-slate-75">
              Enter a new password below. You will land in your portal right after.rsquo;ll land in your portal right after.
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>New password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldInput}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Confirm password</span>
            <input
              type="password"
              autoComplete="new-password"
              placeholder="Same again"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={fieldInput}
            />
          </label>

          {error && (
            <div className="flex items-center gap-2.5 rounded border border-error-line bg-error-bg px-3.5 py-3 animate-fade-up">
              <span className="h-2 w-2 flex-none rounded-full bg-error-dot" />
              <span className="text-[13px] font-medium leading-snug text-error-ink">{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-gold px-5 py-3 font-condensed text-[15px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px disabled:opacity-60"
          >
            {loading ? "Saving…" : "Save password"}
          </button>

          <div className="border-t border-line-subtle pt-4 text-center text-[12px] text-slate-50">
            Your portal is prepared and maintained by Everest Collective.
          </div>
        </form>
      </div>

      <div className="font-condensed text-[12px] uppercase tracking-wide text-ondark-muted">
        clients.everestcollective.com
      </div>
    </section>
  );
}
