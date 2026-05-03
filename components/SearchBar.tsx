import React, { useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  Pressable,
  Text,
  StyleSheet,
  Animated,
} from 'react-native';
import { COLORS, FONTS, SPACING, SCREEN_PADDING } from '../constants';

interface Props {
  value: string;
  onChange: (text: string) => void;
  onClose: () => void;
  autoFocus?: boolean;
}

export default function SearchBar({ value, onChange, onClose, autoFocus }: Props) {
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-12, 0],
  });

  return (
    <Animated.View style={[styles.container, { opacity: slideAnim, transform: [{ translateY }] }]}>
      <Text style={styles.prefix}>⌕</Text>
      <TextInput
        style={styles.input}
        placeholder="Search sessions, topics, insights…"
        placeholderTextColor={COLORS.textMuted}
        value={value}
        onChangeText={onChange}
        autoFocus={autoFocus}
        returnKeyType="search"
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="never"
      />
      {value.length > 0 && (
        <Pressable onPress={() => onChange('')} hitSlop={8} style={styles.clearButton}>
          <Text style={styles.clearText}>✕</Text>
        </Pressable>
      )}
      <Pressable onPress={onClose} hitSlop={8} style={styles.cancelButton}>
        <Text style={styles.cancelText}>CANCEL</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.background,
    gap: SPACING.sm,
  },
  prefix: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textMuted,
  },
  input: {
    flex: 1,
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.xs,
  },
  clearButton: {
    padding: SPACING.xs,
  },
  clearText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
  },
  cancelButton: {
    paddingVertical: SPACING.xs,
    paddingLeft: SPACING.xs,
  },
  cancelText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
  },
});
