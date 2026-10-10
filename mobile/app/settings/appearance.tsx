/**
 * Appearance.
 *
 * Lets the user pick light, dark or follow-system. The choice is persisted by
 * `ThemeProvider` (AsyncStorage), so it survives a restart rather than resetting
 * to system every launch.
 *
 * Each option renders three preview swatches using the *resolved* tokens, so
 * "Light" and "Dark" look like the app will actually look, not like generic
 * toggles.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Moon, Smartphone, Sun } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme, useThemeMode, type ThemePreference } from '@/providers/ThemeProvider';
import { darkTheme, lightTheme, radius, spacing, typography } from '@/constants/theme';
import { Screen, ScreenHeader } from '@/components/layout/Screen';

const OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  description: string;
  icon: LucideIcon;
}> = [
  {
    value: 'system',
    label: 'System',
    description: 'Match your phoneâ€™s light or dark setting.',
    icon: Smartphone,
  },
  { value: 'light', label: 'Light', description: 'Always use the light theme.', icon: Sun },
  { value: 'dark', label: 'Dark', description: 'Always use the dark theme.', icon: Moon },
];

export default function AppearanceScreen() {
  const { colors } = useTheme();
  const { preference, setPreference } = useThemeMode();
  const router = useRouter();

  const select = useCallback((value: ThemePreference) => setPreference(value), [setPreference]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Appearance" fallback="/(tabs)" />

      <Screen gap={spacing.md}>
        {OPTIONS.map((option) => {
          const selected = preference === option.value;
          const Icon = option.icon;
          // The swatch always previews the *option*, not the current theme.
          const preview = option.value === 'dark' ? darkTheme : lightTheme;
          const previewColors =
            option.value === 'system' ? colors : preview.colors;

          return (
            <Pressable
              key={option.value}
              onPress={() => select(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={option.label}
              style={({ pressed }) => [
                styles.option,
                {
                  backgroundColor: selected ? colors.brandSoft : colors.surface,
                  borderColor: selected ? colors.brand : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <View style={styles.optionHeader}>
                <View
                  style={[
                    styles.iconWrap,
                    { backgroundColor: selected ? colors.brand : colors.surfaceAlt },
                  ]}
                >
                  <Icon size={18} color={selected ? colors.onBrand : colors.textMuted} />
                </View>
                <View style={styles.optionText}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>
                    {option.label}
                  </Text>
                  <Text style={[typography.small, { color: colors.textMuted }]}>
                    {option.description}
                  </Text>
                </View>

                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: selected ? colors.brand : colors.borderStrong,
                      backgroundColor: selected ? colors.brand : 'transparent',
                    },
                  ]}
                >
                  {selected ? <Check size={13} color={colors.onBrand} strokeWidth={3} /> : null}
                </View>
              </View>

              {/* Mini app preview: header bar, a card, and a text line. */}
              <View style={[styles.preview, { backgroundColor: previewColors.bg, borderColor: colors.border }]}>
                <View style={[styles.previewBar, { backgroundColor: previewColors.heroFrom }]} />
                <View style={[styles.previewCard, { backgroundColor: previewColors.surface, borderColor: previewColors.border }]}>
                  <View style={[styles.previewLine, { backgroundColor: previewColors.textMuted }]} />
                  <View
                    style={[
                      styles.previewLine,
                      styles.previewLineShort,
                      { backgroundColor: previewColors.brand },
                    ]}
                  />
                </View>
              </View>
            </Pressable>
          );
        })}

        <Text style={[typography.caption, { color: colors.textSubtle, textAlign: 'center' }]}>
          JID uses your system setting by default.
        </Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  option: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.base,
    gap: spacing.md,
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    flexDirection: 'row',
    height: 56,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  previewBar: {
    width: 18,
  },
  previewCard: {
    flex: 1,
    margin: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.sm,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewLine: {
    height: 7,
    borderRadius: 4,
    width: '70%',
  },
  previewLineShort: {
    width: '40%',
  },
});
