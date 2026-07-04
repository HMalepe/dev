import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Redirects unauthenticated requests to /login for every route except
 * /login itself.
 *
 * Note: as of Next.js 16, the `middleware.ts` file convention was renamed
 * to `proxy.ts` (same runtime behavior, new name/file). See
 * https://nextjs.org/docs/app/api-reference/file-conventions/proxy
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image (Next.js internals)
     * - favicon.ico, and common static asset extensions
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
