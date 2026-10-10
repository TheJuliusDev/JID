/**
 * Presentational primitives shared by every card, sheet and empty state.
 */
import React from 'react';
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/constants/theme';
import { avatarColors, cloudinaryThumb, initial } from '@/utils/format';

/** Elevated surface with JID's modern design language. */
export function Card({
  children,
  style,
  padded = true,
  onPress,
  accessibilityLabel,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const Wrapper: any = onPress ? require('react-native').Pressable : View;

  return (
    <Wrapper
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.card,
        shadows.subtle,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          padding: padded ? spacing.base : 0,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </Wrapper>
  );
}

/** Compact badge for statuses (Active, Boosted, Verified, Sold...). */
export function Badge({
  label,
  tone = 'neutral',
  icon: Icon,
  style,
}: {
  label: string;
  tone?: 'neutral' | 'brand' | 'accent' | 'success' | 'danger' | 'info';
  icon?: LucideIcon;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  const skin = (() => {
    switch (tone) {
      case 'brand':
        return { bg: colors.brandSoft, fg: colors.brandText, border: colors.brandSoftBorder };
      case 'accent':
        return { bg: colors.accentSoft, fg: colors.accentText, border: colors.accentSoftBorder };
      case 'success':
        return { bg: colors.successSoft, fg: colors.success, border: colors.successBorder };
      case 'danger':
        return { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerBorder };
      case 'info':
        return { bg: colors.infoSoft, fg: colors.info, border: colors.infoBorder };
      default:
        return { bg: colors.surfaceAlt, fg: colors.textMuted, border: colors.border };
    }
  })();

  return (
    <View style={[styles.badge, { backgroundColor: skin.bg, borderColor: skin.border }, style]}>
      {Icon ? <Icon size={11} color={skin.fg} strokeWidth={2.4} /> : null}
      <Text style={[typography.caption, { color: skin.fg, fontWeight: '600' }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/**
 * Avatar with a deterministic colour fallback.
 *
 * `expo-image` handles the network image; the fallback letter is drawn in the
 * same brand-derived colour so avatars never flash as an empty grey box.
 */
export function Avatar({
  uri,
  name,
  size = 44,
  style,
  showRing = false,
}: {
  uri?: string;
  name: string;
  size?: number;
  style?: StyleProp<ViewStyle>;
  showRing?: boolean;
}) {
  const { colors } = useTheme();
  const [from, to] = avatarColors(name || 'jid');

  const wrapper: StyleProp<ViewStyle> = [
    {
      width: size,
      height: size,
      borderRadius: size / 2,
      overflow: 'hidden',
      backgroundColor: colors.surfaceAlt,
      borderWidth: showRing ? 2 : StyleSheet.hairlineWidth,
      borderColor: showRing ? colors.brand : colors.border,
    },
    style,
  ];

  if (uri) {
    return (
      <View style={wrapper}>
        <Image
          source={{ uri: cloudinaryThumb(uri, size * 2) }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={120}
        />
      </View>
    );
  }

  return (
    <View style={[wrapper, { alignItems: 'center', justifyContent: 'center' }]}>
      <LinearGradient
        colors={[from, to]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: size * 0.4 }}>
        {initial(name)}
      </Text>
    </View>
  );
}

/**
 * The dark hero gradient used at the top of the Home and detail screens.
 * `Animated.View` friendly: passes through extra props.
 */
export function HeroGradient({
  children,
  style,
  height,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  height?: number | string;
}) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={[colors.heroFrom, colors.heroTo]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.6, y: 1 }}
      style={[{ height: height as any, overflow: 'hidden' }, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignSelf: 'flex-start',
  },
});