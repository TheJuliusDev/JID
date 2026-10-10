/**
 * Tab layout with the custom floating bottom bar.
 *
 * The bar is a bespoke component rather than `Tabs` with a styled `tabBar`
 * because JID's navigation has a centre "Post" action that rises above the bar —
 * a pill in the middle of the bar, matching the website's dock. Expo Router's
 * `Tabs` supports a custom `tabBar` prop, which is exactly this.
 *
 * The floating shape also lets list content scroll under the bar with a blur,
 * which reads as a modern native app rather than a web page in a frame.
 *
 * Everything that moves here runs on the UI thread: one shared value drives the
 * sliding active indicator, and each tab animates its own icon scale and label
 * opacity from a single spring. No per-tab timers, no layout thrash, and nothing
 * to clean up on tab change — so switching tabs stays smooth on mid-range
 * Android hardware.
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  Keyboard,
  Platform,
  StyleSheet,
  View,
  Pressable,
  Text,
  type LayoutChangeEvent,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Tabs, useRouter } from 'expo-router';
import { Bookmark, Compass, House, Plus, CircleUser } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { useTheme } from '@/providers/ThemeProvider';
import { useData } from '@/providers/DataProvider';
import { useAuth } from '@/providers/AuthProvider';
import { radius, shadows, spacing, motion, typography } from '@/constants/theme';
import { compactNumber } from '@/utils/format';

/**
 * The slice of react-navigation's tab-bar props this component actually uses.
 *
 * Declared structurally rather than imported from
 * `@react-navigation/bottom-tabs`: that package is bundled inside expo-router
 * and is not a declared dependency of this app, so importing its types would be
 * relying on an internal file layout that a minor upgrade can move.
 */
interface TabBarProps {
  state: {
    index: number;
    routes: Array<{ key: string; name: string }>;
  };
  navigation: {
    emit: (event: {
      type: 'tabPress';
      target: string;
      canPreventDefault: true;
    }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
}

type TabConfig = {
  name: string;
  title: string;
  icon: LucideIcon;
  /** Read out by screen readers in place of the bare label. */
  hint: string;
};

/**
 * Tab order and labels.
 *
 * "Post" is intentionally not a tab — it is a modal-presentation route, so it
 * sits in the centre of the bar as a raised action and never becomes a history
 * entry the back gesture has to unwind.
 */
const TABS: TabConfig[] = [
  { name: 'index', title: 'Home', icon: House, hint: 'Latest listings and campus news' },
  { name: 'explore', title: 'Explore', icon: Compass, hint: 'Search items and lodges' },
  { name: 'saved', title: 'Saved', icon: Bookmark, hint: 'Everything you have saved' },
  { name: 'profile', title: 'Profile', icon: CircleUser, hint: 'Your account and settings' },
];

/** Width reserved for the raised Post action, matching `styles.createSlot`. */
const CREATE_SLOT = 74;
/** How much of a tab's slot the active highlight fills. */
const INDICATOR_RATIO = 0.68;

function TabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { saved } = useData();
  const { session } = useAuth();

  // Measured once per orientation change; the indicator position is derived from
  // it rather than from per-tab layout callbacks.
  const [barWidth, setBarWidth] = useState(0);
  const indicatorX = useSharedValue(0);

  const openCreate = useCallback(() => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.push('/create');
  }, [router]);

  const tabSlot = barWidth > 0 ? (barWidth - spacing.sm * 2 - CREATE_SLOT) / TABS.length : 0;
  const indicatorWidth = tabSlot * INDICATOR_RATIO;

  useEffect(() => {
    if (tabSlot <= 0) return;
    const left = spacing.sm + state.index * tabSlot + (tabSlot - indicatorWidth) / 2;
    indicatorX.value = withSpring(left, motion.nav);
  }, [state.index, tabSlot, indicatorWidth, indicatorX]);

  // The bar floats above the safe-area inset, but on Android with gesture
  // navigation there is no inset to speak of and the bar can sit lower.
  const bottom = Math.max(insets.bottom, Platform.OS === 'android' ? spacing.md : 0);

  return (
    <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
      <TabDockBody
        onBarLayout={setBarWidth}
        indicatorWidth={indicatorWidth}
        indicatorX={indicatorX}
      >
        {/* Left half: Home + Explore */}
        <TabButton config={TABS[0]} focused={state.index === 0} onPress={() => press(state, navigation, 0)} />
        <TabButton config={TABS[1]} focused={state.index === 1} onPress={() => press(state, navigation, 1)} />

        {/* Centre: the raised Post action */}
        <View style={styles.createSlot} pointerEvents="box-none">
          <CreateButton onPress={openCreate} disabled={!session} />
        </View>

        {/* Right half: Saved + Profile */}
        <TabButton
          config={TABS[2]}
          focused={state.index === 2}
          onPress={() => press(state, navigation, 2)}
          badge={saved.length > 0 ? saved.length : undefined}
        />
        <TabButton config={TABS[3]} focused={state.index === 3} onPress={() => press(state, navigation, 3)} />
      </TabDockBody>
    </View>
  );
}

/**
 * The blurred bar itself, plus the keyboard handling that keeps it out of the
 * way of typing.
 *
 * Split out so the keyboard listeners live on one node rather than being
 * re-subscribed when the tab list re-renders.
 */
