import React, { useMemo } from 'react';
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

import { COLORS, FONTS, SPACING, SCREEN_PADDING, RADIUS } from '../constants';
import { MOCK_RECORDINGS } from '../mock/recordings';
import { formatDurationShort } from '../utils/formatting';
import EnergySparkline from '../components/EnergySparkline';
import ErrorBoundary from '../components/ErrorBoundary';
import type { Recording } from '../types';

// ─── Comparison logic ─────────────────────────────────────────────────────────

interface MetricRow {
  label: string;
  valueA: string;
  valueB: string;
  // positive = B is better, negative = A is better, 0 = neutral/no preference
  delta: number;
  higherIsBetter: boolean;
  rawA: number;
  rawB: number;
}

function buildMetricRows(a: Recording, b: Recording): MetricRow[] {
  return [
    {
      label: 'CONFIDENCE INDEX',
      valueA: `${a.confidenceIndex}/100`,
      valueB: `${b.confidenceIndex}/100`,
      delta: b.confidenceIndex - a.confidenceIndex,
      higherIsBetter: true,
      rawA: a.confidenceIndex,
      rawB: b.confidenceIndex,
    },
    {
      label: 'TALK RATIO',
      valueA: `${a.talkRatio}%`,
      valueB: `${b.talkRatio}%`,
      // Closer to 50% is better — distance from ideal
      delta: Math.abs(a.talkRatio - 50) - Math.abs(b.talkRatio - 50),
      higherIsBetter: false,
      rawA: a.talkRatio,
      rawB: b.talkRatio,
    },
    {
      label: 'QUESTIONS ASKED',
      valueA: String(a.questionsAsked),
      valueB: String(b.questionsAsked),
      delta: b.questionsAsked - a.questionsAsked,
      higherIsBetter: true,
      rawA: a.questionsAsked,
      rawB: b.questionsAsked,
    },
    {
      label: 'SPEAKING PACE',
      valueA: `${a.speakingPace} WPM`,
      valueB: `${b.speakingPace} WPM`,
      delta: 0, // pace preference is context-dependent
      higherIsBetter: false,
      rawA: a.speakingPace,
      rawB: b.speakingPace,
    },
    {
      label: 'FILLER WORDS',
      valueA: String(a.fillerWordCount),
      valueB: String(b.fillerWordCount),
      delta: a.fillerWordCount - b.fillerWordCount, // fewer is better → positive delta when B has fewer
      higherIsBetter: false,
      rawA: a.fillerWordCount,
      rawB: b.fillerWordCount,
    },
    {
      label: 'DURATION',
      valueA: formatDurationShort(a.duration),
      valueB: formatDurationShort(b.duration),
      delta: 0,
      higherIsBetter: false,
      rawA: a.duration,
      rawB: b.duration,
    },
  ];
}

