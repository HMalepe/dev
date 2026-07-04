/** Monday-start week utilities shared by the calendar and analytics views
 * (Phase 7) -- both default to "current week, navigable" per the brief,
 * and analytics' platform-posts chart explicitly uses "the same date
 * range as the calendar view". */

const DAY_MS = 24 * 60 * 60 * 1000;

export function formatDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Monday of the week containing `date`, at local midnight. */
export function getWeekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0 = Sunday
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Parses a `?week=YYYY-MM-DD` search param into that week's Monday,
 * falling back to the current week for a missing/invalid value. */
export function resolveWeekStart(weekParam: string | undefined): Date {
  if (weekParam) {
    const parsed = new Date(`${weekParam}T00:00:00`);
    if (!Number.isNaN(parsed.getTime())) {
      return getWeekStart(parsed);
    }
  }
  return getWeekStart(new Date());
}

export function formatWeekRangeLabel(weekStart: Date): string {
  const weekEnd = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const startLabel = weekStart.toLocaleDateString(undefined, opts);
  const endLabel = weekEnd.toLocaleDateString(undefined, { ...opts, year: "numeric" });
  return `${startLabel} \u2013 ${endLabel}`;
}