function TabDockBody({
  onBarLayout,
  indicatorWidth,
  indicatorX,
  children,
}: {
  onBarLayout: (width: number) => void;
  indicatorWidth: number;
  indicatorX: SharedValue<number>;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(false);
  const offset = useSharedValue(0);

  const onLayout = useCallback(
    (e: LayoutChangeEvent) => onBarLayout(e.nativeEvent.layout.width),
    [onBarLayout],
  );

  useEffect(() => {
    // `keyboardWill*` is the only event that fires on iOS, and it is the one
    // that keeps the dismissal in step with the system animation there.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, () => setHidden(true));
    const hide = Keyboard.addListener(hideEvent, () => setHidden(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    // Slides the dock below the fold rather than popping it, so dismissing the
    // keyboard brings it back with the same motion.
    offset.value = withTiming(hidden ? 120 : 0, {
      duration: hidden ? 200 : 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [hidden, offset]);

  const dockStyle = useAnimatedStyle(() => ({
    opacity: 1 - offset.value / 120,
    transform: [{ translateY: offset.value }],
  }));

  // The active-tab indicator rides the same shared value the parent animates,
  // so it slides on the UI thread and never lags the tab press behind it.
  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
  }));

  return (
    <Animated.View pointerEvents="box-none" style={dockStyle}>
      <BlurView
        intensity={Platform.OS === 'ios' ? 40 : 90}
        tint={colors.isDark ? 'dark' : 'light'}
        onLayout={onLayout}
        style={[
          styles.bar,
          shadows.lg,
          {
            backgroundColor: colors.isDark ? 'rgba(20,20,18,0.72)' : 'rgba(255,255,255,0.82)',
            borderColor: colors.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,115,88,0.10)',
          },
        ]}
      >
        {indicatorWidth > 0 ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.indicator,
              { width: indicatorWidth, backgroundColor: colors.brandSoft },
              indicatorStyle,
            ]}
          />
        ) : null}
        {children}
      </BlurView>
    </Animated.View>
  );
}

/** Tab press: defer to any listener that wants to veto, then switch. */
function press(
  state: TabBarProps['state'],
  navigation: TabBarProps['navigation'],
  index: number,
): void {
  const route = state.routes[index];
  if (!route) return;
  const event = navigation.emit({
    type: 'tabPress',
    target: route.key,
    canPreventDefault: true,
  });
  if (state.index === index || event.defaultPrevented) return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  navigation.navigate(route.name);
}

function CreateButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animated = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel="Post a listing"
      style={styles.createButtonWrapper}
      onPressIn={() => {
        scale.value = withSpring(0.9, motion.press);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, motion.press);
      }}
    >
      <Animated.View
        style={[
          styles.createButton,
          shadows.brand,
          animated,
          { backgroundColor: colors.brand, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <Plus size={26} color={colors.onBrand} strokeWidth={2.8} />
      </Animated.View>
    </Pressable>
  );
}

function TabButton({
  config,
  focused,
  onPress,
  badge,
}: {
  config: TabConfig;
  focused: boolean;
  onPress: () => void;
  badge?: number;
}) {
  const { colors } = useTheme();
  const progress = useSharedValue(focused ? 1 : 0);

  useEffect(() => {
    progress.value = withSpring(focused ? 1 : 0, motion.nav);
  }, [focused, progress]);

  // One spring, two outputs: the icon lifts and grows very slightly, and the
  // label firms up from muted to full strength.
  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.08 * progress.value }, { translateY: -1 * progress.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: 0.62 + 0.38 * progress.value,
  }));

  const Icon = config.icon;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={
        badge && badge > 0 ? `${config.title}, ${badge} saved` : config.title
      }
      accessibilityHint={config.hint}
      style={styles.tab}
    >
      <View>
        <Animated.View style={iconStyle}>
          <Icon
            size={22}
            color={focused ? colors.brand : colors.textSubtle}
            strokeWidth={focused ? 2.4 : 2}
          />
        </Animated.View>
        {badge !== undefined && badge > 0 ? (
          <View style={[styles.tabBadge, { backgroundColor: colors.brand, borderColor: colors.isDark ? '#141210' : '#FFFFFF' }]}>
            <Text style={styles.tabBadgeText}>{compactNumber(badge)}</Text>
          </View>
        ) : null}
      </View>
      <Animated.View style={labelStyle} pointerEvents="none">
        <Text
          numberOfLines={1}
          style={[
            typography.caption,
            styles.tabLabel,
            { color: focused ? colors.brand : colors.textSubtle, fontWeight: focused ? '700' : '500' },
          ]}
        >
          {config.title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
        // The floating bar overlays content, so scenes must paint an opaque
        // background of their own or the blur picks up whatever is behind.
        sceneStyle: { backgroundColor: 'transparent' },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: spacing.base,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 62,
    borderRadius: radius['3xl'],
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.sm,
    overflow: 'hidden',
  },
  indicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    left: 0,
    borderRadius: radius.lg,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    height: '100%',
  },
  tabLabel: {
    marginTop: 1,
  },
  tabBadge: {
    position: 'absolute',
    top: -5,
    right: -11,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    borderWidth: 2,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBadgeText: {
    color: '#FFFFFF',
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 12,
  },
  createSlot: {
    width: CREATE_SLOT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButtonWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  createButton: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});