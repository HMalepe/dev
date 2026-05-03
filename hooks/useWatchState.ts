import { useState, useEffect, useRef } from 'react';
import { MOCK_WATCH_STATE } from '../mock/recordings';
import type { WatchState } from '../types';

interface UseWatchStateResult {
  watchState: WatchState;
  // Will trigger Watch session in production via WatchKit bridge
  startRecording: () => void;
  stopRecording: () => void;
}

// Manages the live Watch connection state. In production, this communicates
// with the WatchKit companion app via a native module bridge.
// Currently simulates recording with a live timer for UI dev purposes.
export function useWatchState(): UseWatchStateResult {
  const [watchState, setWatchState] = useState<WatchState>(MOCK_WATCH_STATE);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    setWatchState((s) => ({ ...s, status: 'recording', recordingDurationSeconds: 0 }));
    timerRef.current = setInterval(() => {
      setWatchState((s) => ({
        ...s,
        recordingDurationSeconds: s.recordingDurationSeconds + 1,
      }));
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setWatchState((s) => ({
      ...s,
      status: 'syncing',
      recordingDurationSeconds: 0,
      lastSyncedAt: new Date(),
    }));
    // Simulate sync completing after 2 seconds
    setTimeout(() => {
      setWatchState((s) => ({ ...s, status: 'connected' }));
    }, 2000);
  };

  return { watchState, startRecording, stopRecording };
}
