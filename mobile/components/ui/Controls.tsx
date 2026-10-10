/**
 * Chips, segmented controls, search bars, stars and toggle rows.
 *
 * Filter surfaces on mobile need to feel fast: chips scroll horizontally, the
 * segmented control is the tab-bar cousin, and the search bar has a real
 * cancel affordance like iOS.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  TextInput,
  Platform,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Search, X, Star, ChevronRight, type LucideIcon } from 'lucide-react-native';
import AnimatedReanimated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { motion, MIN_TOUCH, radius, shadows, spacing, typography } from '@/constants/theme';

const AnimatedView = AnimatedReanimated.View;

/** Filter chip. */
export function Chip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  size = 'md',
  style,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
      style={({ pressed }) => [
        styles.chip,
        size === 'sm' ? styles.chipSm : styles.chipMd,
        {
          backgroundColor: selected ? colors.brandSoft : colors.surface,
          borderColor: selected ? colors.brand : colors.border,
          opacity: pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {Icon ? (
        <Icon size={14} color={selected ? colors.brandText : colors.textMuted} strokeWidth={2.4} />
      ) : null}
      <Text
        style={[
          size === 'sm' ? typography.caption : typography.smallStrong,
          { color: selected ? colors.brandText : colors.text },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** A horizontally scrolling row of chips — the standard filter rail. */
export function ChipRail({
  options,
  value,
  onChange,
  keyExtractor,
  renderLabel,
  size = 'md',
  contentStyle,
  iconFor,
}: {
  options: readonly string[];
  value: string | null;
  onChange: (value: string | null) => void;
  keyExtractor?: (option: string) => string;
  renderLabel?: (option: string) => string;
  size?: 'sm' | 'md';
  contentStyle?: StyleProp<ViewStyle>;
  iconFor?: (option: string) => LucideIcon | undefined;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.rail, contentStyle]}
      keyboardShouldPersistTaps="handled"
    >
      {options.map((option) => {
        const Icon = iconFor?.(option);
        return (
          <Chip
            key={keyExtractor?.(option) ?? option}
            label={renderLabel?.(option) ?? option}
            icon={Icon}
            selected={option === value}
            size={size}
            onPress={() => onChange(option === value ? null : option)}
          />
        );
      })}
    </ScrollView>
  );
}

/**
 * Segmented control with an animated indicator pill.
 *
 * The pill slides between segments with the JID spring so switching tabs within
 * a screen feels continuous rather than a jump cut.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
  fullWidth = true,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
  fullWidth?: boolean;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;

  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const segmentWidth = width > 0 ? width / options.length : 0;

  React.useEffect(() => {
    Animated.spring(anim, {
      toValue: index,
      useNativeDriver: true,
      damping: 32,
      stiffness: 400,
      mass: 0.7,
    }).start();
  }, [anim, index]);

  const translateX = anim.interpolate({
    inputRange: options.map((_, i) => i),
    outputRange: options.map((_, i) => i * segmentWidth),
  });

  return (
    <View
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[
        styles.segmented,
        { backgroundColor: colors.surfaceAlt },
        fullWidth && { alignSelf: 'stretch' },
        style,
      ]}
    >
      {segmentWidth > 0 ? (
        <Animated.View
          style={[
            styles.segmentedIndicator,
            shadows.sm,
            {
              width: segmentWidth,
              backgroundColor: colors.surface,
              transform: [{ translateX }],
            },
          ]}
        />
      ) : null}
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            style={styles.segment}
          >
            <Text
              numberOfLines={1}
              style={[
                typography.smallStrong,
                { color: selected ? colors.text : colors.textMuted },
              ]}
            >
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Search field.
 *
 * `onCancel` reveals a trailing clear button and, when `showCancel` is set, an
 * iOS-style "Cancel" affordance — matching platform expectations rather than
 * inventing a new pattern.
 */
export function SearchBar({
  value,
  onChangeText,
  placeholder = 'Search',
  autoFocus = false,
  onCancel,
  style,
  autoCapitalize = 'none',
  returnKeyType = 'search',
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onCancel?: () => void;
  style?: StyleProp<ViewStyle>;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  returnKeyType?: 'search' | 'done' | 'go' | 'next' | 'send';
  onSubmitEditing?: () => void;
}) {
  const { colors } = useTheme();
  const inputRef = useRef<TextInput>(null);

  const clear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const cancel = useCallback(() => {
    onChangeText('');
    onCancel?.();
    inputRef.current?.blur();
  }, [onChangeText, onCancel]);

  return (
    <View style={[styles.searchRow, style]}>
      <View
        style={[
          styles.searchField,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <Search size={18} color={colors.textMuted} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          style={[typography.body, styles.searchInput, { color: colors.text }]}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          cursorColor={colors.brand}
          selectionColor={Platform.OS === 'ios' ? colors.brand : undefined}
          clearButtonMode="never"
          accessibilityLabel={placeholder}
        />
        {value.length > 0 ? (
          <Pressable onPress={clear} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search">
            <X size={17} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {value.length > 0 && onCancel && Platform.OS === 'ios' ? (
        <Pressable onPress={cancel} hitSlop={8} accessibilityRole="button">
          <Text style={[typography.body, { color: colors.brand }]}>Cancel</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Star rating. Read-only unless `onRate` is provided, in which case tapping a
 * star submits that rating — which is exactly the vendor-review interaction.
 */
export function Rating({
  value,
  count,
  size = 14,
  onRate,
  style,
  showValue = false,
}: {
  value: number;
  count?: number;
  size?: number;
  onRate?: (rating: number) => void;
  style?: StyleProp<ViewStyle>;
  showValue?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={[styles.rating, style]} accessibilityLabel={`Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ''}`}>
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = value >= star - 0.25;
        const icon = (
          <Star
            size={size}
            color={filled ? colors.accent : colors.borderStrong}
            fill={filled ? colors.accent : 'transparent'}
            strokeWidth={2}
          />
        );
        if (!onRate) {
          return <View key={star}>{icon}</View>;
        }
        return (
          <Pressable
            key={star}
            onPress={() => onRate(star)}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`}
          >
            {icon}
          </Pressable>
        );
      })}
      {showValue ? (
        <Text style={[typography.small, { color: colors.textMuted, marginLeft: spacing.xs }]}>
          {value.toFixed(1)}
          {count !== undefined ? ` (${count})` : ''}
        </Text>
      ) : null}
    </View>
  );
}

/** Switch/checkbox row used for multi-select filters and consent. */
export function Checkbox({
  checked,
  onToggle,
  label,
  style,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onToggle}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={[styles.checkboxRow, style]}
    >
      <View
        style={[
          styles.checkbox,
          {
            backgroundColor: checked ? colors.brand : 'transparent',
            borderColor: checked ? colors.brand : colors.borderStrong,
          },
        ]}
      >
        {checked ? (
          <View style={[styles.check, { borderColor: colors.onBrand }]} />
        ) : null}
      </View>
      <Text style={[typography.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    </Pressable>
  );
}

/** Settings-style row with a chevron. */
export function LinkRow({
  icon: Icon,
  label,
  value,
  count,
  onPress,
  destructive = false,
  style,
}: {
  icon?: LucideIcon;
  label: string;
  value?: string;
  /**
   * Unread items behind this destination, shown as a pill.
   *
   * A badge rather than text in `value` because unread counts have to be
   * scannable in a list — `value` reads as descriptive text and gets longer than a
   * number ("14 unread" wrapping to a second line) while a pill stays a fixed
   * shape. Renders nothing at zero so a row nobody has anything pending in stays
   * quiet instead of advertising a zero.
   */
  count?: number;
  onPress?: () => void;
  destructive?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const showCount = typeof count === 'number' && count > 0;

  // Screen readers announce the number with the label; a bare "14" floating
  // between the row's text and its chevron is not obviously about messages.
  const accessibilityLabel = showCount ? `${label}, ${count} unread` : label;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={onPress ? accessibilityLabel : undefined}
      style={({ pressed }) => [
        styles.linkRow,
        { backgroundColor: pressed && onPress ? colors.surfaceAlt : 'transparent' },
        style,
      ]}
    >
      {Icon ? (
        <View style={[styles.linkIconWrapper, { backgroundColor: destructive ? colors.dangerSoft : colors.surfaceAlt }]}>
          <Icon size={17} color={destructive ? colors.danger : colors.text} strokeWidth={2.2} />
        </View>
      ) : null}
      <Text
        style={[
          typography.bodyStrong,
          { color: destructive ? colors.danger : colors.text, flex: 1 },
        ]}
      >
        {label}
      </Text>
      {showCount ? (
        <View style={[styles.linkCount, { backgroundColor: colors.brand }]}>
          <Text style={[typography.caption, styles.linkCountText, { color: colors.onBrand }]}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : value ? (
        <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {onPress ? (
        <ChevronRight size={16} color={colors.textSubtle} strokeWidth={2} />
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipSm: {
    minHeight: 32,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  chipMd: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
  },
  rail: {
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
  },
  linkCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkCountText: {
    fontWeight: '800',
  },
  segmented: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 4,
    position: 'relative',
  },
  segmentedIndicator: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    left: 4,
    borderRadius: radius.sm,
  },
  segment: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  searchField: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
  },
  rating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: 10,
    height: 5,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '-45deg' }, { translateY: -1 }],
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: MIN_TOUCH + spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.base,
    borderRadius: radius.md,
  },
  linkIconWrapper: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * Horizontal progress bar.
 *
 * Used by the boost flow to show "n of 2 ads watched". The fill animates on the
 * UI thread so it keeps moving smoothly while a rewarded ad is playing over it,
 * and the value is clamped so an over-count can never overflow the track.
 */
export function ProgressBar({
  value,
  height = 6,
  tint,
  track,
  style,
}: {
  /** 0-1. Clamped. */
  value: number;
  height?: number;
  /** Fill colour; defaults to the brand. */
  tint?: string;
  /** Track colour; defaults to a muted surface. */
  track?: string;
  style?: StyleProp<ViewStyle>;
}) {
const { colors } = useTheme();
  const clamped = Math.min(1, Math.max(0, value));
  const progress = useSharedValue(clamped);

  // The fill is animated in pixels rather than as a percentage string: the
  // track's width is only known after layout, and a measured pixel value keeps
  // the animated style type-safe.
  const [trackWidth, setTrackWidth] = useState(0);

  useEffect(() => {
    progress.value = withTiming(clamped, { duration: motion.slow });
  }, [clamped, progress]);

  const fill = useAnimatedStyle(() => ({ width: progress.value * trackWidth }));

  return (
    <View
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[
        {
          height,
          borderRadius: height,
          backgroundColor: track ?? colors.surfaceAlt,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      <AnimatedView
        style={[
          fill,
          { height: '100%', borderRadius: height, backgroundColor: tint ?? colors.brand },
        ]}
      />
    </View>
  );
}
