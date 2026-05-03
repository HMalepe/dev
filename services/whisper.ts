// Whisper API — OpenAI speech-to-text
// Docs: https://platform.openai.com/docs/guides/speech-to-text

export interface WhisperTranscriptSegment {
  id: number;
  start: number; // seconds
  end: number;
  text: string;
}

export interface WhisperResponse {
  text: string;           // full transcript
  language: string;
  duration: number;       // seconds
  segments: WhisperTranscriptSegment[];
}

// Submits an audio file for transcription. Returns a structured transcript
// with per-segment timestamps for syncing with the UI timeline.
export async function transcribeAudio(
  audioUri: string,
  apiKey: string
): Promise<WhisperResponse> {
  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'recording.m4a',
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'verbose_json');
  formData.append('timestamp_granularities[]', 'segment');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Whisper API error ${response.status}: ${err}`);
  }

  return response.json() as Promise<WhisperResponse>;
}
