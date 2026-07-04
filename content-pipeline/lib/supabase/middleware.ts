import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Refreshes the Supabase auth session on every request and redirects
 * unauthenticated users away from protected routes.
 *
 * Called from `proxy.ts` (Next.js 16's renamed `middleware.ts` convention).
 * Kept in its own module, per the Supabase `@supabase/ssr` recipe, so the
 * proxy entry point itself stays a thin wrapper.
 */
export async function updateSession(request: NextRequest) {
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

  // IMPORTANT: do not run any logic between createServerClient and
  // getUser(). A simple mistake could make it very hard to debug issues
  // with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");
  // Vercel's cron invoker has no Supabase session cookie -- this route
  // enforces its own (stronger) CRON_SECRET bearer-token check instead,
  // see app/api/cron/check-renders/route.ts.
  const isCronRoute = request.nextUrl.pathname.startsWith("/api/cron/");

  if (!user && !isLoginRoute && !isCronRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // IMPORTANT: `supabaseResponse` (with its refreshed cookies) must be
  // returned as-is, or the session refresh will not propagate to the
  // browser / following Server Components.
  return supabaseResponse;
}
