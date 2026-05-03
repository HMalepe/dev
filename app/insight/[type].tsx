import React from 'react';
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
import { MOCK_RECORDINGS, MOCK_TRENDS } from '../../mock/recordings';
import { INSIGHT_CONTENT } from '../../mock/insights';
import { confidenceLabel, talkRatioLabel, bestSession } from '../../utils/insights';
import ErrorBoundary from '../../components/ErrorBoundary';
import EnergySparkline from '../../components/EnergySparkline';
import DetailSection from '../../components/DetailSection';

// ─── Scale bar ────────────────────────────────────────────────────────────────

function ScaleBar({
  items,
  currentLabel,
}: {
  items: Array<{ range: string; label: string; isIdeal?: boolean }>;
  currentLabel: string;
}) {
  return (
    <View style={scaleStyles.container}>
      {items.map((item, i) => {
        const isActive = item.label === currentLabel;
        return (
          <View
            key={i}
            style={[
              scaleStyles.row,
              i < items.length - 1 && scaleStyles.rowBorder,
            ]}
          >
            <View style={[scaleStyles.dot, isActive && scaleStyles.dotActive]} />
            <Text style={scaleStyles.range}>{item.range}</Text>
            <Text style={[scaleStyles.label, isActive && scaleStyles.labelActive]}>
              {item.label}
            </Text>
            {item.isIdeal && (
              <View style={scaleStyles.idealBadge}>
                <Text style={scaleStyles.idealText}>TARGET</Text>
              </View>
            )}
            {isActive && (
              <View style={scaleStyles.youBadge}>
                <Text style={scaleStyles.youText}>YOU</Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const scaleStyles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.base,
    paddingVertical: SPACING.sm,
    gap: SPACING.sm,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    backgroundColor: COLORS.accent,
  },
  range: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    width: 72,
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    flex: 1,
  },
  labelActive: {
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.bold,
  },
  idealBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
  },
  idealText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  youBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.xs,
    backgroundColor: COLORS.accentSubtle,
  },
  youText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.accent,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
});

// ─── Implication card ─────────────────────────────────────────────────────────

function ImplicationCard({
  condition,
  meaning,
  isActive,
}: {
  condition: string;
  meaning: string;
  isActive: boolean;
}) {
  return (
    <View style={[implStyles.card, isActive && implStyles.cardActive]}>
      <View style={implStyles.header}>
        <Text style={implStyles.bullet}>{isActive ? '◆' : '○'}</Text>
        <Text style={[implStyles.condition, isActive && implStyles.conditionActive]}>
          {condition}
        </Text>
      </View>
      <Text style={implStyles.meaning}>{meaning}</Text>
    </View>
  );
}

const implStyles = StyleSheet.create({
  card: {
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  cardActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSubtle,
  },
  header: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
  },
  bullet: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    marginTop: 3,
  },
  condition: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    flex: 1,
    lineHeight: FONTS.sizes.xs * 1.5,
  },
  conditionActive: {
    color: COLORS.accent,
  },
  meaning: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.6,
  },
});

// ─── Improvement item ─────────────────────────────────────────────────────────

function ImprovementItem({ text, index }: { text: string; index: number }) {
  return (
    <View style={impStyles.item}>
      <Text style={impStyles.number}>{String(index + 1).padStart(2, '0')}</Text>
      <Text style={impStyles.text}>{text}</Text>
    </View>
  );
}

const impStyles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: SPACING.base,
    alignItems: 'flex-start',
    paddingBottom: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
  },
  number: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.accent,
    fontWeight: FONTS.weights.bold,
    marginTop: 2,
    width: 24,
  },
  text: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.7,
    flex: 1,
  },
});

// ─── Mini trend sparkline ─────────────────────────────────────────────────────

function TrendLine({ values, isImproving }: { values: number[]; isImproving: boolean }) {
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min || 1;

  return (
    <View style={trendStyles.container}>
      {values.map((v, i) => {
        const h = Math.max(0.08, (v - min) / range);
        const isLatest = i === values.length - 1;
        return (
          <View key={i} style={trendStyles.barWrapper}>
            <View
              style={[
                trendStyles.bar,
                {
                  flex: h,
                  backgroundColor: isLatest
                    ? isImproving ? COLORS.accent : COLORS.textSecondary
                    : COLORS.border,
                },
              ]}
            />
            <View style={{ flex: 1 - h }} />
          </View>
        );
      })}
    </View>
  );
}

const trendStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    height: 36,
    gap: 2,
    alignItems: 'flex-end',
  },
  barWrapper: {
    flex: 1,
    height: '100%',
    flexDirection: 'column',
  },
  bar: {
    width: '100%',
    borderRadius: 1,
  },
});

// ─── InsightDeepDive ──────────────────────────────────────────────────────────

function InsightDeepDiveContent() {
  const { type } = useLocalSearchParams<{ type: string; recordingId?: string }>();
  const recordingId = useLocalSearchParams<{ recordingId?: string }>().recordingId;
  const insets = useSafeAreaInsets();

  const content = INSIGHT_CONTENT[type ?? ''];
  const recording = recordingId
    ? MOCK_RECORDINGS.find((r) => r.id === recordingId)
    : undefined;

  const best = bestSession(MOCK_RECORDINGS);

  // Derive the current value and label for this metric type
  const { currentValue, currentLabel, activeImplicationIndex } = (() => {
    if (!recording) return { currentValue: '', currentLabel: '', activeImplicationIndex: -1 };
    switch (type) {
      case 'confidence-index':
        return {
          currentValue: `${recording.confidenceIndex}/100`,
          currentLabel: confidenceLabel(recording.confidenceIndex),
          activeImplicationIndex: recording.confidenceIndex < 60 ? 0 : -1,
        };
      case 'talk-ratio':
        return {
          currentValue: `${recording.talkRatio}%`,
          currentLabel: talkRatioLabel(recording.talkRatio),
          activeImplicationIndex: recording.talkRatio > 68 ? 0 : recording.talkRatio < 40 ? 2 : -1,
        };
      case 'questions-asked': {
        const count = recording.questionsAsked;
        const label = count >= 10 ? 'Deeply curious' : count >= 6 ? 'Engaged' : count >= 3 ? 'Moderate' : count >= 1 ? 'Passive' : 'Monologuing';
        return { currentValue: `${count} questions`, currentLabel: label, activeImplicationIndex: count <= 2 ? 0 : -1 };
      }
      default:
        return { currentValue: '', currentLabel: '', activeImplicationIndex: -1 };
    }
  })();

  // Trend data for this metric type
  const trend = MOCK_TRENDS.find((t) =>
    type === 'confidence-index' ? t.metric === 'CONFIDENCE INDEX' :
    type === 'talk-ratio' ? t.metric === 'TALK RATIO' :
    type === 'questions-asked' ? t.metric === 'QUESTIONS ASKED' : false
  );

  if (!content) {
    return (
      <View style={[styles.screen, styles.notFound, { paddingTop: insets.top }]}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </Pressable>
        <Text style={styles.notFoundText}>INSIGHT NOT FOUND</Text>
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
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{content.title}</Text>
          <Text style={styles.headerTagline}>{content.tagline}</Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxxl }}
      >
        {/* Session value banner — only when arriving from a recording */}
        {recording && currentValue ? (
          <View style={styles.sessionBanner}>
            <View style={styles.sessionBannerRow}>
              <Text style={styles.sessionValue}>{currentValue}</Text>
              <Text style={styles.sessionLabel}>{currentLabel}</Text>
            </View>
            <Text style={styles.sessionFrom}>
              FROM: {recording.title.toUpperCase()}
            </Text>
          </View>
        ) : null}

        {/* What this means */}
        <DetailSection title="WHAT THIS MEASURES">
          <Text style={styles.description}>{content.description}</Text>
        </DetailSection>

        {/* Scale — if available */}
        {content.scale && (
          <DetailSection title="SCALE">
            <ScaleBar items={content.scale} currentLabel={currentLabel} />
          </DetailSection>
        )}

        {/* Historical trend — if available */}
        {trend && (
          <DetailSection
            title="YOUR TREND"
            accessory={
              <Text style={[
                styles.trendChange,
                {
                  color:
                    (trend.changeDirection === 'up' && trend.higherIsBetter) ||
                    (trend.changeDirection === 'down' && !trend.higherIsBetter)
                      ? COLORS.accent
                      : COLORS.textSecondary,
                },
              ]}>
                {trend.changeDirection === 'up' ? '↑' : '↓'} {trend.changeLabel}
              </Text>
            }
          >
            <TrendLine
              values={trend.points.map((p) => p.value)}
              isImproving={
                (trend.changeDirection === 'up' && trend.higherIsBetter) ||
                (trend.changeDirection === 'down' && !trend.higherIsBetter)
              }
            />
          </DetailSection>
        )}

        {/* Best session callout */}
        {best && type === 'confidence-index' && (
          <DetailSection title="YOUR BEST SESSION">
            <View style={styles.bestSessionCard}>
              <View style={styles.bestSessionHeader}>
                <Text style={styles.bestSessionScore}>{best.confidenceIndex}</Text>
                <Text style={styles.bestSessionScoreUnit}>/100</Text>
              </View>
              <Text style={styles.bestSessionTitle}>{best.title.toUpperCase()}</Text>
              <Text style={styles.bestSessionDate}>
                {best.timestamp.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                }).toUpperCase()}
              </Text>
              <EnergySparkline data={best.energyArc} height={20} />
              <Text style={styles.bestSessionHint}>
                Study this session. Replicate the conditions.
              </Text>
            </View>
          </DetailSection>
        )}

        {/* Implications — what it means for THIS user */}
        <DetailSection title="WHAT IT MEANS">
          <View style={styles.implicationsList}>
            {content.implications.map((impl, i) => (
              <ImplicationCard
                key={i}
                condition={impl.condition}
                meaning={impl.meaning}
                isActive={i === activeImplicationIndex}
              />
            ))}
          </View>
        </DetailSection>

        {/* Improvements */}
        <DetailSection title="HOW TO IMPROVE">
          <View style={styles.improvementsList}>
            {content.improvements.map((tip, i) => (
              <ImprovementItem key={i} text={tip} index={i} />
            ))}
          </View>
        </DetailSection>

        {/* Related metrics */}
        <DetailSection title="RELATED METRICS">
          <View style={styles.relatedRow}>
            {content.relatedMetrics.map((metric, i) => (
              <View key={i} style={styles.relatedChip}>
                <Text style={styles.relatedText}>{metric}</Text>
              </View>
            ))}
          </View>
        </DetailSection>
      </ScrollView>
    </View>
  );
}

