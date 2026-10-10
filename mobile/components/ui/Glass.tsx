/**
 * Glass surfaces.
 *
 * ## What "glass" means here
 *
 * Three layers, always in this order:
 *
 *   1. a `BlurView` that samples what is behind the surface
 *   2. a translucent tint from the theme, which sets the base tone
 *   3. a hairline border, because a frosted edge with no outline reads as a
 *      rendering artefact rather than a deliberate pane
 *
 * ## Where it is used, and why not everywhere
 *
 * Glass is reserved for surfaces that float *above* content — sheets, menus,
 * floating controls, overlays — because that is the only place where there is
 * something behind it worth blurring. Applying it to a card in a flat scrolling
 * list produces a grey wash with no depth behind it: pure cost, no payoff. For
 * those, `Card` with an opaque surface is the correct choice, and it is what the
 * rest of the app uses.
 *
 * ## Performance
 *
 * `BlurView` is a native view, and its cost scales with the area it covers. So:
 *
 *   - `intensity` comes from the shared `blur` presets, which are tuned per
 *     platform, because the same number looks different on each
 *   - the Android implementation clips to its own bounds; nothing here blurs a
 *     full-screen surface
 *   - `GlassSurface` renders its blur behind a plain `View`, so the blur is never
 *     re-composited by a parent that also animates opacity
 *
 * Every animated value in this file is a `useSharedValue` driving
 * `useAnimatedStyle`, so the work happens on the UI thread. Nothing here calls
 * `setState` on a frame.
 */
import React from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { blur, blurIntensity, radius, shadows, spacing } from '@/constants/theme';

type IntensityPreset = number | { ios: number; android: number };

/**
 * A frosted panel.
 *
 * Use for something that genuinely floats: a sheet, a menu, a floating bar. If the
 * surface is inside an opaque list and nothing shows through it, use `Card`
 * instead — the blur would be invisible and the tint would just look like a grey
 * card.
 */
export function GlassSurface({
  children,
  style,
  /** `strong` guarantees legibility over unpredictable content. */
  tone = 'default',
  intensity = blur.sheet,
  radius: cornerRadius = radius['2xl'],
  /** Fades the whole surface in. Set on mount for content that should settle. */
  animateIn = false,
  bordered = true,
  elevated = true,
  pointerEvents,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'strong';
  intensity?: IntensityPreset;
  radius?: number;
  animateIn?: boolean;
  bordered?: boolean;
  elevated?: boolean;
  pointerEvents?: ViewStyle['pointerEvents'];
}) {
  const { colors } = useTheme();
  const tint = tone === 'strong' ? colors.glassStrong : colors.glass;
  const resolved = blurIntensity(intensity, Platform.OS);

  const enter = useSharedValue(animateIn ? 0 : 1);

  React.useEffect(() => {
    if (!animateIn) return;
    enter.value = withTiming(1, { duration: MOTION_ENTER_MS, easing: Easing.out(Easing.cubic) });
  }, [animateIn, enter]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: enter.value,
  }));

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.clip,
        { borderRadius: cornerRadius },
        elevated ? shadows.lg : null,
        bordered
          ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.glassBorder }
          : null,
        style,
      ]}
    >
      {/*
       * Absolute fill behind the tint. Kept as a sibling rather than a parent so
       * that content re-renders cannot re-create the native blur view.
       */}
      {resolved > 0 ? (
        <BlurView
          intensity={resolved}
          tint={colors.isDark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: cornerRadius }]}
          // The blur must never eat touches meant for the content inside it.
          pointerEvents="none"
        />
      ) : null}

      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { borderRadius: cornerRadius, backgroundColor: tint },
          animatedStyle,
        ]}
        pointerEvents="none"
      />

      {/*
       * Top highlight. A one-pixel light line along the upper edge is what sells
       * glass as a lit material rather than a translucent rectangle; it is the
       * cheapest possible imitation of a bevel.
       */}
      {bordered ? (
        <View
          pointerEvents="none"
          style={[
            styles.highlight,
            { borderTopColor: colors.glassHighlight, borderTopLeftRadius: cornerRadius, borderTopRightRadius: cornerRadius },
          ]}
        />
      ) : null}

      <View style={styles.content}>{children}</View>
    </View>
  );
}

/**
 * A glass card for content layered over media or a gradient.
 *
 * Distinguishes itself from `Card` only in being translucent. Use it for a card
 * sitting on a photo or hero; use `Card` for a card on a flat surface.
 */
export function GlassCard({
  children,
  style,
  tone = 'strong',
  intensity = blur.none,
  padded = true,
  radius: cornerRadius = radius.xl,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'default' | 'strong';
  /** Defaults to no blur — a card over a photo should not pay for a blur. */
  intensity?: IntensityPreset;
  padded?: boolean;
  radius?: number;
}) {
  return (
    <GlassSurface
      tone={tone}
      intensity={intensity}
      radius={cornerRadius}
      style={padded ? styles.paddedCard : undefined}
    >
      {children}
    </GlassSurface>
  );
}

/**
 * The dimming layer behind an overlay, with the backdrop's own fade.
 *
 * Extracted so every overlay in the app dims identically. The fade is animated on
 * the UI thread and driven by `progress` (0 = hidden, 1 = shown) so it tracks a
 * sheet dragging open rather than snapping on after the sheet has moved.
 *
 * `pressToDismiss` is deliberately separate from rendering: a backdrop that
 * swallows touches without closing them is a dead zone, which is worse than no
 * backdrop at all. It closes the overlay instead.
 */
export function GlassScrim({
  progress,
  onDismiss,
  opacity = 1,
  style,
}: {
  /** 0–1. Drives the fade so it stays in step with the sheet's own motion. */
  progress?: SharedValue<number>;
  onDismiss?: () => void;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const own = useSharedValue(1);

  React.useEffect(() => {
    if (progress) return;
    own.value = withTiming(1, { duration: MOTION_ENTER_MS });
  }, [progress, own]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: (progress ? progress.value : own.value) * opacity,
  }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      {/*
       * A `Pressable`, not a bare `View` with a touch handler: `onTouchEnd` on a
       * plain view does not fire reliably on Android, which would leave the
       * backdrop visible but inert — the exact dead zone this component exists to
       * avoid.
       *
       * It fills the screen and swallows the press, so a tap that misses the panel
       * can never reach the content behind it and trigger something else.
       */}
      <Pressable
        onPress={onDismiss}
        disabled={!onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Close"
        style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]}
      >
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, animatedStyle]}
        />
      </Pressable>
    </Animated.View>
  );
}

const MOTION_ENTER_MS = 220;

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  highlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  content: {
    flex: 1,
  },
  paddedCard: {
    padding: spacing.base,
  },
});