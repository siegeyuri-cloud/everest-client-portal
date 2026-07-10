"use client";

import * as React from "react";

/**
 * LoginScreen — black granite entry. One sign-in for everyone;
 * your app decides where the submit leads (client vs admin).
 *
 * Step 13 additions (all optional, design unchanged):
 *   loading  — disables the button + "Signing in…" label
 *   notice   — teal info strip (e.g. "Reset link sent")
 *   onForgot — renders the "Forgot password?" link
 */
export interface LoginScreenProps {
  logoUrl: string;          // {logoWhiteUrl}
  portalUrl: string;        // {portalUrl}
  error?: boolean;          // show the invalid-credentials strip
  errorText?: string;       // optional custom error copy
  notice?: string;          // teal info strip
  loading?: boolean;
  onSubmit?: (email: string, password: string) => void;
  onForgot?: (email: string) => void;
}

export default function LoginScreen({
  logoUrl,
  portalUrl,
  error = false,
  errorText,
  notice,
  loading = false,
  onSubmit,
  onForgot,
}: LoginScreenProps) {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");

  const fieldLabel =
    "font-condensed text-[11px] font-bold uppercase tracking-label text-slate-75";
  const fieldInput =
    "w-full rounded bg-snow border border-line-subtle px-3.5 py-2.5 text-[15px] text-ink outline-none transition-shadow duration-200 ease-climb focus:border-teal focus:shadow-focus";

  return (
    <section className="min-h-screen bg-granite flex flex-col items-center justify-center gap-8 px-6 py-[72px] box-border">
      <img src={logoUrl} alt="Everest Collective" className="h-11 w-auto" />

      <div className="w-full max-w-[440px] overflow-hidden rounded-lg bg-paper shadow-login animate-fade-up">
        <div className="h-1 bg-gold" />
        <form
          className="flex flex-col gap-5 px-10 pb-8 pt-10"
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit?.(email, password);
          }}
        >
          <div className="flex flex-col gap-2">
            <div className="font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold-deep">
              Portal Sign In
            </div>
            <div className="font-display text-[25px] leading-[1.1] uppercase tracking-display text-storm">
              Welcome back
            </div>
            <div className="text-[13px] leading-relaxed text-slate-75">
              One sign in for clients and the Everest team. Your account decides where you land.
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldInput}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={fieldInput}
            />
          </label>

          {error && (
            <div className="flex items-center gap-2.5 rounded border border-error-line bg-error-bg px-3.5 py-3 animate-fade-up">
              <span className="h-2 w-2 flex-none rounded-full bg-error-dot" />
              <span className="text-[13px] font-medium leading-snug text-error-ink">
                {errorText ??
                  "That email and password don\u2019t match. Check the note from your Everest guide."}
              </span>
            </div>
          )}

          {notice && (
            <div className="flex items-center gap-2.5 rounded border border-teal-50 bg-teal-25 px-3.5 py-3 animate-fade-up">
              <span className="h-2 w-2 flex-none rounded-full bg-teal-deep" />
              <span className="text-[13px] font-medium leading-snug text-storm">{notice}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-gold px-5 py-3 font-condensed text-[15px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px disabled:opacity-60"
          >
            {loading ? "Signing in\u2026" : "Sign in"}
          </button>

          <div className="flex items-center justify-between border-t border-line-subtle pt-4 text-[12px] text-slate-50">
            <span>Prepared and maintained by Everest Collective.</span>
            {onForgot && (
              <button
                type="button"
                onClick={() => onForgot(email)}
                className="font-condensed text-[11px] font-bold uppercase tracking-label text-teal-deep"
              >
                Forgot password?
              </button>
            )}
          </div>
        </form>
      </div>

      <div className="font-condensed text-[12px] uppercase tracking-wide text-ondark-muted">
        {portalUrl}
      </div>
    </section>
  );
}
