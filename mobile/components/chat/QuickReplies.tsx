/**
 * The quick-reply rail above the composer.
 *
 * Sits directly above the input rather than inside it, so tapping a suggestion
 * fills the composer and lets the user add to it before sending. One tap sends
 * and one tap drafts are both defensible; drafting is the safer default here
 * because a mis-sent "Is this still available?" in a thread where the item is
 * already sold is an awkward thing to have to unsend.
 */
import React from 'react';
import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import { Sparkles } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';

interface QuickRepliesProps {
  suggestions: readonly string[];
  /**
   * Called with the chosen text. The composer decides whether to fill the draft
   * or send immediately.
   */
  onSelect: (text: string) => void;
  /** Hides the rail until the user re-opens it. */
  onDismiss: () => void;
}

export function QuickReplies({ suggestions, onSelect, onDismiss }: QuickRepliesProps) {
  const { colors } = useTheme();

  if (suggestions.length === 0) return null;

return (
    <Animated.View
      entering={FadeInDown.duration(240)}
      exiting={FadeOut.duration(140)}
      style={styles.wrapper}
    >
      <View style={styles.labelRow}>
        <View style={styles.labelLeft}>
          <Sparkles size={12} color={colors.brand} />
          <Text style={[typography.caption, { color: colors.textSubtle }]}>Quick replies</Text>
        </View>
        <Pressable
          onPress={onDismiss}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Hide quick replies"
        >
          <Text style={[typography.caption, { color: colors.textSubtle }]}>Hide</Text>
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="always"
        contentContainerStyle={styles.rail}
      >
        {suggestions.map((suggestion, index) => (
          <Animated.View
            key={suggestion}
            entering={FadeInDown.duration(240).delay(60 + index * 50)}
          >
            <Pressable
              onPress={() => onSelect(suggestion)}
              accessibilityRole="button"
              accessibilityLabel={`Quick reply: ${suggestion}`}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: pressed ? colors.brandSoft : colors.surface,
                  borderColor: pressed ? colors.brand : colors.border,
                  borderRadius: radius.pill,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.text }]}>
                {suggestion}
              </Text>
            </Pressable>
          </Animated.View>
        ))}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
    paddingBottom: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.base,
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  rail: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xxs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 260,
  },
});