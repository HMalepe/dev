import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, SCREEN_PADDING, RADIUS } from '../../constants';
import { MOCK_TRENDS, MOCK_RECORDINGS, MOCK_WEEK_STATS } from '../../mock/recordings';
import type { InsightTrend } from '../../types';

// ─── Time filter ──────────────────────────────────────────────────────────────

type TimeRange = '4W' | '3M' | 'ALL';

const TIME_LABELS: Record<TimeRange, string> = {
  '4W': '4 WEEKS',
  '3M': '3 MONTHS',
  'ALL': 'ALL TIME',
};

// ─── Mini bar chart for a trend ───────────────────────────────────────────────

function TrendChart({ trend }: { trend: InsightTrend }) {
  const values = trend.points.map((p) => p.value);
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  // Direction indicators
  const isImproving =
    (trend.changeDirection === 'up' && trend.higherIsBetter) ||
    (trend.changeDirection === 'down' && !trend.higherIsBetter);

  const changeColor = isImproving ? COLORS.accent : COLORS.textSecondary;
  const changeArrow = trend.changeDirection === 'up' ? '↑' : trend.changeDirection === 'down' ? '↓' : '→';

  return (
    <View style={trendStyles.container}>
      {/* Header */}
      <View style={trendStyles.header}>
        <Text style={trendStyles.metric}>{trend.metric}</Text>
        <Text style={[trendStyles.change, { color: changeColor }]}>
          {changeArrow} {trend.changeLabel}
        </Text>
      </View>

      {/* Chart */}
      <View style={trendStyles.chart}>
        {trend.points.map((point, i) => {
          const normalised = (point.value - min) / range; // 0–1
          const heightPct = Math.max(0.06, normalised);
          const isLatest = i === trend.points.length - 1;

          return (
            <View key={i} style={trendStyles.barWrapper}>
              <View
                style={[
                  trendStyles.bar,
                  {
                    flex: heightPct,
                    backgroundColor: isLatest
                      ? isImproving ? COLORS.accent : COLORS.textSecondary
                      : COLORS.border,
                  },
                ]}
              />
              <View style={{ flex: 1 - heightPct }} />
              <Text style={[trendStyles.barLabel, isLatest && trendStyles.barLabelLatest]}>
                {point.label.split(' ')[1]}
              </Text>
            </View>
          );
        })}
      </View>

      {/* Latest value */}
      <View style={trendStyles.footer}>
        <Text style={trendStyles.latestLabel}>NOW</Text>
        <Text style={[trendStyles.latestValue, { color: isImproving ? COLORS.accent : COLORS.textPrimary }]}>
          {trend.points[trend.points.length - 1].value}{trend.unit}
        </Text>
      </View>
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  metric: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  change: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    letterSpacing: FONTS.tracking.wide,
  },
  chart: {
    flexDirection: 'row',
    height: 56,
    gap: 3,
    alignItems: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    height: '100%',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
  },
  bar: {
    width: '100%',
    borderRadius: 1,
  },
  barLabel: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: 0,
  },
  barLabelLatest: {
    color: COLORS.textSecondary,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.xs,
  },
  latestLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  latestValue: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xl,
    fontWeight: FONTS.weights.bold,
    letterSpacing: FONTS.tracking.tight,
  },
});

// ─── Behavioral pattern summary card ─────────────────────────────────────────

function PatternCard({ text, isPositive }: { text: string; isPositive: boolean }) {
  return (
    <View style={[patStyles.card, isPositive && patStyles.cardPositive]}>
      <Text style={patStyles.icon}>{isPositive ? '◆' : '▲'}</Text>
      <Text style={patStyles.text}>{text}</Text>
    </View>
  );
}

const patStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.surface,
  },
  cardPositive: {
    borderColor: COLORS.accentDim,
  },
  icon: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  text: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.6,
    flex: 1,
  },
});

// ─── InsightsOverview ─────────────────────────────────────────────────────────

const BEHAVIORAL_PATTERNS = [
  { text: "Your most confident sessions happen before noon — afternoon calls average 14 points lower.", isPositive: false },
  { text: "Your question rate has tripled in 7 weeks. Your best calls correlate with asking more questions.", isPositive: true },
  { text: "You've used 'I don't know' 7× in coaching sessions — never once in board or investor calls.", isPositive: false },
  { text: "Your filler word count drops 40% when the other person is more senior than you.", isPositive: false },
  { text: "In sessions where you talked less than 55%, satisfaction signals are markedly higher.", isPositive: true },
];

const AI_SYNTHESIS = `Over the last 7 weeks, you've become measurably more deliberate. Your confidence index is up 24 points, you're asking more questions, and your filler words are down nearly half. The gap to close: you still over-talk in high-stakes situations, and you deflect when conversations move toward your co-founder. These two things are probably related. The best version of you showed up on April 30th — board check-in, 91 confidence, 45% talk ratio, 3 fillers. Study that session.`;

