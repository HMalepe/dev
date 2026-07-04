import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and Route
 * Handlers. Reads/writes the user's session via cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // `setAll` was called from a Server Component that can't set
            // cookies. Safe to ignore as long as proxy.ts is refreshing
            // the session (see proxy.ts / lib/supabase/proxy.ts).
          }
        },
      },
    }
  );
}

/**
 * Privileged client using the Supabase service role key. Bypasses Row Level
 * Security entirely, so it must NEVER be imported into any client component
 * or route that isn't fully server-only (the `server-only` import above
 * enforces this at build time).
 *
 * There is exactly one user in this app, so RLS is a formality rather than a
 * multi-tenant boundary — but the service role client is still kept separate
 * so future server-only jobs (agents, cron, webhooks) don't accidentally
 * depend on a signed-in user's session.
 */
export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
