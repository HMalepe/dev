import { createServiceRoleClient } from "@/lib/supabase/server";
import { logAgentCall } from "@/lib/logAgentCall";
import { textToSpeech } from "@/lib/integrations/elevenlabs";
import { uploadToStorage } from "@/lib/supabase/storage";
import { getAssetUrls, mergeAssetUrls } from "./assetUrls";
import { runAssembleAgent } from "./assemble";

const VOICEOVER_BUCKET = "voiceover-audio";

/**
 * Voiceover generation agent (Phase 3 section 5). Fetches script_text,
 * calls ElevenLabs, mirrors the audio into Supabase Storage, logs the
 * (character-based) cost, then internally chains into the assemble agent
 * -- mirroring the Phase 2 research -> draft -> qa internal-chaining
 * pattern rather than requiring the dashboard to call four separate
 * endpoints.
 *
 * As of Phase 7, this can legitimately be called twice for the same
 * content_item in a race: the approve endpoint calls it directly, and
 * the check-renders cron also calls it as a safety net for items that
 * reached 'scheduled' without a successful direct kickoff. Idempotent by
 * checking asset_urls.voiceover_url first -- a no-op return here avoids
 * double-billing ElevenLabs and clobbering an in-progress/finished
 * asset_urls state with a second, redundant generation.
 */
export async function runVoiceoverAgent(contentItemId: string): Promise<void> {
  const existingAssetUrls = await getAssetUrls(contentItemId);
  if (existingAssetUrls.voiceover_url) {
    return;
  }

  const supabase = createServiceRoleClient();
  const { data: item, error } = await supabase
    .from("content_items")
    .select("script_text")
    .eq("id", contentItemId)
    .single();

  if (error || !item?.script_text) {
    throw new Error(`runVoiceoverAgent: content_items row ${contentItemId} has no script_text`);
  }

  let result;
  try {
    result = await textToSpeech(item.script_text);
  } catch (ttsError) {
    await logAgentCall({
      contentItemId,
      agentName: "asset",
      model: "elevenlabs-tts",
      status: "fail",
      outputSummary: `ElevenLabs TTS request failed: ${(ttsError as Error).message}`,
    });
    throw ttsError;
  }

  const publicUrl = await uploadToStorage(
    VOICEOVER_BUCKET,
    `${contentItemId}.mp3`,
    result.audioBuffer,
    "audio/mpeg"
  );

  await mergeAssetUrls(contentItemId, { voiceover_url: publicUrl });

  await logAgentCall({
    contentItemId,
    agentName: "asset",
    model: "elevenlabs-tts",
    costUsd: result.costUsd,
    status: "success",
    outputSummary: `Generated ${result.characterCount} characters of narration audio (${result.model}), uploaded to ${VOICEOVER_BUCKET}/${contentItemId}.mp3`,
  });

  // Chain failures here are logged and stop the chain, same contract as
  // Phase 2's research -> draft -> qa: the content_items row is left at
  // its last successful state (voiceover_url populated, no render
  // submitted yet) rather than silently disappearing.
  try {
    await runAssembleAgent(contentItemId);
  } catch (assembleError) {
    console.error(`runVoiceoverAgent: assemble agent failed for ${contentItemId}`, assembleError);
  }
}
