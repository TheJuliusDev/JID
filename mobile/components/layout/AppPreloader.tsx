/**
 * Branded launch preloader.
 *
 * Shown while the app restores its session and warms its first screen. It is
 * deliberately not a spinner: the mark settles in with a spring, a brand glow
 * breathes behind it, and an indeterminate bar sweeps across the wordmark. Every
 * animation is either a one-shot spring or a single opacity/translate loop, so
 * it costs almost nothing even on a low-end Android device.
 *
 * It renders no content of its own — it is purely an overlay — which is what
 * lets the real navigator mount underneath it while it is still visible. The app
 * therefore has data in flight *during* the preloader and never needs to delay
 * it to "make the loader last".
 */
import React, { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { BRAND } from '@/constants/brand';
import { motion, radius, shadows, spacing, typography } from '@/constants/theme';

/** Fraction of the track the travelling highlight occupies. */
const BAR_FRACTION = 0.34;

export function AppPreloader() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  // 0 → 1 as the brand mark settles into place.
  const intro = useSharedValue(0);
  // 0 → 1 → 0 loop driving the breathing glow behind the mark.
  const breathe = useSharedValue(0);
  // 0 → 1 loop driving the sweep of the highlight across the track.
  const sweep = useSharedValue(0);
  // 0 → 1 as the wordmark and caption fade up under the mark.
  const copyIn = useSharedValue(0);

  const [trackWidth, setTrackWidth] = useState(0);

  const onTrackLayout = useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  useEffect(() => {
    intro.value = withSpring(1, motion.enter);
    copyIn.value = withDelay(120, withTiming(1, { duration: 420, easing: Easing.out(Easing.cubic) }));

    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );

    sweep.value = withRepeat(
      withTiming(1, { duration: 1250, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false,
    );

    return () => {
      cancelAnimation(intro);
      cancelAnimation(breathe);
      cancelAnimation(sweep);
      cancelAnimation(copyIn);
    };
  }, [intro, breathe, sweep, copyIn]);

  const markStyle = useAnimatedStyle(() => ({
    opacity: intro.value,
    transform: [
      { scale: 0.82 + 0.18 * intro.value },
      { translateY: (1 - intro.value) * 12 },
    ],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.45 * breathe.value,
    transform: [{ scale: 0.9 + 0.16 * breathe.value }],
  }));

  const copyStyle = useAnimatedStyle(() => ({
    opacity: copyIn.value,
    transform: [{ translateY: (1 - copyIn.value) * 8 }],
  }));

  const barStyle = useAnimatedStyle(() => {
    const segment = trackWidth * BAR_FRACTION;
    const travel = trackWidth - segment;
    // Fade in and out at the ends so the highlight appears to enter and leave
    // the track rather than teleport.
    const p = sweep.value;
    const fade = Math.min(1, Math.min(p / 0.18, (1 - p) / 0.18));
    return {
      opacity: fade,
      transform: [{ translateX: -segment + travel * p }],
    };
  });

  return (
    <View
      style={[styles.root, { backgroundColor: colors.bg }]}
      accessibilityRole="progressbar"
      accessibilityLabel={`Loading ${BRAND.name}`}
    >
      <View style={styles.center}>
        <View style={styles.markWrap}>
          <Animated.View
            style={[
              styles.glow,
              { backgroundColor: colors.brandGlow },
              glowStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.mark,
              shadows.brand,
              { backgroundColor: colors.brand },
              markStyle,
            ]}
          >
            <Image
              source={require('../../assets/jid-logo.png')}
              style={styles.markImage}
              contentFit="cover"
            />
          </Animated.View>
        </View>

        <Animated.View style={[styles.copy, copyStyle]}>
          <Text style={[styles.wordmark, { color: colors.text }]}>{BRAND.name}</Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>{BRAND.tagline}</Text>
        </Animated.View>

        <Animated.View
          style={[styles.track, { backgroundColor: colors.surfaceAlt }, copyStyle]}
          onLayout={onTrackLayout}
        >
          {trackWidth > 0 ? (
            <Animated.View
              style={[
                styles.bar,
                { width: trackWidth * BAR_FRACTION, backgroundColor: colors.brand },
                barStyle,
              ]}
            />
          ) : null}
        </Animated.View>
      </View>

      <Text
        style={[
          typography.caption,
          styles.footer,
          { bottom: insets.bottom + spacing.xl, color: colors.textSubtle },
        ]}
      >
        {BRAND.institution.name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  markWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
  },
  mark: {
    width: 92,
    height: 92,
    borderRadius: radius['2xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
  markImage: {
    width: 92,
    height: 92,
    borderRadius: radius['2xl'],
  },
  copy: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  wordmark: {
    ...typography.display,
    letterSpacing: 3.2,
  },
  track: {
    width: 148,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: spacing.xs,
  },
  bar: {
    height: '100%',
    borderRadius: 2,
  },
  footer: {
    position: 'absolute',
  },
});