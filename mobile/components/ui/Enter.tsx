/**
 * Content entrance.
 *
 * Loaded content should *arrive*, not blink into existence. Without this, a screen
 * swaps a skeleton for real content and the user's eye has to re-find everything
 * that moved; a short fade-and-rise says "this is the same screen, now filled in".
 *
 * ## Why the delay exists
 *
 * `delay` staggers a grid or list so rows do not all land on the same frame. It is
 * the one place a delay is welcome, and it is capped deliberately: past about
 * 240ms the last item stops feeling connected to the interaction that revealed it
 * and starts feeling slow. Beyond that, stagger should be dropped, not extended.
 *
 * ## Why this is opt-in
 *
 * It is not applied automatically to every list. An entrance on every screen means
 * an animation on every navigation, which compounds into a laggy feel and, on a
 * mid-range Android, real dropped frames. It is applied where it earns its place:
 * screen bodies after a load, and first-render content that replaced a skeleton.
 *
 * ## Implementation
 *
 * `FadeIn`/`FadeInDown` from Reanimated are used directly rather than a hand-rolled
 * `useSharedValue` + `withTiming`, because the library's layout animations already
 * run on the UI thread and already handle unmounting and re-entrant layout changes.
 */
import React from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, type LayoutAnimation } from 'react-native-reanimated';

/** Longest stagger this component will accept. See the note above. */
const MAX_DELAY_MS = 240;
const STEP_MS = 40;

export function EnterFade({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  /** Milliseconds before the entrance begins. Clamped to 240. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View entering={FadeIn.duration(220).delay(clamp(delay))} style={style}>
      {children}
    </Animated.View>
  );
}

/**
 * Entrance that rises slightly as it fades in — the default for content that
 * replaces a skeleton, because the direction matches the list it now sits in.
 */
export function EnterRise({
  children,
  delay = 0,
  distance = 10,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInUp.duration(260).delay(clamp(delay)).springify().damping(26).stiffness(240)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * A row in a staggered group.
 *
 * Intended to be used inside a list's `renderItem` with `delay={index * STEP_MS}`.
 * Only sensible for the first screenful: a long list would delay rows the user is
 * already scrolling past.
 */
export function StaggeredRise({
  children,
  index = 0,
  style,
}: {
  children: React.ReactNode;
  index: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Animated.View
      entering={FadeInDown.duration(240).delay(clamp(index * STEP_MS)).springify().damping(24)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Wraps a screen body so it settles in on first mount.
 *
 * `once` is the default because re-running the entrance on every focus turn would
 * make the screen feel like it was reloading each time the user glanced back at it.
 */
export function ScreenEntrance({
  children,
  enabled = true,
  style,
}: {
  children: React.ReactNode;
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  if (!enabled) return <View style={style}>{children}</View>;
  return (
    <Animated.View entering={FadeIn.duration(200)} style={style}>
      {children}
    </Animated.View>
  );
}

function clamp(delay: number): number {
  if (!Number.isFinite(delay) || delay <= 0) return 0;
  return Math.min(delay, MAX_DELAY_MS);
}

export type { LayoutAnimation };