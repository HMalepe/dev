import React, { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { COLORS } from '../constants';
import { useOnboarding } from '../hooks/useOnboarding';
import ErrorBoundary from '../components/ErrorBoundary';

function RootLayoutInner() {
  const { isLoading, isOnboarded } = useOnboarding();

  // Redirect to onboarding on first launch — runs after the initial render
  // so the Navigator is already mounted when we call router.replace().
  useEffect(() => {
    if (!isLoading && !isOnboarded) {
      router.replace('/onboarding');
    }
  }, [isLoading, isOnboarded]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Main tab shell */}
      <Stack.Screen name="(tabs)" />
      {/* First-run flow */}
      <Stack.Screen
        name="onboarding"
        options={{ animation: 'fade', gestureEnabled: false }}
      />
      {/* Recording detail — full screen card pushed over tab chrome */}
      <Stack.Screen
        name="recording/[id]"
        options={{ animation: 'slide_from_right' }}
      />
      {/* Insight deep dive — pushed from RecordingDetail */}
      <Stack.Screen
        name="insight/[type]"
        options={{ animation: 'slide_from_right' }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <ErrorBoundary>
        <View style={styles.root}>
          <RootLayoutInner />
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
