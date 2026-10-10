/**
 * The in-progress recording surface.
 *
 * Rendered in place of the mic icon, inside the view that carries the recording
 * `PanResponder`, so the finger stays on the same target from press to release.
 * See `useVoiceRecorder` for why that matters.
 *
 * Everything here is animated on the UI thread with Reanimated:
 *
 *  - **Waveform.** Each mic sample drives a shared value; the bars spring toward
 *    it (rather than snapping), so idle bars rest at a sliver and speech glides
 *    in and out instead of cutting on and off.
 *  - **Live dot.** The dot breathes on a slow loop with a fading halo ring, the
 *    "we are recording" signal without the alarm blinking of an old tape deck.
 *  - **Cancel morph.** Crossing the cancel threshold runs one shared value to 1,
 *    and every element (bar fill, bar surface, dot, copy) interpolates from
 *    brand to danger, so the gesture is acknowledged by a smooth shift rather
 *    than a swap.
 *  - **Entrance.** The bar springs in from the mic rather than teleporting.
 *
 * The bar's leftward travel mirrors the actual drag, and past the cancel
 * threshold the whole bar turns to the danger colour and the copy switches to
 * "Release to cancel". The user learns the gesture by attempting it and seeing
 * it acknowledge, rather than by reading a tooltip.
 */
import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeOut,
  ZoomIn,
  interpolateColor,
  makeMutable,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { formatDuration } from './VoiceMessage';

const BAR_COUNT = 24;
/** Resting height of a silent bar; keeps the waveform visible but quiet. */
const MIN_BAR = 3;
/** Full-scale height of a hot bar. */
const MAX_BAR = 22;

interface RecordingBarProps {
  durationMs: number;
  amplitudes: number[];
  dragX: number;
  cancelArmed: boolean;
}

export function RecordingBar({ durationMs, amplitudes, dragX, cancelArmed }: RecordingBarProps) {
  const { colors } = useTheme();

  const slide = useSharedValue(0);
  const cancelProgress = useSharedValue(0);
  const breathe = useSharedValue(0);
  const barTargets = useRef<SharedValue<number>[]>(
    Array.from({ length: BAR_COUNT }, () => makeMutable(0)),
  ).current;

  useEffect(() => {
    // Native driver, mirroring the live drag. Runs for every gesture frame, so it
    // must not bounce through the JS bridge.
    slide.value = withSpring(dragX, { damping: 30, stiffness: 400, mass: 0.5 });
  }, [dragX, slide]);

  useEffect(() => {
    // One shared "how armed is the cancel" value drives every colour below, so the
    // whole bar shifts together instead of parts of it blinking out of sync.
    cancelProgress.value = withTiming(cancelArmed ? 1 : 0, {
      duration: 220,
      easing: Easing.inOut(Easing.quad),
    });
  }, [cancelArmed, cancelProgress]);

  useEffect(() => {
    breathe.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [breathe]);

  // Fold the live samples into the bar targets; the spring reading them does the
  // smoothing, so a 100ms tick becomes a glide rather than a snap.
  useEffect(() => {
    if (amplitudes.length === 0) {
      for (const target of barTargets) target.value = 0;
      return;
    }
    for (let i = 0; i < BAR_COUNT; i++) {
      const offset = amplitudes.length - BAR_COUNT + i;
      const value = offset >= 0 ? amplitudes[offset] : 0;
      barTargets[i].value = Math.max(MIN_BAR, value * MAX_BAR);
    }
  }, [amplitudes, barTargets]);

  const barStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      cancelProgress.value,
      [0, 1],
      [colors.surface, colors.dangerSoft],
    ),
    borderColor: interpolateColor(cancelProgress.value, [0, 1], [colors.border, colors.dangerBorder]),
    transform: [{ translateX: slide.value }],
  }));

  const tintStyle = useAnimatedStyle(() => ({
    color: interpolateColor(cancelProgress.value, [0, 1], [colors.brand, colors.danger]),
  }));

  const captionStyle = useAnimatedStyle(() => ({
    color: interpolateColor(cancelProgress.value, [0, 1], [colors.textSubtle, colors.danger]),
  }));

  const dotStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(cancelProgress.value, [0, 1], [colors.accent, colors.danger]),
    transform: [{ scale: 1 + breathe.value * 0.18 }],
    opacity: 0.85 + breathe.value * 0.15,
  }));

  const haloStyle = useAnimatedStyle(() => ({
    opacity: (1 - breathe.value) * 0.3,
    transform: [{ scale: 1 + breathe.value * 1.7 }],
  }));

  return (
    <Animated.View
      entering={ZoomIn.springify().damping(28).stiffness(320).mass(0.8)}
      exiting={FadeOut.duration(160)}
      style={styles.frame}
      accessibilityRole="button"
      accessibilityLabel={
        cancelArmed
          ? `Recording ${formatDuration(durationMs)}. Release to cancel.`
          : `Recording, ${formatDuration(durationMs)}. Slide left to cancel, release to send.`
      }
    >
      <Animated.View style={[styles.bar, barStyle]}>
        <View style={styles.dotSlot}>
          <Animated.View style={[styles.halo, { borderColor: colors.danger }, haloStyle]} />
          <Animated.View style={[styles.dot, dotStyle]} />
        </View>

        <Animated.Text style={[typography.bodyStrong, tintStyle]}>
          {formatDuration(durationMs)}
        </Animated.Text>

        <View style={styles.wave}>
          {barTargets.map((target, i) => (
            <WaveBar
              key={i}
              target={target}
              cancelProgress={cancelProgress}
              tint={colors.brand}
              danger={colors.danger}
            />
          ))}
        </View>

        <Animated.Text style={[typography.caption, captionStyle]} numberOfLines={1}>
          {cancelArmed ? 'Release to cancel' : 'Slide to cancel'}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
}

/**
 * One waveform bar. Its height is a spring reading `target`, so consecutive
 * mic samples flow into each other instead of cutting between states.
 */
function WaveBar({
  target,
  cancelProgress,
  tint,
  danger,
}: {
  target: SharedValue<number>;
  cancelProgress: SharedValue<number>;
  tint: string;
  danger: string;
}) {
  const style = useAnimatedStyle(() => ({
    height: withSpring(target.value, { damping: 24, stiffness: 220, mass: 0.6 }),
    backgroundColor: interpolateColor(cancelProgress.value, [0, 1], [tint, danger]),
  }));

  return <Animated.View style={[styles.barItem, style]} />;
}

const styles = StyleSheet.create({
  frame: {
    flex: 1,
  },
  bar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    height: 44,
    paddingHorizontal: spacing.base,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  dotSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: radius.pill,
  },
  halo: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: radius.pill,
    borderWidth: 2,
  },
  wave: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: 26,
  },
  barItem: {
    width: 3,
    borderRadius: radius.pill,
  },
});