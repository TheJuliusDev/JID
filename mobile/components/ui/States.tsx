/**
 * Loading and empty/error states.
 *
 * Skeletons mirror the exact shape of the real cards with smooth shimmer animations,
 * avoiding jarring layout jumps. Empty and error states provide clear guidance
 * and actionable recovery steps without exposing raw database errors.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  makeMutable,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import {
  WifiOff,
  SearchX,
  TriangleAlert,
  PackageX,
  BookmarkX,
  MessageSquareOff,
  BellOff,
  RefreshCw,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { radius, shadows, spacing, typography } from '@/constants/theme';
import { Button } from './Button';

/**
 * The one shimmer clock for the whole app.
 *
 * ## Why this is module scope
 *
 * A skeleton is used inside every placeholder component, and those placeholders
 * repeat per card in a grid — a listing screen can easily mount twenty at once. The
 * obvious implementation gives each block its own `withRepeat(..., -1)`, which means
 * twenty independent infinite animations that never stop, even after the real data
 * has replaced them, because the loops are only torn down on unmount.
 *
 * `makeMutable` creates a shared value outside the React tree, so N skeletons cost
 * exactly one animation: the first one to mount starts the loop, and every block
 * reads the same value in its own `useAnimatedStyle`. That work stays on the UI
 * thread and costs no JS per frame.
 *
 * The trade-off is that every shimmer on screen is in phase. That is invisible in
 * practice — a sweeping highlight reads as ambient light — and it is the trade-off
 * every design system makes for skeleton shimmer.
 */
const shimmerClock = makeMutable(0);
let shimmerStarted = false;

/**
 * A shimmering placeholder block.
 *
 * The highlight sweeps across rather than pulsing, which reads as a surface being
 * lit rather than a block blinking — the difference between "loading" and "broken"
 * at a glance.
 */
export function Skeleton({
  width,
  height,
  radius: r = radius.sm,
  style,
}: {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const [measured, setMeasured] = useState(0);

  useEffect(() => {
    if (shimmerStarted) return;
    shimmerStarted = true;
    shimmerClock.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  /**
   * Measured once, and only when the width genuinely changed.
   *
   * The sweep is a translate, so it needs a pixel distance — and a `onLayout`
   * callback fires on every relayout of the parent, which on a scrolling grid is
   * many times. Comparing before setting state keeps that from becoming a render
   * loop.
   */
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    setMeasured((current) => (Math.abs(current - next) > 1 ? next : current));
  }, []);

  const sweep = useAnimatedStyle(() => ({
    // Fades in over the first half and out over the second, so the highlight
    // arrives and leaves instead of teleporting at the wrap point.
    opacity: shimmerClock.value < 0.5 ? shimmerClock.value * 2 : (1 - shimmerClock.value) * 2,
    transform: [{ translateX: -measured + measured * 2 * shimmerClock.value }],
  }));

  return (
    <View
      onLayout={onLayout}
      style={[
        {
          width,
          height,
          borderRadius: r,
          backgroundColor: colors.skeleton,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {measured > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            { position: 'absolute', top: 0, bottom: 0, width: measured },
            sweep,
          ]}
        >
          <LinearGradient
            colors={['transparent', colors.skeletonHighlight, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

/** Placeholder matching a marketplace grid card. */
export function ListingCardSkeleton({ width }: { width: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.gridCard,
        shadows.subtle,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          padding: spacing.sm,
          overflow: 'hidden',
        },
      ]}
    >
      <Skeleton width="100%" height={width * 0.72} radius={radius.md} />
      <View style={{ gap: 6, paddingTop: 4 }}>
        <Skeleton width="55%" height={16} radius={4} />
        <Skeleton width="85%" height={14} radius={4} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 2 }}>
          <Skeleton width="40%" height={11} radius={4} />
          <Skeleton width="30%" height={11} radius={4} />
        </View>
      </View>
    </View>
  );
}

/** Placeholder matching an accommodation card. */
export function LodgeCardSkeleton({ width }: { width: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.gridCard,
        shadows.subtle,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          padding: spacing.sm,
          overflow: 'hidden',
        },
      ]}
    >
      <Skeleton width="100%" height={width * 0.7} radius={radius.md} />
      <View style={{ gap: 6, paddingTop: 4 }}>
        <Skeleton width="60%" height={18} radius={4} />
        <Skeleton width="80%" height={14} radius={4} />
        <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
          <Skeleton width="45%" height={20} radius={radius.pill} />
          <Skeleton width="35%" height={20} radius={radius.pill} />
        </View>
      </View>
    </View>
  );
}

/** Placeholder for a horizontal row (messages, my listings, categories). */
export function RowSkeleton({ avatar = true }: { avatar?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderWidth: StyleSheet.hairlineWidth,
          borderRadius: radius.md,
          padding: spacing.md,
        },
      ]}
    >
      {avatar ? <Skeleton width={44} height={44} radius={22} /> : null}
      <View style={styles.rowBody}>
        <Skeleton width="55%" height={14} radius={4} />
        <Skeleton width="80%" height={12} radius={4} />
      </View>
    </View>
  );
}

