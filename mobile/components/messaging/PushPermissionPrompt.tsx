/**
 * The late push-permission prompt.
 *
 * ## Why this exists rather than a request on launch
 *
 * On iOS the system permission alert appears exactly once. Asking at first launch,
 * before the user has any reason to want notifications, is the most reliable way to
 * spend that one chance on a "no" — and a refused iOS prompt can never be re-asked,
 * only fixed in Settings. So JID waits for a moment where the answer is obviously
 * yes: the user has just been contacted by someone they are talking to.
 *
 * ## The prompt is JID's, then the system's
 *
 * An in-app card asking first, then the OS alert only on "Turn on", means the OS
 * prompt always arrives with context attached. A user who declines the card never
 * sees the system alert at all, so the one unrepeatable ask is preserved for when
 * it is genuinely wanted.
 *
 * ## It will not pester
 *
 * Offered once per install. Declining records the answer in AsyncStorage rather
 * than just forgetting it, because otherwise the next message re-asks and the
 * second ask is the one that poisons the channel. Settings stays available for
 * anyone who dismisses this by accident.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BellRing, X } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import {
  getPermissionStatus,
  isPushSupported,
  requestPermissionAndRegister,
} from '@/services/messaging/push';
import { radius, spacing, typography } from '@/constants/theme';

const DISMISSED_KEY = 'jid.push.dismissed';

export function PushPermissionPrompt() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { unreadTotal } = useMessaging();

  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  /** The unread count at the previous render, to detect a *new* arrival. */
  const previousUnread = useRef(unreadTotal);

  useEffect(() => {
    const arrived = unreadTotal > previousUnread.current;
    previousUnread.current = unreadTotal;
    if (!arrived) return;

    let cancelled = false;

    void (async () => {
      // Emulators and the simulator have no push token, so prompting there can only
      // produce an error the user can do nothing about.
      if (!isPushSupported()) return;

      const [dismissed, permission] = await Promise.all([
        AsyncStorage.getItem(DISMISSED_KEY),
        getPermissionStatus(),
      ]);

      if (cancelled || dismissed === '1' || permission.granted || !permission.canAskAgain) return;

      setVisible(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [unreadTotal]);

  const decline = useCallback(async () => {
    setVisible(false);
    // Remembered, not just hidden: see the note at the top of this file.
    await AsyncStorage.setItem(DISMISSED_KEY, '1').catch(() => {
      // Worst case the card is offered again, which is survivable. Failing here
      // must never interrupt the message that caused it.
    });
  }, []);

  const accept = useCallback(async () => {
    setBusy(true);
    try {
      await requestPermissionAndRegister();
    } catch {
      // `requestPermissionAndRegister` reports its own failures through push state.
      // The card simply goes away either way — a permission prompt that cannot
      // succeed should not sit on screen forever.
    } finally {
      setBusy(false);
      setVisible(false);
    }
  }, []);

  if (!visible) return null;

  return (
    <View
      style={[
        styles.wrap,
        { bottom: insets.bottom + spacing.base, paddingHorizontal: spacing.base },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconWell, { backgroundColor: colors.brandSoft }]}>
          <BellRing size={17} color={colors.brand} />
        </View>

        <View style={styles.body}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>
            Know when they reply
          </Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            Turn on notifications for new messages, so you do not have to keep checking.
          </Text>

          <View style={styles.actions}>
            <Pressable
              onPress={() => void accept()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Turn on message notifications"
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: colors.brand, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[typography.small, styles.primaryText, { color: colors.onBrand }]}>
                {busy ? 'Turning on…' : 'Turn on'}
              </Text>
            </Pressable>

            <Pressable
              onPress={() => void decline()}
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel="Not now"
              style={({ pressed }) => [
                styles.secondary,
                { backgroundColor: pressed ? colors.surfaceAlt : 'transparent' },
              ]}
            >
              <Text style={[typography.small, { color: colors.textMuted }]}>Not now</Text>
            </Pressable>
          </View>
        </View>

        <Pressable
          onPress={() => void decline()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          style={styles.close}
        >
          <X size={16} color={colors.textSubtle} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.base,
  },
  iconWell: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  primary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  primaryText: {
    fontWeight: '700',
  },
  secondary: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  close: {
    padding: spacing.xs,
  },
});