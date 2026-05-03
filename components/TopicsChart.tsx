import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING } from '../constants';

interface Props {
  topics: Array<{ theme: string; count: number }>;
  maxCount?: number;
}

export default function TopicsChart({ topics, maxCount }: Props) {
  const max = maxCount ?? Math.max(...topics.map((t) => t.count), 1);
  const sorted = [...topics].sort((a, b) => b.count - a.count);

  return (
    <View style={styles.container}>
      {sorted.map((topic, i) => (
        <View key={i} style={styles.row}>
          <Text style={styles.label} numberOfLines={1}>
            {topic.theme.toUpperCase()}
          </Text>
          <View style={styles.barTrack}>
            <View style={[styles.barFill, { flex: topic.count }]} />
            <View style={{ flex: max - topic.count }} />
          </View>
          <Text style={styles.count}>{topic.count}×</Text>
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
  label: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
    width: 130,
  },
  barTrack: {
    flex: 1,
    flexDirection: 'row',
    height: 3,
  },
  barFill: {
    height: '100%',
    backgroundColor: COLORS.textSecondary,
    borderRadius: 1,
  },
  count: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    width: 24,
    textAlign: 'right',
  },
});
