import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Archive,
  MessageSquare,
  Pin,
  Search,
  Tag,
  X,
  CheckCheck,
} from 'lucide-react';
import type { Conversation } from '../../types';
import { messageSummary } from '../../services/database';

type Filter = 'all' | 'unread' | 'archived';

interface ConversationListProps {
  conversations: Conversation[];
  loading: boolean;
  activeId: string | null;
  onlineIds: Set<string>;
  onSelect: (id: string) => void;
  onBack?: () => void;
  onExploreMarketplace?: () => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  loading,
  activeId,
  onlineIds,
  onSelect,
  onBack,
  onExploreMarketplace,
}) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  // Pinned threads are always shown regardless of filter or search — they are
  // the conversations someone explicitly asked to keep at the top.
  const pinned = useMemo(() => conversations.filter((c) => c.pinnedAt), [conversations]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return conversations
      .filter((c) => (filter === 'archived' ? Boolean(c.archivedAt) : !c.archivedAt))
      .filter((c) => (filter === 'unread' ? c.unreadCount > 0 : true))
      .filter((c) => {
        if (!needle) return true;
        return (
          c.participant.fullName.toLowerCase().includes(needle) ||
          (c.participant.username || '').toLowerCase().includes(needle) ||
          (c.listingRef?.title || '').toLowerCase().includes(needle) ||
          (c.lastMessage ? c.lastMessage.content.toLowerCase().includes(needle) : false)
        );
      });
  }, [conversations, query, filter]);

  const unreadTotal = conversations.reduce((n, c) => n + (c.archivedAt ? 0 : c.unreadCount), 0);
  const archivedCount = conversations.filter((c) => c.archivedAt).length;

  const renderRow = (conv: Conversation) => (
    <ConversationRow
      key={conv.id}
      conversation={conv}
      selected={activeId === conv.id}
      online={onlineIds.has(conv.participant.id)}
      onSelect={() => onSelect(conv.id)}
    />
  );

  return (
    <div className="w-full md:w-80 lg:w-96 md:border-r border-zinc-200 dark:border-zinc-800 flex-col min-h-0 bg-zinc-50/50 dark:bg-zinc-900/50">
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
        {unreadTotal > 0 && (
          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 bg-emerald-600 text-white rounded-full">
            {unreadTotal} new
          </span>
        )}
        {onBack && (
          <button
            onClick={onBack}
            className={`hidden md:inline-flex items-center gap-1 text-xs font-semibold text-zinc-500 hover:text-emerald-600 transition-colors cursor-pointer ${
              unreadTotal > 0 ? '' : 'ml-auto'
            }`}
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-4 h-4" />
            Dashboard
          </button>
        )}
      </div>

      <div className="px-3 pt-3 pb-2 flex-shrink-0 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/40">
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats"
            aria-label="Search conversations"
            className="flex-1 min-w-0 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="mt-2 flex gap-1.5">
          <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
          <FilterChip
            label="Unread"
            count={unreadTotal}
            active={filter === 'unread'}
            onClick={() => setFilter('unread')}
          />
          <FilterChip
            label="Archived"
            icon={<Archive className="w-3 h-3" />}
            count={archivedCount}
            active={filter === 'archived'}
            onClick={() => setFilter('archived')}
          />
        </div>
      </div>

      <div className="overflow-y-auto flex-1">
        {loading ? (
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
          <EmptyState icon={<MessageSquare className="w-12 h-12" />} title="No messages yet">
            When you contact a seller from a listing, your conversations will show up here.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<Search className="w-10 h-10" />} title="Nothing found">
            {query ? `No chats match "${query}".` : 'No conversations in this view.'}
          </EmptyState>
        ) : (
          <>
            {pinned.length > 0 && filter !== 'archived' && !query && (
              <div className="px-4 pt-3 pb-1 flex items-center gap-1.5">
                <Pin className="w-3 h-3 text-zinc-400" />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Pinned</span>
              </div>
            )}
            {pinned
              .filter((c) => !c.archivedAt && filtered.some((f) => f.id === c.id))
              .map(renderRow)}

            {filtered
              .filter((c) => !pinned.some((p) => p.id === c.id))
              .map(renderRow)}
          </>
        )}
      </div>

      {onExploreMarketplace && conversations.length === 0 && (
        <div className="p-4 flex-shrink-0 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={onExploreMarketplace}
            className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl cursor-pointer transition-colors"
          >
            Explore listings
          </button>
        </div>
      )}
    </div>
  );
};

