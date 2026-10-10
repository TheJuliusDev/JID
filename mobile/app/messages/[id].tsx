/**
 * Chat thread.
 *
 * ## Shape of this screen
 *
 * All state lives in `useThread` (see `hooks/useThread.ts`); this file is
 * presentation plus the handful of decisions that genuinely belong to the screen —
 * which conversation is open, what the composer is replying to, which overlay is
 * showing. Every subscription, upload and optimistic row is owned by the hook and
 * torn down by it, so leaving a conversation cannot leak a Realtime channel.
 *
 * ## Rendering the transcript
 *
 * A `FlatList`, inverted, rather than a `ScrollView` mapped top-to-bottom. Three
 * reasons that matter at this feature level:
 *
 *  1. **History paging.** `onEndReached` pulls older pages in without holding the
 *     whole thread in memory, so a five-year-old conversation stays smooth.
 *  2. **Jump-to-message.** Search results and reply quotes both need to scroll to
 *     an arbitrary index. With an inverted list that is `scrollToIndex` against a
 *     known offset; with a `ScrollView` it is a hand-rolled measurement pass.
 *  3. **Performance.** Only visible rows are mounted, so read receipts, ticks and
 *     voice waveforms do not all animate at once in a long thread.
 *
 * Inverted means `data` is newest-first, which is exactly the order the transcript
 * reads in, and it makes "stick to the bottom" the default rather than something
 * to be fought for on every content-size change.
 *
 * ## Keyboard
 *
 * The composer sits outside the list but inside a `KeyboardAvoidingView`, and the
 * list's bottom padding grows while the keyboard is up. On Android `adjustResize`
 * plus the insets is enough; on iOS the padding is what keeps the composer above
 * the keyboard rather than behind it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Animated as RNAnimated,
  type ListRenderItemInfo,
} from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image as ImageIcon } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';

import { useTheme } from '@/providers/ThemeProvider';
import { useAuth } from '@/providers/AuthProvider';
import { useData } from '@/providers/DataProvider';
import { useMessaging } from '@/providers/MessagingProvider';
import { useToast } from '@/providers/ToastProvider';
import { useThread, useThreadSearch } from '@/hooks/useThread';
import { quickRepliesFor } from '@/constants/quickReplies';
import { humanizeError } from '@/services/supabase';
import { UploadError } from '@/services/cloudinary';
import { messagePreview } from '@/services/messaging/codec';
import { setConversationMuted } from '@/services/messaging/conversations';
import { isBlockedBetween, type SafetyReportTarget } from '@/services/messaging/safety';
import { radius, spacing, typography } from '@/constants/theme';
import { Avatar } from '@/components/ui/Card';
import { BackButton } from '@/components/ui/Button';
import { EmptyState, LoadingState } from '@/components/ui/States';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { Composer } from '@/components/chat/Composer';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { MessageActions } from '@/components/chat/MessageActions';
import { ConversationActions } from '@/components/chat/ConversationActions';
import { SafetyReportSheet } from '@/components/chat/SafetyReportSheet';
import { ThreadSearch } from '@/components/chat/ThreadSearch';
import { PhotoBubble } from '@/components/chat/PhotoBubble';
import { PhotoViewer } from '@/components/media/PhotoViewer';
import { useKeyboardVisible, useStableCallback } from '@/hooks';
import { nairaCompact } from '@/utils/format';
import { shortTime } from '@/utils/time';
import type { Conversation, Message } from '@/types';
import type { ThreadItem } from '@/utils/chatPhotos';

/** Messages from one sender within this window share a bubble group. */
const GROUP_WINDOW_MS = 2 * 60 * 1000;

/**
 * A fresh transcript row settles in with a short fade, a lean-in scale and a
 * gentle rise, so an arriving message reads as material easing into place
 * rather than popping onto the list.
 */
const rowEntry: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: {
      opacity: 0,
      transform: [{ scale: 0.97 }, { translateY: 10 }],
    },
    animations: {
      opacity: withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }),
      transform: [
        { scale: withTiming(1, { duration: 240, easing: Easing.out(Easing.cubic) }) },
        { translateY: withTiming(0, { duration: 240, easing: Easing.out(Easing.cubic) }) },
      ],
    },
  };
};

