// Supabase — auth, database, and audio file storage
// Tables: recordings, transcripts, users
// Storage bucket: audio-recordings

import type { Recording, Transcript } from '../types';

// ─── Config ───────────────────────────────────────────────────────────────────

// Injected from settings at runtime — never hardcoded
let supabaseUrl = '';
let supabaseAnonKey = '';

export function configureSupabase(url: string, anonKey: string) {
  supabaseUrl = url;
  supabaseAnonKey = anonKey;
}

// ─── Thin fetch wrapper ───────────────────────────────────────────────────────

async function supabaseFetch<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const response = await fetch(`${supabaseUrl}/rest/v1${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Supabase error ${response.status}: ${err}`);
  }

  return response.json() as Promise<T>;
}

// ─── Recordings ───────────────────────────────────────────────────────────────

export async function fetchRecordings(): Promise<Recording[]> {
  return supabaseFetch<Recording[]>(
    '/recordings?order=timestamp.desc&select=*'
  );
}

export async function saveRecording(recording: Recording): Promise<Recording> {
  return supabaseFetch<Recording>('/recordings', {
    method: 'POST',
    body: JSON.stringify(recording),
  });
}

export async function deleteRecording(id: string): Promise<void> {
  await supabaseFetch(`/recordings?id=eq.${id}`, { method: 'DELETE' });
}

// ─── Transcripts ──────────────────────────────────────────────────────────────

export async function fetchTranscript(recordingId: string): Promise<Transcript | null> {
  const results = await supabaseFetch<Transcript[]>(
    `/transcripts?recording_id=eq.${recordingId}&select=*`
  );
  return results[0] ?? null;
}

export async function saveTranscript(transcript: Transcript): Promise<Transcript> {
  return supabaseFetch<Transcript>('/transcripts', {
    method: 'POST',
    body: JSON.stringify(transcript),
  });
}

// ─── Audio storage ────────────────────────────────────────────────────────────

export async function uploadAudio(
  recordingId: string,
  audioUri: string
): Promise<string> {
  // In production: read file from audioUri, upload to Supabase Storage bucket
  // Returns the public URL of the uploaded file
  const path = `${recordingId}.m4a`;
  // Placeholder — full implementation requires expo-file-system
  return `${supabaseUrl}/storage/v1/object/public/audio-recordings/${path}`;
}
