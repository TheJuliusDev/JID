/**
 * Messages inbox.
 *
 * ## What this screen is responsible for
 *
 * The list itself, the unread badges, and the three ways a conversation can be
 * *organised* — pinned, archived, found. Conversation state comes from
 * `MessagingProvider`, which is the single owner of the inbox, so the badge on
 * this screen, the badge on the Messages entry point and the rows themselves can
 * never disagree.
 *
 * ## Kept entirely separate from Notifications
 *
 * Nothing here reads or writes the activity feed. A chat lives in Messages; a
 * listing update lives in Notifications. `DataProvider` already filters
 * message-type rows out of that feed, and this screen never adds any, so an unread
 * message is counted once and shown in exactly one place.
 *
 * ## Why the online dot here is derived, not live
 *
 * Live presence is a Realtime socket fact on a *per-conversation* channel, which is
 * exactly right for a thread (one channel, one other person) and wrong for an
 * inbox — subscribing to fifty conversations to decorate fifty rows would cost more
 * than the feature is worth.
 *
 * So the inbox shows activity derived from `last_seen_at`, which the app writes on
 * foreground and on a five-minute heartbeat. A person with JID open looks active
 * here; the thread header shows the true live state. The dot is deliberately
 * conservative — it needs a very recent timestamp — so it under-promises rather than
 * showing somebody as present after they have left.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Archive, Search, X, MessageCircle } from 'lucide-react-native';

import { useTheme } from '@/providers/ThemeProvider';
import { useData } from '@/providers/DataProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import { useToast } from '@/providers/ToastProvider';
import { useStableCallback } from '@/hooks';
import { humanizeError } from '@/services/supabase';
import { setConversationMuted } from '@/services/messaging/conversations';
import type { SafetyReportTarget } from '@/services/messaging/safety';
import { radius, spacing, typography, HIT_SLOP } from '@/constants/theme';
import { Avatar } from '@/components/ui/Card';
import { EmptyState, RowSkeleton } from '@/components/ui/States';
import { ScreenHeader } from '@/components/layout/Screen';
import { ConversationRow } from '@/components/chat/ConversationRow';
import { ConversationActions } from '@/components/chat/ConversationActions';
import { SafetyReportSheet } from '@/components/chat/SafetyReportSheet';
import { Highlighted } from '@/components/chat/ThreadSearch';
import { messagePreview } from '@/services/messaging/codec';
import { presenceText } from '@/utils/presence';
import { timeAgo } from '@/utils/time';
import type { Conversation, ConversationSearchResult } from '@/types';

/**
 * How recent `last_seen_at` must be before the inbox calls somebody active.
 *
 * Tight on purpose. The heartbeat refreshes every five minutes, so a wider window
 * would keep showing somebody as present long after they closed the app; erring
 * toward "not shown" is the less annoying failure.
 */
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

export default function MessagesScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const {
    conversations,
    conversationsLoading,
    refreshConversations,
    setActiveConversationId,
  } = useData();
  const {
    capabilities,
    archivedCount,
    pinConversation,
    archiveConversation,
    block,
    unblock,
    blockedUsers,
    searchConversations,
  } = useMessaging();

  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Awaited<ReturnType<typeof searchConversations>>>([]);
  const [searchBusy, setSearchBusy] = useState(false);
  /** The conversation whose action sheet is open. */
  const [actionTarget, setActionTarget] = useState<Conversation | null>(null);
  const [reportTarget, setReportTarget] = useState<SafetyReportTarget | null>(null);

  /**
   * Refetch on focus.
   *
   * A thread opened from a listing detail may have started after this list was last
   * built, and returning from a thread must show its new message. Leaving the list
   * also clears the "thread being viewed" marker, or the Messages badge would keep
   * excluding that thread's unread count forever.
   */
  useFocusEffect(
    React.useCallback(() => {
      setActiveConversationId(null);
      void refreshConversations();
    }, [refreshConversations, setActiveConversationId]),
  );

  /**
   * Opens a thread by id.
   *
   * Takes the id rather than the row because a search hit is a
   * `ConversationSearchResult`, which carries only what search needs — forcing it
   * into a full `Conversation` with a cast would mean rendering a thread header
   * from fields the search RPC never returned.
   */
  const open = useCallback(
    (conversationId: string) => {
      router.push({ pathname: '/messages/[id]', params: { id: conversationId } });
    },
    [router],
  );

  // --- Search ------------------------------------------------------------