// Generates plain-language sentences about meaningful differences between sessions
function generateChangeNarrative(a: Recording, b: Recording): string[] {
  const lines: string[] = [];

  const ciDiff = b.confidenceIndex - a.confidenceIndex;
  if (Math.abs(ciDiff) >= 5) {
    lines.push(
      `Confidence Index ${ciDiff > 0 ? 'rose' : 'dropped'} ${Math.abs(ciDiff)} points (${a.confidenceIndex} → ${b.confidenceIndex}).`
    );
  }

  const talkDiff = b.talkRatio - a.talkRatio;
  if (Math.abs(talkDiff) >= 8) {
    const direction = talkDiff < 0 ? 'dropped' : 'rose';
    const meaning = talkDiff < 0 ? 'you listened more' : 'you spoke more';
    lines.push(`Talk ratio ${direction} ${Math.abs(talkDiff)} points — ${meaning}.`);
  }

  const qDiff = b.questionsAsked - a.questionsAsked;
  if (Math.abs(qDiff) >= 2) {
    const factor =
      a.questionsAsked > 0
        ? `${(b.questionsAsked / a.questionsAsked).toFixed(1)}×`
        : `${b.questionsAsked} more`;
    lines.push(
      `You asked ${factor} ${qDiff > 0 ? 'more' : 'fewer'} questions (${a.questionsAsked} → ${b.questionsAsked}).`
    );
  }

  const fDiff = a.fillerWordCount - b.fillerWordCount; // positive when B improved
  if (Math.abs(fDiff) >= 3) {
    const pct =
      a.fillerWordCount > 0
        ? Math.abs(Math.round((fDiff / a.fillerWordCount) * 100))
        : 0;
    lines.push(
      `Filler words ${fDiff > 0 ? 'down' : 'up'} ${pct > 0 ? `${pct}%` : String(Math.abs(fDiff))} (${a.fillerWordCount} → ${b.fillerWordCount}).`
    );
  }

  if (lines.length === 0) {
    lines.push('These two sessions are closely matched across all metrics.');
  }

  return lines;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

// A single row in the comparison table
function CompareRow({ row }: { row: MetricRow }) {
  const maxRaw = Math.max(row.rawA, row.rawB, 1);
  const fillA = row.rawA / maxRaw;
  const fillB = row.rawB / maxRaw;

  // Winner highlighting — only when delta is meaningful
  const threshold = 4;
  const bWins = row.delta > threshold;
  const aWins = row.delta < -threshold;

  return (
    <View style={rowStyles.container}>
      <Text style={rowStyles.label}>{row.label}</Text>
      <View style={rowStyles.values}>
        {/* A side */}
        <View style={rowStyles.side}>
          <Text style={[rowStyles.value, aWins && rowStyles.valueWin]}>
            {row.valueA}
          </Text>
          <View style={rowStyles.barTrack}>
            <View style={rowStyles.barRight}>
              <View
                style={[
                  rowStyles.barFill,
                  {
                    flex: fillA,
                    backgroundColor: aWins ? COLORS.accent : COLORS.textMuted,
                  },
                ]}
              />
              <View style={{ flex: 1 - fillA }} />
            </View>
          </View>
        </View>

        {/* Centre divider + delta */}
        <View style={rowStyles.centre}>
          {Math.abs(row.delta) >= threshold && (
            <Text style={[rowStyles.arrow, { color: bWins ? COLORS.accent : COLORS.textSecondary }]}>
              {bWins ? '→' : '←'}
            </Text>
          )}
        </View>

        {/* B side */}
        <View style={rowStyles.side}>
          <View style={rowStyles.barTrack}>
            <View style={{ flex: 1 - fillB }} />
            <View
              style={[
                rowStyles.barFill,
                {
                  flex: fillB,
                  backgroundColor: bWins ? COLORS.accent : COLORS.textMuted,
                },
              ]}
            />
          </View>
          <Text style={[rowStyles.value, rowStyles.valueRight, bWins && rowStyles.valueWin]}>
            {row.valueB}
          </Text>
        </View>
      </View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  container: {
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    gap: SPACING.xs,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    textAlign: 'center',
  },
  values: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  side: {
    flex: 1,
    gap: 4,
  },
  value: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.wide,
  },
  valueRight: {
    textAlign: 'right',
  },
  valueWin: {
    color: COLORS.accent,
    fontWeight: FONTS.weights.bold,
  },
  barTrack: {
    height: 2,
    flexDirection: 'row',
  },
  barRight: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  barFill: {
    height: '100%',
    borderRadius: 1,
  },
  centre: {
    width: 20,
    alignItems: 'center',
  },
  arrow: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    fontWeight: FONTS.weights.bold,
  },
});

// Session label card (compact, used at top)
function SessionLabel({ recording, side }: { recording: Recording; side: 'A' | 'B' }) {
  const isA = side === 'A';
  return (
    <View style={[labelStyles.container, isA ? labelStyles.containerA : labelStyles.containerB]}>
      <View style={[labelStyles.badge, isA ? labelStyles.badgeA : labelStyles.badgeB]}>
        <Text style={[labelStyles.badgeText, isA ? labelStyles.badgeTextA : labelStyles.badgeTextB]}>
          {side}
        </Text>
      </View>
      <View style={labelStyles.text}>
        <Text style={labelStyles.title} numberOfLines={1}>
          {recording.title.toUpperCase()}
        </Text>
        <Text style={labelStyles.sub}>
          {recording.timestamp
            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            .toUpperCase()}{' '}
          · {formatDurationShort(recording.duration)}
        </Text>
      </View>
    </View>
  );
}

const labelStyles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.xs,
  },
  containerA: {
    borderColor: COLORS.textSecondary,
    backgroundColor: COLORS.surface,
  },
  containerB: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSubtle,
  },
  badge: {
    width: 20,
    height: 20,
    borderRadius: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeA: {
    backgroundColor: COLORS.surfaceElevated,
  },
  badgeB: {
    backgroundColor: COLORS.accentDim,
  },
  badgeText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
    letterSpacing: 0,
  },
  badgeTextA: {
    color: COLORS.textSecondary,
  },
  badgeTextB: {
    color: COLORS.accent,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.wide,
    fontWeight: FONTS.weights.semibold,
  },
  sub: {
    fontFamily: FONTS.mono,
    fontSize: 9,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
});

// ─── CompareScreen ────────────────────────────────────────────────────────────

