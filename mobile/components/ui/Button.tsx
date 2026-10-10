/**
 * Button.
 *
 * One component covers every button in the app. Variants map to the website's
 * button vocabulary; `pressable` styling uses a scale/opacity spring so a tap
 * feels physical rather than just recolouring.
 */
import React, { useCallback } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { ChevronLeft, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { MIN_TOUCH, motion, radius, spacing, typography } from '@/constants/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger'
  | 'accent'
  | 'subtle';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** Rendered after the label instead of before it. */
  trailingIcon?: LucideIcon;
  loading?: boolean;
  disabled?: boolean;
  /** Stretches to the container width. Default true. */
  block?: boolean;
  full?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  trailingIcon: TrailingIcon,
  loading = false,
  disabled = false,
  block = true,
  full = false,
  style,
  accessibilityLabel,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const inactive = disabled || loading;

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.96, motion.press);
  }, [scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, motion.press);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (inactive) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  }, [inactive, onPress]);

  const skin = ((): {
    background: string;
    border: string;
    borderWidth: number;
    foreground: string;
  } => {
    switch (variant) {
      case 'primary':
        return {
          background: colors.brand,
          border: 'transparent',
          borderWidth: 0,
          foreground: colors.onBrand,
        };
      case 'accent':
        return {
          background: colors.accent,
          border: 'transparent',
          borderWidth: 0,
          foreground: '#FFFFFF',
        };
      case 'secondary':
        return {
          background: colors.surfaceAlt,
          border: colors.border,
          borderWidth: 1,
          foreground: colors.text,
        };
      case 'subtle':
        return {
          background: colors.brandSoft,
          border: colors.brandSoftBorder,
          borderWidth: 1,
          foreground: colors.brandText,
        };
      case 'outline':
        return {
          background: 'transparent',
          border: colors.borderStrong,
          borderWidth: 1,
          foreground: colors.text,
        };
      case 'ghost':
        return {
          background: 'transparent',
          border: 'transparent',
          borderWidth: 0,
          foreground: colors.textMuted,
        };
      case 'danger':
        return {
          background: colors.dangerSoft,
          border: colors.dangerBorder,
          borderWidth: 1,
          foreground: colors.danger,
        };
      default:
        return {
          background: colors.brand,
          border: 'transparent',
          borderWidth: 0,
          foreground: colors.onBrand,
        };
    }
  })();

  const dims = ((): { height: number; padding: number; icon: number; font: TextStyle } => {
    switch (size) {
      case 'sm':
        return { height: 36, padding: spacing.md, icon: 14, font: typography.smallStrong };
      case 'lg':
        return { height: 52, padding: spacing.xl, icon: 18, font: typography.subheading };
      default:
        return { height: 46, padding: spacing.base, icon: 16, font: typography.bodyStrong };
    }
  })();

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={[
        animatedStyle,
        styles.base,
        {
          height: full ? MIN_TOUCH : dims.height,
          minWidth: full ? MIN_TOUCH : undefined,
          width: block ? '100%' : undefined,
          alignSelf: block ? 'stretch' : 'flex-start',
          backgroundColor: skin.background,
          borderColor: skin.border,
          borderWidth: skin.borderWidth,
          opacity: inactive ? 0.45 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={skin.foreground} />
      ) : (
        <View style={[styles.content, { gap: spacing.sm, paddingHorizontal: dims.padding }]}>
          {Icon ? <Icon size={dims.icon} color={skin.foreground} strokeWidth={2.4} /> : null}
          <Text
            style={[dims.font, { color: skin.foreground }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            {label}
          </Text>
          {TrailingIcon ? (
            <TrailingIcon size={dims.icon} color={skin.foreground} strokeWidth={2.4} />
          ) : null}
        </View>
      )}
    </AnimatedPressable>
  );
}

/**
 * Icon-only button. Always has an accessibility label — an unlabelled icon
 * button is invisible to screen readers and unrecognisable to everyone else.
 */
export function IconButton({
  icon: Icon,
  onPress,
  size = 20,
  variant = 'ghost',
  disabled = false,
  accessibilityLabel,
  style,
  badge,
  badgeTone = 'danger',
  iconColor,
  iconFilled,
}: {
  icon: LucideIcon;
  onPress?: () => void;
  size?: number;
  variant?: 'ghost' | 'surface' | 'brand' | 'danger' | 'scrim';
  disabled?: boolean;
  accessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  /** Small count rendered on the top-right, e.g. unread totals. */
  badge?: number;
  /**
   * Badge colour. `danger` (red) means "act on this"; `brand` (green) means
   * "something arrived", which is all an unread chat is.
   */
  badgeTone?: 'danger' | 'brand';
  /** Overrides the icon colour, for state-driven icons like a saved heart. */
  iconColor?: string;
  /** Fills the icon instead of stroking it. */
  iconFilled?: boolean;
}) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const skin = ((): { background: string; foreground: string; border: string; borderWidth: number } => {
    switch (variant) {
      case 'surface':
        return {
          background: colors.surface,
          foreground: colors.text,
          border: colors.border,
          borderWidth: 1,
        };
      case 'brand':
        return {
          background: colors.brand,
          foreground: colors.onBrand,
          border: 'transparent',
          borderWidth: 0,
        };
      case 'danger':
        return {
          background: colors.dangerSoft,
          foreground: colors.danger,
          border: 'transparent',
          borderWidth: 0,
        };
      case 'scrim':
        // For floating over photography: a translucent dark disc so the icon
        // stays legible against a bright photo as well as a dark one. Forced
        // dark because the scrim itself is dark, whatever the theme is.
        return {
          background: 'rgba(14,13,12,0.55)',
          foreground: '#FFFFFF',
          border: 'rgba(255,255,255,0.18)',
          borderWidth: 1,
        };
      default:
        return {
          background: 'transparent',
          foreground: colors.textMuted,
          border: 'transparent',
          borderWidth: 0,
        };
    }
  })();

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.9, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.press);
      }}
      disabled={disabled}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={[
        animatedStyle,
        styles.iconButton,
        {
          backgroundColor: skin.background,
          borderColor: skin.border,
          borderWidth: skin.borderWidth,
          opacity: disabled ? 0.4 : 1,
        },
        style,
      ]}
    >
      <Icon
        size={size}
        color={iconColor ?? skin.foreground}
        strokeWidth={2.2}
        fill={iconFilled ? (iconColor ?? skin.foreground) : 'none'}
      />
      {badge !== undefined && badge > 0 ? (
        <View
          style={[
            styles.badge,
            {
              backgroundColor: badgeTone === 'brand' ? colors.brand : colors.danger,
              borderColor: colors.bg,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: '#FFFFFF' }]}>
            {badge > 99 ? '99+' : badge}
          </Text>
        </View>
      ) : null}
    </AnimatedPressable>
  );
}

