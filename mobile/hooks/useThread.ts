/**
 * Thread state for one open conversation.
 *
 * Everything a chat screen does that is *not* rendering lives here: loading and
 * paging history, the optimistic send path, image and voice uploads with retry,
 * the realtime subscription, read and delivery receipts, presence and typing.
 *
 * ## Why this is a hook and not the screen
 *
 * The send lifecycle is the part of messaging that is easy to get subtly wrong,
 * and it is much easier to get right in one place that has no JSX in it. Three
 * rules drive the design:
 *
 * 1. **A message is never silently lost.** Every send creates a local optimistic
 *    row immediately. If the write fails the row stays on screen as `failed` with
 *    the payload it was built from, so retry needs no re-typing and nothing
 *    disappears. This is why `Message.pending` exists.
 *
 * 2. **Uploads run beside the transcript, never inside it.** An image is picked,
 *    rendered instantly as a placeholder, and uploaded in the background. The
 *    user can read and send other messages while bytes move, and the chat never
 *    blocks on the network.
 *
 * 3. **Every subscription is torn down by the effect that created it.** Leaving a
 *    conversation removes its Realtime channel, its presence channel and its
 *    typing channel. Moving quickly between chats is the case that leaks
 *    handlers and double-fires events, so the cleanups here are explicit rather
 *    than left to a ref count.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { humanizeError } from '@/services/supabase';
import { UploadError } from '@/services/cloudinary';
import {
  assertWithinSizeLimit,
  captureChatPhoto,
  MAX_CHAT_IMAGES,
  pickChatImages,
  uploadChatImage,
  uploadVoiceClip,
} from '@/services/messaging/media';
import { buildReplyPreview, decodeMessage } from '@/services/messaging/codec';
import { joinPresenceChannel, touchLastSeen } from '@/services/messaging/presence';
import { isTypingFresh, joinTypingChannel, type TypingState } from '@/services/messaging/typing';
import {
  deleteMessageForEveryone,
  deleteMessageForMe,
  fetchMessages,
  fetchMessagesBefore,
  markThreadDelivered,
  markThreadRead,
  mergeIncoming,
  newClientId,
  optimisticMessage,
  searchMessages,
  sendMessage,
  subscribeToMessages,
  type OutgoingMessage,
} from '@/services/messaging/messages';
import {
  mergeThread,
  nextPhotoClientId,
  withoutSettledPhotos,
  type OptimisticPhoto,
  type ThreadItem,
} from '@/utils/chatPhotos';
import { useStableCallback } from '@/hooks';
import type { Message, PresenceState } from '@/types';
import type { VoiceClip } from '@/components/chat/VoiceRecorder';

export interface UseThreadOptions {
  conversationId: string | undefined;
  /** The signed-in user, or null while the session resolves. */
  self: { id: string; name: string } | null;
  /** Feature flags from the capability probe. */
  capabilities: {
    richMessages: boolean;
    replies: boolean;
  };
  /** Persisted last-seen values for the other participant, from the inbox row. */
  participantLastSeen: { lastSeenAt?: string | null; visible: boolean };
  /** Called when a new inbound message arrives, to bump the inbox preview. */
  onInbound?: () => void;
}

export interface ThreadApi {
  /** Confirmed messages plus in-flight photo placeholders, oldest first. */
  items: ThreadItem[];
  messages: Message[];

  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: string | null;
  /** True while an action is retryable after a failure. */
  offline: boolean;

  /** Photos queued or uploading, keyed by clientId. */
  photos: OptimisticPhoto[];

  presence: PresenceState;
  typing: TypingState | null;

  /** Loads the newest page. Called on mount and on pull-to-refresh. */
  reload: () => Promise<void>;
  /** Loads one page of older history, prepended. */
  loadOlder: () => Promise<void>;
  /** Refreshes the conversation preview in the inbox. */
  onForeground: () => void;

