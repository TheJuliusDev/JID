/**
 * Root layout — providers, fonts, splash, and the auth gate.
 *
 * Order matters here:
 *   ThemeProvider      first, so everything (including the setup error screen)
 *                      can read tokens
 *   SafeAreaProvider   needs to wrap anything using insets, including the toast
 *                      layer and the tab bar
 *   AuthProvider       before DataProvider, which depends on the session
 *   MessagingProvider  owns conversations; DataProvider reads messaging state
 *                      back out of it, so it must sit above DataProvider
 *   DataProvider       saved items and the activity feed; needs a session
 *
 * Expo Router redirects on `(auth)` change below, inside the providers, so the
 * gate can read auth state.
 */
import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as SystemUI from 'expo-system-ui';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold, Inter_800ExtraBold, useFonts } from '@expo-google-fonts/inter';

import { ThemeProvider, useTheme } from '@/providers/ThemeProvider';
import { ToastProvider } from '@/providers/ToastProvider';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { MessagingProvider } from '@/providers/MessagingProvider';
import { DataProvider } from '@/providers/DataProvider';
import { AppPreloader } from '@/components/layout/AppPreloader';
import { PushPermissionPrompt } from '@/components/messaging/PushPermissionPrompt';
import { attachNotificationHandlers, ensureChannel } from '@/services/messaging/push';
import { isConfigured, missingVariables } from '@/services/env';
import { radius, spacing, typography } from '@/constants/theme';

// Hold the splash until fonts and the session check are done, so the first
// painted frame is the real app rather than a flash of fallback system font.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Already hidden, or called outside a native context (web). Safe to ignore.
});

/**
 * Shown when the app has no Supabase/Cloudinary configuration.
 *
 * Without this the first screen would show a confusing network error and the
 * user would have no idea the problem is a missing `.env`.
 */
function SetupRequired() {
  const { colors } = useTheme();
  return (
    <View style={[styles.setup, { backgroundColor: colors.bg }]}>
      <View style={[styles.setupBadge, { backgroundColor: colors.brand }]}>
        <Image
          source={require('../assets/jid-logo.png')}
          style={styles.setupLogo}
          contentFit="cover"
        />
      </View>
      <Text style={[typography.title, styles.setupTitle, { color: colors.text }]}>
        Almost ready
      </Text>
      <Text style={[typography.body, styles.setupBody, { color: colors.textMuted }]}>
        JID needs to know where your backend lives before it can load anything. Add these
        variables to `mobile/.env`:
      </Text>
      <View style={[styles.setupCode, { backgroundColor: colors.surfaceAlt, borderColor: colors.border }]}>
        {missingVariables.map((name) => (
          <Text key={name} style={[typography.small, { color: colors.text }]}>
            • {name}
          </Text>
        ))}
      </View>
      <Text style={[typography.small, styles.setupHint, { color: colors.textSubtle }]}>
        Copy `.env.example` to `.env` and paste the values from the website's own `.env`,
        then restart with `npx expo start -c`.
      </Text>
    </View>
  );
}

/**
 * Redirects between the signed-in and signed-out trees.
 *
 * Expo Router's `Stack` has no built-in auth guard, so this watches the session
 * and the current segment group and swaps routes as needed. It waits for
 * `initialising` so a persisted session is restored before any decision is made
 * — otherwise a returning user would be bounced to the login screen for a frame.
 */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, initialising } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  const inAuthGroup = segments[0] === '(auth)';

  useEffect(() => {
    if (initialising) return;

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, initialising, inAuthGroup, router]);

  /**
   * Notification taps.
   *
   * Only installed while signed in, so a tap cannot navigate into a thread
   * belonging to an account that is no longer signed in — and it is torn down on
   * sign-out, so there is no path from a dead session back into the navigator.
   *
   * This is the only place a push tap is handled. Foreground, background and
   * cold-start taps all arrive as notification *responses*, so there is one code
   * path rather than three, and no chance of the same message opening two threads.
   * The service dedupes message ids across the paths that can overlap.
   */
  useEffect(() => {
    if (!session) return undefined;
    return attachNotificationHandlers((conversationId) => {
      router.push({ pathname: '/messages/[id]', params: { id: conversationId } });
    });
  }, [session, router]);

  /**
   * The Android notification channel.
   *
   * Created on sign-in rather than on first push: Android 8+ *drops* notifications
   * whose channel does not exist, which presents as "push silently never arrives"
   * rather than as an error. There is no callback that fires when a message is
   * pushed, so this is the earliest point at which it can be done.
   */
  useEffect(() => {
    if (!session) return;
    void ensureChannel();
  }, [session]);

  // The preloader stays up until the session check has resolved. Once it has,
  // `BootLayer` cross-fades it out and hands the screen to the navigator.
  return (
    <BootLayer show={initialising}>
      {children}
      <PushPermissionPrompt />
    </BootLayer>
  );
}