/**
 * Back affordance shared by every screen that was pushed onto the stack.
 *
 * One component so the chevron, the touch target, the pressed-state surface and
 * the fallback all stay identical across the app. It always prefers the real
 * previous screen (`router.back()`, which restores scroll position and any tab
 * state behind it) and only falls back to a `replace` when the screen was
 * opened cold from a deep link, where there is no history to unwind.
 */
export function BackButton({
  fallback = '/',
  variant = 'surface',
  accessibilityLabel = 'Go back',
  onPress,
  style,
}: {
  /** Where to land when there is no history to pop. */
  fallback?: string;
  variant?: 'surface' | 'ghost' | 'scrim';
  accessibilityLabel?: string;
  /** Overrides the default pop. Used by modals that must unwind a known route. */
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const scale = useSharedValue(1);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
      return;
    }
    if (router.canGoBack()) router.back();
    else router.replace(fallback);
  }, [onPress, router, fallback]);

  const skin = ((): { background: string; border: string; borderColor: string; borderWidth: number } => {
    switch (variant) {
      case 'ghost':
        return { background: 'transparent', border: 'transparent', borderColor: 'transparent', borderWidth: 0 };
      case 'scrim':
        // For floating over photography: a translucent dark disc keeps the
        // chevron legible against a bright photo as well as a dark one.
        return {
          background: 'rgba(14,13,12,0.55)',
          border: 'rgba(255,255,255,0.20)',
          borderColor: 'rgba(255,255,255,0.20)',
          borderWidth: StyleSheet.hairlineWidth,
        };
      default:
        return {
          background: colors.surface,
          border: colors.border,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
        };
    }
  })();

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={() => {
        scale.value = withSpring(0.9, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.press);
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        animatedStyle,
        styles.backButton,
        {
          backgroundColor: skin.background,
          borderColor: skin.borderColor,
          borderWidth: skin.borderWidth,
        },
        style,
      ]}
    >
      <ChevronLeft size={23} color={variant === 'scrim' ? '#FFFFFF' : colors.text} strokeWidth={2.2} />
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 3,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    lineHeight: 13,
  },
  backButton: {
    width: MIN_TOUCH,
    height: MIN_TOUCH,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * A link that looks like text. Used for "Forgot password?", "See all", inline
 * legal links.
 */
export function TextButton({
  label,
  onPress,
  color,
  style,
}: {
  label: string;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      style={({ pressed }) => [{ opacity: withTiming(pressed ? 0.6 : 1, { duration: 100 }) }, style]}
    >
      <Text style={[typography.smallStrong, { color: color ?? colors.brand }]}>{label}</Text>
    </Pressable>
  );
}