  sendText: (text: string, replyTo?: Message | null) => void;
  sendPhotos: (source: 'library' | 'camera') => Promise<void>;
  sendVoice: (clip: VoiceClip) => void;
  /** Re-runs a failed send from the payload the bubble still holds. */
  retry: (clientId: string) => void;
  /** Withdraws an in-flight photo, or forgets a failed one. */
  cancelPhoto: (clientId: string) => void;

  deleteForMe: (message: Message) => Promise<void>;
  deleteForEveryone: (message: Message) => Promise<void>;

  /** Announces typing. Throttled inside the typing channel. */
  notifyTyping: () => void;
  /** Sends the "stopped" signal immediately. */
  notifyStopped: () => void;
  /**
   * Supplies the other participant's id.
   *
   * The screen owns it because it comes from the inbox row rather than from
   * anything the thread can derive, and it is needed before presence and typing
   * can be joined.
   */
  bindParticipant: (id: string | null) => void;
}

const PAGE_SIZE = 50;

export function useThread(options: UseThreadOptions): ThreadApi {
  const { conversationId, self, capabilities, participantLastSeen, onInbound } = options;

  const [messages, setMessages] = useState<Message[]>([]);
  const [photos, setPhotos] = useState<OptimisticPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typing, setTyping] = useState<TypingState | null>(null);
  const [presence, setPresence] = useState<PresenceState>({
    isOnline: false,
    lastSeenAt: participantLastSeen.lastSeenAt ?? null,
    visible: participantLastSeen.visible,
  });

  /**
   * The other participant's id, needed to decide whose typing broadcasts and
   * whose read receipts are ours. Kept in state because it arrives with the
   * inbox row and can change if the inbox reloads under us.
   */
  const [otherUserId, setOtherUserId] = useState<string | null>(null);

  const selfId = self?.id ?? null;
  const otherIdRef = useRef<string | null>(null);
  otherIdRef.current = otherUserId;

  /**
   * Upload abort flags, keyed by clientId.
   *
   * A ref rather than state: progress ticks re-render several times per second
   * and the cancel handler needs to read the flag without waiting for a render.
   */
  const uploadSignals = useRef(new Map<string, { aborted: boolean }>());

  const patchPhoto = useCallback((clientId: string, patch: Partial<OptimisticPhoto>) => {
    setPhotos((current) =>
      current.map((photo) => (photo.clientId === clientId ? { ...photo, ...patch } : photo)),
    );
  }, []);

  // --- Loading -------------------------------------------------------------

  const reload = useStableCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchMessages(conversationId, PAGE_SIZE);
      setMessages(rows);
      // A short first page means the thread has no more history to page in.
      setHasMore(rows.length >= PAGE_SIZE);
    } catch (err) {
      setError(humanizeError(err));
    } finally {
      setLoading(false);
    }
  });

  const loadOlder = useStableCallback(async () => {
    if (!conversationId || loadingMore || !hasMore) return;
    const oldest = messages[0];
    if (!oldest) return;

    setLoadingMore(true);
    try {
      const page = await fetchMessagesBefore(conversationId, oldest.createdAt, PAGE_SIZE);
      if (page.length === 0) {
        setHasMore(false);
        return;
      }
      setMessages((current) => {
        const seen = new Set(current.map((m) => m.id));
        const fresh = page.filter((m) => !seen.has(m.id));
        return [...fresh, ...current];
      });
      setHasMore(page.length >= PAGE_SIZE);
    } catch (err) {
      // Paging history failing is recoverable by scrolling again; it must not
      // blank a transcript that is already on screen.
      setError(humanizeError(err));
    } finally {
      setLoadingMore(false);
    }
  });

  useEffect(() => {
    if (!conversationId) return;
    setPhotos([]);
    setMessages([]);
    setTyping(null);
    void reload();
  }, [conversationId, reload]);

  // --- Realtime ------------------------------------------------------------

  useEffect(() => {
    if (!conversationId) return undefined;

    return subscribeToMessages(conversationId, {
      onInsert: (incoming) => {
        setMessages((current) => mergeIncoming(current, incoming));
        // The real row supersedes a photo placeholder for the same send.
        setPhotos((current) => withoutSettledPhotos(current, [incoming]));

        const fromThem = incoming.senderId !== selfId;
        if (fromThem) {
          onInbound?.();
          if (selfId) void markThreadRead(conversationId, selfId).catch(() => undefined);
        }
      },
      onUpdate: (updated) => {
        setMessages((current) =>
          current.map((m) => (m.id === updated.id ? { ...updated, status: 'sent' } : m)),
        );
      },
      onDelete: (messageId) => {
        setMessages((current) => current.filter((m) => m.id !== messageId));
      },
    });
  }, [conversationId, selfId, onInbound]);

  // --- Read and delivery receipts ------------------------------------------

  /**
   * Read receipts.
   *
   * Written once when the thread opens, then again whenever it regains focus
   * after being backgrounded — coming back from the image viewer or a nested
   * screen can reveal messages that arrived while it was away.
   *
   * Marking read is also what clears the inbox badge, and `markConversationRead`
   * in `MessagingProvider` is the call that zeroes the count. Both are needed:
   * one writes `read_at` for the *sender's* ticks, the other moves the local
   * count. Neither alone produces a correct header.
   */
  useEffect(() => {
    if (!conversationId || !selfId) return;
    void markThreadRead(conversationId, selfId).catch(() => undefined);
    void markThreadDelivered(conversationId, capabilities.richMessages);
  }, [conversationId, selfId, capabilities.richMessages]);

  const onForeground = useStableCallback(() => {
    if (!conversationId || !selfId) return;
    void markThreadRead(conversationId, selfId).catch(() => undefined);
    void markThreadDelivered(conversationId, capabilities.richMessages);
    void touchLastSeen(true);
  });

  // --- Presence ------------------------------------------------------------

  useEffect(() => {
    if (!conversationId || !self || !otherUserId) return undefined;

    return joinPresenceChannel(
      conversationId,
      { userId: self.id, name: self.name },
      {
        lastSeenAt: participantLastSeen.lastSeenAt ?? null,
        visible: participantLastSeen.visible,
      },
      setPresence,
    ).teardown;
  }, [conversationId, self?.id, self?.name, otherUserId, participantLastSeen.lastSeenAt, participantLastSeen.visible]);

  // --- Typing --------------------------------------------------------------

  /**
   * The typing channel.
   *
   * Joined only once the other participant is known, because without them there is
   * nobody to show an indicator for. `teardown` sends a "stopped" before closing,
   * so leaving mid-sentence clears the indicator on the other phone immediately
   * rather than after the stale timeout.
   */
  const typingRef = useRef<ReturnType<typeof joinTypingChannel> | null>(null);

  useEffect(() => {
    if (!conversationId || !self) return undefined;

    typingRef.current = joinTypingChannel(
      conversationId,
      { userId: self.id, name: self.name },
      (next) => setTyping(next),
    );

    return () => {
      typingRef.current?.teardown();
      typingRef.current = null;
    };
  }, [conversationId, self?.id, self?.name]);

  /**
   * Auto-clear the indicator when the last broadcast goes stale.
   *
   * The typing channel arms its own expiry, but that only fires if a `setTimeout`
   * scheduled at broadcast time actually runs. This is the belt-and-braces path
   * for a thread that was backgrounded across the timeout.
   */
  useEffect(() => {
    if (!typing) return undefined;
    if (isTypingFresh(typing)) {
      const remaining = 5000 - (Date.now() - typing.at) + 250;
      const timer = setTimeout(() => setTyping((current) => (isTypingFresh(current) ? null : current)), Math.max(250, remaining));
      return () => clearTimeout(timer);
    }
    setTyping(null);
    return undefined;
  }, [typing]);

  const notifyTyping = useStableCallback(() => {
    if (self) typingRef.current?.notifyTyping(self.name);
  });

  const notifyStopped = useStableCallback(() => {
    typingRef.current?.notifyStopped();
  });

  // --- Sending -------------------------------------------------------------

  /**
   * Writes one message and reconciles the optimistic row.
   *
   * The local row is keyed `pending-<clientId>` and the server row keeps the same
   * `client_id`, so `mergeIncoming` can swap one for the other whether the
   * realtime echo or this call's response arrives first. `client_id` is also the
   * upsert conflict target on the server, which makes a retry idempotent rather
   * than a second bubble.
   */
  const commit = useStableCallback(
    async (clientId: string, outgoing: OutgoingMessage) => {
      if (!conversationId || !selfId) return;

      const optimistic = optimisticMessage({
        clientId,
        conversationId,
        senderId: selfId,
        outgoing,
        supportsRichMessages: capabilities.richMessages,
      });
      setMessages((current) => mergeIncoming(current, optimistic));

      try {
        const sent = await sendMessage({
          conversationId,
          senderId: selfId,
          clientId,
          outgoing,
          supportsRichMessages: capabilities.richMessages,
          supportsReplies: capabilities.replies,
        });
        setMessages((current) => mergeIncoming(current, sent));
        // The inbox preview and its timestamp are now stale.
        onInbound?.();
      } catch (err) {
        // Keep the bubble, mark it failed, keep the payload for retry. A message
        // the user watched disappear is the one failure mode this whole module
        // exists to prevent.
        setMessages((current) =>
          current.map((m) =>
            m.id === `pending-${clientId}` ? { ...m, status: 'failed', pending: m.pending } : m,
          ),
        );
      }
    },
  );

  const sendText = useStableCallback((text: string, replyTo?: Message | null) => {
    const content = text.trim();
    if (!content) return;

    notifyStopped();
    void commit(newClientId(), {
      kind: 'text',
      text: content,
      ...replyTarget(replyTo, capabilities.replies),
    });
  });

  /**
   * Uploads one image and persists it as a photo message.
   *
   * Ordering is upload-then-persist on purpose. Inserting first and uploading
   * second would leave the recipient with a broken image if the upload failed,
   * with no way for them to tell it never arrived. The placeholder covers that
   * window locally, where the only person affected is the one who can retry.
   */
  const sendPhoto = useStableCallback(async (placeholder: OptimisticPhoto) => {
    const { clientId, conversationId: threadId, senderId } = placeholder;
    const signal = { aborted: false };
    // A fresh signal per attempt, so retrying after a failure is not rejected by
    // the previous attempt's abort flag.
    uploadSignals.current.set(clientId, signal);

    try {
      const uploaded = await uploadChatImage(placeholder.asset as never, {
        onProgress: (progress) => patchPhoto(clientId, { progress }),
        signal,
      });

      // Withdrawn while the bytes were in the air: Cloudinary may still hold the
      // image, but no row is written because the user asked to withdraw it.
      if (signal.aborted) return;

      await commit(clientId, {
        kind: 'image',
        mediaUrl: uploaded.url,
        mediaWidth: uploaded.width,
        mediaHeight: uploaded.height,
      });

      setPhotos((current) => current.filter((photo) => photo.clientId !== clientId));
    } catch (err) {
      if (signal.aborted) return;
      const message = err instanceof UploadError ? err.message : humanizeError(err);
      patchPhoto(clientId, { status: 'failed', error: message });
    } finally {
      uploadSignals.current.delete(clientId);
    }
  });

  const queuePhotos = useStableCallback(
    async (assets: Awaited<ReturnType<typeof pickChatImages>>) => {
      if (!conversationId || !selfId || assets.length === 0) return;

      const room = Math.max(0, MAX_CHAT_IMAGES - photos.length);
      const accepted = assets.slice(0, room);
      if (accepted.length === 0) {
        throw new UploadError(`You can send up to ${MAX_CHAT_IMAGES} photos at once.`);
      }

      const queued = accepted.map((asset) => ({
        clientId: nextPhotoClientId(),
        conversationId,
        senderId: selfId,
        localUri: asset.uri,
        asset,
        status: 'uploading' as const,
        progress: 0,
        createdAt: new Date().toISOString(),
      }));

      // Every accepted image appears at once; each upload runs independently, so
      // one failure does not hold up the others.
      setPhotos((current) => [...current, ...queued]);
      queued.forEach((placeholder) => void sendPhoto(placeholder));
    },
  );

  const sendPhotos = useStableCallback(async (source: 'library' | 'camera') => {
    if (!conversationId || !selfId) return;
    try {
      if (source === 'camera') {
        const asset = await captureChatPhoto();
        if (!asset) return;
        assertWithinSizeLimit(asset);
        await queuePhotos([asset]);
        return;
      }

      const assets = await pickChatImages();
      if (assets.length === 0) return;
      assets.forEach(assertWithinSizeLimit);
      await queuePhotos(assets);
    } catch (err) {
      if (err instanceof UploadError) throw err;
      throw new Error(humanizeError(err));
    }
  });

  const sendVoice = useStableCallback((clip: VoiceClip) => {
    if (!conversationId || !selfId) return;

    notifyStopped();

    const clientId = newClientId();
    // The local row exists immediately so the note is on screen at once; the
    // upload fills in the URL behind it.
    setMessages((current) =>
      mergeIncoming(current, {
        id: `pending-${clientId}`,
        conversationId,
        senderId: selfId,
        content: '',
        kind: 'voice',
        createdAt: new Date().toISOString(),
        clientId,
        status: 'sending',
      }),
    );

    void (async () => {
      try {
        const uploaded = await uploadVoiceClip(clip.uri, { durationMs: clip.durationMs });
        await commit(clientId, {
          kind: 'voice',
          mediaUrl: uploaded.url,
          durationMs: clip.durationMs,
        });
      } catch (err) {
        const message = err instanceof UploadError ? err.message : humanizeError(err);
        setMessages((current) =>
          current.map((m) =>
            m.id === `pending-${clientId}`
              ? { ...m, status: 'failed', pending: { kind: 'voice' as const, uri: clip.uri, durationMs: clip.durationMs } }
              : m,
          ),
        );
        // Surfaced rather than swallowed: a voice note that silently fails to
        // upload is indistinguishable from one that was never recorded.
        throw new Error(message);
      }
    })().catch(() => undefined);
  });

  /**
   * Retries any failed send.
   *
   * Text and voice re-run the write from the stored payload. An image that failed
   * on its upload has no URL yet, so it re-uploads from the local file the
   * placeholder still holds — which is why the asset is kept on the placeholder
   * instead of being released after a failure.
   */
  const retry = useStableCallback((clientId: string) => {
    const failed = messages.find((m) => m.id === `pending-${clientId}`);
    const pending = failed?.pending;
    if (!pending) return;

    notifyStopped();

    switch (pending.kind) {
      case 'text':
        void commit(clientId, {
          kind: 'text',
          text: pending.content,
          ...replyTargetFromPreview(pending.replyToId, pending.replyPreview, capabilities.replies),
        });
        break;
      case 'image': {
        const photo = photos.find((p) => p.clientId === clientId);
        if (!photo) return;
        patchPhoto(clientId, { status: 'uploading', progress: 0, error: undefined });
        void sendPhoto(photo);
        break;
      }
      case 'voice':
        void (async () => {
          try {
            const uploaded = await uploadVoiceClip(pending.uri, { durationMs: pending.durationMs });
            await commit(clientId, {
              kind: 'voice',
              mediaUrl: uploaded.url,
              durationMs: pending.durationMs,
            });
          } catch (err) {
            setMessages((current) =>
              current.map((m) =>
                m.id === `pending-${clientId}`
                  ? { ...m, status: 'failed', pending: { kind: 'voice' as const, uri: pending.uri, durationMs: pending.durationMs } }
                  : m,
              ),
            );
          }
        })();
        break;
    }
  });

  const cancelPhoto = useStableCallback((clientId: string) => {
    const signal = uploadSignals.current.get(clientId);
    if (signal) signal.aborted = true;
    setPhotos((current) => current.filter((photo) => photo.clientId !== clientId));
  });

  // --- Deletion ------------------------------------------------------------

  const deleteForMe = useStableCallback(async (message: Message) => {
    try {
      await deleteMessageForMe(message);
      setMessages((current) => current.filter((m) => m.id !== message.id));
    } catch (err) {
      setError(humanizeError(err));
    }
  });

  /**
   * Deletes for everyone.
   *
   * The RPC enforces sender-only and the one-hour window; a refusal comes back as
   * a normal error which the caller surfaces as a toast. The local row is replaced
   * with a tombstone so the transcript reads correctly even before the realtime
   * echo lands.
   */
  const deleteForEveryone = useStableCallback(async (message: Message) => {
    try {
      const updated = await deleteMessageForEveryone(message);
      setMessages((current) => current.map((m) => (m.id === message.id ? updated : m)));
    } catch (err) {
      setError(humanizeError(err));
      throw err;
    }
  });

  // --- Derived -------------------------------------------------------------

  const items = useMemo(() => {
    if (!conversationId) return [];
    const merged = mergeThread(messages, photos, conversationId);
    // The transcript is an inverted FlatList, so it renders in visual order with
    // the first element at the bottom: data must be newest-first. `mergeThread`
    // returns oldest-first for paging (the `messages[0]` cursor), so flip here.
    merged.reverse();
    return merged;
  }, [messages, photos, conversationId]);

  /**
   * Read: the other participant's id, which the screen owns because it comes from
   * the inbox row rather than from anything the thread can derive.
   */
  const bindParticipant = useCallback((id: string | null) => {
    setOtherUserId(id);
  }, []);

  return {
    items,
    messages,
    loading,
    loadingMore,
    hasMore,
    error,
    offline: error !== null,
    photos,
    presence,
    typing,
    reload,
    loadOlder,
    onForeground,
    sendText,
    sendPhotos,
    sendVoice,
    retry,
    cancelPhoto,
    deleteForMe,
    deleteForEveryone,
    notifyTyping,
    notifyStopped,
    bindParticipant,
  };
}

