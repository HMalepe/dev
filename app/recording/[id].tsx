import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Share,
  FlatList,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS, FONTS, SPACING, SCREEN_PADDING, RADIUS } from '../../constants';
import { MOCK_RECORDINGS } from '../../mock/recordings';
import { getTranscript } from '../../mock/transcripts';
import { formatDurationShort, formatFullDate } from '../../utils/formatting';

import EnergySparkline from '../../components/EnergySparkline';
import TalkRatioBar from '../../components/TalkRatioBar';
import ConfidenceIndex from '../../components/ConfidenceIndex';
import ToneBreakdown from '../../components/ToneBreakdown';
import TopicsChart from '../../components/TopicsChart';
import MomentItem from '../../components/MomentItem';
import TranscriptView from '../../components/TranscriptView';
import DetailSection from '../../components/DetailSection';
import ErrorBoundary from '../../components/ErrorBoundary';

// ─── Screen ───────────────────────────────────────────────────────────────────

function RecordingDetailContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const recording = MOCK_RECORDINGS.find((r) => r.id === id);
  const transcript = id ? getTranscript(id) : undefined;

  const [activeMomentId, setActiveMomentId] = useState<string | undefined>();
  const [comparePickerOpen, setComparePickerOpen] = useState(false);

  const handleMomentPress = useCallback((momentId: string) => {
    setActiveMomentId((prev) => (prev === momentId ? undefined : momentId));
  }, []);

  const goToDeepDive = useCallback(
    (type: string) => router.push(`/insight/${type}?recordingId=${id}`),
    [id]
  );

  const handleShare = useCallback(async () => {
    if (!recording) return;
    await Share.share({
      title: recording.title,
      message: [
        recording.title,
        '',
        recording.summary,
        '',
        `Confidence: ${recording.confidenceIndex}/100 · Talk ratio: ${recording.talkRatio}% · Questions: ${recording.questionsAsked}`,
        '',
        'Recorded with ECHO',
      ].join('\n'),
    });
  }, [recording]);

  const handleComparePick = useCallback(
    (otherId: string) => {
      setComparePickerOpen(false);
      router.push(`/compare?a=${id}&b=${otherId}`);
    },
    [id]
  );

  if (!recording) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>RECORDING NOT FOUND</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* ── Fixed header ── */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.5 }]}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerDate}>{formatFullDate(recording.timestamp)}</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setComparePickerOpen(true)}
            hitSlop={8}
            style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.5 }]}
          >
            <Text style={styles.headerActionText}>↔</Text>
          </Pressable>
          <Pressable
            onPress={handleShare}
            hitSlop={8}
            style={({ pressed }) => [styles.headerAction, pressed && { opacity: 0.5 }]}
          >
            <Ionicons name="share-outline" size={17} color={COLORS.textSecondary} />
          </Pressable>
        </View>
      </View>

      {/* ── Compare picker modal ── */}
      <Modal
        visible={comparePickerOpen}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setComparePickerOpen(false)}
      >
        <View style={styles.modalScreen}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>COMPARE WITH…</Text>
            <Pressable
              onPress={() => setComparePickerOpen(false)}
              hitSlop={12}
              style={({ pressed }) => pressed && { opacity: 0.5 }}
            >
              <Text style={styles.modalClose}>✕</Text>
            </Pressable>
          </View>
          <FlatList
            data={MOCK_RECORDINGS.filter((r) => r.id !== id)}
            keyExtractor={(r) => r.id}
            renderItem={({ item }) => (
              <Pressable
                style={({ pressed }) => [
                  styles.pickerRow,
                  pressed && styles.pickerRowPressed,
                ]}
                onPress={() => handleComparePick(item.id)}
              >
                <View style={styles.pickerInfo}>
                  <Text style={styles.pickerTitle} numberOfLines={1}>
                    {item.title.toUpperCase()}
                  </Text>
                  <Text style={styles.pickerMeta}>
                    {item.timestamp
                      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      .toUpperCase()}
                    {' · '}
                    CI {item.confidenceIndex}
                    {' · '}
                    {item.talkRatio}% talk
                  </Text>
                </View>
                <Text style={styles.pickerArrow}>→</Text>
              </Pressable>
            )}
            ItemSeparatorComponent={() => <View style={styles.pickerSep} />}
          />
        </View>
      </Modal>

      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxxl }}
      >
        {/* ── Title + Summary banner ── */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{recording.title.toUpperCase()}</Text>
          <View style={styles.summaryBanner}>
            <Text style={styles.summaryText}>{recording.summary}</Text>
          </View>
        </View>

        {/* ── Confidence Index — tappable → deep dive ── */}
        <DetailSection
          title="CONFIDENCE INDEX"
          onHeaderPress={() => goToDeepDive('confidence-index')}
        >
          <ConfidenceIndex
            score={recording.confidenceIndex}
            delta={recording.confidenceIndexDelta}
          />
        </DetailSection>

        {/* ── Energy Arc ── */}
        <DetailSection
          title="ENERGY ARC"
          accessory={
            <Text style={styles.sectionAccessory}>{recording.energyArcLabel}</Text>
          }
          onHeaderPress={() => goToDeepDive('energy-arc')}
        >
          <EnergySparkline data={recording.energyArc} height={52} />
        </DetailSection>

        {/* ── Session stats row ── */}
        <DetailSection title="SESSION STATS">
          <View style={styles.statsGrid}>
            <StatCell value={recording.wordCount.toLocaleString()} label="WORDS" />
            <StatCell value={String(recording.questionsAsked)} label="QUESTIONS" />
            <StatCell value={`${recording.speakingPace}`} label="WPM" />
            <StatCell value={String(recording.fillerWordCount)} label="FILLERS" />
          </View>
        </DetailSection>

        {/* ── Talk breakdown ── */}
        <DetailSection title="TALK BREAKDOWN" onHeaderPress={() => goToDeepDive('talk-ratio')}>
          <TalkRatioBar talkRatio={recording.talkRatio} />
        </DetailSection>

        {/* ── Topics ── */}
        <DetailSection title="TOPICS RETURNED TO">
          <TopicsChart topics={recording.repeatedThemes} />
        </DetailSection>

        {/* ── Tone profile ── */}
        <DetailSection
          title="TONE PROFILE"
          onHeaderPress={() => goToDeepDive('tone-profile')}
        >
          <ToneBreakdown segments={recording.toneBreakdown} />
        </DetailSection>

        {/* ── Questions analysis ── */}
        {recording.questionsAnalysis.length > 0 && (
          <DetailSection
            title="QUESTIONS YOU ASKED"
            onHeaderPress={() => goToDeepDive('questions-asked')}
          >
            <View style={styles.questionsList}>
              {recording.questionsAnalysis.map((qa, i) => (
                <View key={i} style={styles.questionItem}>
                  <View style={styles.questionRow}>
                    <Text style={styles.questionQ}>"</Text>
                    <Text style={styles.questionText}>{qa.question}"</Text>
                  </View>
                  <Text style={styles.questionInsight}>{qa.insight}</Text>
                </View>
              ))}
            </View>
          </DetailSection>
        )}

        {/* ── Key moments ── */}
        {recording.moments.length > 0 && (
          <DetailSection title="KEY MOMENTS">
            <View style={styles.momentsList}>
              {recording.moments.map((moment, i) => (
                <Pressable
                  key={moment.id}
                  onPress={() => handleMomentPress(moment.id)}
                >
                  <MomentItem
                    moment={moment}
                    isLast={i === recording.moments.length - 1}
                  />
                </Pressable>
              ))}
            </View>
            {activeMomentId && (
              <Text style={styles.momentHint}>
                ↓ Moment highlighted in transcript below
              </Text>
            )}
          </DetailSection>
        )}

        {/* ── Action items ── */}
        {recording.actionItems.length > 0 && (
          <DetailSection title="ACTION ITEMS">
            <View style={styles.actionList}>
              {recording.actionItems.map((item, i) => (
                <View key={i} style={styles.actionRow}>
                  <Text style={styles.actionBullet}>□</Text>
                  <Text style={styles.actionText}>{item}</Text>
                </View>
              ))}
            </View>
          </DetailSection>
        )}

        {/* ── Transcript ── */}
        <DetailSection
          title="TRANSCRIPT"
          accessory={
            transcript ? (
              <Text style={styles.sectionAccessory}>
                {transcript.lines.length} LINES
              </Text>
            ) : undefined
          }
        >
          {transcript ? (
            <TranscriptView
              lines={transcript.lines}
              highlightedMomentId={activeMomentId}
            />
          ) : (
            <Text style={styles.transcriptUnavailable}>
              Transcript not available for this recording.
            </Text>
          )}
        </DetailSection>
      </ScrollView>
    </View>
  );
}

