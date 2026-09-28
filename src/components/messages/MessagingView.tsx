import React, { useEffect, useRef, useState } from 'react';
import { Message } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { fetchMessages, sendMessage, subscribeToMessages } from '../../services/database';
import { Send, MessageSquare, ShieldCheck, ArrowLeft, Loader2, CheckCheck, Tag } from 'lucide-react';

interface MessagingViewProps {
  onOpenProfile?: (username?: string) => void;
  onBack?: () => void;
  onExploreMarketplace?: () => void;
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const MessagingView: React.FC<MessagingViewProps> = ({ onOpenProfile, onBack, onExploreMarketplace }) => {
  const { user } = useAuth();
  const {
    conversations,
    conversationsLoading,
    activeConversationId,
    setActiveConversationId,
    markConversationRead,
  } = useData();

  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Keyboard-awareness: keep the composer above the on-screen keyboard.
  //
  // Modern Android (Chrome 108+, activated by `interactive-widget=resizes-content`
  // in the viewport meta) resizes the layout viewport itself, so `h-dvh` shrinks
  // automatically and nothing else is needed. For everything else (iOS Safari,
  // older WebViews) we measure the `visualViewport` and pin the chat height to
  // the visible area above the keyboard. No hardcoded keyboard heights.
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
        // How much of the layout viewport the keyboard/URL bar is covering.
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

  // After the keyboard opens/closes, keep the newest message in view.
  useEffect(() => {
    if (!keyboardShrunk) return;
    const id = window.setTimeout(() => {
      bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
    }, 120);
    return () => window.clearTimeout(id);
  }, [keyboardShrunk]);

  // Load history + subscribe to realtime inserts whenever the open conversation changes.
  useEffect(() => {
    if (!activeConversationId || !user?.id) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    setLoadingMessages(true);

    (async () => {
      try {
        const history = await fetchMessages(activeConversationId);
        if (!cancelled) setMessages(history);
      } catch (err) {
        if (!cancelled) console.error('[messages] fetch failed', err);
      } finally {
        if (!cancelled) setLoadingMessages(false);
      }
    })();

    markConversationRead(activeConversationId);

    const unsubscribe = subscribeToMessages(activeConversationId, (incoming) => {
      setMessages((prev) => (prev.some((m) => m.id === incoming.id) ? prev : [...prev, incoming]));
      if (incoming.senderId !== user.id) markConversationRead(activeConversationId);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [activeConversationId, user?.id, markConversationRead]);

  // Keep the newest message in view.
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loadingMessages]);

  if (!user) return null;

  const activeConversation = conversations.find((c) => c.id === activeConversationId) || null;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = messageText.trim();
    if (!text || !activeConversation || sending) return;
    setSending(true);
    setMessageText('');
    try {
      const sent = await sendMessage(activeConversation.id, user.id, text);
      setMessages((prev) => (prev.some((m) => m.id === sent.id) ? prev : [...prev, sent]));
    } catch (err) {
      console.error('[messages] send failed', err);
      setMessageText(text); // restore so the student can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      className="h-dvh w-full min-h-0 flex bg-white dark:bg-zinc-900"
      style={chatHeight ? { height: chatHeight } : undefined}
    >
      {/* Conversation list (full width on mobile until a chat is opened) */}
      <div
        className={`${
          activeConversation ? 'hidden md:flex' : 'flex'
        } w-full md:w-80 lg:w-96 md:border-r border-zinc-200 dark:border-zinc-800 flex-col min-h-0 bg-zinc-50/50 dark:bg-zinc-900/50`}
      >
        <div className="px-4 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 flex-shrink-0 bg-white dark:bg-zinc-900">
          {onBack && (
            <button
              onClick={onBack}
              className="md:hidden p-1.5 -ml-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 cursor-pointer flex-shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <h2 className="font-bold text-zinc-950 dark:text-white font-display text-base sm:text-lg">Campus Messages</h2>
          <span className="ml-auto text-xs font-semibold px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 rounded-full">
            {conversations.length}
          </span>
          {onBack && (
            <button
              onClick={onBack}
              className="hidden md:inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-emerald-600 transition-colors cursor-pointer"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </button>
          )}
        </div>

          <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {conversationsLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="w-11 h-11 rounded-full bg-zinc-200 dark:bg-zinc-800 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded" />
                      <div className="h-2.5 w-3/4 bg-zinc-100 dark:bg-zinc-800/70 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center h-full p-8">
                <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
                <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">No messages yet</h3>
                <p className="text-xs text-zinc-400 max-w-xs mt-1 mb-4">
                  When you contact a seller from a listing, your conversations will show up here.
                </p>
                {onExploreMarketplace && (
                  <button
                    onClick={onExploreMarketplace}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
                  >
                    Explore listings
                  </button>
                )}
              </div>
            ) : (
              conversations.map((conv) => {
                const isSelected = activeConversationId === conv.id;
                return (
                  <button
                    key={conv.id}
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`w-full text-left p-4 flex items-start gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-zinc-800/90 md:border-l-4 md:border-emerald-600'
                        : 'hover:bg-white/60 dark:hover:bg-zinc-800/40'
                    }`}
                  >
                    <div className="relative w-11 h-11 rounded-full bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center font-bold text-emerald-700 dark:text-emerald-300 flex-shrink-0 overflow-hidden">
                      {conv.participant.avatarUrl ? (
                        <img src={conv.participant.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        conv.participant.fullName.charAt(0).toUpperCase()
                      )}
                      {conv.unreadCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                          {conv.unreadCount}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {conv.participant.fullName}
                        </h3>
                        <span className="text-[10px] text-zinc-400 flex-shrink-0">{formatTime(conv.lastMessageAt)}</span>
                      </div>
                      {conv.participant.department && (
                        <p className="text-[11px] text-zinc-500 truncate mb-1">{conv.participant.department}</p>
                      )}
                      <p
                        className={`text-xs truncate ${
                          conv.unreadCount > 0
                            ? 'text-zinc-900 dark:text-zinc-100 font-semibold'
                            : 'text-zinc-500 dark:text-zinc-400'
                        }`}
                      >
                        {conv.lastMessage?.content || 'Start the conversation'}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Active chat (full-screen on mobile, right pane on desktop) */}
        <div
          className={`${
            activeConversation ? 'flex' : 'hidden md:flex'
          } flex-1 flex-col min-h-0 bg-white dark:bg-zinc-900`}
        >
          {activeConversation ? (
            <>
              {/* Chat header */}
              <div className="px-4 sm:px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 bg-zinc-50/75 dark:bg-zinc-900/75 backdrop-blur-md flex-shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <button
                    onClick={() => setActiveConversationId(null)}
                    className="p-1.5 -ml-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 cursor-pointer flex-shrink-0"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => onOpenProfile?.(activeConversation.participant.username)}
                    className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
                    disabled={!activeConversation.participant.username}
                  >
                    <div className="w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {activeConversation.participant.avatarUrl ? (
                        <img src={activeConversation.participant.avatarUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        activeConversation.participant.fullName.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                        {activeConversation.participant.fullName}
                      </h3>
                      <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                        {[activeConversation.participant.department, activeConversation.participant.hallOrArea]
                          .filter(Boolean)
                          .join(' • ') || 'OAU student'}
                      </p>
                    </div>
                  </button>
                </div>

                {activeConversation.listingRef && (
                  <div className="flex items-center gap-2 p-1.5 pr-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl flex-shrink-0">
                    {activeConversation.listingRef.image ? (
                      <img src={activeConversation.listingRef.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                        <Tag className="w-4 h-4 text-zinc-400" />
                      </div>
                    )}
                    <div className="hidden sm:block min-w-0">
                      <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">
                        {activeConversation.listingRef.title}
                      </p>
                      <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                        {BRAND_CONFIG.currency.format(activeConversation.listingRef.price)}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Message thread */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 max-w-lg mx-auto text-center justify-center">
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
                  messages.map((m) => {
                    const mine = m.senderId === user.id;
                    return (
                      <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                            mine
                              ? 'bg-emerald-600 text-white rounded-br-md'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-md'
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.content}</p>
                          <div
                            className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${
                              mine ? 'text-emerald-100/80' : 'text-zinc-400'
                            }`}
                          >
                            <span>{formatTime(m.createdAt)}</span>
                            {mine && <CheckCheck className="w-3 h-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={bottomRef} />
              </div>

              {/* Composer */}
              <form
                onSubmit={handleSend}
                className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900 flex-shrink-0"
              >
                <input
                  type="text"
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  onFocus={() => {
                    window.setTimeout(() => bottomRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' }), 120);
                  }}
                  placeholder="Type a message…"
                  className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                />
                <button
                  type="submit"
                  disabled={!messageText.trim() || sending}
                  className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow transition-all cursor-pointer flex-shrink-0"
                  aria-label="Send message"
                >
                  {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </form>
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
    </div>
  );
};
