"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ReviewQueueItem } from "./page";

interface Props {
  item: ReviewQueueItem;
}

const VARIANT_FIELDS = [
  { key: "youtube_desc" as const, label: "YouTube description" },
  { key: "ig_caption" as const, label: "Instagram caption" },
  { key: "tiktok_caption" as const, label: "TikTok caption" },
];

/** Formats a Date as the value a `<input type="datetime-local">` expects,
 * in the browser's local timezone (not UTC -- toISOString() would shift
 * the displayed time away from what the user actually picked). */
function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatAxisLabel(axis: string): string {
  return axis
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * One review queue card (Phase 7, section 1). Inline-editable script and
 * platform variants -- there's no separate "edit mode": every field is
 * always an editable input, and edits are persisted via PATCH right
 * before an approve/reject action goes through, per the brief.
 */
export function ReviewCard({ item }: Props) {
  const router = useRouter();

  const [scriptText, setScriptText] = useState(item.script_text ?? "");
  const [variants, setVariants] = useState({
    youtube_desc: item.platform_variants?.youtube_desc ?? "",
    ig_caption: item.platform_variants?.ig_caption ?? "",
    tiktok_caption: item.platform_variants?.tiktok_caption ?? "",
  });
  const [scheduledAt, setScheduledAt] = useState(() => toDatetimeLocalValue(new Date()));

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);

  const isDirty =
    scriptText !== (item.script_text ?? "") ||
    variants.youtube_desc !== (item.platform_variants?.youtube_desc ?? "") ||
    variants.ig_caption !== (item.platform_variants?.ig_caption ?? "") ||
    variants.tiktok_caption !== (item.platform_variants?.tiktok_caption ?? "");

  async function saveEditsIfDirty(): Promise<boolean> {
    if (!isDirty) return true;

    const response = await fetch(`/api/content-items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scriptText, platformVariants: variants }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? `Failed to save edits (${response.status}).`);
      return false;
    }
    return true;
  }

  async function handleApprove() {
    setError(null);
    setIsSubmitting(true);
    try {
      if (!(await saveEditsIfDirty())) return;

      const scheduledAtIso = new Date(scheduledAt).toISOString();
      const response = await fetch(`/api/content-items/${item.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduledAt: scheduledAtIso }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? `Approve failed (${response.status}).`);
        return;
      }

      setRemoved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReject() {
    if (!rejectReason.trim()) return;

    setError(null);
    setIsSubmitting(true);
    try {
      if (!(await saveEditsIfDirty())) return;

      const response = await fetch(`/api/content-items/${item.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason.trim() }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? `Reject failed (${response.status}).`);
        return;
      }

      setRemoved(true);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (removed) {
    return null;
  }

  const sourceUrls = (item.source_urls ?? []).filter((url): url is string => typeof url === "string");
  const qaAxes = Object.entries(item.qa_score ?? {});

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{item.case_title}</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.case_region ?? "Region not set"}</p>
        </div>
        <span className="text-xs text-zinc-400 dark:text-zinc-500">
          Waiting since {new Date(item.created_at).toLocaleString()}
        </span>
      </div>

      {sourceUrls.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Sources
          </span>
          <ul className="flex flex-wrap gap-3">
            {sourceUrls.map((url) => (
              <li key={url}>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  {new URL(url).hostname}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {qaAxes.length > 0 && (
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            QA score breakdown (diagnostic only, not editable)
          </span>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            {qaAxes.map(([axis, score]) => (
              <div key={axis} className="flex justify-between rounded bg-zinc-50 px-2 py-1 text-xs dark:bg-zinc-900">
                <dt className="text-zinc-600 dark:text-zinc-400">{formatAxisLabel(axis)}</dt>
                <dd className="font-medium text-zinc-900 dark:text-zinc-100">{score}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="flex flex-col gap-1">
        <label htmlFor={`script-${item.id}`} className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Script
        </label>
        <textarea
          id={`script-${item.id}`}
          value={scriptText}
          onChange={(e) => setScriptText(e.target.value)}
          rows={10}
          className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-1">
        {VARIANT_FIELDS.map((field) => (
          <div key={field.key} className="flex flex-col gap-1">
            <label
              htmlFor={`${field.key}-${item.id}`}
              className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
            >
              {field.label}
            </label>
            <textarea
              id={`${field.key}-${item.id}`}
              value={variants[field.key]}
              onChange={(e) => setVariants((prev) => ({ ...prev, [field.key]: e.target.value }))}
              rows={2}
              className="w-full resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1 sm:w-64">
        <label htmlFor={`scheduled-${item.id}`} className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Schedule for
        </label>
        <input
          id={`scheduled-${item.id}`}
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleApprove}
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {isSubmitting ? "Working..." : "Approve"}
        </button>

        {!isRejecting ? (
          <button
            type="button"
            onClick={() => setIsRejecting(true)}
            disabled={isSubmitting}
            className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
          >
            Reject
          </button>
        ) : (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              type="text"
              autoFocus
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejecting (required)"
              className="min-w-64 flex-1 rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-red-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button
              type="button"
              onClick={handleReject}
              disabled={isSubmitting || !rejectReason.trim()}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
            >
              Confirm reject
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRejecting(false);
                setRejectReason("");
                setError(null);
              }}
              disabled={isSubmitting}
              className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
