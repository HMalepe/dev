import { PLATFORM_COLORS, PLATFORM_LABELS } from "@/lib/platformCaps";
import type { CalendarPost } from "./page";

/** Border style + opacity encode status independently of platform color,
 * per the brief ("use opacity or a border style, not just color, so it's
 * readable without relying on color alone"). Failed additionally gets a
 * distinct red ring on top of its platform color, since a failure is the
 * one status that most needs to visually jump out. */
const STATUS_STYLES: Record<CalendarPost["status"], { border: string; opacity: string; label: string }> = {
  posted: { border: "border-solid", opacity: "opacity-100", label: "Posted" },
  ready: { border: "border-dashed", opacity: "opacity-100", label: "Ready (manual post)" },
  pending: { border: "border-solid", opacity: "opacity-60", label: "Pending" },
  rate_limited: { border: "border-dotted", opacity: "opacity-60", label: "Rate-limited" },
  failed: { border: "border-solid", opacity: "opacity-100", label: "Failed" },
};

export function PostCard({ post }: { post: CalendarPost }) {
  const colors = PLATFORM_COLORS[post.platform];
  const statusStyle = STATUS_STYLES[post.status];

  return (
    <div
      title={`${PLATFORM_LABELS[post.platform]} \u2014 ${statusStyle.label}${post.error_message ? `: ${post.error_message}` : ""}`}
      className={`rounded border-2 px-2 py-1 text-[11px] leading-tight ${colors.bg} ${colors.text} ${
        post.status === "failed" ? "border-red-600 dark:border-red-500" : colors.border
      } ${statusStyle.border} ${statusStyle.opacity}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-semibold">{PLATFORM_LABELS[post.platform]}</span>
        <span>{statusStyle.label}</span>
      </div>
      <div className="truncate">{post.case_title}</div>
    </div>
  );
}
