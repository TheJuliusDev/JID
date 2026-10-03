import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MessageSquare, ShieldCheck } from 'lucide-react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Message } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  fetchMessages,
  fetchMessagesBefore,
  sendMessage,
  deleteMessage,
  hideMessage,
  fetchHiddenMessageIds,
  markThreadRead,
  subscribeToMessages,
  isPhotoMessage,
  isDeletedMessage,
} from '../../services/database';
import { supabase } from '../../services/supabase';
import {
  readConversationDeepLink,
  listenForPushMessages,
  enablePush,
  getPushPermission,
  isPushSupported,
} from '../../services/push';
import { ConversationList } from './ConversationList';
import { ChatHeader } from './ChatHeader';
import { ChatComposer } from './ChatComposer';
import { MessageBubble, type DeliveryState } from './MessageBubble';
import { MessageActionSheet, buildMessageActions, type MessageAction } from './MessageActionSheet';
import { MessageSearchPanel } from './MessageSearchPanel';
import { PhotoLightbox } from './PhotoLightbox';
import { ChatReportModal } from './ChatReportModal';

interface MessagingViewProps {
  onOpenProfile?: (username?: string) => void;
  onBack?: () => void;
  onExploreMarketplace?: () => void;
}

/** Clients of the same message share a bubble run; this is the grouping window. */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

const HISTORY_PAGE = 50;

