/**
 * Phase 1 calibration harness (docs/brand-voice-qa-rubric.md, section 7).
 *
 * Runs every fixture in qa-calibration/ through the real QA agent and checks
 * the result against qa-calibration/manifest.json's expectations. This is a
 * standalone dev script — it is NOT part of the Next.js app and nothing in
 * the app imports it. Per the rubric: don't wire QA into the live pipeline
 * until this passes.
 *
 * Usage: npm run qa:calibrate
 * Requires: ANTHROPIC_API_KEY in the environment (.env.local).
 */

import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { join } from "node:path";

loadEnv({ path: join(__dirname, "..", ".env.local") });

import { runQaCheck } from "../lib/agents/qa";
import type { QaAxisId } from "../lib/agents/qa/rubric";

interface ManifestFixture {
  file: string;
  expectedVerdict: "PASS" | "FAIL";
  expectedFailingAxis?: QaAxisId;
  note?: string;
}

interface Manifest {
  description: string;
  fixtures: ManifestFixture[];
}

const CALIBRATION_DIR = join(__dirname, "..", "qa-calibration");

function loadManifest(): Manifest {
  const raw = readFileSync(join(CALIBRATION_DIR, "manifest.json"), "utf-8");
  return JSON.parse(raw) as Manifest;
}

async function main() {
  const manifest = loadManifest();
  let correct = 0;
  const failures: string[] = [];

  console.log(`Running ${manifest.fixtures.length} calibration fixtures through the QA agent...\n`);

  for (const fixture of manifest.fixtures) {
    const scriptText = readFileSync(join(CALIBRATION_DIR, fixture.file), "utf-8");

    let result;
    try {
      result = await runQaCheck(scriptText);
    } catch (error) {
      console.log(`✗ ${fixture.file}\n  ERROR: ${(error as Error).message}\n`);
      failures.push(fixture.file);
      continue;
    }

    const verdictMatches = result.verdict === fixture.expectedVerdict;
    const axisMatches =
      !fixture.expectedFailingAxis || result.failingAxes.includes(fixture.expectedFailingAxis);
    const isCorrect = verdictMatches && axisMatches;

    if (isCorrect) {
      correct += 1;
      console.log(`✓ ${fixture.file} -> ${result.verdict}`);
    } else {
      failures.push(fixture.file);
      console.log(`✗ ${fixture.file}`);
      console.log(`  expected: ${fixture.expectedVerdict}${fixture.expectedFailingAxis ? ` (axis: ${fixture.expectedFailingAxis})` : ""}`);
      console.log(`  actual:   ${result.verdict} (failing axes: ${result.failingAxes.join(", ") || "none"})`);
      console.log(`  summary:  ${result.summary}`);
      for (const axis of result.axisResults) {
        if (axis.verdict === "fail") {
          console.log(`    - ${axis.label}: ${axis.score}/5 — ${axis.reason}`);
        }
      }
    }
  }

  const total = manifest.fixtures.length;
  const rate = ((correct / total) * 100).toFixed(0);

  console.log(`\n${correct}/${total} fixtures scored correctly (${rate}%).`);

  if (failures.length > 0) {
    console.log(`\nMismatched fixtures:\n  ${failures.join("\n  ")}`);
    console.log(
      "\nThe rubric is not discriminating correctly yet. Per docs/brand-voice-qa-rubric.md " +
        "section 7: do not wire QA into the live pipeline until every fixture passes."
    );
    process.exitCode = 1;
  } else {
    console.log("\nAll fixtures scored correctly. The rubric discriminates as expected.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
