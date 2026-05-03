import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants';
import type { RecordingMoment, MomentType } from '../types';

interface Props {
  moment: RecordingMoment;
  isLast?: boolean;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const MOMENT_META: Record<
  MomentType,
  { icon: string; color: string; prefix: string }
> = {
  confidence: { icon: '↑', color: COLORS.accent, prefix: 'CONFIDENCE' },
  hesitation: { icon: '↓', color: COLORS.textSecondary, prefix: 'HESITATION' },
  deflection: { icon: '✕', color: COLORS.warning, prefix: 'DEFLECTION' },
  rapport:    { icon: '◎', color: COLORS.accent, prefix: 'RAPPORT' },
  insight:    { icon: '◆', color: COLORS.textPrimary, prefix: 'INSIGHT' },
};

export default function MomentItem({ moment, isLast }: Props) {
  const meta = MOMENT_META[moment.type];

  return (
    <View style={styles.container}>
      {/* Timeline spine */}
      <View style={styles.timeline}>
        <View style={[styles.dot, { backgroundColor: meta.color }]} />
        {!isLast && <View style={styles.spine} />}
      </View>

      <View style={styles.content}>
        {/* Timestamp + type label */}
        <View style={styles.headerRow}>
          <Text style={[styles.icon, { color: meta.color }]}>{meta.icon}</Text>
          <Text style={styles.timestamp}>{formatTime(moment.startTimeSeconds)}</Text>
          <Text style={[styles.type, { color: meta.color }]}>{meta.prefix}</Text>
        </View>

        <Text style={styles.title}>{moment.title}</Text>
        <Text style={styles.description}>{moment.description}</Text>

        {moment.quote && (
          <View style={styles.quoteBox}>
            <Text style={styles.quote}>"{moment.quote}"</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  timeline: {
    alignItems: 'center',
    width: 16,
    paddingTop: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  spine: {
    flex: 1,
    width: 1,
    backgroundColor: COLORS.border,
    marginTop: 4,
    marginBottom: -SPACING.base,
  },
  content: {
    flex: 1,
    paddingBottom: SPACING.base,
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  icon: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    fontWeight: FONTS.weights.bold,
  },
  timestamp: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  type: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  title: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.semibold,
  },
  description: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.6,
  },
  quoteBox: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.border,
    paddingLeft: SPACING.sm,
    marginTop: SPACING.xs,
  },
  quote: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    fontStyle: 'italic',
    lineHeight: FONTS.sizes.base * 1.5,
  },
});