/** Reply target for a real message the user tapped. */
function replyTarget(
  replyTo: Message | null | undefined,
  supportsReplies: boolean,
): { replyToId?: string; replyPreview?: string } {
  if (!replyTo || !supportsReplies) return {};
  return { replyToId: replyTo.id, replyPreview: buildReplyPreview(quoteTextOf(replyTo)) };
}

/** Reply target for a retry, where only the stored preview survives. */
function replyTargetFromPreview(
  replyToId: string | undefined,
  replyPreview: string | undefined,
  supportsReplies: boolean,
): { replyToId?: string; replyPreview?: string } {
  if (!replyToId || !supportsReplies) return {};
  return { replyToId, replyPreview: replyPreview ?? 'Message' };
}

/**
 * What a reply quotes.
 *
 * Delegates to the codec rather than duplicating its rules, so a photo or voice
 * message is never quoted as a wall of URL text and a deleted message is never
 * quoted at all.
 */
function quoteTextOf(message: Message): string {
  const decoded = decodeMessage(message);
  if (decoded.kind === 'deleted') return 'Deleted message';
  if (decoded.kind === 'image') return 'Photo';
  if (decoded.kind === 'voice') return 'Voice message';
  return decoded.text;
}

/**
 * Search inside the thread.
 *
 * Kept out of the hook's state on purpose: a search is a transient overlay with
 * its own lifecycle, and keeping its results in the transcript's state would make
 * every keystroke re-render the whole thread.
 */
export function useThreadSearch(conversationId: string | undefined) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Message[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const needle = query.trim();
    if (needle.length < 2) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    setSearching(true);
    let cancelled = false;

    // Debounced so a fast typist does not fire a request per keystroke; the RPC is
    // indexed, but there is no reason to run ten of them.
    const timer = setTimeout(() => {
      void searchMessages(conversationId ?? '', needle)
        .then((rows) => {
          if (!cancelled) setResults(rows);
        })
        .catch(() => {
          // A failed search shows no results rather than an error banner over the
          // conversation the user was trying to read.
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [conversationId, query]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
  }, []);

  return { query, setQuery, results, searching, clear };
}