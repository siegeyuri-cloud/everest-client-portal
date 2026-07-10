"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";
import { getPostLoginPath } from "@/lib/auth";
import LoginScreen from "@/components/portal/LoginScreen";

/**
 * STEP 13 — the real login, wearing the design.
 * LoginScreen (Claude Design) is the face; Supabase is the lock.
 * The database decides where each account lands (admin vs client portal).
 */
export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [error, setError] = useState(false);
  const [errorText, setErrorText] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  // Already signed in? Skip the form.
  useEffect(() => {
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (user) {
        const path = await getPostLoginPath(supabase);
        if (path !== "/login") router.replace(path);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSignIn(email: string, password: string) {
    setLoading(true);
    setError(false);
    setNotice(undefined);
    const { error: err } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (err) {
      setError(true);
      setErrorText(undefined); // use the design's default copy
      setLoading(false);
      return;
    }
    const path = await getPostLoginPath(supabase);
    router.replace(path);
    router.refresh();
  }

  async function handleForgot(email: string) {
    setError(false);
    setNotice(undefined);
    if (!email) {
      setError(true);
      setErrorText("Type your email above first, then tap Forgot password.");
      return;
    }
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/set-password`,
    });
    if (err) {
      setError(true);
      setErrorText(err.message);
    } else {
      setNotice("Reset link sent \u2014 check your email (it can take a minute).");
    }
  }

  return (
    <LoginScreen
      logoUrl="/assets/logo-horizontal-white.png"
      portalUrl="clients.everestcollective.com"
      error={error}
      errorText={errorText}
      notice={notice}
      loading={loading}
      onSubmit={handleSignIn}
      onForgot={handleForgot}
    />
  );
}
