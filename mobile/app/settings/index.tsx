/**
 * Settings hub.
 *
 * A single scroll of grouped `LinkRow`s. Each row owns one concern and pushes a
 * dedicated screen, so this file stays a map of what is configurable rather than
 * a form with everything crammed into it.
 *
 * Destructive actions (sign out, delete account) live at the bottom, visually
 * separated by the same "danger" treatment the web app uses.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import {
  Archive,
  Bell,
  Eye,
  FileText,
  Lock,
  LogOut,
  MessageCircle,
  Moon,
  Palette,
  Tag,
  User,
  UserX,
} from 'lucide-react-native';

import { useTheme, useThemeMode } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import { getMyPresenceSettings } from '@/services/messaging/presence';
import { BRAND } from '@/constants/brand';
import { radius, spacing, typography } from '@/constants/theme';
import { Screen, ScreenHeader, Divider } from '@/components/layout/Screen';
import { LinkRow } from '@/components/ui/Controls';
import { Button } from '@/components/ui/Button';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const { isDark, preference } = useThemeMode();
  const router = useRouter();
  const { signOut } = useAuth();
  const { unreadMessagesCount, unreadNotificationsCount } = useData();
  const { archivedCount, blockedUsers } = useMessaging();

  /**
   * Surfaced on the Privacy row so the setting is visible without opening it.
   *
   * Read from the database rather than the cached profile: this value gates what
   * other people can see, so showing a stale "on" next to a setting that is
   * actually off is the one place this must not be wrong.
   */
  const [lastSeenVisible, setLastSeenVisible] = useState<boolean | null>(null);

  // Re-read on focus so returning from the Privacy screen shows the new value.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      void getMyPresenceSettings().then((settings) => {
        if (!cancelled) setLastSeenVisible(settings.lastSeenVisible);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const blockedCount = blockedUsers.length;

  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need your password to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  }, [signOut]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader title="Settings" fallback="/(tabs)" />

      <Screen gap={spacing.lg}>
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinkRow
            icon={User}
            label="Account"
            value="Name, username, bio"
            onPress={() => router.push('/settings/account')}
          />
          <Divider inset={spacing['4xl']} />
          <LinkRow
            icon={Lock}
            label="Password"
            onPress={() => router.push('/settings/password')}
          />
          <Divider inset={spacing['4xl']} />
          <LinkRow
            icon={Tag}
            label="My listings"
            onPress={() => router.push('/settings/my-listings')}
          />
        </View>

        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {/* Chat has its own row, with its own unread badge: it is a conversation
              inbox, not a category of notification. */}
          <LinkRow
            icon={MessageCircle}
            label="Messages"
            count={unreadMessagesCount}
            onPress={() => router.push('/messages')}
          />
          <Divider inset={spacing['4xl']} />
          <LinkRow
            icon={Archive}
            label="Archived chats"
            count={archivedCount}
            value={archivedCount > 0 ? undefined : 'Finished, but still searchable'}
            onPress={() => router.push('/messages/archived')}
          />
          <Divider inset={spacing['4xl']} />
          <LinkRow
            icon={Bell}
            label="Notifications"
            count={unreadNotificationsCount}
            onPress={() => router.push('/settings/notifications')}
          />
          <Divider inset={spacing['4xl']} />
          <LinkRow
            icon={isDark ? Moon : Palette}
            label="Appearance"
            value={preference === 'system' ? 'Follows your phone' : isDark ? 'Dark' : 'Light'}
            onPress={() => router.push('/settings/appearance')}
          />
        </View>

        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinkRow
            icon={Eye}
            label="Privacy"
            value={lastSeenVisible === false ? 'Last seen: private' : undefined}
            onPress={() => router.push('/settings/privacy')}
          />
          <Divider inset={spacing['4xl']} />
          <LinkRow
            icon={UserX}
            label="Blocked users"
            count={blockedCount}
            onPress={() => router.push('/settings/blocked-users')}
          />
        </View>

        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinkRow
            icon={FileText}
            label="Terms & Privacy"
            onPress={() => router.push('/settings/terms')}
          />
        </View>

        <Button label="Sign out" icon={LogOut} onPress={confirmSignOut} variant="outline" />

        <Text style={[typography.caption, styles.footer, { color: colors.textSubtle }]}>
          {BRAND.fullName}
          {'\n'}
          {BRAND.website}
        </Text>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  footer: {
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
