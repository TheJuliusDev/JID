/**
 * The quoted-message strip above the composer.
 *
 * Identifies what is being replied to without stealing a line of the transcript.
 * The accent bar on the leading edge is the affordance: it points back at the
 * original, and it is the same bar the quoted block uses inside a bubble, so the
 * two read as the same object in two places.
 *
 * Tapping it is wired by the caller to scroll the transcript to the original —
 * that jump is the thing that makes a reply legible in a long thread, and it is
 * why the strip is a button rather than a label.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { X, CornerUpLeft } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';

interface ReplyPreviewProps {
  /** Text of the message being replied to. */
  quote: string;
  /** True when the original was deleted, so the copy says so instead of quoting it. */
  deleted?: boolean;
  onCancel: () => void;
  /** Scrolls the transcript to the original message. */
  onJump?: () => void;
}

export function ReplyPreview({ quote, deleted, onCancel, onJump }: ReplyPreviewProps) {
  const { colors } = useTheme();

  const body = (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.surfaceAlt,
          borderColor: colors.border,
          borderRadius: radius.md,
        },
      ]}
    >
      <View style={[styles.bar, { backgroundColor: deleted ? colors.textSubtle : colors.brand }]} />

      <View style={styles.text}>
        <View style={styles.titleRow}>
          <CornerUpLeft size={11} color={colors.textSubtle} />
          <Text style={[typography.caption, { color: colors.textSubtle }]}>
            {deleted ? 'Replying to a deleted message' : 'Replying'}
          </Text>
        </View>
        <Text
          style={[typography.small, { color: deleted ? colors.textSubtle : colors.textMuted }]}
          numberOfLines={1}
        >
          {quote}
        </Text>
      </View>

      <Pressable
        onPress={onCancel}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Cancel reply"
        style={styles.cancel}
      >
        <X size={16} color={colors.textSubtle} />
      </Pressable>
    </View>
  );

  if (!onJump) return body;

  // Wrapped so the whole strip jumps, while Cancel stays an independent target
  // rather than a press that also fires the jump.
  return (
    <Pressable
      onPress={onJump}
      accessibilityRole="button"
      accessibilityLabel={`Jump to the message you are replying to: ${quote}`}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    overflow: 'hidden',
  },
  bar: {
    width: 3,
    alignSelf: 'stretch',
    minHeight: 34,
  },
  text: {
    flex: 1,
    gap: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cancel: {
    padding: spacing.xs,
  },
});