export interface ComplianceFlags {
  minor_restricted: boolean;
  notes: string;
}

/** Research agent output. Only case_title/case_region/source_urls/
 * compliance_flags get persisted to content_items; the rest is passed
 * directly to the Draft agent without being written to the database
 * (per the Phase 2 brief: "pass directly to the Draft agent call ...
 * without persisting separately"). */
export interface ResearchBrief {
  case_title: string;
  case_region: string;
  source_urls: string[];
  timeline_summary: string;
  key_forensic_or_investigative_detail: string;
  hook_angle: string;
  compliance_flags: ComplianceFlags;
}

export interface PlatformVariants {
  youtube_desc: string;
  ig_caption: string;
  tiktok_caption: string;
}

export interface DraftOutput {
  script_text: string;
  platform_variants: PlatformVariants;
}

export interface QaFailingAxis {
  axis: string;
  reason: string;
}

export interface QaOutput {
  overall_result: "pass" | "fail";
  axis_scores: Record<string, number>;
  failing_axes: QaFailingAxis[];
}

/** Thrown when a model response can't be parsed as the expected JSON shape.
 * Carries the raw text so routes can return it for debugging, per the
 * brief's "return a 500 with the raw text for debugging" requirement. */
export class AgentParseError extends Error {
  readonly rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = "AgentParseError";
    this.rawText = rawText;
  }
}
