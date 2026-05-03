import React, { useState, useCallback, useMemo } from 'react';
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
import { relativeTime } from '../../utils/formatting';
import { useRecordings } from '../../hooks/useRecordings';
import { useWatchState } from '../../hooks/useWatchState';
import ErrorBoundary from '../../components/ErrorBoundary';
import RecordingCard from '../../components/RecordingCard';
import StatsBar from '../../components/StatsBar';
import WatchStatusBanner from '../../components/WatchStatusBanner';
import InsightsTicker from '../../components/InsightsTicker';
import PatternAlert from '../../components/PatternAlert';
import EmptyState from '../../components/EmptyState';
import SearchBar from '../../components/SearchBar';
import RecordingListSkeleton from '../../components/RecordingListSkeleton';

import {
  MOCK_WEEK_STATS,
  MOCK_PATTERN_ALERTS,
} from '../../mock/recordings';
import type { Recording, WatchState } from '../../types';

// ─── Recording filter ─────────────────────────────────────────────────────────

function filterRecordings(recordings: Recording[], query: string): Recording[] {
  const q = query.trim().toLowerCase();
  if (!q) return recordings;
  return recordings.filter(
    (r) =>
      r.title.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.keyTopics.some((t) => t.toLowerCase().includes(q)) ||
      r.tags.some((t) => t.label.toLowerCase().includes(q)) ||
      r.repeatedThemes.some((t) => t.theme.toLowerCase().includes(q))
  );
}

// ─── Sort options ─────────────────────────────────────────────────────────────

type SortKey = 'newest' | 'confidence' | 'duration';

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'NEWEST',
  confidence: 'CONFIDENCE',
  duration: 'DURATION',
};

function sortRecordings(recordings: Recording[], key: SortKey): Recording[] {
  const sorted = [...recordings];
  switch (key) {
    case 'newest':
      return sorted.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    case 'confidence':
      return sorted.sort((a, b) => b.confidenceIndex - a.confidenceIndex);
    case 'duration':
      return sorted.sort((a, b) => b.duration - a.duration);
  }
}

// ─── Header ───────────────────────────────────────────────────────────────────

function Header({
  watchState,
  onSearchPress,
}: {
  watchState: WatchState;
  onSearchPress: () => void;
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
      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}
        onPress={onSearchPress}
        hitSlop={12}
      >
        <Ionicons name="search-outline" size={18} color={COLORS.textSecondary} />
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.5 }]}
        onPress={() => router.push('/settings')}
        hitSlop={12}
      >
        <Ionicons name="settings-outline" size={18} color={COLORS.textSecondary} />
      </Pressable>
    </View>
  );
}

function SectionHeader({
  count,
  filteredCount,
  sortKey,
  onSortChange,
}: {
  count: number;
  filteredCount: number;
  sortKey: SortKey;
  onSortChange: (key: SortKey) => void;
}) {
  const sortKeys = Object.keys(SORT_LABELS) as SortKey[];
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        SESSIONS
        {filteredCount !== count && (
          <Text style={styles.sectionFiltered}> {filteredCount}/{count}</Text>
        )}
        {filteredCount === count && (
          <Text style={styles.sectionCount}> {count}</Text>
        )}
      </Text>
      {/* Inline sort toggle */}
      <View style={styles.sortRow}>
        {sortKeys.map((key) => (
          <Pressable
            key={key}
            onPress={() => onSortChange(key)}
            style={({ pressed }) => [
              styles.sortChip,
              sortKey === key && styles.sortChipActive,
              pressed && { opacity: 0.6 },
            ]}
          >
            <Text
              style={[
                styles.sortLabel,
                sortKey === key && styles.sortLabelActive,
              ]}
            >
              {SORT_LABELS[key]}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

function HomeScreenContent() {
  const insets = useSafeAreaInsets();
  const { recordings, isLoading } = useRecordings();
  const { watchState, startRecording, stopRecording } = useWatchState();

  const [searchActive, setSearchActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const filtered = useMemo(
    () => sortRecordings(filterRecordings(recordings, searchQuery), sortKey),
    [recordings, searchQuery, sortKey]
  );

  const handleRecordingPress = useCallback((id: string) => {
    router.push(`/recording/${id}`);
  }, []);

  const handleSearchClose = useCallback(() => {
    setSearchActive(false);
    setSearchQuery('');
  }, []);

  const handleWatchPress = useCallback(() => {
    if (watchState.status === 'connected') startRecording();
    else if (watchState.status === 'recording') stopRecording();
  }, [watchState.status, startRecording, stopRecording]);

  const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<Recording>) => (
      <RecordingCard
        recording={item}
        onPress={handleRecordingPress}
        isLatest={index === 0 && sortKey === 'newest'}
      />
    ),
    [handleRecordingPress, sortKey]
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
        <SectionHeader
          count={recordings.length}
          filteredCount={filtered.length}
          sortKey={sortKey}
          onSortChange={setSortKey}
        />
      </View>
    ),
    [recordings.length, filtered.length, sortKey]
  );

  const ListEmpty = useCallback(
    () =>
      isLoading ? (
        <RecordingListSkeleton count={3} />
      ) : searchQuery.trim() ? (
        <View style={styles.searchEmpty}>
          <Text style={styles.searchEmptyText}>
            NO SESSIONS MATCHING "{searchQuery.toUpperCase()}"
          </Text>
        </View>
      ) : (
        <EmptyState />
      ),
    [isLoading, searchQuery]
  );

  const keyExtractor = useCallback((item: Recording) => item.id, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <Header watchState={watchState} onSearchPress={() => setSearchActive(true)} />

      {searchActive && (
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          onClose={handleSearchClose}
          autoFocus
        />
      )}

      {isLoading ? (
        // Show full skeleton when initial load is in progress
        <View style={styles.skeletonWrapper}>
          <RecordingListSkeleton count={4} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={ListEmpty}
          contentContainerStyle={[
            styles.listContent,
            filtered.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          removeClippedSubviews
          maxToRenderPerBatch={4}
          initialNumToRender={3}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <WatchStatusBanner watchState={watchState} onOpenWatch={handleWatchPress} />
    </View>
  );
}

export default function HomeScreen() {
  return (
    <ErrorBoundary>
      <HomeScreenContent />
    </ErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  wordmark: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.widest,
    marginRight: SPACING.xs,
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
  iconButton: {
    padding: SPACING.xs,
  },

  statsSection: {
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.base,
  },

  // Section header + sort
  sectionHeader: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.sm,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  sectionCount: {
    color: COLORS.textMuted,
    fontWeight: FONTS.weights.regular,
  },
  sectionFiltered: {
    color: COLORS.accent,
    fontWeight: FONTS.weights.regular,
  },
  sortRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  sortChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sortChipActive: {
    borderColor: COLORS.textSecondary,
    backgroundColor: COLORS.surfaceElevated,
  },
  sortLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  sortLabelActive: {
    color: COLORS.textPrimary,
  },

  listContent: {
    paddingBottom: SPACING.xxl,
  },
  listContentEmpty: {
    flex: 1,
  },
  skeletonWrapper: {
    flex: 1,
    paddingTop: SPACING.base,
  },

  // Search empty state
  searchEmpty: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.xxl,
    alignItems: 'flex-start',
  },
  searchEmptyText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    lineHeight: FONTS.sizes.base * 1.6,
  },
});