/**
 * Conversation search, debounced by input length.
 *
 * Delegates to the provider, which calls the indexed server-side RPC, so this
 * stays fast in a long history and matches archived chats too — an archived
 * conversation is still findable, which is the point of archiving over deleting.
 */
const runSearch = useStableCallback(async (text: string) => {
  const needle = text.trim();
  if (needle.length < 2) {
    setSearchResults([]);
    setSearchBusy(false);
    return;
  }
  setSearchBusy(true);
  const rows = await searchConversations(needle);
  setSearchResults(rows);
  setSearchBusy(false);
});

/**
 * The pending search timer.
 *
 * A ref rather than a `useEffect`: the handler is called on every keystroke, and a
 * cleanup returned from a `TextInput` handler is never invoked by React Native, so
 * an effect-based debounce would stack one live timer per character typed. Holding
 * the timer id lets each keystroke cancel the one before it, which is what makes
 * this a debounce rather than a delay.
 */
const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const onChangeQuery = useCallback((text: string) => {
  setQuery(text);

  if (searchTimer.current) clearTimeout(searchTimer.current);

  if (text.trim().length < 2) {
    setSearchResults([]);
    setSearchBusy(false);
    return;
  }

  setSearchBusy(true);
  searchTimer.current = setTimeout(() => void runSearch(text), 300);
}, [runSearch]);

/** Cancels any in-flight search timer when the screen goes away. */
useEffect(
  () => () => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
  },
  [],
);