function CompareContent() {
  const { a: idA, b: idB } = useLocalSearchParams<{ a: string; b: string }>();
  const insets = useSafeAreaInsets();

  const recA = MOCK_RECORDINGS.find((r) => r.id === idA);
  const recB = MOCK_RECORDINGS.find((r) => r.id === idB);

  const rows = useMemo(
    () => (recA && recB ? buildMetricRows(recA, recB) : []),
    [recA, recB]
  );
  const narrative = useMemo(
    () => (recA && recB ? generateChangeNarrative(recA, recB) : []),
    [recA, recB]
  );

  if (!recA || !recB) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <Pressable style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.notFound}>One or both sessions not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          style={({ pressed }) => pressed && { opacity: 0.5 }}
        >
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>COMPARE SESSIONS</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxxl }}
      >
        {/* Session labels */}
        <View style={styles.labelRow}>
          <SessionLabel recording={recA} side="A" />
          <SessionLabel recording={recB} side="B" />
        </View>

        {/* Metrics table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>METRICS</Text>
          <View style={styles.table}>
            {rows.map((row) => (
              <CompareRow key={row.label} row={row} />
            ))}
          </View>
        </View>

        {/* Energy arcs side by side */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ENERGY ARC</Text>
          <View style={styles.arcRow}>
            <View style={styles.arcCol}>
              <Text style={styles.arcLabel}>A</Text>
              <EnergySparkline data={recA.energyArc} height={32} />
            </View>
            <View style={styles.arcCol}>
              <Text style={[styles.arcLabel, styles.arcLabelB]}>B</Text>
              <EnergySparkline data={recB.energyArc} height={32} />
            </View>
          </View>
        </View>

        {/* Tone profiles side by side */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TONE PROFILE</Text>
          <View style={styles.toneRow}>
            <View style={styles.toneCol}>
              <Text style={styles.arcLabel}>A</Text>
              {recA.toneBreakdown.slice(0, 3).map((t, i) => (
                <Text key={i} style={styles.toneItem}>
                  {t.emoji} {t.label} {t.percentage}%
                </Text>
              ))}
            </View>
            <View style={styles.toneDivider} />
            <View style={styles.toneCol}>
              <Text style={[styles.arcLabel, styles.arcLabelB]}>B</Text>
              {recB.toneBreakdown.slice(0, 3).map((t, i) => (
                <Text key={i} style={styles.toneItem}>
                  {t.emoji} {t.label} {t.percentage}%
                </Text>
              ))}
            </View>
          </View>
        </View>

        {/* What changed */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT CHANGED</Text>
          <View style={styles.narrativeBox}>
            {narrative.map((line, i) => (
              <View key={i} style={styles.narrativeRow}>
                <Text style={styles.narrativeBullet}>—</Text>
                <Text style={styles.narrativeText}>{line}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Repeated themes side by side */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT YOU KEPT RETURNING TO</Text>
          <View style={styles.toneRow}>
            <View style={styles.toneCol}>
              <Text style={styles.arcLabel}>A</Text>
              {recA.repeatedThemes.slice(0, 3).map((t, i) => (
                <Text key={i} style={styles.toneItem}>
                  "{t.theme}" ×{t.count}
                </Text>
              ))}
            </View>
            <View style={styles.toneDivider} />
            <View style={styles.toneCol}>
              <Text style={[styles.arcLabel, styles.arcLabelB]}>B</Text>
              {recB.repeatedThemes.slice(0, 3).map((t, i) => (
                <Text key={i} style={styles.toneItem}>
                  "{t.theme}" ×{t.count}
                </Text>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

export default function CompareScreen() {
  return (
    <ErrorBoundary>
      <CompareContent />
    </ErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.base,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  backBtn: {
    padding: SPACING.xs,
  },
  labelRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  section: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.xl,
    gap: SPACING.base,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  table: {
    gap: 0,
  },
  // Energy arc
  arcRow: {
    gap: SPACING.sm,
  },
  arcCol: {
    gap: SPACING.xs,
  },
  arcLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  arcLabelB: {
    color: COLORS.accent,
  },
  // Tone
  toneRow: {
    flexDirection: 'row',
    gap: SPACING.base,
  },
  toneCol: {
    flex: 1,
    gap: SPACING.xs,
  },
  toneDivider: {
    width: 1,
    backgroundColor: COLORS.border,
  },
  toneItem: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.wide,
    lineHeight: FONTS.sizes.xs * 2,
  },
  // Narrative
  narrativeBox: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
    paddingLeft: SPACING.base,
    gap: SPACING.sm,
  },
  narrativeRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  narrativeBullet: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    marginTop: 1,
  },
  narrativeText: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.6,
    flex: 1,
  },
  notFound: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    marginTop: SPACING.xl,
    marginHorizontal: SCREEN_PADDING,
  },
});