export const MessagingView: React.FC<MessagingViewProps> = ({
  onOpenProfile,
  onBack,
  onExploreMarketplace,
}) => {
  const { user } = useAuth();
  const {
    conversations,
    conversationsLoading,
    activeConversationId,
    setActiveConversationId,
    markConversationRead,
    onlineUserIds,
    togglePinConversation,
    toggleArchiveConversation,
    blockUser,
  } = useData();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasOlder, setHasOlder] = useState(false);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set());
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [actionTarget, setActionTarget] = useState<{ message: Message; x: number; y: number } | null>(null);
  const [reportTarget, setReportTarget] = useState<{ message?: Message; alsoBlock: boolean } | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [pushOfferDismissed, setPushOfferDismissed] = useState(false);

  /** Messages painted before the server confirmed them, keyed by clientId. */
  const [pending, setPending] = useState<
    Record<string, { message: Message; state: DeliveryState; error?: string }>
  >({});

  const threadRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const typingChannelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const stopTypingTimerRef = useRef<number | null>(null);
  const lastTypingEmitRef = useRef(0);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConversationId) || null,
    [conversations, activeConversationId]
  );

  const otherUserId = activeConversation?.participant.id;
  const online = otherUserId ? onlineUserIds.has(otherUserId) : false;

  // ---- Keyboard-aware height ------------------------------------------------

  const [chatHeight, setChatHeight] = useState<number | null>(null);
  const keyboardShrunk = chatHeight !== null;

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let raf = 0;
    const isCoarseTouch = () => window.matchMedia('(any-pointer: coarse)').matches;
    const update = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const covered = window.innerHeight - vv.height;
        setChatHeight(isCoarseTouch() && covered > 24 ? vv.height : null);
      });
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      cancelAnimationFrame(raf);
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    if (!keyboardShrunk) return;
    const id = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
    }, 120);
    return () => window.clearTimeout(id);
  }, [keyboardShrunk]);

  // ---- Typing broadcast -----------------------------------------------------

  const emitTyping = useCallback(
    (typing: boolean) => {
      const ch = typingChannelRef.current;
      if (!ch || !activeConversationId) return;
      const now = Date.now();
      // Throttled: without this, every keystroke is a socket frame.
      if (typing && now - lastTypingEmitRef.current < 2500) return;
      lastTypingEmitRef.current = typing ? now : 0;
      void ch.send({ type: 'broadcast', event: 'typing', payload: { userId: user?.id, typing } });
    },
    [activeConversationId, user?.id]
  );

  const scheduleStopTyping = useCallback(() => {
    if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
    stopTypingTimerRef.current = window.setTimeout(() => emitTyping(false), 2000);
  }, [emitTyping]);

  useEffect(() => {
    setOtherTyping(false);
    if (!activeConversationId || !supabase) return;
    const client = supabase;
    const channel = client.channel(`typing:${activeConversationId}`);
    channel
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        if (!payload.payload || payload.payload.userId === user?.id) return;
        setOtherTyping(Boolean(payload.payload.typing));
        if (payload.payload.typing) {
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          // Failsafe: if the sender's tab dies mid-compose, no further "stopped"
          // broadcast ever arrives, so the indicator is cleared on a timer.
          typingTimeoutRef.current = window.setTimeout(() => setOtherTyping(false), 4000);
        }
      })
      .subscribe();
    typingChannelRef.current = channel;
    return () => {
      client.removeChannel(channel);
      typingChannelRef.current = null;
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    };
  }, [activeConversationId, user?.id]);

  // ---- Deep link from a notification ---------------------------------------

  useEffect(() => {
    if (conversationsLoading || !user) return;
    const deepLink = readConversationDeepLink();
    if (!deepLink) return;
    if (!conversations.some((c) => c.id === deepLink)) return;
    setActiveConversationId(deepLink);
    // Clear the query so a refresh does not re-open the same thread.
    const url = new URL(window.location.href);
    url.searchParams.delete('c');
    window.history.replaceState({}, '', url.toString());
  }, [conversations, conversationsLoading, user, setActiveConversationId]);

  // ---- Load a conversation --------------------------------------------------

  useEffect(() => {
    if (!activeConversationId || !user?.id) {
      setMessages([]);
      setHasOlder(false);
      setOtherTyping(false);
      setReplyTo(null);
      return;
    }
    let cancelled = false;
    setMessages([]);
    setLoadingMessages(true);
    setHasOlder(false);
    setOtherTyping(false);
    setReplyTo(null);
    setSearchOpen(false);
    setHighlighted(new Set());
    messageRefs.current = {};

    (async () => {
      try {
        // Hidden-for-me ids are needed to filter rows that the messages query
        // cannot exclude itself (it has no notion of "hidden by this student").
        const [history, hidden] = await Promise.all([
          fetchMessages(activeConversationId, HISTORY_PAGE),
          fetchHiddenMessageIds(activeConversationId).catch(() => [] as string[]),
        ]);
        if (cancelled) return;
        const hiddenSet = new Set(hidden);
        setMessages(history.filter((m) => !hiddenSet.has(m.id)));
        setHasOlder(history.length >= HISTORY_PAGE);
      } catch (err) {
        if (!cancelled) console.error('[messages] fetch failed', err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    markConversationRead(activeConversationId);
    markThreadRead(activeConversationId, user.id).catch(() => {});

    const unsubscribe = subscribeToMessages(activeConversationId, {
      onInsert: (incoming) => {
        const incomingMine = incoming.senderId === user.id;
        setMessages((prev) => {
          if (prev.some((m) => m.id === incoming.id)) return prev;
          return [...prev, incoming];
        });
        // An arriving message from elsewhere also clears this student's pending
        // optimistic bubble if it is the echo of their own send.
        if (incomingMine && incoming.clientId) {
          setPending((prev) => {
            if (!prev[incoming.clientId!]) return prev;
            const next = { ...prev };
            delete next[incoming.clientId!];
            return next;
          });
        }
        if (!incomingMine) {
          markConversationRead(activeConversationId);
          markThreadRead(activeConversationId, user.id).catch(() => {});
        }
      },
      onUpdate: (updated) => {
        // Read receipts and soft-deletes, from either side.
        setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      },
      onHidden: (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      },
    });

    return () => {
      cancelled = true;
      emitTyping(false);
      if (stopTypingTimerRef.current) window.clearTimeout(stopTypingTimerRef.current);
      unsubscribe();
    };
  }, [activeConversationId, user?.id, markConversationRead, emitTyping]);

  // ---- Auto-scroll ---------------------------------------------------------

  // Only follow the bottom when a message is *appended*. Prepending an older
  // page must not yank the view, and a search jump scrolls deliberately.
  const prevFirstIdRef = useRef<string | null>(null);
  const prevLastIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!messages.length) return;
    const first = messages[0].id;
    const last = messages[messages.length - 1].id;
    const appended = last !== prevLastIdRef.current;
    const prepended = first !== prevFirstIdRef.current;
    if (appended && !prepended) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
    prevFirstIdRef.current = first;
    prevLastIdRef.current = last;
  }, [messages]);

  useEffect(() => {
    if (!loadingMessages) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto', block: 'end' });
    }
  }, [loadingMessages]);

  const loadOlder = useCallback(async () => {
    if (!activeConversationId || !messages.length || loadingOlder || !hasOlder) return;
    const container = threadRef.current;
    const prevHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;
    setLoadingOlder(true);
    try {
      const older = await fetchMessagesBefore(activeConversationId, messages[0].createdAt, HISTORY_PAGE);
      setHasOlder(older.length >= HISTORY_PAGE);
      setMessages((prev) => {
        const existing = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !existing.has(m.id)), ...prev];
      });
      requestAnimationFrame(() => {
        const el = threadRef.current;
        // Restore the reader's position by compensating for the height that was
        // just added above them; without this the viewport jumps.
        if (el) el.scrollTop = prevScrollTop + (el.scrollHeight - prevHeight);
      });
    } catch (err) {
      console.error('[messages] load older failed', err);
    } finally {
      setLoadingOlder(false);
    }
  }, [activeConversationId, messages, loadingOlder, hasOlder]);

  const handleThreadScroll = () => {
    const el = threadRef.current;
    if (el && el.scrollTop < 120) void loadOlder();
  };

  const jumpToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Brief flash so the target is obvious even if the row is off-centre.
      el.classList.add('ring-2', 'ring-emerald-500');
      window.setTimeout(() => el.classList.remove('ring-2', 'ring-emerald-500'), 1600);
      return;
    }
    setBanner('That message is further up the chat — scroll back to load it.');
    window.setTimeout(() => setBanner(null), 4000);
  }, []);

  // ---- Sending -------------------------------------------------------------

  /**
   * Insert optimistically, then reconcile.
   *
   * The bubble is painted immediately with a `clientId`; the realtime INSERT
   * for the same row carries that id too, which is how the two are collapsed
   * into one instead of showing the message twice. A failure flips the bubble
   * to "Not sent" rather than silently dropping it.
   */
  const dispatchSend = useCallback(
    async (input: {
      content: string;
      kind?: Message['kind'];
      metadata?: Record<string, unknown>;
      optimisticText?: string;
    }) => {
      if (!activeConversation || !user) return;
      const clientId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const optimistic: Message = {
        id: clientId,
        clientId,
        conversationId: activeConversation.id,
        senderId: user.id,
        content: input.optimisticText ?? input.content,
        createdAt: new Date().toISOString(),
        kind: input.kind ?? 'text',
        imageMeta: input.kind === 'image' ? { urls: input.metadata?.urls as string[] } : undefined,
        voiceMeta: input.kind === 'voice' ? (input.metadata as Message['voiceMeta']) : undefined,
        replyToId: replyTo?.id,
        replyTo: replyTo
          ? {
              id: replyTo.id,
              senderId: replyTo.senderId,
              kind: replyTo.kind ?? 'text',
              preview: summaryOf(replyTo),
              createdAt: replyTo.createdAt,
            }
          : undefined,
      };

      setMessages((prev) => [...prev, optimistic]);
      setPending((prev) => ({ ...prev, [clientId]: { message: optimistic, state: 'sending' } }));
      setReplyTo(null);

      try {
        const sent = await sendMessage(activeConversation.id, user.id, input, clientId);
        setMessages((prev) => prev.map((m) => (m.id === clientId ? sent : m)));
        setPending((prev) => {
          const next = { ...prev };
          delete next[clientId];
          return next;
        });
      } catch (err) {
        console.error('[messages] send failed', err);
        setPending((prev) => ({
          ...prev,
          [clientId]: {
            ...prev[clientId],
            state: 'failed',
            error: err instanceof Error ? err.message : 'Could not send this message.',
          },
        }));
      }
    },
    [activeConversation, user, replyTo]
  );

  const retryPending = useCallback(
    (clientId: string) => {
      const entry = pending[clientId];
      if (!entry) return;
      setPending((prev) => {
        const next = { ...prev };
        delete next[clientId];
        return next;
      });
      void dispatchSend({
        content: entry.message.content,
        kind: entry.message.kind,
        metadata: {
          ...(entry.message.imageMeta ? { urls: entry.message.imageMeta.urls } : {}),
          ...(entry.message.voiceMeta ? entry.message.voiceMeta : {}),
        },
      });
    },
    [pending, dispatchSend]
  );

  const handleTyping = useCallback(
    (typing: boolean) => {
      if (typing) {
        emitTyping(true);
        scheduleStopTyping();
      } else {
        emitTyping(false);
      }
    },
    [emitTyping, scheduleStopTyping]
  );

  // ---- Push ----------------------------------------------------------------

  useEffect(() => {
    return listenForPushMessages((msg) => {
      // The service worker only hands over payloads when a visible window
      // exists, so this is the "app is open but they are in another chat" case.
      if (msg.conversationId && msg.conversationId === activeConversationId) return;
      setBanner(msg.body ? `${msg.title}: ${msg.body}` : msg.title);
      window.setTimeout(() => setBanner(null), 5000);
    });
  }, [activeConversationId]);

  const pushPermission = getPushPermission();
  const offerPush =
    isPushSupported() && pushPermission === 'default' && Boolean(activeConversation) && !pushOfferDismissed;

  /**
   * Notification permission is only ever requested once the student is actually
   * in a conversation, never on first launch, and never twice in a session.
   */
  const requestPush = useCallback(() => {
    if (!user) return;
    void enablePush(user.id).then((status) => {
      setPushOfferDismissed(true);
      if (status.permission === 'granted') {
        setBanner('Notifications are on.');
        window.setTimeout(() => setBanner(null), 3000);
      } else if (status.permission === 'denied') {
        setBanner('Notifications are blocked in your browser settings.');
        window.setTimeout(() => setBanner(null), 4000);
      }
    });
  }, [user]);

  // ---- Actions -------------------------------------------------------------

  const openActions = useCallback((message: Message, element: HTMLElement) => {
    const rect = element.getBoundingClientRect();
    setActionTarget({
      message,
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    });
  }, []);

  const handleAction = async (id: MessageAction['id']) => {
    if (!actionTarget || !activeConversation || !user) return;
    const { message } = actionTarget;
    setActionTarget(null);

    switch (id) {
      case 'reply':
        setReplyTo(message);
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(message.content);
          setBanner('Copied');
          window.setTimeout(() => setBanner(null), 2000);
        } catch {
          setBanner('Could not copy that message.');
          window.setTimeout(() => setBanner(null), 3000);
        }
        break;
      case 'delete':
        if (!window.confirm('Delete this message for everyone? This cannot be undone.')) return;
        try {
          const updated = await deleteMessage(message.id);
          setMessages((prev) => prev.map((m) => (m.id === message.id ? updated : m)));
        } catch (err) {
          console.error('[messages] delete failed', err);
        }
        break;
      case 'hide':
        try {
          await hideMessage(message.id, activeConversation.id);
          setMessages((prev) => prev.filter((m) => m.id !== message.id));
        } catch (err) {
          console.error('[messages] hide failed', err);
        }
        break;
      case 'report':
        setReportTarget({ message, alsoBlock: false });
        break;
      case 'block':
        if (!window.confirm(`Block ${activeConversation.participant.fullName}?`)) return;
        try {
          await blockUser(activeConversation.participant.id);
          setBanner('Student blocked');
          window.setTimeout(() => setBanner(null), 3000);
        } catch (err) {
          console.error('[messages] block failed', err);
        }
        break;
      case 'blockAndReport':
        setReportTarget({ message, alsoBlock: true });
        break;
    }
  };

  // ---- Render --------------------------------------------------------------

  if (!user) return null;

  return (
    <div
      className="h-dvh w-full min-h-0 flex bg-white dark:bg-zinc-900"
      style={chatHeight ? { height: chatHeight } : undefined}
    >
      <div className={`${activeConversation ? 'hidden md:flex' : 'flex'}`}>
        <ConversationList
          conversations={conversations}
          loading={conversationsLoading}
          activeId={activeConversationId}
          onlineIds={onlineUserIds}
          onSelect={setActiveConversationId}
          onBack={onBack}
          onExploreMarketplace={onExploreMarketplace}
        />
      </div>

      <div className={`${activeConversation ? 'flex' : 'hidden md:flex'} flex-1 flex-col min-h-0 bg-white dark:bg-zinc-900 relative`}>
        {activeConversation ? (
          <>
            <ChatHeader
              conversation={activeConversation}
              online={online}
              otherTyping={otherTyping}
              onBack={() => setActiveConversationId(null)}
              onOpenProfile={onOpenProfile}
              onSearch={() => setSearchOpen(true)}
              onTogglePin={() => void togglePinConversation(activeConversation.id, !activeConversation.pinnedAt)}
              onToggleArchive={() =>
                void toggleArchiveConversation(activeConversation.id, !activeConversation.archivedAt)
              }
              onReport={() => setReportTarget({ alsoBlock: false })}
              onBlock={() => {
                if (window.confirm(`Block ${activeConversation.participant.fullName}?`)) {
                  void blockUser(activeConversation.participant.id);
                }
              }}
            />

            {offerPush && (
              <div className="px-4 py-2 bg-emerald-50 dark:bg-emerald-950/30 border-b border-emerald-200 dark:border-emerald-900 flex items-center gap-2 flex-shrink-0">
                <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 flex-1">
                  Get notified when messages arrive, even when this tab is closed.
                </p>
                <button
                  onClick={requestPush}
                  className="px-3 py-1 text-[11px] font-bold bg-emerald-600 text-white rounded-lg cursor-pointer hover:bg-emerald-500"
                >
                  Enable
                </button>
                <button
                  onClick={() => setPushOfferDismissed(true)}
                  className="text-[11px] font-semibold text-emerald-700/70 dark:text-emerald-400/70 cursor-pointer px-1"
                >
                  Not now
                </button>
              </div>
            )}

            {banner && (
              <div className="px-4 py-2 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-semibold flex items-center justify-between gap-2 flex-shrink-0">
                <span className="truncate">{banner}</span>
                <button onClick={() => setBanner(null)} className="cursor-pointer opacity-70 hover:opacity-100">
                  Dismiss
                </button>
              </div>
            )}

            <div className="relative flex-1 min-h-0 flex flex-col">
              <div ref={threadRef} onScroll={handleThreadScroll} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-0.5">
                {loadingOlder && (
                  <div className="flex items-center justify-center gap-2 py-2 text-[11px] font-semibold text-zinc-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading earlier messages…
                  </div>
                )}

                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 max-w-lg mx-auto text-center justify-center my-3">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span>Meet at SUB or Hezekiah Library. Never pay before you inspect the item in person.</span>
                </div>

                {loadingMessages ? (
                  <div className="flex items-center justify-center py-10 text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-sm text-zinc-400">
                    No messages yet. Say hello to start the conversation.
                  </div>
                ) : (
                  messages.map((m, i) => {
                    const mine = m.senderId === user.id;
                    const prev = messages[i - 1];
                    const grouped =
                      Boolean(prev) &&
                      prev.senderId === m.senderId &&
                      new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS;

                    const isPending = m.id in pending;
                    const delivery: DeliveryState = isPending
                      ? pending[m.id].state
                      : mine
                        ? m.readAt
                          ? 'read'
                          : 'delivered'
                        : 'sent';

                    return (
                      <div
                        key={m.id}
                        ref={(el) => {
                          messageRefs.current[m.id] = el;
                        }}
                      >
                        <MessageBubble
                          message={m}
                          mine={mine}
                          delivery={delivery}
                          grouped={grouped}
                          onOpenActions={openActions}
                          onOpenLightbox={(urls, index) => setLightbox({ urls, index })}
                          onJumpToReply={jumpToMessage}
                          highlightedIds={highlighted}
                        />
                        {isPending && pending[m.id].state === 'failed' && (
                          <div className={`flex ${mine ? 'justify-end' : 'justify-start'} mt-1`}>
                            <button
                              onClick={() => retryPending(m.id)}
                              className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer px-2"
                            >
                              Tap to retry
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {searchOpen && (
                <MessageSearchPanel
                  conversationId={activeConversation.id}
                  onHighlight={setHighlighted}
                  onJumpTo={jumpToMessage}
                  onClose={() => {
                    setSearchOpen(false);
                    setHighlighted(new Set());
                  }}
                />
              )}
            </div>

            <ChatComposer
              listingTitle={activeConversation.listingRef?.title}
              replyTo={
                replyTo
                  ? {
                      id: replyTo.id,
                      preview: summaryOf(replyTo),
                      mine: replyTo.senderId === user.id,
                    }
                  : null
              }
              onCancelReply={() => setReplyTo(null)}
              onTyping={handleTyping}
              onSendText={(text) => dispatchSend({ content: text })}
              onSendImages={(urls) =>
                dispatchSend({
                  content: '',
                  kind: 'image',
                  metadata: { urls },
                })
              }
              onSendVoice={(url, durationMs, peaks) =>
                dispatchSend({
                  content: '',
                  kind: 'voice',
                  metadata: { url, durationMs, peaks },
                })
              }
            />
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
            <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Select a conversation</h3>
            <p className="text-xs text-zinc-400 max-w-xs mt-1">
              Choose a chat, or message any student seller directly from a listing page.
            </p>
          </div>
        )}
      </div>

      {actionTarget && (
        <MessageActionSheet
          actions={buildMessageActions({
            mine: actionTarget.message.senderId === user.id,
            deleted: isDeletedMessage(actionTarget.message.content),
            isText: (actionTarget.message.kind ?? 'text') === 'text',
            canBlock: actionTarget.message.senderId !== user.id,
          })}
          onSelect={(id) => void handleAction(id)}
          onClose={() => setActionTarget(null)}
        />
      )}

      {reportTarget && activeConversation && (
        <ChatReportModal
          reportedUserId={activeConversation.participant.id}
          reportedUserName={activeConversation.participant.fullName}
          conversationId={activeConversation.id}
          messageId={reportTarget.message?.id}
          alsoBlock={reportTarget.alsoBlock}
          onBlock={() => blockUser(activeConversation.participant.id)}
          onClose={() => setReportTarget(null)}
        />
      )}

      {lightbox && (
        <PhotoLightbox
          urls={lightbox.urls}
          startIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
};

/** One-line summary used by the reply banner. */
function summaryOf(m: Message): string {
  if (isDeletedMessage(m.content)) return 'Message deleted';
  if (isPhotoMessage(m.content) || m.kind === 'image') return 'Photo';
  if (m.kind === 'voice') return 'Voice message';
  return m.content;
}