export default function RecordingDetailScreen() {
  return (
    <ErrorBoundary>
      <RecordingDetailContent />
    </ErrorBoundary>
  );
}

// ─── Stat cell (session stats grid) ──────────────────────────────────────────

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
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
    gap: SPACING.sm,
  },
  backButton: {
    padding: SPACING.xs,
  },
  headerDate: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  headerAction: {
    padding: SPACING.xs,
  },
  headerActionText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    fontWeight: FONTS.weights.bold,
  },
  // Modal picker
  modalScreen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingTop: SPACING.xl,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  modalClose: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    gap: SPACING.base,
  },
  pickerRowPressed: {
    backgroundColor: COLORS.surfaceHover,
  },
  pickerInfo: {
    flex: 1,
    gap: 4,
  },
  pickerTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.semibold,
  },
  pickerMeta: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  pickerArrow: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
  },
  pickerSep: {
    height: 1,
    backgroundColor: COLORS.borderSubtle,
    marginHorizontal: SCREEN_PADDING,
  },
  headerDurationText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.wide,
  },

  // Title + Summary
  titleSection: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.xl,
    gap: SPACING.base,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
    lineHeight: FONTS.sizes.base * 1.4,
  },
  summaryBanner: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.xs,
    padding: SPACING.base,
    backgroundColor: COLORS.accentSubtle,
  },
  summaryText: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    lineHeight: FONTS.sizes.lg * 1.5,
    fontWeight: FONTS.weights.medium,
  },

  scroll: {
    flex: 1,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCell: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statValue: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
    letterSpacing: FONTS.tracking.tight,
  },
  statLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },

  // Section accessory
  sectionAccessory: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    maxWidth: 180,
    textAlign: 'right',
  },

  // Questions
  questionsList: {
    gap: SPACING.base,
  },
  questionItem: {
    gap: SPACING.xs,
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  questionRow: {
    flexDirection: 'row',
  },
  questionQ: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
  },
  questionText: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
    fontStyle: 'italic',
    flex: 1,
    lineHeight: FONTS.sizes.md * 1.5,
  },
  questionInsight: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.6,
  },

  // Moments
  momentsList: {
    gap: 0,
  },
  momentHint: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.accent,
    letterSpacing: FONTS.tracking.wide,
    marginTop: SPACING.sm,
  },

  // Action items
  actionList: {
    gap: SPACING.sm,
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  actionBullet: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  actionText: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.md * 1.5,
    flex: 1,
  },

  // Transcript unavailable
  transcriptUnavailable: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },

  // Not found
  notFound: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notFoundText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
});
