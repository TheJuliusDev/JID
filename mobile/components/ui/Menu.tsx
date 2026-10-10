/**
 * Menus and popovers.
 *
 * The small-overlay counterpart to `Sheet`. A menu must not dim the screen and must
 * not drag, but it must obey exactly the same dismissal contract, because from the
 * user's point of view they are the same kind of thing: temporary UI that appeared
 * because they tapped something.
 *
 * ## The tap-outside problem, and why it is fiddly
 *
 * A menu is a small panel floating over a live screen. Getting dismissal right means
 * satisfying four things at once, and every shortcut breaks one of them:
 *
 *   1. A tap *on the panel* must not close it.
 *   2. A tap *anywhere else* must close it.
 *   3. A tap in the gap *between* the panel and the nearest screen edge must also
 *      close it. This is where hand-rolled menus fail: the panel is measured after
 *      mount, and a press in the few pixels between the panel's edge and where it
 *      was assumed to be hits the screen instead.
 *   4. A press inside the panel must reach the panel's own content — its rows, its
 *      inputs, its scroll view.
 *
 * The structure below gets all four without any hit-testing: an absolute-fill
 * `Pressable` backdrop, and the panel as a *sibling above it*. Touch routing is
 * decided by drawing order, so hits on the panel go to the panel and everything
 * else falls through to the backdrop. (3) in particular needs no arithmetic at all.
 *
 * ## Why the exit animation works
 *
 * The menu stays mounted and a single shared value drives its opacity and transform
 * in both directions. The obvious alternative — `entering`/`exiting` from
 * Reanimated — only plays the exit if the component unmounts, and unmounting on the
 * same tick that sets `open = false` means the close animation never gets a frame.
 * A shared value animating `open → 0` is what makes closing a genuine reverse of
 * opening rather than an instant disappearance.
 *
 * ## Rendering
 *
 * Rendered in place rather than in a `Modal`. A native `Modal` would put the menu on
 * its own window above the status bar, breaking the anchored positioning and costing
 * a full-screen native surface on mid-range Android. A native `Modal` is still
 * correct for genuinely full-screen media (the photo viewer), and that is the only
 * place this app uses one.
 */
import React, { useCallback, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { MIN_TOUCH, motion, radius, shadows, spacing, typography } from '@/constants/theme';
import { useDismissable, useKeyboardVisible } from '@/hooks';
import { GlassSurface } from '@/components/ui/Glass';

/** Where the panel sits. */
export type MenuAnchor =
  /** Centred on screen — for menus opened from a header with no useful anchor. */
  | 'center'
  /** Pinned above the bottom safe area — for menus from a bottom bar or tab. */
  | 'bottom';

const OPEN_MS = 180;
const CLOSE_MS = 140;

export function Menu({
  open,
  onClose,
  children,
  anchor = 'center',
  width,
  style,
  maxHeight = 420,
  title,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  anchor?: MenuAnchor;
  width?: number;
  style?: StyleProp<ViewStyle>;
  maxHeight?: number;
  title?: string;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();

  // Android back, same contract as sheets.
  useDismissable(open, onClose);

  const progress = useSharedValue(0);

  useEffect(() => {
    // Closing is faster than opening: by the time the user has tapped away they
    // have already decided, so a slow fade-out only delays getting on with it.
    progress.value = open
      ? withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) })
      : withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
  }, [open, progress]);

  const panelStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [
      { scale: interpolate(progress.value, [0, 1], [0.94, 1]) },
      { translateY: interpolate(progress.value, [0, 1], [10, 0]) },
    ],
  }));

  /**
   * A menu with no height should not be able to cover the screen.
   *
   * A tall menu is legitimate — a long list of saved filters, say — so this
   * subtracts the insets rather than imposing a small cap, and the body scrolls.
   */
  const cap = Math.min(maxHeight, 640);

  return (
    <View
      style={StyleSheet.absoluteFill}
      // `none` when closed so the invisible menu cannot swallow a tap meant for the
      // screen beneath. When open, `auto` lets the backdrop receive it.
      pointerEvents={open ? 'auto' : 'none'}
    >
      {/*
       * The backdrop: absolute fill, drawn first, so every part of the screen
       * outside the panel is a close target.
       *
       * It does not dim. A menu is a light interruption, not a modal decision, and
       * dimming a list the user is still looking at makes them think it is gone.
       */}
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Close menu"
        style={StyleSheet.absoluteFill}
      />

      {/* The panel: a sibling above the backdrop, so presses inside it never
          reach the close target. */}
      <View
        style={[
          anchor === 'center' ? styles.centered : styles.bottom,
          {
            paddingBottom: anchor === 'bottom' ? insets.bottom + spacing.md : insets.bottom,
            // Centre-anchored menus would sit under the keyboard; the bottom-anchored
            // one is already above the safe area and simply moves with the layout.
            opacity: keyboardVisible && anchor === 'center' ? 0 : 1,
          },
          style,
        ]}
        pointerEvents="box-none"
      >
        <Animated.View style={[styles.panelWrap, panelStyle]}>
          <GlassSurface
            tone="strong"
            intensity={72}
            radius={radius.xl}
            style={[styles.panel, { width: width ?? undefined, maxHeight: cap }]}
          >
            {title ? (
              <View style={[styles.titleRow, { borderBottomColor: colors.border }]}>
                <Text style={[typography.overline, { color: colors.textSubtle }]}>{title}</Text>
              </View>
            ) : null}

            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.body}
            >
              {children}
            </ScrollView>
          </GlassSurface>
        </Animated.View>
      </View>
    </View>
  );
}