/** Removed rows (deleted-for-me) fade out instead of vanishing in place. */
const rowExit = FadeOut.duration(160);

export default function MessageThreadScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();
  const { profile } = useAuth();
  const { conversations, markConversationRead, setActiveConversationId, refreshConversations } =
    useData();
  const { capabilities, pinConversation, archiveConversation, block, unblock, blockedUsers } =
    useMessaging();

  // `searchParam`, not `search`: `search` is already the `useThreadSearch` handle in
  // this scope.
  const { id, search: searchParam } = useLocalSearchParams<{ id?: string; search?: string }>();
  const conversationId = Array.isArray(id) ? id[0] : id;

  /**
   * Opens search immediately when arriving from the inbox's "Search in
   * conversation" menu item.
   *
   * The flag is read once per arrival rather than watched continuously: search is
   * opened by a navigation that carries the flag, not by a property of the thread,
   * so re-opening on every focus would trap the user in the search sheet with no
   * way to dismiss it. Reading it in an effect keyed on the conversation means a
   * later focus with the same params does not fight the user.
   */
  const searchRequested = searchParam === '1';
  const handledSearchRequest = useRef(false);

  const keyboardVisible = useKeyboardVisible();
  const listRef = useRef<FlatList<ThreadItem>>(null);

  // --- Local UI state ----------------------------------------------------
  /** The message being replied to, or null. */
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  /** Quick replies can be dismissed for the rest of this thread's visit. */
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const [searching, setSearching] = useState(false);
  /** Message the action sheet is acting on. */
  const [actionTarget, setActionTarget] = useState<Message | null>(null);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [conversationActionsOpen, setConversationActionsOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<SafetyReportTarget | null>(null);
  /** Photo currently open in the full-screen viewer. */
  const [viewer, setViewer] = useState<{ images: string[]; index: number } | null>(null);
  /** Local mirror of "I have blocked them", so the composer can go inert. */
  const [blockedByMe, setBlockedByMe] = useState(false);
  /** Whether the *other* person blocked us. Checked once on open. */
  const [blockedFromUs, setBlockedFromUs] = useState(false);

  const conversation: Conversation | undefined = useMemo(
    () => conversations.find((c) => c.id === conversationId),
    [conversations, conversationId],
  );

  const participant = conversation?.participant;

  /**
   * Binds the other participant's id into the hook.
   *
   * Presence and typing both need to know who "the other person" is, and that only
   * arrives with the inbox row. Done in an effect rather than during render so the
   * hook sees a stable value across a single pass.
   */
  const thread = useThread({
    conversationId,
    self: profile ? { id: profile.id, name: profile.fullName } : null,
    capabilities: {
      richMessages: capabilities.richMessages,
      replies: capabilities.replies,
    },
    participantLastSeen: {
      lastSeenAt: participant?.lastSeenAt ?? null,
      visible: participant?.lastSeenVisible !== false,
    },
    onInbound: useStableCallback(() => {
      void refreshConversations();
    }),
  });

  const search = useThreadSearch(conversationId);

  /**
   * Row keys that were already on screen when the thread hydrated. Only rows
   * whose key arrives *after* that — a send, a realtime echo, a photo landing —
   * play the entry animation, so opening a thread does not cascade its whole
   * history, and scrolling back does not re-animate every message.
   */
  const knownKeys = useRef<Set<string> | null>(null);
  if (knownKeys.current === null && thread.items.length > 0) {
    knownKeys.current = new Set(thread.items.map(keyOf));
  }

  // Backfill keys after a paging batch lands, so history pages stay silent when
  // their rows are eventually scrolled into view.
  useEffect(() => {
    if (!knownKeys.current) return;
    for (const item of thread.items) knownKeys.current.add(keyOf(item));
  }, [thread.items]);

  // Registering the thread as "the one being read" keeps its unread count out of
  // the tab badge, and unregisters on the way out so the count comes back.
  useEffect(() => {
    if (!conversationId) return;
    setActiveConversationId(conversationId);
    return () => setActiveConversationId(null);
  }, [conversationId, setActiveConversationId]);

  // Opening the conversation is what marks it read. Done on focus rather than only
  // on mount, so returning from the image viewer or a nested screen is enough.
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      void markConversationRead(conversationId);
      thread.onForeground();
      // `thread` is a fresh object each render; `onForeground` is stable.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [conversationId, markConversationRead]),
  );

  /** Is this account blocking the other participant? */
  useEffect(() => {
    if (!participant) return;
    setBlockedByMe(blockedUsers.some((u) => u.id === participant.id));
  }, [participant, blockedUsers]);

  /**
   * Whether the *other* person blocked us.
   *
   * Checked once on open. A block by the other party is not something the app can
   * be notified about, and asking on every render would be a network call per
   * keystroke's worth of re-render.
   */
  useEffect(() => {
    if (!participant) return;
    let cancelled = false;
    void isBlockedBetween(participant.id)
      .then((blocked) => {
        if (!cancelled) setBlockedFromUs(blocked);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [participant?.id]);

  const blocked = blockedByMe || blockedFromUs;

  // --- Transcript helpers -------------------------------------------------

  /**
   * Grouping flags for one row.
   *
   * `items` is newest-first, so "the previous item" in reading order is the *next*
   * element in the array. Getting this backwards makes every bubble look grouped,
   * which reads as a rendering bug rather than as grouping.
   */
  const groupFlags = useCallback(
    (item: ThreadItem, index: number): { isGrouped: boolean; isGroupTail: boolean } => {
      const next = thread.items[index + 1];
      if (!next) return { isGrouped: false, isGroupTail: true };

      const mine = senderOf(item) === profile?.id;
      const nextMine = senderOf(next) === profile?.id;
      if (mine !== nextMine) return { isGrouped: false, isGroupTail: true };

      const at = createdAtOf(item);
      const nextAt = createdAtOf(next);
      const within = Math.abs(new Date(at).getTime() - new Date(nextAt).getTime()) <= GROUP_WINDOW_MS;

      const after = thread.items[index + 2];
      const afterAt = after ? createdAtOf(after) : null;

      // The tail is the last bubble of a run, and it is the one carrying meta.
      const isGroupTail =
        !afterAt || Math.abs(new Date(at).getTime() - new Date(afterAt).getTime()) > GROUP_WINDOW_MS;

      return { isGrouped: within, isGroupTail };
    },
    [thread.items, profile?.id],
  );

  /** Remote photos in the thread, newest first, for the viewer's pager. */
  const remotePhotos = useMemo(
    () =>
      thread.messages
        .filter((m) => !m.deletedAt && !m.deletedForEveryoneAt)
        .map((m) => m.mediaUrl)
        .filter((url): url is string => Boolean(url && /^https?:\/\//.test(url))),
    [thread.messages],
  );

  const openViewer = useCallback(
    (url: string) => {
      const images = remotePhotos.length > 0 ? remotePhotos : [url];
      setViewer({ images, index: Math.max(0, images.indexOf(url)) });
    },
    [remotePhotos],
  );

  /**
   * Scrolls the inverted list to a message.
   *
   * `scrollToIndex` throws if the target row has not been measured yet, which is
   * the normal case for a message far up a paged history. The failure handler
   * retries once at an average row height, then gives up silently — a search hit
   * that cannot be scrolled to exactly should still not break the thread.
   */
  const scrollToMessage = useCallback(
    (message: Message) => {
      const index = thread.items.findIndex(
        (item) => item.type === 'message' && item.message.id === message.id,
      );

      if (index < 0) {
        toast.error('That message is further back in this chat.');
        return;
      }

      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
      });
    },
    [thread.items, toast],
  );

  /** A search result was chosen: leave search, then land on the hit. */
  const onSelectSearchResult = useCallback(
    (message: Message) => {
      setSearching(false);
      search.clear();
      scrollToMessage(message);
    },
    [search, scrollToMessage],
  );

  /**
   * `onScrollToIndexFailed` fallback.
   *
   * Fires when a row outside the render window is requested. Scrolling to a
   * plausible average offset gets the target into the window, after which the
   * retry succeeds and lands accurately.
   */
  const onScrollToIndexFailed = useStableCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: false,
      });
    },
  );

  // --- Actions -----------------------------------------------------------

  const sendText = useCallback(
    (text: string) => {
      thread.sendText(text, replyTo);
      setReplyTo(null);
    },
    [thread, replyTo],
  );

  const attachImages = useCallback(
    async (source: 'library' | 'camera') => {
      try {
        await thread.sendPhotos(source);
      } catch (error) {
        toast.error(
          error instanceof UploadError || error instanceof Error
            ? error.message
            : humanizeError(error),
        );
      }
    },
    [thread, toast],
  );

  const copyMessage = useCallback(
    async (message: Message) => {
      setActionsOpen(false);
      setActionTarget(null);
      const text = messagePreview(message);
      if (!text) return;
      await Clipboard.setStringAsync(text);
      toast.success('Message copied.');
    },
    [toast],
  );

  const confirmDeleteForMe = useCallback(
    (message: Message) => {
      setActionsOpen(false);
      setActionTarget(null);
      Alert.alert('Delete for me?', 'This removes the message from your side only.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void thread.deleteForMe(message),
        },
      ]);
    },
    [thread],
  );

  const confirmDeleteForEveryone = useCallback(
    (message: Message) => {
      setActionsOpen(false);
      setActionTarget(null);
      Alert.alert(
        'Delete for everyone?',
        'The message is removed for you and for the person you sent it to. This cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              void thread
                .deleteForEveryone(message)
                .catch(() => toast.error('That message can no longer be deleted for everyone.'));
            },
          },
        ],
      );
    },
    [thread, toast],
  );

  const reportMessage = useCallback(
    (message: Message) => {
      setActionsOpen(false);
      setActionTarget(null);
      if (!participant || !conversationId) return;
      setReportTarget({
        type: 'message',
        userId: message.senderId,
        conversationId,
        messageId: message.id,
        displayName: participant.fullName,
      });
    },
    [participant, conversationId],
  );

  const confirmBlock = useCallback(() => {
    setActionsOpen(false);
    setActionTarget(null);
    setConversationActionsOpen(false);
    if (!participant) return;

    Alert.alert(
      `Block ${participant.fullName}?`,
      'They will not be able to message you or see your profile. They are not told that you blocked them.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            void block(participant.id);
            setBlockedByMe(true);
          },
        },
      ],
    );
  }, [participant, block]);

  const confirmUnblock = useCallback(() => {
    setConversationActionsOpen(false);
    if (!participant) return;
    void unblock(participant.id).then(() => setBlockedByMe(false));
  }, [participant, unblock]);

  const togglePin = useCallback(() => {
    if (!conversation) return;
    void pinConversation(conversation.id, !conversation.pinnedAt);
  }, [conversation, pinConversation]);

  /**
   * Leaves the thread, popping the stack when there is one and falling back to
   * the inbox when the screen was opened cold (deep link, push notification), so
   * a back press never hits an empty navigator.
   */
  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/messages');
  }, [router]);

  const toggleArchive = useCallback(() => {
    if (!conversation) return;
    // Archiving removes the thread from the inbox, which also removes it from
    // under this screen — so leave rather than render an empty conversation.
    const archiving = !conversation.archivedAt;
    void archiveConversation(conversation.id, archiving);
    if (archiving) goBack();
  }, [conversation, archiveConversation, goBack]);

  const toggleMute = useCallback(() => {
    if (!conversation) return;
    void setConversationMuted(conversation.id, !conversation.mutedAt).catch((error) =>
      toast.error(humanizeError(error)),
    );
    void refreshConversations();
  }, [conversation, toast, refreshConversations]);

  const openSearch = useCallback(() => {
    setConversationActionsOpen(false);
    setSearching(true);
  }, []);

  // Honour the arrival flag exactly once per thread.
  useEffect(() => {
    if (!searchRequested || handledSearchRequest.current) return;
    handledSearchRequest.current = true;
    setSearching(true);
  }, [searchRequested]);

  const closeSearch = useCallback(() => {
    setSearching(false);
    search.clear();
  }, [search]);

  // --- Render ------------------------------------------------------------

  const quickReplies = useMemo(() => {
    if (!showQuickReplies) return undefined;
    return quickRepliesFor(conversation?.listingRef?.type);
  }, [showQuickReplies, conversation?.listingRef?.type]);

  /**
 * Day separators.
 *
 * Rendered at the boundary *between* two days rather than above every message: a
 * chip between two messages from the same afternoon is noise. An item gets a
 * separator when the next-older item falls on a different day, which — because the
 * list is inverted and each cell is individually flipped — means it belongs as the
 * cell's first child, putting it visually between this message and the older ones.
 */
