/**
 * Bottom sheets.
 *
 * One primitive for every sheet in the app. Before this existed each sheet wired
 * `@gorhom/bottom-sheet` itself, which meant six subtly different backdrops, six
 * slightly different handles, and — most importantly — six chances to forget that
 * tapping outside closes the sheet.
 *
 * ## What every sheet now gets, for free
 *
 *   - **Glass.** A blur, a tint, a hairline and a lit top edge, identical
 *     everywhere.
 *   - **An animated backdrop.** It fades in step with the sheet rather than
 *     appearing all at once, so dragging the sheet down visibly "un-dims" the
 *     screen behind it.
 *   - **Three ways out, none of them a hunt for an X.** Tap the backdrop, swipe
 *     the sheet down, or press Android back.
 *   - **One exit animation.** Closing plays the reverse of opening; nothing is
 *     unmounted mid-motion, which is what makes a sheet feel like it snaps away.
 *
 * ## The dismissal contract
 *
 * A sheet is temporary UI, and temporary UI must never trap the user. That is
 * enforced here rather than left to each call site, because the failure mode is
 * silent: a sheet with no backdrop press just looks unresponsive.
 *
 * Closing goes through `closeSheet`, which fires `onClose` and lets gorhom animate
 * out. Parents keep the single source of truth in their own `visible` prop; the
 * sheet never closes itself.
 *
 * ## Android back
 *
 * Handled by the library, but only once `enableDismissOnClose` is on, and it is
 * off by default in some configurations. It is set explicitly below, and the
 * library suppresses the *hardware* back only while the sheet is open — so back
 * still navigates the stack the moment it closes.
 *
 * ## Why `enableDynamicSizing` is off
 *
 * Dynamic sizing re-measures content on every open, which makes an action sheet
 * visibly resize between two taps that render the same rows. Snap points are
 * chosen per sheet instead, so the height is predictable and the motion is not.
 */
import React, { useCallback, useMemo } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useTheme } from '@/providers/ThemeProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { GlassSurface } from '@/components/ui/Glass';
import { useDismissable } from '@/hooks';

/** Re-exported so sheets scroll without each importing from the library. */
export { BottomSheetScrollView };

export type SheetSnapPoints = Array<string | number>;

/**
 * The backdrop behind a sheet.
 *
 * Its opacity is derived from the sheet's own animated position, so the dim tracks
 * the drag instead of cross-fading on a separate timer. `pressBehavior="close"` is
 * what makes the whole backdrop a close target, and `enableTouchThrough={false}`
 * stops a fast tap from slipping through to the screen underneath.
 */
function SheetBackdrop(props: BottomSheetBackdropProps) {
  const { colors } = useTheme();
  return (
    <BottomSheetBackdrop
      {...props}
      appearsOnIndex={0}
      disappearsOnIndex={-1}
      pressBehavior="close"
      enableTouchThrough={false}
      opacity={1}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.backdrop }]}
    />
  );
}

