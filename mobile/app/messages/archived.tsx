/**
 * Archived conversations.
 *
 * ## Why archived chats live here rather than in the inbox
 *
 * Archiving is for conversations that are finished but not disposable — a room
 * enquiry from last term, a sale that completed. Removing them from the inbox is
 * the entire point; a toggle inside the inbox would defeat it. So they get their
 * own destination, reachable from the inbox header.
 *
 * ## Nothing is hidden, and nothing is lost
 *
 * An archived chat keeps every message and keeps receiving them. Search covers
 * archived conversations too, so "I archived it, where was it?" always has an
 * answer. This is deliberately different from hiding or deleting: neither of those
 * is reversible, and neither is what a user means by "clear this out of my list".
 *
 * ## New messages in an archived chat
 *
 * They still arrive and still notify. The unread count is shown here, so a chat
 * that becomes active again is obvious rather than silent. What archiving changes
 * is only *where* the conversation lives — never whether the user is told.
 */
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArchiveRestore, Archive as ArchiveIcon } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import { radius, spacing, typography } from '@/constants/theme';
import { ScreenHeader } from '@/components/layout/Screen';
import { EmptyState, RowSkeleton } from '@/components/ui/States';
import { ConversationRow } from '@/components/chat/ConversationRow';
import type { Conversation } from '@/types';

export default function ArchivedChatsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { archivedConversations, archivedLoading, refreshArchived, unarchiveConversation } =
    useMessaging();

  const [pendingId, setPendingId] = useState<string | null>(null);

  // Reloaded on focus so a chat archived from the inbox appears here immediately,
  // and one unarchived here leaves without a manual refresh.
  useFocusEffect(
    useCallback(() => {
      void refreshArchived();
    }, [refreshArchived]),
  );

  const restore = useCallback(
    (conversation: Conversation) => {
      setPendingId(conversation.id);
      void unarchiveConversation(conversation.id).finally(() => setPendingId(null));
    },
    [unarchiveConversation],
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <ScreenHeader
        title="Archived"
        subtitle={
          archivedConversations.length > 0
            ? `${archivedConversations.length} ${archivedConversations.length === 1 ? 'chat' : 'chats'} · still searchable`
            : 'Finished conversations live here'
        }
        fallback="/messages"
      />

      <FlatList
        data={archivedConversations}
        keyExtractor={(c) => c.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={archivedLoading}
            onRefresh={() => void refreshArchived()}
            tintColor={colors.brand}
            colors={[colors.brand]}
            progressBackgroundColor={colors.surface}
          />
        }
        ListEmptyComponent={
          archivedLoading ? (
            <View style={styles.skeletons}>
              <RowSkeleton />
              <RowSkeleton />
            </View>
          ) : (
            <EmptyState
              icon={ArchiveIcon}
              title="Nothing archived"
              message="Long-press any chat in Messages and choose Archive to clear it from your inbox. Archived chats still receive messages and stay searchable."
            />
          )
        }
        renderItem={({ item }) => (
          <View>
            <ConversationRow
              conversation={item}
              onPress={() => undefined}
              onLongPress={() => restore(item)}
            />

            {/**
             * Restore is the only action here, and it is a button rather than a
             * hidden gesture: reaching this screen means looking for something, and
             * making the way back explicit is kinder than requiring a long press
             * that this screen does not otherwise explain.
             */}
            <Pressable
              onPress={() => restore(item)}
              disabled={pendingId === item.id}
              accessibilityRole="button"
              accessibilityLabel={`Move conversation with ${item.participant.fullName} back to Messages`}
              style={({ pressed }) => [
                styles.restore,
                {
                  backgroundColor: pressed ? colors.brandSoft : 'transparent',
                  borderBottomColor: colors.border,
                },
              ]}
            >
              <ArchiveRestore size={15} color={colors.brand} />
              <Text style={[typography.caption, { color: colors.brand }]}>
                {pendingId === item.id ? 'Moving…' : 'Move back to Messages'}
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
  restore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: spacing.xs,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  skeletons: {
    padding: spacing.base,
  },
});