const daySeparatorFor = useCallback(
    (item: ThreadItem, index: number): string | null => {
      const at = createdAtOf(item);
      const previous = thread.items[index + 1];
      if (!previous) return null;

      const previousAt = createdAtOf(previous);
      const sameDay = new Date(at).toDateString() === new Date(previousAt).toDateString();
      return sameDay ? null : dayLabel(at);
    },
    [thread.items],
  );

const renderItem = useCallback(
    ({ item, index }: ListRenderItemInfo<ThreadItem>) => {
      const { isGrouped, isGroupTail } = groupFlags(item, index);
      const day = daySeparatorFor(item, index);

      // Fresh rows (sent, echoed, uploaded) ease in; the initially-loaded page
      // and paged history stay put.
      const fresh = !knownKeys.current?.has(keyOf(item));

      const separator = day ? (
        <View style={styles.dayChipRow}>
          <View style={[styles.dayChip, { backgroundColor: colors.surfaceAlt }]}>
            <Text style={[typography.caption, { color: colors.textMuted }]}>{day}</Text>
          </View>
        </View>
      ) : null;

      // A photo still uploading, or one that failed. Not a `Message` — see the
      // note in `MessageBubble`.
      if (item.type === 'photo') {
        const mine = item.photo.senderId === profile?.id;
        return (
          <Animated.View entering={fresh ? rowEntry : undefined} exiting={rowExit}>
            {separator}
            <View
              style={[
                styles.row,
                mine ? styles.rowMine : styles.rowTheirs,
                !isGrouped && styles.spaced,
              ]}
            >
              <View style={styles.bubbleColumn}>
                <PhotoBubble
                  uri={item.photo.localUri}
                  pending={item.photo.status === 'uploading'}
                  progress={item.photo.progress}
                  error={item.photo.status === 'failed' ? item.photo.error : undefined}
                  canOpen={false}
                  onPress={() => undefined}
                  onRetry={() => thread.retry(item.photo.clientId)}
                  footer={
                    <Text
                      style={[typography.caption, styles.photoTime, { color: colors.textSubtle }]}
                    >
                      {shortTime(item.photo.createdAt)}
                    </Text>
                  }
                />
              </View>
            </View>
          </Animated.View>
        );
      }

      const message = item.message;
      const mine = message.senderId === profile?.id;

      return (
        <Animated.View entering={fresh ? rowEntry : undefined} exiting={rowExit}>
          {separator}
          <MessageBubble
            message={message}
            mine={mine}
            showSender
            senderName={participant?.fullName ?? 'Them'}
            senderAvatar={participant?.avatarUrl}
            isGrouped={isGrouped}
            isGroupTail={isGroupTail}
            onPress={() => setReplyTo(message)}
            onLongPress={() => {
              setActionTarget(message);
              setActionsOpen(true);
            }}
            onRetry={() => thread.retry(message.clientId ?? message.id)}
            onOpenPhoto={openViewer}
          />
        </Animated.View>
      );
    },
    [
      colors,
      daySeparatorFor,
      groupFlags,
      openViewer,
      participant,
      profile?.id,
      thread,
    ],
  );

  const transcriptStyle = useMemo(
    () => ({
      paddingHorizontal: spacing.base,
      // Extra bottom padding while the keyboard is up keeps the newest bubble clear
      // of the composer instead of tucked behind it.
      paddingBottom: keyboardVisible ? spacing.base : insets.bottom + spacing.sm,
    }),
    [keyboardVisible, insets.bottom],
  );

  const blockedHint = blockedByMe
    ? 'You blocked this person. Unblock them from the chat menu to send messages again.'
    : blockedFromUs
      ? 'You can no longer send messages in this chat.'
      : undefined;

  const emptyTranscript =
    thread.loading || thread.items.length > 0 ? null : (
      <EmptyState
        title={`Say hello to ${participant?.fullName?.split(' ')[0] ?? 'them'}`}
        message="Ask about the item or room, send a photo, or hold the mic for a voice note."
      />
    );

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {searching ? (
        <ThreadSearch
          query={search.query}
          onChangeQuery={search.setQuery}
          onClose={closeSearch}
          results={search.results}
          searching={search.searching}
          selfId={profile?.id}
          participantName={participant?.fullName ?? 'Them'}
          onSelectResult={onSelectSearchResult}
        />
      ) : (
        <View style={{ paddingTop: insets.top }}>
          <ChatHeader
            name={participant?.fullName ?? 'Conversation'}
            avatarUrl={participant?.avatarUrl}
            username={participant?.username}
            presence={thread.presence}
            typing={thread.typing}
            showLastSeen
            blocked={blocked}
            onBack={goBack}
            onOpenProfile={
              participant?.username ? () => router.push(`/user/${participant.username}`) : undefined
            }
            onSearch={openSearch}
            onOpenActions={() => setConversationActionsOpen(true)}
          />
        </View>
      )}

      {conversation?.listingRef && !searching ? (
        <Pressable
          onPress={() =>
            router.push(`/listing/${conversation.listingRef!.type}/${conversation.listingRef!.id}`)
          }
          accessibilityRole="button"
          accessibilityLabel={`About ${conversation.listingRef.title}`}
          style={({ pressed }) => [
            styles.listingRef,
            {
              backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          <ImageIcon size={14} color={colors.textMuted} />
          <Text style={[typography.caption, styles.listingText]} numberOfLines={1}>
            <Text style={{ color: colors.brand }}>{conversation.listingRef.title}</Text>
            {' · '}
            {nairaCompact(conversation.listingRef.price)}
          </Text>
        </Pressable>
      ) : null}

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 44 : 0}
      >
        {thread.loading ? (
          <LoadingState label="Loading messages" />
        ) : (
          <FlatList
            ref={listRef}
            data={thread.items}
            inverted
            keyExtractor={keyOf}
            renderItem={renderItem}
            contentContainerStyle={transcriptStyle}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
            onEndReached={() => void thread.loadOlder()}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={emptyTranscript}
            ListFooterComponent={
              thread.loadingMore ? (
                <View style={styles.paging}>
                  <ActivityIndicator size="small" color={colors.textSubtle} />
                </View>
              ) : null
            }
            onScrollToIndexFailed={onScrollToIndexFailed}
          />
        )}

        {/**
         * Offline / load-failure banner.
         *
         * Sits above the composer rather than replacing the transcript: a network
         * blip must not throw away a conversation the user is reading, and the
         * messages already on screen are still valid.
         */}
        {thread.offline && !thread.loading ? (
          <Pressable
            onPress={() => void thread.reload()}
            accessibilityRole="button"
            accessibilityLabel="Connection problem. Tap to retry."
            style={[styles.banner, { backgroundColor: colors.warningSoft, borderTopColor: colors.warningBorder }]}
          >
            <Text style={[typography.caption, { color: colors.warning }]} numberOfLines={2}>
              {thread.error} Tap to try again.
            </Text>
          </Pressable>
        ) : null}

        <Composer
          disabled={blocked}
          disabledHint={blockedHint}
          replyTo={replyTo}
          photos={thread.photos}
          quickReplies={quickReplies}
          onSendText={sendText}
          onPickImage={() => void attachImages('library')}
          onCaptureImage={() => void attachImages('camera')}
          onSendVoice={(clip) => thread.sendVoice(clip)}
          onCancelReply={() => setReplyTo(null)}
          onJumpToReply={replyTo ? () => scrollToMessage(replyTo) : undefined}
          onCancelPhoto={thread.cancelPhoto}
          onDismissQuickReplies={() => setShowQuickReplies(false)}
          onError={(message) => toast.error(message)}
        />
      </KeyboardAvoidingView>

      {/* Typing sits under the transcript, above the composer, so it never moves
          the input row the user is typing into. */}
      {thread.typing && !searching ? (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[
            styles.typingBar,
            { backgroundColor: colors.bgElevated, borderTopColor: colors.border },
          ]}
          pointerEvents="none"
        >
          <View style={styles.typingDots}>
            <TypingDot delay={0} />
            <TypingDot delay={160} />
            <TypingDot delay={320} />
          </View>
          <Text style={[typography.caption, { color: colors.textMuted }]}>
            {thread.typing.name.split(' ')[0]} is typing
          </Text>
        </Animated.View>
      ) : null}

      <PhotoViewer
        visible={viewer !== null}
        images={viewer?.images ?? []}
        index={viewer?.index ?? 0}
        onClose={() => setViewer(null)}
      />

      <MessageActions
        visible={actionsOpen}
        message={actionTarget}
        mine={actionTarget?.senderId === profile?.id}
        onClose={() => {
          setActionsOpen(false);
          setActionTarget(null);
        }}
        onReply={(message) => {
          setActionsOpen(false);
          setActionTarget(null);
          setReplyTo(message);
        }}
        onCopy={copyMessage}
        onDeleteForMe={confirmDeleteForMe}
        onDeleteForEveryone={confirmDeleteForEveryone}
        onReport={reportMessage}
        onBlockUser={confirmBlock}
      />

      <ConversationActions
        visible={conversationActionsOpen}
        displayName={participant?.fullName ?? 'this person'}
        pinned={Boolean(conversation?.pinnedAt)}
        archived={Boolean(conversation?.archivedAt)}
        muted={Boolean(conversation?.mutedAt)}
        blocked={blockedByMe}
        onClose={() => setConversationActionsOpen(false)}
        onTogglePin={togglePin}
        onToggleArchive={toggleArchive}
        onToggleMute={toggleMute}
        onSearch={openSearch}
        showSearch={false}
        onBlock={confirmBlock}
        onUnblock={confirmUnblock}
        onReport={() => {
          setConversationActionsOpen(false);
          if (!participant || !conversationId) return;
          setReportTarget({
            type: 'conversation',
            userId: participant.id,
            conversationId,
            displayName: participant.fullName,
          });
        }}
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

/**
 * Stable key across the placeholder → real-row transition.
 *
 * The optimistic row is keyed by `client_id`, and the realtime echo of the same
 * send carries that same `client_id`, so a message cell is not remounted (and its
 * entry animation not replayed) when the pending placeholder is swapped for the
 * confirmed row. Rows without a client id — anything the web app wrote — fall
 * back to their database id.
 */
function keyOf(item: ThreadItem): string {
  if (item.type === 'message') return item.message.clientId ?? item.message.id;
  return `photo-${item.photo.clientId}`;
}

/**
 * Who sent a transcript row.
 *
 * A photo placeholder is not a `Message` — it exists only while its bytes upload —
 * so its sender lives one level deeper. Normalising here keeps every caller in this
 * screen from repeating the same narrowing ternary.
 */
function senderOf(item: ThreadItem): string {
  return item.type === 'message' ? item.message.senderId : item.photo.senderId;
}

/** When a transcript row was created, for both real messages and placeholders. */
function createdAtOf(item: ThreadItem): string {
  return item.type === 'message' ? item.message.createdAt : item.photo.createdAt;
}

/** "Today" / "Yesterday" / a date, for the transcript separators. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  if (date.toDateString() === today) return 'Today';
  if (date.toDateString() === yesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * One of three animated dots.
 *
 * A single shared opacity would make all three pulse in unison, which reads as a
 * single blinking blob rather than as typing. The staggered delay is what makes it
 * legible as "someone is composing".
 */
function TypingDot({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const opacity = useRef(new RNAnimated.Value(0.3)).current;

  useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(opacity, {
          toValue: 1,
          duration: 380,
          delay,
          useNativeDriver: true,
        }),
        RNAnimated.timing(opacity, {
          toValue: 0.3,
          duration: 380,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity, delay]);

  return (
    <RNAnimated.View
      style={[styles.dot, { backgroundColor: colors.brand, opacity }]}
    />
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  listingRef: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  listingText: {
    flex: 1,
    color: undefined,
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 1,
  },
  rowMine: {
    justifyContent: 'flex-end',
    paddingLeft: 52,
  },
  rowTheirs: {
    justifyContent: 'flex-start',
    paddingRight: 52,
  },
  spaced: {
    marginTop: spacing.sm,
  },
  bubbleColumn: {
    maxWidth: '86%',
  },
  dayChipRow: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  dayChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  photoTime: {
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  paging: {
    paddingVertical: spacing.base,
    alignItems: 'center',
  },
  banner: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  typingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  typingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: radius.pill,
  },
});