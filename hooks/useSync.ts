import { useState, useCallback, useEffect } from 'react';
import { syncPendingSales } from '@/lib/sync';
import { getPendingSyncCount } from '@/lib/db';
import { useNetworkStatus } from './useNetworkStatus';
import { SyncStatus } from '@/types';

export function useSync() {
  const { isConnected, onReconnect } = useNetworkStatus();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced');
  const [pendingCount, setPendingCount] = useState(0);

  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingSyncCount();
    setPendingCount(count);
    if (!isConnected) {
      setSyncStatus('offline');
    } else {
      setSyncStatus(count > 0 ? 'syncing' : 'synced');
    }
  }, [isConnected]);

  const triggerSync = useCallback(async () => {
    if (!isConnected) {
      setSyncStatus('offline');
      return;
    }
    setSyncStatus('syncing');
    try {
      await syncPendingSales();
      await refreshPendingCount();
      setSyncStatus('synced');
    } catch {
      setSyncStatus('error');
    }
  }, [isConnected, refreshPendingCount]);

  useEffect(() => {
    refreshPendingCount();
  }, [refreshPendingCount]);

  useEffect(() => {
    if (!isConnected) setSyncStatus('offline');
    else refreshPendingCount();
  }, [isConnected, refreshPendingCount]);

  useEffect(() => {
    onReconnect(triggerSync);
  }, [onReconnect, triggerSync]);

  return { syncStatus, pendingCount, triggerSync, refreshPendingCount };
}
