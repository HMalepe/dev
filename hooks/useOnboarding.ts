import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_KEY = 'echo_onboarded';
const NAME_KEY = 'echo_user_name';

interface UseOnboardingResult {
  isLoading: boolean;
  isOnboarded: boolean;
  userName: string;
  completeOnboarding: (name: string) => Promise<void>;
  resetOnboarding: () => Promise<void>;
}

export function useOnboarding(): UseOnboardingResult {
  const [isLoading, setIsLoading] = useState(true);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [onboarded, name] = await Promise.all([
          AsyncStorage.getItem(ONBOARDING_KEY),
          AsyncStorage.getItem(NAME_KEY),
        ]);
        setIsOnboarded(onboarded === 'true');
        setUserName(name ?? '');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, []);

  const completeOnboarding = useCallback(async (name: string) => {
    await Promise.all([
      AsyncStorage.setItem(ONBOARDING_KEY, 'true'),
      AsyncStorage.setItem(NAME_KEY, name.trim()),
    ]);
    setUserName(name.trim());
    setIsOnboarded(true);
  }, []);

  const resetOnboarding = useCallback(async () => {
    await Promise.all([
      AsyncStorage.removeItem(ONBOARDING_KEY),
      AsyncStorage.removeItem(NAME_KEY),
    ]);
    setIsOnboarded(false);
    setUserName('');
  }, []);

  return { isLoading, isOnboarded, userName, completeOnboarding, resetOnboarding };
}