const closeSearch = useCallback(() => {
  if (searchTimer.current) clearTimeout(searchTimer.current);
  setSearching(false);
  setQuery('');
  setSearchResults([]);
  setSearchBusy(false);
}, []);

  // --- Actions -----------------------------------------------------------

  const togglePin = useCallback(() => {
    if (!actionTarget) return;
    void pinConversation(actionTarget.id, !actionTarget.pinnedAt);
    setActionTarget(null);
  }, [actionTarget, pinConversation]);

  const toggleArchive = useCallback(() => {
    if (!actionTarget) return;
    void archiveConversation(actionTarget.id, !actionTarget.archivedAt);
    setActionTarget(null);
  }, [actionTarget, archiveConversation]);

  const toggleMute = useCallback(() => {
    if (!actionTarget) return;
    const next = !actionTarget.mutedAt;
    setActionTarget(null);
    void setConversationMuted(actionTarget.id, next)
      .then(() => {
        toast.success(next ? 'Notifications muted for this chat.' : 'Notifications on.');
        return refreshConversations();
      })
      .catch((error) => toast.error(humanizeError(error)));
  }, [actionTarget, toast, refreshConversations]);

  const confirmBlock = useCallback(() => {
    const target = actionTarget;
    setActionTarget(null);
    if (!target) return;

    Alert.alert(
      `Block ${target.participant.fullName}?`,
      'They will not be able to message you or see your profile. They are not told that you blocked them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => void block(target.participant.id),
        },
      ],
    );
  }, [actionTarget, block]);

  const confirmUnblock = useCallback(() => {
    const target = actionTarget;
    setActionTarget(null);
    if (target) void unblock(target.participant.id);
  }, [actionTarget, unblock]);

  const reportConversation = useCallback(() => {
    const target = actionTarget;
    setActionTarget(null);
    if (!target) return;
    setReportTarget({
      type: 'conversation',
      userId: target.participant.id,
      conversationId: target.id,
      displayName: target.participant.fullName,
    });
  }, [actionTarget]);

  // --- Derived -----------------------------------------------------------

  /**
   * Pinned first.
   *
   * The server already orders this way, but the client re-sorts after a pin or
   * archive so the list never has to wait for a round trip to look right.
   */
  const ordered = useMemo(
    () =>
      [...conversations].sort((a, b) => {
        const aPinned = a.pinnedAt ? 1 : 0;
        const bPinned = b.pinnedAt ? 1 : 0;
        if (aPinned !== bPinned) return bPinned - aPinned;
        return (
          new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime()
        );
      }),
    [conversations],
  );

  /** Renders the dot + label under a row's name, when there is something to say. */
  const activityFor = useCallback((conversation: Conversation) => {
    const { lastSeenAt, lastSeenVisible } = conversation.participant;
    if (lastSeenVisible === false) return null;

    const then = lastSeenAt ? new Date(lastSeenAt).getTime() : NaN;
    if (!Number.isNaN(then) && Date.now() - then <= ACTIVE_WINDOW_MS) {
      return { isOnline: true, label: 'Active now' };
    }

    const text = presenceText({
      isOnline: false,
      lastSeenAt,
      // Already known visible: the opt-out returned null above, so this cannot be
      // false here.
      visible: true,
    });
    return text ? { isOnline: false, label: text } : null;
  }, []);

  const renderRow = useCallback(
    ({ item }: { item: Conversation }) => (
      <View>
        <ConversationRow
          conversation={item}
          selected={actionTarget?.id === item.id}
          onPress={() => open(item.id)}
          onLongPress={setActionTarget}
        />
        {/*
         * Activity line.
         *
         * Sits under the preview rather than replacing it: the preview is what the
         * user is looking for, and presence is secondary context. It is skipped
         * entirely for unread threads, where the bold name and the pill already
         * carry the emphasis.
         */}
        {!item.unreadCount ? <ActivityLine conversation={item} activityFor={activityFor} /> : null}
      </View>
    ),
    [open, actionTarget?.id, activityFor],
  );

  const header = (
    <ScreenHeader
      title="Messages"
      subtitle={
        conversations.length > 0
          ? `${conversations.length} ${conversations.length === 1 ? 'conversation' : 'conversations'}`
          : 'Chats with sellers and landlords'
      }
      fallback="/(tabs)"
      action={
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => setSearching(true)}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel="Search conversations"
            style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
          >
            <Search size={20} color={colors.text} />
          </Pressable>

          {/*
           * Archived is a destination, not a filter.
           *
           * Archived chats are gone from this list by design, so the entry point has
           * to live somewhere permanent. It is hidden entirely when there is nothing
           * archived rather than sitting there as an empty destination.
           */}
          {capabilities.organise && archivedCount > 0 ? (
            <Pressable
              onPress={() => router.push('/messages/archived')}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={`Archived conversations, ${archivedCount}`}
              style={({ pressed }) => [styles.headerButton, pressed && { opacity: 0.6 }]}
            >
              <Archive size={20} color={colors.text} />
              <View style={[styles.countDot, { backgroundColor: colors.brand }]}>
                <Text style={[styles.countText, { color: colors.onBrand }]}>
                  {archivedCount > 9 ? '9+' : archivedCount}
                </Text>
              </View>
            </Pressable>
          ) : null}
        </View>
      }
    />
  );

  const searchBar = (
    <View
      style={[
        styles.searchBar,
        { backgroundColor: colors.bg, borderBottomColor: colors.border },
      ]}
    >
      <Search size={18} color={colors.textSubtle} />
      <TextInput
        value={query}
        onChangeText={onChangeQuery}
        placeholder="Search people and messages"
        placeholderTextColor={colors.textSubtle}
        style={[typography.body, styles.searchInput, { color: colors.text }]}
        autoFocus
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel="Search conversations"
      />
      {searchBusy ? <ActivityIndicator size="small" color={colors.textSubtle} /> : null}
      <Pressable
        onPress={closeSearch}
        hitSlop={HIT_SLOP}
        accessibilityRole="button"
        accessibilityLabel="Close search"
        style={({ pressed }) => [styles.closeButton, pressed && { opacity: 0.6 }]}
      >
        <X size={20} color={colors.text} />
      </Pressable>
    </View>
  );

  const listEmpty = conversationsLoading ? (
    <View style={styles.skeletons}>
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </View>
  ) : (
    <EmptyState
      icon={MessageCircle}
      title="No messages yet"
      message="When you message a seller or landlord, the conversation shows up here. Keep it in JID so you both have a record."
      actionLabel="Browse listings"
      onAction={() => router.push('/(tabs)/explore')}
    />
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {searching ? searchBar : header}

      {searching ? (
        <FlatList
          data={searchResults}
          keyExtractor={(row) => row.conversationId}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            query.trim().length < 2 ? (
              <Text style={[typography.small, styles.searchHint, { color: colors.textSubtle }]}>
                Search by name, or by anything said inside a chat.
              </Text>
            ) : searchBusy ? null : (
              <Text style={[typography.small, styles.searchHint, { color: colors.textSubtle }]}>
                Nothing matches “{query.trim()}”. Archived chats are searched too.
              </Text>
            )
          }
          renderItem={({ item }) => (
            <SearchResultRow
              result={item}
              needle={query.trim()}
              onPress={() => open(item.conversationId)}
            />
          )}
        />
      ) : (
        <FlatList
          data={ordered}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + spacing.lg }]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={conversationsLoading}
              onRefresh={() => void refreshConversations()}
              tintColor={colors.brand}
              colors={[colors.brand]}
              progressBackgroundColor={colors.surface}
            />
          }
          ListEmptyComponent={listEmpty}
        />
      )}

      <ConversationActions
        visible={actionTarget !== null}
        displayName={actionTarget?.participant.fullName ?? 'this person'}
        pinned={Boolean(actionTarget?.pinnedAt)}
        archived={Boolean(actionTarget?.archivedAt)}
        muted={Boolean(actionTarget?.mutedAt)}
        blocked={blockedUsers.some((u) => u.id === actionTarget?.participant.id)}
        onClose={() => setActionTarget(null)}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        onToggleMute={toggleMute}
        // Search from the inbox would re-enter the screen that is already showing
        // search; the per-conversation search lives in the thread, where it has a
        // transcript to jump around in. The `search` flag tells the thread to open
        // it on arrival, so this does what the menu item says it does.
        onSearch={() => {
          const target = actionTarget;
          setActionTarget(null);
          if (!target) return;
          router.push({
            pathname: '/messages/[id]',
            params: { id: target.id, search: '1' },
          });
        }}
        onBlock={confirmBlock}
        onUnblock={confirmUnblock}
        onReport={reportConversation}
      />

      <SafetyReportSheet
        visible={reportTarget !== null}
        target={reportTarget}
        onSubmitted={(message) => toast.success(message)}
        onError={(message) => toast.error(message)}
        onClose={() => setReportTarget(null)}
      />
    </View>
  );
}

