import type Anthropic from "@anthropic-ai/sdk";

/** Concatenates every text block in a Messages API response, ignoring
 * server-tool-use / tool-result blocks (e.g. web_search). Agents in this
 * pipeline are instructed to output raw JSON as their only text output, so
 * this is normally a single block. */
export function extractResponseText(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
}
