import React, { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Loader2, Search, X } from 'lucide-react';
import type { Message } from '../../types';
import { searchMessages } from '../../services/database';

export interface SearchHit {
  messageId: string;
  senderId: string;
  createdAt: string;
  kind: string;
  snippet: string;
}

interface MessageSearchPanelProps {
  conversationId: string;
  /** Called with the ids of every hit so the thread can highlight them. */
  onHighlight: (ids: Set<string>) => void;
  onJumpTo: (messageId: string) => void;
  onClose: () => void;
}

/**
 * Search inside one conversation.
 *
 * Matching happens in `search_messages()`, which uses the generated tsvector
 * index — filtering a thousand loaded rows in the browser would be both slower
 * and wrong about which rows were loaded.
 */
export const MessageSearchPanel: React.FC<MessageSearchPanelProps> = ({
  conversationId,
  onHighlight,
  onJumpTo,
  onClose,
}) => {
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);

  // Debounced: this fires an RPC per keystroke otherwise.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setHits([]);
      onHighlight(new Set());
      setCursor(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchMessages(conversationId, trimmed);
        if (cancelled) return;
        const mapped: SearchHit[] = results.map((r: Message & { snippet: string }) => ({
          messageId: r.id,
          senderId: r.senderId,
          createdAt: r.createdAt,
          kind: r.kind ?? 'text',
          snippet: r.snippet,
        }));
        setHits(mapped);
        setCursor(0);
        onHighlight(new Set(mapped.map((h) => h.messageId)));
      } catch (err) {
        console.error('[messages] search failed', err);
        if (!cancelled) setHits([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, conversationId, onHighlight]);

  const step = (delta: number) => {
    if (hits.length === 0) return;
    setCursor((c) => (c + delta + hits.length) % hits.length);
  };

  return (
    <div className="absolute inset-0 z-20 bg-white dark:bg-zinc-900 flex flex-col">
      <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 flex-shrink-0">
        <div className="flex-1 flex items-center gap-2 px-3 py-2 bg-zinc-100 dark:bg-zinc-800 rounded-xl focus-within:ring-2 focus-within:ring-emerald-500/40">
          <Search className="w-4 h-4 text-zinc-400 flex-shrink-0" />
          <input
            autoFocus
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') step(e.shiftKey ? -1 : 1);
              if (e.key === 'Escape') onClose();
            }}
            placeholder="Search this chat"
            aria-label="Search this conversation"
            className="flex-1 min-w-0 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
          />
          {loading && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 flex-shrink-0" />}
        </div>

        {hits.length > 0 && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous result"
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <span className="text-[11px] font-bold text-zinc-500 tabular-nums">
              {cursor + 1}/{hits.length}
            </span>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next result"
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          aria-label="Close search"
          className="p-1.5 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex-shrink-0"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 ? (
          <p className="p-6 text-center text-xs text-zinc-400">Type at least two characters to search.</p>
        ) : hits.length === 0 && !loading ? (
          <p className="p-6 text-center text-xs text-zinc-400">No messages in this chat match your search.</p>
        ) : (
          hits.map((hit, i) => (
            <button
              key={hit.messageId}
              type="button"
              onClick={() => {
                setCursor(i);
                onJumpTo(hit.messageId);
              }}
              className={`w-full text-left px-4 py-3 border-b border-zinc-100 dark:border-zinc-800/60 cursor-pointer transition-colors ${
                i === cursor ? 'bg-emerald-50 dark:bg-emerald-950/30' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
              }`}
            >
              <p className="text-[10px] font-bold text-zinc-400 mb-0.5">
                {new Date(hit.createdAt).toLocaleString([], {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {hit.kind !== 'text' ? ` · ${hit.kind}` : ''}
              </p>
              {/* `snippet` arrives with <mark> around the matched terms. */}
              <p
                className="text-xs text-zinc-700 dark:text-zinc-200 break-words"
                dangerouslySetInnerHTML={{ __html: sanitizeSnippet(hit.snippet) }}
              />
            </button>
          ))
        )}
      </div>
    </div>
  );
};

/**
 * `search_messages()` builds its snippet with `ts_headline`, so the input is
 * already-escaped SQL output containing only `<b>` tags. This strips anything
 * else that is not one of those, so a message containing markup cannot inject
 * nodes into the page.
 */
function sanitizeSnippet(snippet: string): string {
  return snippet.replace(/<(?!\/?b>)[^>]*>/gi, '');
}
