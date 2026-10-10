/**
 * Notifications.
 *
 * Activity on your listings and account — offers, boosts, reviews, price and
 * status changes, moderation and system notices — newest first. Chat is
 * deliberately absent: replies live in Messages, and the two unread counts are
 * tracked separately so a conversation never shows up twice.
 *
 * A notification's `link` is a web-style path; rather than parsing arbitrary
 * URLs, only the routes the app actually owns are opened, and anything else is
 * shown as static text. That keeps a malformed row from navigating somewhere
 * unexpected.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, RefreshControl, FlatList, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Bell,
  CheckCheck,
  MessageCircle,
  Rocket,
  ShieldAlert,
  Sparkles,
  Star,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useData } from '@/providers/DataProvider';
import { useToast } from '@/providers/ToastProvider';
import {
  getPushState,
  isPushSupported,
  requestPermissionAndRegister,
  subscribeToPushState,
  type PushState,
} from '@/services/messaging/push';
import { spacing, typography, radius } from '@/constants/theme';
import { ScreenHeader } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import { timeAgo } from '@/utils/time';
import type { NotificationItem, NotificationType } from '@/types';

const ICONS: Record<NotificationType, LucideIcon> = {
  message: MessageCircle,
  boost: Rocket,
  inquiry: Sparkles,
  system: Bell,
  report: ShieldAlert,
  review: Star,
};

/** Maps a notification link to an in-app route, or null if we don't own it. */
const routeFor = (link?: string): string | null => {
  if (!link) return null;
  if (link.startsWith('/listing/')) return link;
  if (link.startsWith('/messages')) return '/messages';
  if (link.startsWith('/user/')) return link;
  if (link.startsWith('/settings')) return link;
  return null;
};

export default function NotificationsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const {
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    refreshNotifications,
  } = useData();

  const [refreshing, setRefreshing] = React.useState(false);

  // Refresh once on mount; the provider keeps the list live from then on.
  React.useEffect(() => {
    void refreshNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void refreshNotifications().finally(() => setRefreshing(false));
  }, [refreshNotifications]);

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Notifications"
        subtitle={
          unread > 0
            ? `${unread} new ${unread === 1 ? 'update' : 'updates'}`
            : 'Listing activity and account updates'
        }
        fallback="/(tabs)"
        action={
          unread > 0 ? (
            <Button
              label="Mark all read"
              icon={CheckCheck}
              size="sm"
              variant="ghost"
              block={false}
              onPress={() => void markAllNotificationsRead()}
            />
          ) : undefined
        }
      />

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={<MessagePushControl />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          <EmptyState
            icon={Bell}
            title="You're all caught up"
            message="Offers, boosts, reviews and account updates will appear here. Replies from sellers stay in Messages."
          />
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            onPress={() => {
              if (!item.isRead) void markNotificationRead(item.id);
              const route = routeFor(item.link);
              if (route) router.push(route);
            }}
          />
        )}
      />
    </View>
  );
}

function NotificationRow({ item, onPress }: { item: NotificationItem; onPress: () => void }) {
  const { colors } = useTheme();
  const Icon = ICONS[item.type] ?? Bell;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed
            ? colors.surfaceAlt
            : item.isRead
              ? 'transparent'
              : colors.brandSoft,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: item.isRead ? colors.surfaceAlt : colors.brand },
        ]}
      >
        <Icon size={17} color={item.isRead ? colors.textMuted : colors.onBrand} />
      </View>

      <View style={styles.rowBody}>
        <Text style={[typography.smallStrong, { color: colors.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={2}>
          {item.message}
        </Text>
        <Text style={[typography.caption, { color: colors.textSubtle }]}>
          {timeAgo(item.createdAt)}
        </Text>
      </View>

      {!item.isRead ? (
        <View style={[styles.dot, { backgroundColor: colors.brand }]} />
      ) : null}
    </Pressable>
  );
}

/**
 * Message push, opt-in from Settings.
 *
 * This screen is about activity on your listings, but message notifications are
 * the other thing people come here looking for and cannot otherwise find. It is
 * separated from the listing feed below because they are unrelated: the rows here
 * never contain replies, and turning push on changes nothing about this list.
 *
 * ## States are shown honestly
 *
 * "On a device without push" and "you said no" are different situations and get
 * different copy. A control that cannot ever succeed is hidden rather than left
 * as a switch that fails, and a refusal points at the one place it can be fixed,
 * because iOS will not show its prompt again.
 */
function MessagePushControl() {
  const { colors } = useTheme();
  const toast = useToast();

  const [state, setState] = useState<PushState>(getPushState());
  const [busy, setBusy] = useState(false);

  // The service keeps its own state so this row reflects a permission change made
  // anywhere else in the app, not just here.
  useEffect(() => subscribeToPushState(setState), []);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      const next = await requestPermissionAndRegister();
      if (next.status === 'denied') {
        toast.error('Notifications are blocked for JID in your phone settings.');
      } else if (next.status === 'failed') {
        toast.error(next.reason);
      } else if (next.status === 'unsupported') {
        toast.error(next.reason);
      }
    } finally {
      setBusy(false);
    }
  }, [toast]);

  if (!isPushSupported()) return null;

  const on = state.status === 'registered';
  const blocked = state.status === 'denied';

  return (
    <View style={styles.pushSection}>
      <View
        style={[
          styles.pushCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: colors.brandSoft }]}>
          <MessageCircle size={17} color={colors.brand} />
        </View>

        <View style={styles.pushBody}>
          <Text style={[typography.bodyStrong, { color: colors.text }]}>
            Message notifications
          </Text>
          <Text style={[typography.small, { color: colors.textMuted }]}>
            {on
              ? 'You will be notified when someone replies, even when JID is closed.'
              : blocked
                ? 'JID cannot show notifications. Turn them on for JID in your phone settings.'
                : 'Get a notification when someone replies, even when JID is closed.'}
          </Text>
        </View>

        {blocked ? (
          <Pressable
            onPress={() => Linking.openSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open phone settings for JID"
            style={({ pressed }) => [
              styles.pushButton,
              { backgroundColor: pressed ? colors.brandSoft : colors.surfaceAlt },
            ]}
          >
            <Text style={[typography.caption, styles.pushButtonText, { color: colors.brand }]}>
              Open settings
            </Text>
          </Pressable>
        ) : (
          <Button
            label={busy ? 'Turning on…' : on ? 'On' : 'Turn on'}
            size="sm"
            variant={on ? 'ghost' : 'primary'}
            block={false}
            disabled={busy || on}
            onPress={() => void enable()}
          />
        )}
      </View>
    </View>
  );
}

/**
 * Pull-to-refresh list; the provider keeps it live once mounted.
 */

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  pushSection: {
    paddingHorizontal: spacing.base,
    paddingTop: spacing.base,
    paddingBottom: spacing.md,
  },
  pushCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  pushBody: {
    flex: 1,
    gap: 2,
  },
  pushButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
  },
  pushButtonText: {
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: spacing.sm,
  },
});
