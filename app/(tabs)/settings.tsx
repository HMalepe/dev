import React from 'react';
import ErrorBoundary from '../../components/ErrorBoundary';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, SCREEN_PADDING, RADIUS } from '../../constants';

// ─── Settings item ────────────────────────────────────────────────────────────

function SettingRow({
  label,
  value,
  hint,
  onPress,
  isDestructive,
}: {
  label: string;
  value?: string;
  hint?: string;
  onPress?: () => void;
  isDestructive?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.settingRow, pressed && styles.settingRowPressed]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.settingMain}>
        <Text style={[styles.settingLabel, isDestructive && styles.settingLabelDestructive]}>
          {label}
        </Text>
        {hint && <Text style={styles.settingHint}>{hint}</Text>}
      </View>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {onPress && <Text style={styles.settingChevron}>›</Text>}
    </Pressable>
  );
}

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

// ─── Settings Screen ──────────────────────────────────────────────────────────

function SettingsScreenContent() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.wordmark}>ECHO</Text>
        <Text style={styles.headerLabel}>CONFIG</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + SPACING.xxxl }}
      >
        {/* API Keys */}
        <SettingSection title="AI PROVIDERS">
          <SettingRow
            label="OpenAI API Key"
            value="sk-••••••••4f2a"
            hint="Used for Whisper transcription"
            onPress={() => {}}
          />
          <SettingRow
            label="Anthropic API Key"
            value="sk-ant-••••••••9c1e"
            hint="Used for insight generation"
            onPress={() => {}}
          />
        </SettingSection>

        {/* Transcription */}
        <SettingSection title="TRANSCRIPTION">
          <SettingRow
            label="Whisper Model"
            value="whisper-1"
            onPress={() => {}}
          />
          <SettingRow
            label="Language"
            value="Auto-detect"
            onPress={() => {}}
          />
          <SettingRow
            label="Speaker Detection"
            value="Enabled"
            onPress={() => {}}
          />
        </SettingSection>

        {/* Insight Model */}
        <SettingSection title="INSIGHT ENGINE">
          <SettingRow
            label="Claude Model"
            value="claude-sonnet-4-20250514"
            onPress={() => {}}
          />
          <SettingRow
            label="Insight Depth"
            value="Full analysis"
            hint="Shorter = faster + cheaper"
            onPress={() => {}}
          />
        </SettingSection>

        {/* Storage */}
        <SettingSection title="STORAGE">
          <SettingRow
            label="Recordings stored"
            value="6  ·  67 MB"
          />
          <SettingRow
            label="Auto-delete after"
            value="Never"
            onPress={() => {}}
          />
          <SettingRow
            label="Export all recordings"
            onPress={() => {}}
          />
        </SettingSection>

        {/* Privacy */}
        <SettingSection title="PRIVACY">
          <SettingRow
            label="Store audio on device only"
            value="On"
            onPress={() => {}}
          />
          <SettingRow
            label="Send transcripts to Claude"
            value="On"
            hint="Required for insight generation"
            onPress={() => {}}
          />
        </SettingSection>

        {/* Danger zone */}
        <SettingSection title="DANGER ZONE">
          <SettingRow
            label="Delete all recordings"
            isDestructive
            onPress={() => {}}
          />
          <SettingRow
            label="Reset all insights"
            isDestructive
            onPress={() => {}}
          />
        </SettingSection>

        {/* Build info */}
        <View style={styles.buildInfo}>
          <Text style={styles.buildText}>ECHO  v1.0.0  ·  BUILD 1</Text>
          <Text style={styles.buildText}>Made for people who take conversations seriously</Text>
        </View>
      </ScrollView>
    </View>
  );
}

export default function SettingsScreen() {
  return (
    <ErrorBoundary>
      <SettingsScreenContent />
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  wordmark: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.widest,
  },
  headerLabel: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
  },
  section: {
    marginTop: SPACING.xl,
  },
  sectionTitle: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
    paddingHorizontal: SCREEN_PADDING,
    marginBottom: SPACING.xs,
  },
  sectionBody: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: SPACING.base,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSubtle,
    gap: SPACING.sm,
  },
  settingRowPressed: {
    backgroundColor: COLORS.surfaceHover,
  },
  settingMain: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textPrimary,
  },
  settingLabelDestructive: {
    color: COLORS.error,
  },
  settingHint: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  settingValue: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.wide,
  },
  settingChevron: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textMuted,
  },
  buildInfo: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: SPACING.xxxl,
    paddingBottom: SPACING.base,
    gap: SPACING.xs,
  },
  buildText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
});
