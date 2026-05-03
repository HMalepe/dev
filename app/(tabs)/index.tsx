import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  ListRenderItemInfo,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, FONTS, SPACING, SCREEN_PADDING } from '../../constants';
import RecordingCard from '../../components/RecordingCard';
import StatsBar from '../../components/StatsBar';
import WatchStatusBanner from '../../components/WatchStatusBanner';
import InsightsTicker from '../../components/InsightsTicker';
import PatternAlert from '../../components/PatternAlert';
import EmptyState from '../../components/EmptyState';

import {
  MOCK_RECORDINGS,
  MOCK_WEEK_STATS,
  MOCK_WATCH_STATE,
  MOCK_PATTERN_ALERTS,
} from '../../mock/recordings';
import type { Recording, WatchState } from '../../types';

// ─── Relative time helper ────────────────────────────────────────────────────

function relativeTime(date: Date): string {
  const diffMin = Math.round((Date.now() - date.getTime()) / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  return `${Math.floor(diffMin / 60)}h ago`;
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  watchState,
}: {
  watchState: WatchState;
}) {
  const isRecording = watchState.status === 'recording';
  const isSyncing = watchState.status === 'syncing';
  const syncedAt = watchState.lastSyncedAt;

  let watchLabel = '';
  if (isRecording) watchLabel = 'Recording…';
  else if (isSyncing) watchLabel = 'Syncing…';
  else if (syncedAt) watchLabel = `Synced ${relativeTime(syncedAt)}`;
  else watchLabel = 'Watch not connected';

  const watchDotColor =
    isRecording ? COLORS.accent :
    isSyncing ? COLORS.textSecondary :
    syncedAt ? COLORS.textMuted : COLORS.error;

  return (
    <View style={styles.header}>
      <Text style={styles.wordmark}>ECHO</Text>
      <View style={styles.watchStatus}>
        <View style={[styles.watchDot, { backgroundColor: watchDotColor }]} />
        <Text style={styles.watchLabel}>{watchLabel}</Text>
      </View>
      {/* Settings navigates to the settings tab */}
      <Pressable
        style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.5 }]}
        onPress={() => router.push('/settings')}
        hitSlop={12}
      >
        <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
      </Pressable>
    </View>
  );
}

function SectionHeader({ count }: { count: number }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>RECENT SESSIONS</Text>
      <Text style={styles.sectionCount}>{count}</Text>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const [recordings] = useState<Recording[]>(MOCK_RECORDINGS);

  const handleRecordingPress = useCallback((id: string) => {
    router.push(`/recording/${id}`);
  }, []);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Recording>) => (
      <RecordingCard
        recording={item}
        onPress={handleRecordingPress}
        isLatest={index === 0}
      />
    ),
    [handleRecordingPress]
  );

  const ListHeader = useCallback(
    () => (
      <View>
        <InsightsTicker stats={MOCK_WEEK_STATS} />
        <View style={styles.statsSection}>
          <StatsBar stats={MOCK_WEEK_STATS} />
        </View>
        {MOCK_PATTERN_ALERTS.length > 0 && (
          <PatternAlert alert={MOCK_PATTERN_ALERTS[0]} />
        )}
        <SectionHeader count={recordings.length} />
      </View>
    ),
    [recordings.length]
  );

  const ListEmpty = useCallback(() => <EmptyState />, []);
  const keyExtractor = useCallback((item: Recording) => item.id, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header watchState={MOCK_WATCH_STATE} />
      <FlatList
        data={recordings}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={ListEmpty}
        contentContainerStyle={[
          styles.listContent,
          recordings.length === 0 && styles.listContentEmpty,
        ]}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        maxToRenderPerBatch={4}
        initialNumToRender={3}
      />
      <WatchStatusBanner watchState={MOCK_WATCH_STATE} onOpenWatch={() => {}} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
  },
  wordmark: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.widest,
    marginRight: SPACING.sm,
  },
  watchStatus: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  watchDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  watchLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  headerButton: {
    padding: SPACING.xs,
  },
  statsSection: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.base,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  sectionCount: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  listContent: {
    paddingBottom: SPACING.xxl,
  },
  listContentEmpty: {
    flex: 1,
  },
});