/** Placeholder for user profile page. */
export function ProfileSkeleton() {
  return (
    <View style={{ gap: spacing.lg, padding: spacing.base }}>
      <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md }}>
        <Skeleton width={80} height={80} radius={40} />
        <Skeleton width={140} height={18} radius={4} />
        <Skeleton width={90} height={13} radius={4} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md, justifyContent: 'center' }}>
        <Skeleton width="28%" height={56} radius={radius.md} />
        <Skeleton width="28%" height={56} radius={radius.md} />
        <Skeleton width="28%" height={56} radius={radius.md} />
      </View>
      <View style={{ gap: spacing.sm }}>
        <Skeleton width="100%" height={52} radius={radius.md} />
        <Skeleton width="100%" height={52} radius={radius.md} />
        <Skeleton width="100%" height={52} radius={radius.md} />
      </View>
    </View>
  );
}

/** Full-screen centred spinner for first loads. */
export function LoadingState({ label }: { label?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.brand} />
      {label ? (
        <Text style={[typography.small, styles.centerText, { color: colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

interface StateProps {
  title?: string;
  message?: string;
  icon?: LucideIcon;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'neutral' | 'error';
}

/**
 * Empty / zero-results state.
 * Explains clearly what happened and offers a friendly way forward.
 */
export function EmptyState({
  title,
  message,
  icon: Icon = SearchX,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  style,
  tone = 'neutral',
}: StateProps) {
  const { colors } = useTheme();
  const iconBg = tone === 'error' ? colors.dangerSoft : colors.brandSoft;
  const iconFg = tone === 'error' ? colors.danger : colors.brand;

  return (
    <View style={[styles.center, style]}>
      <View style={[styles.stateIcon, { backgroundColor: iconBg }]}>
        <Icon size={28} color={iconFg} strokeWidth={2} />
      </View>
      <Text style={[typography.heading, styles.stateTitle, { color: colors.text }]}>
        {title}
      </Text>
      {message ? (
        <Text style={[typography.body, styles.stateMessage, { color: colors.textMuted }]}>
          {message}
        </Text>
      ) : null}
      <View style={styles.stateActionRow}>
        {actionLabel && onAction ? (
          <Button
            label={actionLabel}
            onPress={onAction}
            variant="primary"
            size="sm"
            block={false}
            style={styles.stateAction}
          />
        ) : null}
        {secondaryLabel && onSecondary ? (
          <Button
            label={secondaryLabel}
            onPress={onSecondary}
            variant="ghost"
            size="sm"
            block={false}
            style={styles.stateAction}
          />
        ) : null}
      </View>
    </View>
  );
}

/** Network / server error with friendly recovery. */
export function ErrorState({
  title = "Something went wrong",
  message = "We couldn't load this information. Please check your internet connection and try again.",
  onAction,
  actionLabel = 'Try again',
}: StateProps) {
  return (
    <EmptyState
      tone="error"
      icon={TriangleAlert}
      title={title}
      message={message}
      actionLabel={onAction ? actionLabel : undefined}
      onAction={onAction}
    />
  );
}

/** Dedicated empty states with curated copy and icons. */
export function EmptyListingsState({ onPost }: { onPost?: () => void }) {
  return (
    <EmptyState
      icon={PackageX}
      title="No items found"
      message="Looks like nothing has been posted here yet. Have something you'd like to sell to fellow students?"
      actionLabel={onPost ? 'Post an item' : undefined}
      onAction={onPost}
    />
  );
}

export function EmptySavedState({ onBrowse }: { onBrowse?: () => void }) {
  return (
    <EmptyState
      icon={BookmarkX}
      title="Nothing saved yet"
      message="When you spot an item or a lodge you like, tap the bookmark icon to save it here for quick access."
      actionLabel={onBrowse ? 'Explore marketplace' : undefined}
      onAction={onBrowse}
    />
  );
}

export function EmptyMessagesState() {
  return (
    <EmptyState
      icon={MessageSquareOff}
      title="No messages yet"
      message="Your inquiries and conversations with sellers or landlords will show up here."
    />
  );
}

export function EmptyNotificationsState() {
  return (
    <EmptyState
      icon={BellOff}
      title="All caught up"
      message="You don't have any unread notifications right now. Check back later for listing updates."
    />
  );
}

/**
 * Skeleton for the listing detail screen.
 * Mirrors the real layout — full-bleed image, then price, title, facts, seller —
 * so the screen does not visibly jump when the data arrives.
 */
export function ListingDetailSkeleton() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bg, flex: 1 }}>
      <Skeleton width="100%" height={320} radius={0} />
      <View style={styles.detailBody}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Skeleton width="45%" height={28} radius={4} />
          <Skeleton width="25%" height={24} radius={radius.pill} />
        </View>
        <Skeleton width="85%" height={22} radius={4} style={styles.lineTight} />
        <Skeleton width="60%" height={14} radius={4} />
        <Skeleton width="100%" height={120} radius={radius.lg} style={styles.lineTight} />
        <Skeleton width="100%" height={14} radius={4} style={styles.lineTight} />
        <Skeleton width="90%" height={14} radius={4} />
        <Skeleton width="70%" height={14} radius={4} />
        <Skeleton width="100%" height={74} radius={radius.lg} style={styles.lineTight} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing['3xl'],
    paddingHorizontal: spacing.xl,
  },
  centerText: {
    marginTop: spacing.md,
  },
  stateIcon: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.base,
  },
  stateTitle: {
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  stateMessage: {
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 20,
  },
  stateActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  stateAction: {
    paddingHorizontal: spacing.lg,
  },
  gridCard: {
    gap: spacing.xs,
  },
  lineTight: {
    marginTop: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  rowBody: {
    flex: 1,
    gap: spacing.xs,
  },
  detailBody: {
    padding: spacing.base,
    gap: spacing.md,
  },
});