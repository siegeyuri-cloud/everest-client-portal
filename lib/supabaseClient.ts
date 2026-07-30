import { createBrowserClient } from "@supabase/ssr";

// Force the implicit (hash-token) flow for auth email links.
// PKCE reset links arrive as ?code= and require a browser-stored verifier,
// which breaks when a reset link is opened on a different device than it was
// requested from. Implicit flow delivers the session in the URL hash (the same
// way invites already work), which is cross-device safe. Normal email/password
// login does not use URL tokens, so it is unaffected.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { flowType: "implicit" } }
  );
}
