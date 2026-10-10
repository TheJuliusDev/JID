/**
 * Profile.
 *
 * The signed-in hub: identity header, live counters, and the entry points into
 * everything else in the app (my listings, chats, settings).
 *
 * Counters are derived from data the app already holds — unread messages and
 * notifications from `DataContext`, saved items from the same place, and the
 * user's own listings fetched here — rather than from a separate stats
 * endpoint, so a number can never disagree with the list behind it.
 */
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Bell,
  Bookmark,
  Home,
  LogOut,
  MessageCircle,
  Moon,
  Sun,
  User,
  UserCog,
} from 'lucide-react-native';

import { useTheme, useThemeMode } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { listMarketplaceByUser, listPropertiesByUser } from '@/services/database';
import { GUTTER, MIN_TOUCH, radius, spacing, typography, TAB_BAR_CLEARANCE } from '@/constants/theme';
import { Avatar, Badge } from '@/components/ui/Card';
import { BackButton, Button, IconButton } from '@/components/ui/Button';
import { LinkRow } from '@/components/ui/Controls';
import { useAsync } from '@/hooks';

export default function ProfileScreen() {
  const { colors } = useTheme();
  const { isDark, preference, toggle } = useThemeMode();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile, signOut } = useAuth();
  const { conversations, unreadMessagesCount, unreadNotificationsCount, saved } = useData();

  /**
   * Loads the user's own listings so "My listings" carries a real count.
   *
   * Counted from the rows themselves rather than a denormalised total so the
   * number always matches what the My Listings screen will show.
   */
  const loadListings = useCallback(async () => {
    if (!profile) return { items: 0, lodges: 0 };
    const [items, lodges] = await Promise.all([
      listMarketplaceByUser(profile.id),
      listPropertiesByUser(profile.id),
    ]);
    return { items: items.length, lodges: lodges.length };
  }, [profile]);

  const { data: counts, loading, refresh, refreshing } = useAsync(loadListings, [profile]);

  const totalListings = (counts?.items ?? 0) + (counts?.lodges ?? 0);
  const displayName = profile?.fullName?.trim() || profile?.username || 'JID student';
  const subtitle = [profile?.department, profile?.level, profile?.hallOrArea]
    .filter(Boolean)
    .join(' · ');

  /**
   * Signing out is confirmed because it drops the restored session from the
   * device, and any in-progress form state goes with it.
   */
  const confirmSignOut = useCallback(() => {
    Alert.alert('Sign out?', 'You will need your password to get back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void signOut();
        },
      },
    ]);
  }, [signOut]);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScrollView
        contentContainerStyle={{
          padding: GUTTER,
          paddingBottom: TAB_BAR_CLEARANCE + insets.bottom,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
      >
        {/*
          A title row, not a large hero: Profile is a tab, but it is also reached
          from inside a listing or a chat, and the back affordance has to be
          honest about where "back" leads — the actual screen you came from.
        */}
        <View style={[styles.titleRow, { marginTop: insets.top + spacing.xs }]}>
          {router.canGoBack() ? (
            <BackButton fallback="/(tabs)" />
          ) : (
            <View style={styles.titleSpacer} />
          )}
          <Text style={[typography.title, styles.title, { color: colors.text }]}>Profile</Text>
          <IconButton
            icon={Bell}
            onPress={() => router.push('/settings/notifications')}
            variant="surface"
            accessibilityLabel={
              unreadNotificationsCount > 0
                ? `Notifications, ${unreadNotificationsCount} new`
                : 'Notifications'
            }
            badge={unreadNotificationsCount}
          />
        </View>

        {/*
          A suspended account is invisible to other users by RLS, so listing
          anything is pointless. Say so plainly instead of letting the user post
          into a void.
        */}
        {profile?.isSuspended ? (
          <View style={[styles.banner, { backgroundColor: colors.dangerSoft, borderColor: colors.danger }]}>
            <Text style={[typography.smallStrong, { color: colors.danger }]}>
              Your account is suspended
            </Text>
            <Text style={[typography.small, { color: colors.danger }]}>
              You can still read JID, but your listings are hidden and you cannot post or message
              sellers. Contact support if you think this is a mistake.
            </Text>
          </View>
        ) : null}

        {/* Identity. */}
        <View style={styles.identity}>
          <Avatar uri={profile?.avatarUrl} name={displayName} size={64} showRing />

          <View style={styles.identityText}>
            <Text style={[typography.heading, { color: colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[typography.body, { color: colors.textMuted }]} numberOfLines={1}>
              @{profile?.username ?? 'username'}
            </Text>

            <View style={styles.badges}>
              {/*
                There is no user-level "landlord" flag — `landlord_role` belongs
                to an individual property row — so being a lister is inferred
                from having posted, which is the same thing the web app shows.
              */}
              {totalListings > 0 ? <Badge label="Lister" tone="info" /> : null}
              {loading ? <Badge label="Loading…" tone="neutral" /> : null}
            </View>
          </View>

          <IconButton
            icon={UserCog}
            onPress={() => router.push('/settings/account')}
            variant="surface"
            accessibilityLabel="Edit profile"
          />
        </View>

        <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={2}>
          {subtitle || 'Add your department and level so sellers know who they are dealing with.'}
        </Text>

        {/* Grouped rows. `LinkRow` supplies the divider between entries, so the
            first row of each group is marked and the rest are not. */}
        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinkRow
            icon={Home}
            label="My listings"
            value={loading ? '…' : String(totalListings)}
            onPress={() => router.push('/settings/my-listings')}
          />
          <LinkRow
            icon={Bookmark}
            label="Saved"
            value={String(saved.length)}
            onPress={() => router.push('/(tabs)/saved')}
          />
          {/* Chat and activity are counted and labelled separately so neither
              number quietly absorbs the other's. */}
          <LinkRow
            icon={MessageCircle}
            label="Messages"
            // The badge carries the unread count; `value` only describes the row
            // when there is nothing unread, so the two never compete for the same
            // space or contradict each other.
            count={unreadMessagesCount}
            value={
              unreadMessagesCount > 0
                ? undefined
                : `${conversations.length} ${conversations.length === 1 ? 'chat' : 'chats'}`
            }
            onPress={() => router.push('/messages')}
          />
          <LinkRow
            icon={Bell}
            label="Notifications"
            value={
              unreadNotificationsCount > 0 ? `${unreadNotificationsCount} new` : undefined
            }
            onPress={() => router.push('/settings/notifications')}
          />
        </View>

        <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <LinkRow
            icon={isDark ? Moon : Sun}
            label="Appearance"
            value={preference === 'system' ? 'Follows your phone' : isDark ? 'Dark' : 'Light'}
            onPress={toggle}
          />
          <LinkRow
            icon={User}
            label="Account and privacy"
            onPress={() => router.push('/settings')}
          />
        </View>

        <Button label="Sign out" icon={LogOut} onPress={confirmSignOut} variant="ghost" />

        <Text style={[typography.caption, styles.footer, { color: colors.textSubtle }]}>
          JID · Student marketplace and accommodation
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xs,
  },
  title: {
    flex: 1,
  },
  titleSpacer: {
    width: MIN_TOUCH,
  },
  banner: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  identityText: {
    flex: 1,
    gap: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  footer: {
    textAlign: 'center',
  },
});