/**
 * Holds the branded preloader over the navigator and hands over cleanly.
 *
 * Children are mounted the whole time, so the first screen has already fetched
 * by the time it becomes visible — the preloader costs no extra startup time. The
 * handover is a short cross-fade between an opaque preloader and the app, which
 * reads as one continuous surface rather than a flash of unstyled content.
 */
function BootLayer({ show, children }: { show: boolean; children: React.ReactNode }) {
  const { colors } = useTheme();
  const [mounted, setMounted] = React.useState(show);

  const veil = useSharedValue(show ? 1 : 0);
  const app = useSharedValue(show ? 0 : 1);

  useEffect(() => {
    if (show) {
      setMounted(true);
      veil.value = 1;
      app.value = 0;
      return undefined;
    }
    veil.value = withTiming(0, { duration: 400, easing: Easing.inOut(Easing.cubic) });
    app.value = withDelay(140, withTiming(1, { duration: 460, easing: Easing.out(Easing.cubic) }));
    const timer = setTimeout(() => setMounted(false), 420);
    return () => clearTimeout(timer);
  }, [show, veil, app]);

  const veilStyle = useAnimatedStyle(() => ({ opacity: veil.value }));
  const appStyle = useAnimatedStyle(() => ({ opacity: app.value }));

  return (
    <View style={[styles.flex, { backgroundColor: colors.bg }]}>
      <Animated.View
        style={[styles.flex, appStyle]}
        pointerEvents={show ? 'none' : 'auto'}
      >
        {children}
      </Animated.View>

      {mounted ? (
        <Animated.View
          style={[StyleSheet.absoluteFill, veilStyle]}
          pointerEvents={show ? 'auto' : 'none'}
        >
          <AppPreloader />
        </Animated.View>
      ) : null}
    </View>
  );
}

/**
 * Bridges the resolved theme into the native status bar.
 *
 * `expo-system-ui` is loaded rather than the bare `StatusBar` alone so the
 * Android navigation-bar colour and icon contrast follow the scheme too.
 */
function ThemedChrome() {
  const { colors } = useTheme();
  SystemUI.setBackgroundColorAsync(colors.bg).catch(() => {
    // Not fatal: on iOS and web there is no system background to set.
  });
  return <StatusBar style={colors.isDark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const ready = fontsLoaded || Boolean(fontError);

  // Hand off from the native splash to our own preloader as soon as the fonts
  // are in, so the native splash is never sitting on top of a mounted app.
  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  const onLayout = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  // Before the fonts land there is nothing to render but the splash surface —
  // showing our preloader now would mean the wordmark jumps to Inter a moment
  // later.
  if (!ready) return <View style={styles.gateLoader} />;

  return (
    <GestureHandlerRootView style={styles.flex} onLayout={onLayout}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ThemedChrome />
          <ToastProvider>
            <AuthProvider>
              <MessagingProvider>
                <DataProvider>
                  {isConfigured ? (
                    <AuthGate>
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          animation: 'slide_from_right',
                          animationDuration: 260,
                          contentStyle: { backgroundColor: 'transparent' },
                        }}
                      >
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="(auth)" options={{ animation: 'fade' }} />
                        <Stack.Screen name="create" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="create/[id]" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                        <Stack.Screen name="listing/[kind]/[id]" />
                        <Stack.Screen name="user/[username]" />
                        <Stack.Screen name="messages" />
                        <Stack.Screen name="messages/archived" />
                        <Stack.Screen name="messages/[id]" />
                        <Stack.Screen name="settings" />
                        <Stack.Screen name="settings/account" />
                        <Stack.Screen name="settings/password" />
                        <Stack.Screen name="settings/my-listings" />
                        <Stack.Screen name="settings/notifications" />
                        <Stack.Screen name="settings/appearance" />
                        <Stack.Screen name="settings/privacy" />
                        <Stack.Screen name="settings/blocked-users" />
                        <Stack.Screen name="settings/terms" />
                        <Stack.Screen name="+not-found" options={{ animation: 'fade' }} />
                      </Stack>
                    </AuthGate>
                  ) : (
                    <SetupRequired />
                  )}
                </DataProvider>
              </MessagingProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Flat surface painted behind the preloader while fonts are still loading.
 * Rendered without theme colours so it cannot flash the wrong surface.
 */
const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  gateLoader: {
    flex: 1,
    backgroundColor: '#FBFAF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setup: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.base,
  },
  setupBadge: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  setupLogo: {
    width: 64,
    height: 64,
    borderRadius: radius.lg,
  },
  setupTitle: {
    textAlign: 'center',
  },
  setupBody: {
    textAlign: 'center',
    maxWidth: 340,
  },
  setupCode: {
    alignSelf: 'stretch',
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  setupHint: {
    textAlign: 'center',
    maxWidth: 340,
    marginTop: spacing.sm,
  },
});