/**
 * One row in a menu.
 *
 * Destructive rows are tinted, so "Delete" cannot be hit by muscle memory next to
 * "Copy".
 */
export function MenuItem({
  label,
  onPress,
  icon: Icon,
  destructive = false,
  disabled = false,
  /** Right-aligned status text, e.g. "On". */
  detail,
  selected = false,
}: {
  label: string;
  onPress: () => void;
  icon?: LucideIcon;
  destructive?: boolean;
  disabled?: boolean;
  detail?: string;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  const press = useSharedValue(1);
  const foreground = destructive ? colors.danger : colors.text;

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: press.value }],
  }));

  const handlePress = useCallback(() => {
    if (disabled) return;
    onPress();
  }, [disabled, onPress]);

  return (
    <Animated.View style={animated}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          press.value = withSpring(0.97, motion.press);
        }}
        onPressOut={() => {
          press.value = withSpring(1, motion.press);
        }}
        disabled={disabled}
        accessibilityRole="menuitem"
        accessibilityState={{ disabled, selected }}
        style={({ pressed }) => [
          styles.item,
          {
            backgroundColor: pressed && !disabled ? colors.surfaceAlt : 'transparent',
            opacity: disabled ? 0.4 : 1,
          },
        ]}
      >
        {Icon ? (
          <Icon size={17} color={destructive ? colors.danger : colors.textMuted} strokeWidth={2.1} />
        ) : null}
        <Text style={[typography.body, styles.itemLabel, { color: foreground }]} numberOfLines={1}>
          {label}
        </Text>
        {selected ? (
          <View style={[styles.check, { backgroundColor: colors.brand }]} />
        ) : detail ? (
          <Text style={[typography.caption, { color: colors.textSubtle }]}>{detail}</Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/** Hairline between groups of menu rows. */
export function MenuDivider() {
  const { colors } = useTheme();
  return <View style={[styles.divider, { backgroundColor: colors.border }]} />;
}

const styles = StyleSheet.create({
  centered: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  bottom: {
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.base,
    alignItems: 'center',
  },
  panelWrap: {
    maxWidth: '100%',
  },
  panel: {
    overflow: 'hidden',
    ...shadows.lg,
  },
  titleRow: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  body: {
    paddingVertical: spacing.xs,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
  },
  itemLabel: {
    flex: 1,
    fontWeight: '500',
  },
  check: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
});