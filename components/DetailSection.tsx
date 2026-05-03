import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, FONTS, SPACING, SCREEN_PADDING } from '../constants';

interface Props {
  title: string;
  children: React.ReactNode;
  accessory?: React.ReactNode; // right-side header element
}

// Consistent section wrapper for RecordingDetail — title bar + padded content.
export default function DetailSection({ title, children, accessory }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {accessory}
      </View>
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
  title: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  body: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.base,
    paddingBottom: SPACING.xl,
  },
});
