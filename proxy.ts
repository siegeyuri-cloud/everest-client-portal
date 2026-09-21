import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Gala registration is public by design: invited guests, ticket buyers and
// sponsors complete a registration without ever having a portal account.
// Everything else still requires a session.
const PUBLIC_PATHS = ["/login", "/auth", "/api/gala", "/gala"];

export async function proxy(request: NextRequest) {
  // One deployment, two front doors. gala.everestcollective.com serves
  // the gala page at its own root, so an invitation can carry a clean
  // hostname with no path on it. A rewrite rather than a redirect, so
  // the address bar keeps the short form.
  //
  // Only the bare root is rewritten. Everything else on that hostname
  // resolves normally, which is what keeps /gala/ticket/<token> and the
  // font and image files working.
  const host = (request.headers.get("host") ?? "").split(":")[0];
  if (host.startsWith("gala.") && request.nextUrl.pathname === "/") {
    return NextResponse.rewrite(new URL("/gala", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Skip static assets so fonts, images, and public PDFs load on /login
    // (previously fonts were redirected to /login -> Georgia fallback).
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2|woff|ttf|otf|pdf)$).*)",
  ],
};