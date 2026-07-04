import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

/**
 * Bare authenticated placeholder. Intentionally empty — later phases build
 * the real dashboard (content review queue, publish status, etc.) here.
 */
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Proxy already redirects unauthenticated requests to /login; this is a
  // defense-in-depth check for this Server Component specifically.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-24 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
        Dashboard — Phase 0 shell
      </h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Signed in as {user.email}. Session is live.
      </p>
      <form action={signOut}>
        <button
          type="submit"
          className="mt-2 rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
