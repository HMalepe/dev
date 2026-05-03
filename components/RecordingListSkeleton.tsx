import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS, SPACING, SCREEN_PADDING, RADIUS } from '../constants';

// Skeleton block that pulses opacity — no shimmer, consistent with brutalist aesthetic
function SkeletonBlock({ width, height }: { width: number | `${number}%`; height: number }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <Animated.View
      style={[styles.block, { width, height, opacity: pulse }]}
    />
  );
}

function CardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Date + duration row */}
      <View style={styles.row}>
        <SkeletonBlock width={80} height={8} />
        <SkeletonBlock width={40} height={8} />
      </View>
      {/* Title */}
      <SkeletonBlock width="70%" height={9} />
      {/* Summary lines */}
      <SkeletonBlock width="100%" height={8} />
      <SkeletonBlock width="85%" height={8} />
      {/* Sparkline */}
      <SkeletonBlock width="100%" height={20} />
      {/* Tags */}
      <View style={styles.row}>
        <SkeletonBlock width={90} height={22} />
        <SkeletonBlock width={80} height={22} />
        <SkeletonBlock width={70} height={22} />
      </View>
    </View>
  );
}

interface Props {
  count?: number;
}

export default function RecordingListSkeleton({ count = 3 }: Props) {
  return (
    <View>
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: SCREEN_PADDING,
    marginBottom: SPACING.sm,
    padding: SPACING.base,
    borderWidth: 1,
    borderColor: COLORS.borderSubtle,
    borderRadius: RADIUS.xs,
    gap: SPACING.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  block: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 2,
  },
});
