"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

/** /no-access — branded "not linked / not allowed" screen. */
export default function NoAccess() {
  const router = useRouter();
  const supabase = createClient();

  return (
    <section className="box-border flex min-h-screen flex-col items-center justify-center gap-8 bg-granite px-6 py-[72px]">
      <img src="/assets/logo-horizontal-white.png" alt="Everest Collective" className="h-11 w-auto" />

      <div className="w-full max-w-[560px] animate-fade-up overflow-hidden rounded-lg bg-paper shadow-login">
        <div className="h-1 bg-gold" />
        <div className="flex flex-col gap-3 px-9 pb-6 pt-7">
          <div className="flex flex-col gap-2">
            <div className="font-condensed text-[13px] font-bold uppercase tracking-eyebrow text-gold-deep">
              Access
            </div>
            <div className="font-display text-[20px] uppercase leading-[1.1] tracking-display text-storm">
              Collective Error
            </div>
            <p className="text-[13px] leading-snug text-slate-75">
              Either we haven&rsquo;t reached this point yet, or you don&rsquo;t currently have
              access to this section.
            </p>
            <p className="text-[12px] italic leading-snug text-slate-50">
              If you believe you should have access, please reach out to your Everest Collective
              contact.
            </p>
          </div>

          <div className="flex items-center gap-3 border-t border-line-subtle pt-3.5">
            <button
              onClick={() => router.replace("/login")}
              className="rounded bg-gold px-5 py-2.5 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,transform] duration-200 ease-climb hover:bg-gold-deep active:translate-y-px"
            >
              Got it
            </button>
            <button
              onClick={async () => {
                await supabase.auth.signOut();
                router.replace("/login");
              }}
              className="rounded border border-line px-4 py-2.5 font-condensed text-[13px] font-bold uppercase tracking-label text-storm transition-[background,border-color] duration-200 ease-climb hover:border-storm hover:bg-black/[0.04]"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div className="font-condensed text-[12px] uppercase tracking-wide text-ondark-muted">
        clients.everestcollective.com
      </div>
    </section>
  );
}
