/**
 * Screen layout primitives.
 *
 * Three components cover every screen in the app:
 *
 *  - `<Screen>`     the scroll/flex body plus insets
 *  - `<ScreenHeader>` the large-title header used by tabs and stack screens
 *  - `<Divider>`    hairline
 *
 * Keeping them here means padding is decided once. Inconsistent page gutters
 * are the fastest way to make an app feel unbuilt.
 */
import React from 'react';
import {
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from 'react-native';
import { useTheme } from '@/providers/ThemeProvider';
import { GUTTER, MIN_TOUCH, radius, spacing, typography } from '@/constants/theme';
import { Pressable } from 'react-native';
import { BackButton } from '@/components/ui/Button';

/**
 * Screen body.
 *
 * `edges` controls which safe-area insets are consumed. Tab screens pass
 * `[]` for the bottom (the tab bar owns it) and stack screens pass `['bottom']`
 * so content clears the home indicator.
 */
export function Screen({
  children,
  scroll = true,
  edges = ['bottom'],
  contentStyle,
  style,
  refreshing,
  onRefresh,
  /** Adds the page gutter. Off for full-bleed screens like galleries. */
  padded = true,
  /** Gap between children; 0 when children manage their own rhythm. */
  gap = spacing.lg,
  keyboardShouldPersistTaps = 'handled',
  contentContainerStyle,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  edges?: Array<'top' | 'bottom'>;
  contentStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
  padded?: boolean;
  gap?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
  contentContainerStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const padding = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom')
      ? insets.bottom + (Platform.OS === 'ios' ? spacing.sm : 0)
      : 0,
  };

  const inner: StyleProp<ViewStyle> = [
    padded && { paddingHorizontal: GUTTER },
    { gap },
    contentStyle,
    contentContainerStyle,
  ];

  if (!scroll) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.bg }, padding, style]}>
        <View style={[styles.flex, inner]}>{children}</View>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.flex, { backgroundColor: colors.bg }, style]}
      contentContainerStyle={[inner, { paddingBottom: (edges.includes('bottom') ? insets.bottom : 0) + spacing.xxl }]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/**
 * Header with a large title, optional back affordance and optional right-side
 * action.
 *
 * The back chevron is only rendered for stack screens; `back={false}` is used by
 * tab roots, which have nothing to go back to. `onBack` overrides the default
 * behaviour for screens that need to unwind more than one entry (e.g. a modal
 * that should return to the listing it was opened from).
 */
export function ScreenHeader({
  title,
  subtitle,
  back = true,
  onBack,
  fallback = '/',
  action,
  edges = ['top'],
  compact = false,
  /** Rendered under the title — used for the search bar on browse screens. */
  children,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  /** Route used when there is no history to pop back to. */
  fallback?: string;
  action?: React.ReactNode;
  edges?: Array<'top' | 'bottom'>;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.header,
        {
          paddingTop: (edges.includes('top') ? insets.top : 0) + spacing.sm,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.headerRow}>
        {back ? (
          <BackButton
            fallback={fallback}
            style={styles.backButtonOffset}
            {...(onBack ? { onPress: onBack } : {})}
          />
        ) : null}

        <View style={styles.flex}>
          <Text
            style={[
              compact ? typography.heading : typography.title,
              { color: colors.text },
            ]}
            numberOfLines={2}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text style={[typography.small, styles.subtitle, { color: colors.textMuted }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {action}
      </View>
      {children}
    </View>
  );
}

/** Hairline rule. */
export function Divider({ style, inset = 0 }: { style?: StyleProp<ViewStyle>; inset?: number }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          height: StyleSheet.hairlineWidth,
          backgroundColor: colors.border,
          marginLeft: inset,
        },
        style,
      ]}
    />
  );
}

/**
 * Section heading with an optional trailing action, used above every grouped
 * list.
 */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
  style,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.sectionHeader, style]}>
      <Text style={[typography.subheading, { color: colors.text }]}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={[typography.smallStrong, { color: colors.brand }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/** Vertically centred label + value pair, used across detail sheets. */
export function DetailRow({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.detailRow}>
      {icon ? <View style={styles.detailIcon}>{icon}</View> : null}
      <View style={styles.flex}>
        <Text style={[typography.caption, { color: colors.textSubtle }]}>{label}</Text>
        <Text style={[typography.body, { color: colors.text }]}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  header: {
    paddingHorizontal: GUTTER,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 40,
  },
  backButton: {
    width: MIN_TOUCH - 8,
    height: MIN_TOUCH - 8,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  backButtonOffset: {
    marginLeft: -spacing.sm,
  },
  subtitle: {
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingTop: spacing.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  detailIcon: {
    width: 22,
    alignItems: 'center',
    paddingTop: 2,
  },
});