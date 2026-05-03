import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, FONTS, SPACING, SCREEN_PADDING } from '../constants';

interface Props {
  title: string;
  children: React.ReactNode;
  accessory?: React.ReactNode;
  // When provided, the section header becomes a tappable link (→ deep dive)
  onHeaderPress?: () => void;
}

// Consistent section wrapper for RecordingDetail — title bar + padded content.
export default function DetailSection({ title, children, accessory, onHeaderPress }: Props) {
  return (
    <View style={styles.container}>
      <Pressable
        style={({ pressed }) => [styles.header, pressed && onHeaderPress && styles.headerPressed]}
        onPress={onHeaderPress}
        disabled={!onHeaderPress}
      >
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          {accessory}
          {onHeaderPress && <Text style={styles.chevron}>›</Text>}
        </View>
      </Pressable>
      <View style={styles.body}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  headerPressed: {
    backgroundColor: COLORS.surfaceHover,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  chevron: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.md,
    color: COLORS.textMuted,
  },
  body: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.xl,
  },
});