const ConversationRow: React.FC<{
  conversation: Conversation;
  selected: boolean;
  online: boolean;
  onSelect: () => void;
}> = ({ conversation: conv, selected, online, onSelect }) => {
  const lastAt = new Date(conv.lastMessageAt);

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 flex items-start gap-3 transition-all cursor-pointer ${
        selected
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
        {online && (
          <span
            className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-zinc-900"
            title="Online"
          />
        )}
        {conv.unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-emerald-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {conv.unreadCount > 99 ? '99+' : conv.unreadCount}
          </span>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5">
          <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate flex items-center gap-1.5">
            {conv.pinnedAt && <Pin className="w-3 h-3 text-zinc-400 flex-shrink-0" />}
            {conv.participant.fullName}
          </h3>
          <span className="text-[10px] text-zinc-400 flex-shrink-0">{formatListTime(lastAt)}</span>
        </div>

        {conv.listingRef && (
          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 truncate flex items-center gap-1 mb-0.5">
            <Tag className="w-2.5 h-2.5 flex-shrink-0" />
            {conv.listingRef.title}
          </p>
        )}

        <div className="flex items-center gap-1.5">
          <p
            className={`text-xs truncate flex-1 ${
              conv.unreadCount > 0 ? 'text-zinc-900 dark:text-zinc-100 font-semibold' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            {conv.archivedAt && <span className="mr-1 text-zinc-400">[Archived]</span>}
            {conv.lastMessage
              ? messageSummary({ content: conv.lastMessage.content, kind: conv.lastMessage.kind })
              : 'Start the conversation'}
          </p>
          {conv.unreadCount === 0 && conv.lastMessage && (
            <CheckCheck className="w-3.5 h-3.5 text-zinc-300 dark:text-zinc-600 flex-shrink-0" />
          )}
        </div>

        {online && (
          <p className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5">Online</p>
        )}
      </div>
    </button>
  );
};

const FilterChip: React.FC<{
  label: string;
  active: boolean;
  count?: number;
  icon?: React.ReactNode;
  onClick: () => void;
}> = ({ label, active, count, icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-2.5 py-1 text-[11px] font-bold rounded-full flex items-center gap-1 transition-colors cursor-pointer ${
      active
        ? 'bg-emerald-600 text-white'
        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700'
    }`}
  >
    {icon}
    {label}
    {count !== undefined && count > 0 && (
      <span className={active ? 'text-white/80' : 'text-zinc-400'}>{count}</span>
    )}
  </button>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; children: React.ReactNode }> = ({
  icon,
  title,
  children,
}) => (
  <div className="flex flex-col items-center justify-center text-center p-8">
    <div className="text-zinc-300 dark:text-zinc-700 mb-3">{icon}</div>
    <h3 className="font-bold text-zinc-700 dark:text-zinc-300 text-sm">{title}</h3>
    <p className="text-xs text-zinc-400 max-w-xs mt-1">{children}</p>
  </div>
);

/** Relative for this week, time-of-day after that. */
function formatListTime(date: Date): string {
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff = startOfToday - date.getTime();
  if (diff >= 0 && diff < 86_400_000) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  if (diff >= 86_400_000 && diff < 6 * 86_400_000) {
    return date.toLocaleDateString([], { weekday: 'short' });
  }
  return date.toLocaleDateString([], { day: 'numeric', month: 'short' });
}