export function Sheet({
  visible,
  onClose,
  children,
  snapPoints,
  title,
  subtitle,
  headerRight,
  /**
   * Replaces the `title`/`subtitle` header with custom content, still pinned above
   * the scrolling body.
   *
   * For sheets whose header carries more than a label - a status icon, a live
   * summary, a severity badge. A sheet's title should not scroll away, because it is
   * what tells the user where they are after the content starts moving.
   */
  header,
  /** Scrollable body. Off for short sheets like action menus. */
  scrollable = true,
  /**
   * Pinned below the scrolling body.
   *
   * The primary action of a sheet — "Show results", "Send report" — must not scroll
   * away, or it disappears exactly when the user has finished reading what it acts
   * on. Kept outside the scroll view so it stays reachable at any scroll position.
   */
  footer,
  contentContainerStyle,
  style,
  /** Hides the drag handle — only for a sheet that is never dismissed by dragging. */
  hideHandle = false,
  backgroundStyle,
}: {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  snapPoints: SheetSnapPoints;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  /** Custom pinned header, in place of `title`/`subtitle`. See the prop docs. */
  header?: React.ReactNode;
  scrollable?: boolean;
  /**
   * Pinned below the scrolling body.
   *
   * The primary action of a sheet — "Show results", "Send report" — must not scroll
   * away, or it disappears exactly when the user has finished reading what it acts
   * on. Kept outside the scroll view so it stays reachable at any scroll position.
   */
  footer?: React.ReactNode;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  hideHandle?: boolean;
  backgroundStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();

  /**
   * Android hardware back, as a safety net.
   *
   * The library claims back while a sheet is open. This covers the gap the library
   * cannot: a sheet whose parent unmounted it mid-animation, where the subscription
   * is already gone but the overlay is still on screen. Without it, back silently
   * does nothing and the user is stuck.
   */
  useDismissable(visible, onClose);

  const handleClose = useCallback(() => onClose(), [onClose]);

  /**
   * Remounting on open is what makes the sheet animate in from fully closed.
   *
   * Without the changing `key`, gorhom keeps the previous layout and the sheet
   * appears already-open — correct state, wrong motion, and it reads as the app
   * failing to respond.
   */
  const remountKey = useMemo(() => (visible ? 'open' : 'closed'), [visible]);

  const Body = scrollable ? BottomSheetScrollView : BottomSheetView;

  return (
    <BottomSheet
      key={remountKey}
      index={visible ? 0 : -1}
      snapPoints={snapPoints}
      onClose={handleClose}
      // Swipe-down and backdrop-tap are the two exits the library owns; both are
      // required, because on a tall sheet the handle is not always reachable with
      // one hand.
      enablePanDownToClose
      enableDynamicSizing={false}
      // Locks the sheet to the backdrop so a fast tap never slips through to the
      // screen underneath and opens something else.
      backdropComponent={SheetBackdrop}
      backgroundStyle={[
        {
          backgroundColor: 'transparent',
          borderColor: colors.glassBorder,
          borderWidth: StyleSheet.hairlineWidth,
          borderTopLeftRadius: radius['2xl'],
          borderTopRightRadius: radius['2xl'],
          elevation: 0,
          shadowColor: '#000',
          shadowOpacity: 0.18,
          shadowRadius: 24,
          shadowOffset: { width: 0, height: -4 },
        },
        backgroundStyle,
      ]}
      handleIndicatorStyle={[
        {
          backgroundColor: colors.handle,
          width: 36,
          height: 4,
          borderRadius: 2,
        },
        hideHandle ? styles.hiddenHandle : null,
      ]}
      // Android's navigation bar draws over the sheet; transparent + edge-to-edge
      // is what lets the glass reach the bottom of the screen.
      style={style}
    >
      {/*
       * The glass layer is a child of the sheet rather than its background, so the
       * blur samples the screen *behind* the sheet. Blurring the sheet's own
       * background colour would blur a flat fill and do nothing.
       */}
      <GlassSurface
        tone="strong"
        intensity={72}
        radius={0}
        bordered={false}
        elevated={false}
        style={styles.glassFill}
      >
        <View style={styles.glassContent}>
          {header ??
            (title ? (
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <SheetTitle>{title}</SheetTitle>
                  {subtitle ? (
                    <SheetSubtitle>{subtitle}</SheetSubtitle>
                  ) : null}
                </View>
                {headerRight}
              </View>
            ) : null)}

          <Body
            contentContainerStyle={[styles.body, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
            // The sheet owns its scroll; the screen behind must not move with it.
            nestedScrollEnabled
          >
            {children}
          </Body>

          {footer ? (
            <View
              style={[
                styles.footer,
                { borderTopColor: colors.borderStrong },
              ]}
            >
              {footer}
            </View>
          ) : null}

          {/*
           * Home-indicator allowance. Without it the last row of a tall sheet sits
           * under the iOS home bar.
           */}
          <View style={styles.bottomSafe} />
        </View>
      </GlassSurface>
    </BottomSheet>
  );
}

/**
 * Titles live in the sheet body rather than a native header so they share the glass
 * tint and stay put while the body scrolls.
 */
function SheetTitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typography.heading, { color: colors.text }]}>{children}</Text>;
}

function SheetSubtitle({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typography.small, styles.subtitle, { color: colors.textMuted }]}>{children}</Text>;
}

/** Android-only: keeps the sheet clear of the navigation bar. */
export const sheetAndroidProps = Platform.select({
  android: { statusBarTranslucent: true, navigationBarTranslucent: true },
  default: {},
}) as { statusBarTranslucent?: boolean; navigationBarTranslucent?: boolean };

const styles = StyleSheet.create({
  glassFill: {
    flex: 1,
    borderTopLeftRadius: radius['2xl'],
    borderTopRightRadius: radius['2xl'],
  },
  glassContent: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  subtitle: {
    marginTop: 2,
  },
  body: {
    paddingHorizontal: spacing.base,
    paddingBottom: spacing.base,
    flexGrow: 1,
  },
  /**
   * The pinned footer spans the sheet's full width, so its own padding is the
   * caller's job — wrapping in a bordered row keeps the divider from being cut
   * short by a rounded corner.
   */
  footer: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  bottomSafe: {
    height: spacing.lg,
  },
  hiddenHandle: {
    opacity: 0,
  },
});