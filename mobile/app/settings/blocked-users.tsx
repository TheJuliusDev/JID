/**
 * Blocked users.
 *
 * Blocking is enforced server-side and symmetrically: neither party can exchange
 * messages afterwards, and the conversation stops appearing in the inbox for
 * either side. That makes unblocking the only way back, which is why this screen
 * exists as a first-class destination rather than being buried inside a chat.
 *
 * ## What unblocking does and does not restore
 *
 * It lifts the block. It does **not** restore the conversation's place in the
 * inbox, nor un-delete anything, nor unblock the other direction. Somebody who
 * blocked you in the meantime stays blocked. Saying so up front is important:
 * people unblock in anger and then cannot work out why nothing came back.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { UserX, ShieldOff } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/layout/Screen';
import { Avatar } from '@/components/ui/Card';
import { EmptyState, RowSkeleton } from '@/components/ui/States';
import { timeAgo } from '@/utils/time';
import type { BlockedUser } from '@/types';

export default function BlockedUsersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { blockedUsers, refreshBlockedUsers, unblock, capabilities } = useMessaging();

  const [loading, setLoading] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void refreshBlockedUsers().finally(() => setLoading(false));
    }, [refreshBlockedUsers]),
  );

  const confirmUnblock = useCallback(
    (user: BlockedUser) => {
      Alert.alert(
        `Unblock ${user.fullName}?`,
        'They will be able to message you again and see your profile. This does not restore any conversation you deleted.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Unblock',
            onPress: () => {
              setPendingId(user.id);
              void unblock(user.id).finally(() => setPendingId(null));
            },
          },
        ],
      );
    },
    [unblock],
  );

  /**
   * Blocking is unavailable on a database without the block tables.
   *
   * Explained rather than silently showing an empty list, because an empty blocked
   * list looks like "nobody is blocked" when the truth is "this cannot be blocked".
   */
  if (capabilities.resolved && !capabilities.blocks) {
    return (
      <View style={[styles.root, { backgroundColor: colors.bg }]}>
        <ScreenHeader title="Blocked users" fallback="/settings" />
        <EmptyState
          icon={ShieldOff}
          title="Blocking is not available yet"
          message="This needs the latest JID messaging update. Once it is applied you can block anyone from any chat."
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Blocked users"
        subtitle={
          blockedUsers.length > 0
            ? `${blockedUsers.length} ${blockedUsers.length === 1 ? 'person' : 'people'} blocked`
            : 'Nobody is blocked'
        }
        fallback="/settings"
      />

      <FlatList
        data={blockedUsers}
        keyExtractor={(u) => u.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : (
            <EmptyState
              icon={UserX}
              title="Nobody is blocked"
              message="You can block someone from any chat. They will not be able to message you or see your profile, and they are not told."
            />
          )
        }
        renderItem={({ item }) => (
          <View style={[styles.row, { borderBottomColor: colors.border }]}>
            <Avatar uri={item.avatarUrl} name={item.fullName} size={44} />

            <View style={styles.rowBody}>
              <Text style={[typography.bodyStrong, { color: colors.text }]} numberOfLines={1}>
                {item.fullName}
              </Text>
              <Text style={[typography.caption, { color: colors.textSubtle }]} numberOfLines={1}>
                {item.username ? `@${item.username} · ` : ''}Blocked {timeAgo(item.blockedAt)}
              </Text>
            </View>

            <Pressable
              onPress={() => confirmUnblock(item)}
              disabled={pendingId === item.id}
              accessibilityRole="button"
              accessibilityLabel={`Unblock ${item.fullName}`}
              style={({ pressed }) => [
                styles.unblock,
                {
                  backgroundColor: pressed ? colors.brandSoft : colors.surface,
                  borderColor: colors.border,
                },
                pendingId === item.id && { opacity: 0.5 },
              ]}
            >
              <Text style={[typography.caption, styles.unblockText, { color: colors.brand }]}>
                {pendingId === item.id ? '…' : 'Unblock'}
              </Text>
            </Pressable>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  list: {
    paddingBottom: 0,
    flexGrow: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  unblock: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  unblockText: {
    fontWeight: '700',
  },
  skeletons: {
    padding: spacing.base,
  },
});