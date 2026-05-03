import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants';
import type { ToneSegment } from '../types';

interface Props {
  segments: ToneSegment[];
}

export default function ToneBreakdown({ segments }: Props) {
  // Sort descending so dominant tone is always first
  const sorted = [...segments].sort((a, b) => b.percentage - a.percentage);
  const maxPct = sorted[0]?.percentage ?? 100;

  return (
    <View style={styles.container}>
      {sorted.map((seg, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.emoji}>{seg.emoji}</Text>
          <Text style={styles.label}>{seg.label.toUpperCase()}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                {
                  flex: seg.percentage,
                  // Dominant tone gets a hint of accent; others stay muted
                  backgroundColor: i === 0 ? COLORS.textSecondary : COLORS.border,
                },
              ]}
            />
            <View style={{ flex: maxPct - seg.percentage }} />
          </View>
          <Text style={styles.pct}>{seg.percentage}%</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  emoji: {
    fontSize: FONTS.sizes.base,
    width: 20,
    textAlign: 'center',
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    width: 96,
  },
  barTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 3,
  },
  barFill: {
    height: '100%',
    borderRadius: 1,
  },
  pct: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    width: 32,
    textAlign: 'right',
  },
});