/** "Active now" / "Last seen …", or nothing when the person has opted out. */
function ActivityLine({
  conversation,
  activityFor,
}: {
  conversation: Conversation;
  activityFor: (conversation: Conversation) => { isOnline: boolean; label: string } | null;
}) {
  const { colors } = useTheme();
  const activity = activityFor(conversation);
  if (!activity) return null;

  return (
    <View style={styles.activity}>
      <View
        style={[
          styles.activityDot,
          { backgroundColor: activity.isOnline ? '#22C55E' : colors.textSubtle },
        ]}
      />
      <Text style={[typography.caption, { color: colors.textSubtle }]}>{activity.label}</Text>
    </View>
  );
}

/** One search hit: who it is, and which message matched. */
function SearchResultRow({
  result,
  needle,
  onPress,
}: {
  result: ConversationSearchResult;
  needle: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  /**
   * What to show under the name.
   *
   * The matched message when the hit was on something said, because a result that
   * shows the thread's newest message instead makes every hit look identical and
   * gives the user nothing to search within once they open it. When the hit was on
   * the person's name there is no snippet, so the latest message stands in as
   * context.
   */
  const snippet = result.matchedMessageContent
    ? result.matchedMessageContent
    : messagePreview(result.lastMessage);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${result.participant.fullName}`}
      style={({ pressed }) => [
        styles.searchRow,
        {
          backgroundColor: pressed ? colors.surfaceAlt : 'transparent',
          borderBottomColor: colors.border,
        },
      ]}
    >
      <Avatar uri={result.participant.avatarUrl} name={result.participant.fullName} size={44} />

      <View style={styles.searchBody}>
        <View style={styles.searchTop}>
          <Text style={[typography.bodyStrong, styles.searchName, { color: colors.text }]} numberOfLines={1}>
            {result.participant.fullName}
          </Text>
          {result.lastMessageAt ? (
            <Text style={[typography.caption, { color: colors.textSubtle }]}>
              {timeAgo(result.lastMessageAt)}
            </Text>
          ) : null}
        </View>

        <Text style={[typography.small, { color: colors.textMuted }]} numberOfLines={2}>
          {result.matchedMessageContent ? (
            <Highlighted text={snippet} needle={needle} />
          ) : (
            snippet
          )}
        </Text>

        {result.archivedAt ? (
          <View style={[styles.archivedTag, { backgroundColor: colors.surfaceAlt }]}>
            <Archive size={10} color={colors.textSubtle} />
            <Text style={[typography.caption, { color: colors.textSubtle }]}>Archived</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countDot: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 17,
    height: 17,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  countText: {
    fontSize: 9.5,
    fontWeight: '800',
    lineHeight: 12,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.xs,
  },
  closeButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchHint: {
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    lineHeight: 18,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBody: {
    flex: 1,
    gap: 3,
  },
  searchTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchName: {
    flex: 1,
  },
  archivedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    marginTop: 2,
  },
  activity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingLeft: 62,
    marginTop: -2,
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
  },
  skeletons: {
    padding: spacing.base,
  },
});