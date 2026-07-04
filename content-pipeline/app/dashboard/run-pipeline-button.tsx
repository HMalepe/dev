"use client";

import { useState } from "react";

interface PipelineResult {
  id?: string;
  case_title?: string;
  stage?: string;
  qa_result?: string | null;
  rejection_reason?: string | null;
  error?: string;
  raw?: string;
}

/**
 * Bare trigger button per the Phase 2 brief: calls run-pipeline and shows
 * the resulting row's stage/qa_result. This is intentionally minimal —
 * Phase 7 builds the real review queue UI.
 */
export function RunPipelineButton() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<PipelineResult | null>(null);

  async function handleClick() {
    setIsRunning(true);
    setResult(null);
    try {
      const response = await fetch("/api/agents/run-pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as PipelineResult;
      setResult(data);
    } catch (error) {
      setResult({ error: (error as Error).message });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-4">
      <button
        type="button"
        onClick={handleClick}
        disabled={isRunning}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {isRunning ? "Running Research \u2192 Draft \u2192 QA..." : "Generate New Case"}
      </button>

      {result && (
        <div className="w-full rounded-md border border-zinc-200 bg-white p-4 text-left text-sm dark:border-zinc-800 dark:bg-zinc-950">
          {result.error ? (
            <>
              <p className="font-medium text-red-600 dark:text-red-400">Error</p>
              <p className="mt-1 text-zinc-600 dark:text-zinc-400">{result.error}</p>
              {result.raw && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-zinc-500">
                  {result.raw}
                </pre>
              )}
            </>
          ) : (
            <dl className="space-y-1">
              <div>
                <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">Case: </dt>
                <dd className="inline text-zinc-600 dark:text-zinc-400">{result.case_title}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">Stage: </dt>
                <dd className="inline text-zinc-600 dark:text-zinc-400">{result.stage}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">QA result: </dt>
                <dd className="inline text-zinc-600 dark:text-zinc-400">
                  {result.qa_result ?? "(pipeline did not reach QA)"}
                </dd>
              </div>
              {result.rejection_reason && (
                <div>
                  <dt className="inline font-medium text-zinc-700 dark:text-zinc-300">
                    Rejection reason:{" "}
                  </dt>
                  <dd className="inline text-zinc-600 dark:text-zinc-400">
                    {result.rejection_reason}
                  </dd>
                </div>
              )}
            </dl>
          )}
        </div>
      )}
    </div>
  );
}
