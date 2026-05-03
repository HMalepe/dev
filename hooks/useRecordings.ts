import { useState, useCallback } from 'react';
import { MOCK_RECORDINGS } from '../mock/recordings';
import type { Recording } from '../types';

interface UseRecordingsResult {
  recordings: Recording[];
  isLoading: boolean;
  error: string | null;
  getById: (id: string) => Recording | undefined;
  refresh: () => void;
}

// In production this would fetch from Supabase. Currently wraps mock data
// with the same loading/error contract so components don't need to change.
export function useRecordings(): UseRecordingsResult {
  const [recordings] = useState<Recording[]>(MOCK_RECORDINGS);
  const [isLoading] = useState(false);
  const [error] = useState<string | null>(null);

  const getById = useCallback(
    (id: string) => recordings.find((r) => r.id === id),
    [recordings]
  );

  // Will trigger a refetch from Supabase in production
  const refresh = useCallback(() => {}, []);

  return { recordings, isLoading, error, getById, refresh };
}
