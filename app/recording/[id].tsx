import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
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

  const handleMomentPress = useCallback((momentId: string) => {
    setActiveMomentId((prev) => (prev === momentId ? undefined : momentId));
  }, []);

  const goToDeepDive = useCallback(
    (type: string) => router.push(`/insight/${type}?recordingId=${id}`),
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
        <View style={styles.headerDuration}>
          <Text style={styles.headerDurationText}>
            {formatDurationShort(recording.duration)}
          </Text>
        </View>
      </View>

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
  headerDuration: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
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
