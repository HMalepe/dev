import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, FONTS, SPACING, SCREEN_PADDING } from '../constants';

interface Props {
  children: React.ReactNode;
  // Optional fallback — defaults to the full-screen error view
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

// React requires a class component for error boundaries.
// Wrap every screen with this to prevent crashes from propagating.
export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production: send to Sentry or similar
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, message: '' });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <View style={styles.container}>
          <Text style={styles.glyph}>⚠</Text>
          <Text style={styles.title}>SOMETHING WENT WRONG</Text>
          <Text style={styles.message} numberOfLines={4}>
            {this.state.message || 'An unexpected error occurred.'}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={this.reset}
          >
            <Text style={styles.buttonText}>TRY AGAIN</Text>
          </Pressable>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'flex-start',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
    gap: SPACING.base,
  },
  glyph: {
    fontSize: 28,
    color: COLORS.warning,
    marginBottom: SPACING.sm,
  },
  title: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.textPrimary,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  message: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
    lineHeight: FONTS.sizes.xs * 1.8,
  },
  button: {
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  buttonPressed: {
    backgroundColor: COLORS.accentDim,
  },
  buttonText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.base,
    color: COLORS.accent,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
});