export default function InsightDeepDiveScreen() {
  return (
    <ErrorBoundary>
      <InsightDeepDiveContent />
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
    alignItems: 'flex-start',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    gap: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerText: {
    flex: 1,
    gap: 3,
  },
  headerTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  headerTagline: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
  },

  // Session banner
  sessionBanner: {
    marginHorizontal: SCREEN_PADDING,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    paddingVertical: SPACING.base,
    paddingHorizontal: SPACING.base,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.accent,
    backgroundColor: COLORS.surface,
    gap: SPACING.xs,
  },
  sessionBannerRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: SPACING.sm,
  },
  sessionValue: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xxl,
    color: COLORS.accent,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.tight,
  },
  sessionLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
  },
  sessionFrom: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },

  // Description
  description: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.md * 1.7,
  },

  // Trend change label
  trendChange: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    letterSpacing: FONTS.tracking.wide,
  },

  // Best session
  bestSessionCard: {
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
    gap: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  bestSessionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  bestSessionScore: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xxl,
    color: COLORS.accent,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.tight,
  },
  bestSessionScoreUnit: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
  },
  bestSessionTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  bestSessionDate: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  bestSessionHint: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    fontStyle: 'italic',
  },

  // Implications
  implicationsList: {
    gap: SPACING.sm,
  },

  // Improvements
  improvementsList: {
    gap: SPACING.base,
  },

  // Related metrics
  relatedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  relatedChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.xs,
  },
  relatedText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
  },

  // Not found
  notFound: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    gap: SPACING.xl,
  },
  notFoundText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
});
