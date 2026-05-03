import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS, FONTS, SPACING, SCREEN_PADDING, RADIUS } from '../constants';
import { useOnboarding } from '../hooks/useOnboarding';
import ErrorBoundary from '../components/ErrorBoundary';

// ─── Step definitions ─────────────────────────────────────────────────────────

interface Step {
  id: string;
  overline?: string;
  headline: string;
  body: string;
  cta: string;
  ctaSecondary?: string;
  showNameInput?: boolean;
  // For the final step, headline is dynamic (uses name)
  headlineFn?: (name: string) => string;
}

const STEPS: Step[] = [
  {
    id: 'welcome',
    headline: 'YOUR CONVERSATIONS,\nUNDERSTOOD.',
    body: "The patterns you can't see.\nThe habits you can't hear.\nThe insights you've been missing.",
    cta: 'BEGIN →',
  },
  {
    id: 'name',
    overline: 'FIRST THINGS FIRST',
    headline: 'WHAT SHOULD\nWE CALL YOU?',
    body: "Used to personalise your insights.\nNever shared, never sold.",
    cta: 'CONTINUE →',
    showNameInput: true,
  },
  {
    id: 'microphone',
    overline: 'PERMISSION',
    headline: 'ECHO NEEDS\nMICROPHONE ACCESS',
    body: "To transcribe and analyse your sessions, ECHO needs access to your microphone.\n\nYour audio is processed on-device and never uploaded without your explicit permission.",
    cta: 'GRANT ACCESS →',
    ctaSecondary: "I'll do this later",
  },
  {
    id: 'watch',
    overline: 'HOW IT WORKS',
    headline: 'RECORDING LIVES\nON YOUR WATCH',
    body: "One tap to start. One tap to stop.\n\nYour Watch captures the audio. Your iPhone does the understanding. Sessions sync automatically when in range.",
    cta: 'SET UP WATCH APP →',
    ctaSecondary: 'Remind me later',
  },
  {
    id: 'ready',
    overline: 'ALL SET',
    headlineFn: (name) => `YOU'RE READY${name ? `,\n${name.toUpperCase()}.` : '.'}`,
    headline: "YOU'RE READY.",
    body: "Start your first session by tapping the ECHO button on your Watch.\n\nYour insights will appear here within seconds of syncing.",
    cta: 'GO TO HOME →',
  },
];

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepDots({ total, current }: { total: number; current: number }) {
  return (
    <View style={dotsStyles.container}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[dotsStyles.dot, i === current && dotsStyles.dotActive]}
        />
      ))}
    </View>
  );
}

const dotsStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: SPACING.xs,
    alignItems: 'center',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
  },
  dotActive: {
    width: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 2,
  },
});

// ─── Onboarding ───────────────────────────────────────────────────────────────

function OnboardingContent() {
  const insets = useSafeAreaInsets();
  const { completeOnboarding } = useOnboarding();
  const [stepIndex, setStepIndex] = useState(0);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState('');
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const step = STEPS[stepIndex];
  const isLastStep = stepIndex === STEPS.length - 1;
  const headline = step.headlineFn ? step.headlineFn(name) : step.headline;

  const transitionToStep = useCallback(
    (nextIndex: number) => {
      Animated.sequence([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
      // Update index mid-fade
      setTimeout(() => setStepIndex(nextIndex), 150);
    },
    [fadeAnim]
  );

  const handlePrimary = useCallback(async () => {
    Keyboard.dismiss();

    if (step.id === 'name') {
      if (name.trim().length < 1) {
        setNameError('Enter your name to continue.');
        return;
      }
      setNameError('');
    }

    if (isLastStep) {
      await completeOnboarding(name);
      router.replace('/(tabs)');
      return;
    }

    transitionToStep(stepIndex + 1);
  }, [step.id, name, isLastStep, completeOnboarding, stepIndex, transitionToStep]);

  const handleSecondary = useCallback(() => {
    Keyboard.dismiss();
    transitionToStep(stepIndex + 1);
  }, [stepIndex, transitionToStep]);

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Top bar — logo + step dots */}
      <View style={styles.topBar}>
        <Text style={styles.wordmark}>ECHO</Text>
        {stepIndex > 0 && (
          <StepDots total={STEPS.length - 1} current={stepIndex - 1} />
        )}
      </View>

      {/* Animated step content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        {step.overline && (
          <Text style={styles.overline}>{step.overline}</Text>
        )}

        <Text style={styles.headline}>{headline}</Text>

        {step.showNameInput && (
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name"
              placeholderTextColor={COLORS.textMuted}
              value={name}
              onChangeText={(t) => {
                setName(t);
                if (nameError) setNameError('');
              }}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handlePrimary}
              autoFocus={stepIndex === 1}
            />
            <View style={styles.inputUnderline} />
            {nameError ? (
              <Text style={styles.inputError}>{nameError}</Text>
            ) : null}
          </View>
        )}

        <Text style={styles.body}>{step.body}</Text>
      </Animated.View>

      {/* CTAs always fixed at bottom */}
      <View style={styles.ctas}>
        <Pressable
          style={({ pressed }) => [styles.primaryCta, pressed && styles.primaryCtaPressed]}
          onPress={handlePrimary}
        >
          <Text style={styles.primaryCtaText}>{step.cta}</Text>
        </Pressable>

        {step.ctaSecondary && (
          <Pressable
            style={({ pressed }) => [styles.secondaryCta, pressed && { opacity: 0.5 }]}
            onPress={handleSecondary}
          >
            <Text style={styles.secondaryCtaText}>{step.ctaSecondary}</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

export default function OnboardingScreen() {
  return (
    <ErrorBoundary>
      <OnboardingContent />
    </ErrorBoundary>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: SCREEN_PADDING,
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.base,
    marginBottom: SPACING.sm,
  },
  wordmark: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.lg,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.widest,
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    gap: SPACING.xl,
    paddingBottom: SPACING.xxxl,
  },
  overline: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.accent,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  headline: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xxl,
    color: COLORS.textPrimary,
    fontWeight: FONTS.weights.black,
    letterSpacing: FONTS.tracking.tight,
    lineHeight: FONTS.sizes.xxl * 1.2,
  },
  body: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.md,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.md * 1.7,
  },

  // Name input
  inputWrapper: {
    gap: SPACING.xs,
  },
  nameInput: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.xl,
    color: COLORS.textPrimary,
    paddingVertical: SPACING.sm,
    outlineStyle: 'none', // web only — suppresses browser outline
  } as any,
  inputUnderline: {
    height: 1,
    backgroundColor: COLORS.accent,
  },
  inputError: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.error,
    letterSpacing: FONTS.tracking.wide,
  },

  // CTAs
  ctas: {
    gap: SPACING.base,
    paddingBottom: SPACING.xl,
  },
  primaryCta: {
    borderWidth: 1,
    borderColor: COLORS.accent,
    paddingVertical: SPACING.base,
    alignItems: 'center',
  },
  primaryCtaPressed: {
    backgroundColor: COLORS.accentDim,
  },
  primaryCtaText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.accent,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  secondaryCta: {
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  secondaryCtaText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
});
