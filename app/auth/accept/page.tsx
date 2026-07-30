"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * /auth/accept — invite AND password-reset links land here.
 * Supabase can deliver the session several ways depending on the flow:
 *   1. Hash tokens:  #access_token=...&refresh_token=...   (invites, implicit recovery)
 *   2. Token hash:   ?token_hash=...&type=recovery
 *   3. PKCE code:    ?code=...
 * Server routes can never read the hash, so this client page handles all of
 * them, turns the link into a real session, then sends the person to set a
 * password. Expired or already-used links get a clear message instead of a dead end.
 */
export default function AcceptLink() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [msg, setMsg] = React.useState("Opening your secure link\u2026");

  React.useEffect(() => {
    (async () => {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : "");

      const done = () => {
        try { window.history.replaceState({}, "", url.pathname); } catch {}
        router.replace("/set-password");
      };

      try {
        // Expired or already-used link: Supabase returns an error in the hash.
        if (hash.get("error_description") || hash.get("error")) {
          setMsg("This link has expired or was already used. Go to the login page, choose Forgot Password, and click the new link right away.");
          return;
        }

        // A previous click or auto-detection may have already created the session.
        const existing = await supabase.auth.getSession();
        if (existing.data.session) return done();

        // 1) Hash tokens (invites and implicit-flow recovery).
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          return done();
        }

        // 2) Token hash (verifyOtp path, cross-device safe).
        const token_hash = url.searchParams.get("token_hash");
        const type = url.searchParams.get("type");
        if (token_hash && type) {
          const { error } = await supabase.auth.verifyOtp({ token_hash, type: type as any });
          if (error) throw error;
          return done();
        }

        // 3) PKCE code (older reset links from before this fix).
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          return done();
        }

        setMsg("This link is missing its key. Go to the login page, choose Forgot Password, and click the new link directly from the email.");
      } catch (e: any) {
        // If something set a session despite the error, continue anyway.
        const recheck = await supabase.auth.getSession();
        if (recheck.data.session) return done();
        setMsg(e?.message ?? "This link could not be opened. Go to the login page and choose Forgot Password to get a fresh one.");
      }
    })();
  }, [router, supabase]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-storm px-6">
      <div className="w-full max-w-[420px] animate-fade-up rounded-lg bg-paper px-8 py-10 text-center shadow-login">
        <div className="font-condensed text-[11px] font-bold uppercase tracking-eyebrow text-gold">Everest Collective</div>
        <p className="mt-3 text-[14.5px] leading-relaxed text-slate-75">{msg}</p>
      </div>
    </div>
  );
}
