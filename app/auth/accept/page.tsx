"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/**
 * /auth/accept — invite links land here.
 * Supabase invite emails carry the session as #access_token=... in the URL hash,
 * which server routes can never see. This page reads the hash in the browser,
 * turns it into a real session, then sends the person to set their own password.
 */
export default function AcceptInvite() {
  const router = useRouter();
  const supabase = React.useMemo(() => createClient(), []);
  const [msg, setMsg] = React.useState("Opening your invitation\u2026");

  React.useEffect(() => {
    (async () => {
      try {
        const raw = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const params = new URLSearchParams(raw);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          window.location.hash = "";
          router.replace("/set-password");
          return;
        }
        // Already signed in from a previous click? Continue the ceremony.
        const { data } = await supabase.auth.getSession();
        if (data.session) {
          router.replace("/set-password");
          return;
        }
        setMsg("This invitation link is missing its key. Ask for a fresh invite and click it directly from the email.");
      } catch (e: any) {
        setMsg(e?.message ?? "This invitation could not be opened. Ask for a fresh invite.");
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
