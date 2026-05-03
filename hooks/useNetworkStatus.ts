import { useState, useEffect, useRef, useCallback } from 'react';
import * as Network from 'expo-network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState(true);
  const prevConnected = useRef(true);
  const onReconnectRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const check = async () => {
      const state = await Network.getNetworkStateAsync();
      const connected = !!state.isConnected && !!state.isInternetReachable;
      setIsConnected(connected);

      if (connected && !prevConnected.current) {
        onReconnectRef.current?.();
      }
      prevConnected.current = connected;
    };

    check();
    interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const onReconnect = useCallback((cb: () => void) => {
    onReconnectRef.current = cb;
  }, []);

  return { isConnected, onReconnect };
}
