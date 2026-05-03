import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Tabs, router } from 'expo-router';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { COLORS, FONTS, SPACING, SCREEN_PADDING } from '../../constants';

// Tab configuration — icon glyphs instead of vector-icons to avoid font loading complexity
const TAB_CONFIG = [
  { name: 'index',    label: 'HOME',     glyph: '◉' },
  { name: 'insights', label: 'INSIGHTS', glyph: '▲' },
  { name: 'settings', label: 'CONFIG',   glyph: '⚙' },
] as const;

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  return (
    <View style={styles.tabBar}>
      <View style={styles.tabBarInner}>
        {state.routes.map((route, index) => {
          const config = TAB_CONFIG.find((t) => t.name === route.name);
          if (!config) return null;
          const isActive = state.index === index;

          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [
                styles.tab,
                isActive && styles.tabActive,
                pressed && styles.tabPressed,
              ]}
              onPress={() => navigation.navigate(route.name)}
            >
              <Text style={[styles.tabGlyph, isActive && styles.tabGlyphActive]}>
                {config.glyph}
              </Text>
              <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                {config.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="insights" />
      <Tabs.Screen name="settings" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.background,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.base,
  },
  tabBarInner: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: SPACING.xs,
  },
  tabActive: {},
  tabPressed: {
    opacity: 0.5,
  },
  tabGlyph: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  tabGlyphActive: {
    color: COLORS.accent,
  },
  tabLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  tabLabelActive: {
    color: COLORS.accent,
  },
});