export default function InsightsOverview() {
  const insets = useSafeAreaInsets();
  const [timeRange, setTimeRange] = useState<TimeRange>('4W');

  const totalSessions = MOCK_RECORDINGS.length;
  const totalMinutes = Math.round(
    MOCK_RECORDINGS.reduce((s, r) => s + r.duration, 0) / 60
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>ECHO</Text>
        <Text style={styles.headerLabel}>INSIGHTS</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxxl }}
      >
        {/* ── Overview numbers ── */}
        <View style={styles.overviewRow}>
          <View style={styles.overviewCell}>
            <Text style={styles.overviewValue}>{totalSessions}</Text>
            <Text style={styles.overviewLabel}>SESSIONS</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCell}>
            <Text style={styles.overviewValue}>{totalMinutes}m</Text>
            <Text style={styles.overviewLabel}>RECORDED</Text>
          </View>
          <View style={styles.overviewDivider} />
          <View style={styles.overviewCell}>
            <Text style={[styles.overviewValue, styles.overviewAccent]}>82</Text>
            <Text style={styles.overviewLabel}>PEAK CI</Text>
          </View>
        </View>

        {/* ── Time range filter ── */}
        <View style={styles.filterRow}>
          {(Object.keys(TIME_LABELS) as TimeRange[]).map((range) => (
            <Pressable
              key={range}
              style={[
                styles.filterChip,
                timeRange === range && styles.filterChipActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text
                style={[
                  styles.filterLabel,
                  timeRange === range && styles.filterLabelActive,
                ]}
              >
                {TIME_LABELS[range]}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Trend charts ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>METRIC TRENDS</Text>
          <View style={styles.trendsGrid}>
            {MOCK_TRENDS.map((trend) => (
              <View key={trend.metric} style={styles.trendCard}>
                <TrendChart trend={trend} />
              </View>
            ))}
          </View>
        </View>

        {/* ── AI synthesis paragraph ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SYNTHESIS</Text>
          <View style={styles.synthesisBox}>
            <Text style={styles.synthesisText}>{AI_SYNTHESIS}</Text>
          </View>
        </View>

        {/* ── Behavioral patterns ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BEHAVIORAL PATTERNS</Text>
          <View style={styles.patternsList}>
            {BEHAVIORAL_PATTERNS.map((p, i) => (
              <PatternCard key={i} text={p.text} isPositive={p.isPositive} />
            ))}
          </View>
        </View>

        {/* ── Topic frequency over time ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TOP TOPICS THIS PERIOD</Text>
          <View style={styles.topicsList}>
            {[
              { topic: 'Leadership / Management', count: 24 },
              { topic: 'Fundraising / Investors', count: 18 },
              { topic: 'Team / Hiring', count: 15 },
              { topic: 'Product / Roadmap', count: 14 },
              { topic: 'Personal / Coaching', count: 11 },
              { topic: 'Sales / Partnerships', count: 9 },
            ].map((item, i) => {
              const widthPct = (item.count / 24) * 100;
              return (
                <View key={i} style={styles.topicRow}>
                  <Text style={styles.topicName}>{item.topic.toUpperCase()}</Text>
                  <View style={styles.topicBarTrack}>
                    <View
                      style={[styles.topicBarFill, { flex: item.count }]}
                    />
                    <View style={{ flex: 24 - item.count }} />
                  </View>
                  <Text style={styles.topicCount}>{item.count}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  wordmark: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.widest,
  },
  headerLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },

  // Overview numbers
  overviewRow: {
    flexDirection: 'row',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  overviewCell: {
    flex: 1,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  overviewDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginVertical: SPACING.xs,
  },
  overviewValue: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xxl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
    letterSpacing: FONTS.tracking.tight,
  },
  overviewAccent: {
    color: COLORS.accent,
  },
  overviewLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },

  // Time filter
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterChip: {
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
  },
  filterChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSubtle,
  },
  filterLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  filterLabelActive: {
    color: COLORS.accent,
  },

  // Sections
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

  // Trend charts grid — 2 per row
  trendsGrid: {
    gap: SPACING.xl,
  },
  trendCard: {
    paddingBottom: SPACING.xl,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },

  // AI synthesis
  synthesisBox: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
    paddingLeft: SPACING.base,
  },
  synthesisText: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.md * 1.7,
  },

  // Patterns
  patternsList: {
    gap: SPACING.sm,
  },

  // Topics
  topicsList: {
    gap: SPACING.sm,
  },
  topicRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  topicName: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    width: 160,
  },
  topicBarTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 3,
  },
  topicBarFill: {
    height: '100%',
    backgroundColor: COLORS.textSecondary,
    borderRadius: 1,
  },
  topicCount: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    width: 24,
    textAlign: 'right',
  },
});
