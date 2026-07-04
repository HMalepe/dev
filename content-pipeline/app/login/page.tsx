import { LoginForm } from "./login-form";

/**
 * Single email/password login form. No signup flow: this app has exactly
 * one user, ever, and that account is created manually once via the
 * Supabase dashboard.
 */
export default function LoginPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-24 dark:bg-black">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          Content Pipeline
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Sign in to continue
        </p>
      </div>
      <LoginForm />
    </div>
  );
}
