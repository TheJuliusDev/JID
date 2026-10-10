/**
 * Shared header for every signed-out screen: the JID mark, the tagline, and the
 * institution line.
 *
 * Kept as a component rather than layout chrome so it scrolls with the form.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/providers/ThemeProvider';
import { BRAND } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';

export function AuthHero({ compact = false }: { compact?: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      <View style={[styles.mark, { backgroundColor: colors.brand }]}>
        <Image
          source={require('../../assets/jid-logo.png')}
          style={styles.markImage}
          contentFit="cover"
        />
      </View>
      <Text style={[compact ? typography.title : typography.display, styles.tagline, { color: colors.text }]}>
        {BRAND.tagline}
      </Text>
      <Text style={[typography.small, styles.subtagline, { color: colors.textMuted }]}>
        {BRAND.institution.name} · {BRAND.institution.location}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing['3xl'],
    paddingBottom: spacing['2xl'],
  },
  wrapCompact: {
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
  },
  mark: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  markImage: {
    width: 60,
    height: 60,
    borderRadius: radius.lg,
  },
  tagline: {
    textAlign: 'center',
  },
  subtagline: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});