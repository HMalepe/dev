import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { COLORS, FONTS, SPACING, RADIUS } from '../constants';
import type { TranscriptLine } from '../types';

interface Props {
  lines: TranscriptLine[];
  // If provided, tapping a line with this momentId will highlight it
  highlightedMomentId?: string;
}

const PREVIEW_LINE_COUNT = 6;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Renders text with filler word ranges subtly de-emphasized
function TranscriptText({
  text,
  fillerRanges,
}: {
  text: string;
  fillerRanges?: Array<{ start: number; end: number }>;
}) {
  if (!fillerRanges || fillerRanges.length === 0) {
    return <Text style={styles.lineText}>{text}</Text>;
  }

  // Split text into normal + filler segments
  const segments: Array<{ text: string; isFiller: boolean }> = [];
  let cursor = 0;
  const sorted = [...fillerRanges].sort((a, b) => a.start - b.start);

  for (const range of sorted) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start), isFiller: false });
    }
    segments.push({ text: text.slice(range.start, range.end), isFiller: true });
    cursor = range.end;
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor), isFiller: false });
  }

  return (
    <Text style={styles.lineText}>
      {segments.map((seg, i) =>
        seg.isFiller ? (
          <Text key={i} style={styles.fillerWord}>
            {seg.text}
          </Text>
        ) : (
          <Text key={i}>{seg.text}</Text>
        )
      )}
    </Text>
  );
}

export default function TranscriptView({ lines, highlightedMomentId }: Props) {
  const [expanded, setExpanded] = useState(false);
  const visibleLines = expanded ? lines : lines.slice(0, PREVIEW_LINE_COUNT);

  return (
    <View style={styles.container}>
      {visibleLines.map((line) => {
        const isHighlighted = !!line.momentId && line.momentId === highlightedMomentId;
        const isYou = line.speaker === 'YOU';

        return (
          <View
            key={line.id}
            style={[
              styles.line,
              isHighlighted && styles.lineHighlighted,
            ]}
          >
            <View style={styles.lineHeader}>
              <Text style={[styles.speaker, isYou && styles.speakerYou]}>
                {line.speaker}
              </Text>
              <Text style={styles.timestamp}>{formatTime(line.startTimeSeconds)}</Text>
              {isHighlighted && (
                <View style={styles.momentBadge}>
                  <Text style={styles.momentBadgeText}>MOMENT</Text>
                </View>
              )}
            </View>
            <TranscriptText text={line.text} fillerRanges={line.fillerRanges} />
          </View>
        );
      })}

      {lines.length > PREVIEW_LINE_COUNT && (
        <Pressable
          style={({ pressed }) => [styles.expandButton, pressed && { opacity: 0.6 }]}
          onPress={() => setExpanded((e) => !e)}
        >
          <Text style={styles.expandText}>
            {expanded
              ? '↑ COLLAPSE TRANSCRIPT'
              : `↓ SHOW ALL ${lines.length} LINES`}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  line: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.xs,
    gap: SPACING.xs,
  },
  lineHighlighted: {
    backgroundColor: COLORS.surfaceElevated,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.accent,
  },
  lineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  speaker: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
    width: 32,
  },
  speakerYou: {
    color: COLORS.textSecondary,
  },
  timestamp: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textMuted,
    letterSpacing: FONTS.tracking.wide,
  },
  momentBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: COLORS.accent,
    borderRadius: RADIUS.xs,
  },
  momentBadgeText: {
    fontFamily: FONTS.mono,
    fontSize: 8,
    color: COLORS.accent,
    letterSpacing: FONTS.tracking.label,
    fontWeight: FONTS.weights.bold,
  },
  lineText: {
    fontFamily: FONTS.sans,
    fontSize: FONTS.sizes.base,
    color: COLORS.textSecondary,
    lineHeight: FONTS.sizes.base * 1.6,
    paddingLeft: 40, // align under speaker label
  },
  fillerWord: {
    color: COLORS.textMuted,
    textDecorationLine: 'underline',
    textDecorationColor: COLORS.textMuted,
  },
  expandButton: {
    alignSelf: 'flex-start',
    marginTop: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  expandText: {
    fontFamily: FONTS.mono,
    fontSize: FONTS.sizes.xs,
    color: COLORS.textSecondary,
    letterSpacing: FONTS.tracking.label,
  },
});
