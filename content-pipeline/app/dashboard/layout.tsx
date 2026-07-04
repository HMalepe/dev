import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const NAV_LINKS = [
  { href: "/dashboard", label: "Home" },
  { href: "/dashboard/review", label: "Review Queue" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/analytics", label: "Analytics" },
];

/**
 * Shared nav shell for every /dashboard/* route (Phase 7). Auth check here
 * is defense-in-depth on top of proxy.ts's own redirect, same rationale as
 * the pre-existing check in app/dashboard/page.tsx (kept as-is, so it's
 * still checked twice -- cheap, and consistent with this codebase's
 * existing "layered checks over a single point of failure" pattern for
 * auth specifically).
 */
export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <nav className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center gap-6">
          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Content Pipeline</span>
          <div className="flex items-center gap-4">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</span>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </nav>
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
