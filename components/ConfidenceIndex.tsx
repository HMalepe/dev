import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants';

interface Props {
  score: number;  // 0–100
  delta: number;  // change vs rolling average (positive = above average)
}

// The single-number metric users will obsess over — like a sleep score or credit score.
// Higher always = more confident delivery.
export default function ConfidenceIndex({ score, delta }: Props) {
  const deltaSign = delta >= 0 ? '+' : '';
  const deltaColor = delta >= 0 ? COLORS.accent : COLORS.textSecondary;

  const filledBars = Math.round(score / 5); // 20 bars total
  const scoreColor =
    score >= 75 ? COLORS.accent :
    score >= 50 ? COLORS.textPrimary :
    COLORS.textSecondary;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>CONFIDENCE INDEX</Text>
        <Text style={[styles.delta, { color: deltaColor }]}>
          {deltaSign}{delta} vs avg
        </Text>
      </View>
      <View style={styles.scoreRow}>
        <Text style={[styles.score, { color: scoreColor }]}>{score}</Text>
        <Text style={styles.scoreUnit}>/100</Text>
      </View>
      {/* Progress bar — 20 segments */}
      <View style={styles.track}>
        {Array.from({ length: 20 }, (_, i) => (
          <View
            key={i}
            style={[
              styles.segment,
              i < filledBars
                ? { backgroundColor: scoreColor }
                : { backgroundColor: COLORS.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  delta: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    letterSpacing: FONTS.tracking.wide,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
  },
  score: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xxxl,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.tight,
    lineHeight: FONTS.sizes.xxxl * 1.1,
  },
  scoreUnit: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  track: {
    flexDirection: 'row',
    gap: 2,
    height: 4,
    marginTop: SPACING.xs,
  },
  segment: {
    flex: 1,
    height: '100%',
    borderRadius: 1,
  },
});
