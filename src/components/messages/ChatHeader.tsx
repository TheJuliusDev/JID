import React, { useState } from 'react';
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  ChevronDown,
  Flag,
  Pin,
  PinOff,
  Search,
  Tag,
  UserX,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { Conversation } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { formatPresence } from '../../services/presence';

interface ChatHeaderProps {
  conversation: Conversation;
  online: boolean;
  otherTyping: boolean;
  onBack: () => void;
  onOpenProfile?: (username?: string) => void;
  onSearch: () => void;
  onTogglePin: () => void;
  onToggleArchive: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  conversation,
  online,
  otherTyping,
  onBack,
  onOpenProfile,
  onSearch,
  onTogglePin,
  onToggleArchive,
  onReport,
  onBlock,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const other = conversation.participant;

  // Typing outranks presence: while someone is composing, that is the more
  // useful thing to say.
  const subtitle = otherTyping ? (
    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
      <span className="flex items-center gap-0.5">
        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '140ms' }} />
        <span className="w-1 h-1 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '280ms' }} />
      </span>
      typing…
    </span>
  ) : (
    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
      {other.presenceVisible === false
        ? [other.department, other.hallOrArea].filter(Boolean).join(' • ') || 'OAU student'
        : formatPresence({ isOnline: online, lastSeenAt: other.lastSeenAt, visible: true })}
    </p>
  );

  return (
    <div className="px-3 sm:px-6 py-2.5 sm:py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2 bg-zinc-50/75 dark:bg-zinc-900/75 backdrop-blur-md flex-shrink-0 relative">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <button
          onClick={onBack}
          className="p-1.5 -ml-1.5 rounded-lg text-zinc-500 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 cursor-pointer flex-shrink-0"
          aria-label="Back to conversations"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <button
          onClick={() => onOpenProfile?.(other.username)}
          className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
          disabled={!other.username}
        >
          <div className="relative w-9 h-9 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 font-bold flex items-center justify-center flex-shrink-0 overflow-hidden">
            {other.avatarUrl ? (
              <img src={other.avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              other.fullName.charAt(0).toUpperCase()
            )}
            {online && other.presenceVisible !== false && (
              <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-50 dark:border-zinc-900" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
              {other.fullName}
            </h3>
            {subtitle}
          </div>
        </button>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        {conversation.listingRef && (
          <div className="hidden lg:flex items-center gap-2 p-1.5 pr-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
            {conversation.listingRef.image ? (
              <img src={conversation.listingRef.image} alt="" className="w-8 h-8 rounded-lg object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-lg bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                <Tag className="w-4 h-4 text-zinc-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[140px]">
                {conversation.listingRef.title}
              </p>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold">
                {BRAND_CONFIG.currency.format(conversation.listingRef.price)}
              </p>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onSearch}
          aria-label="Search this conversation"
          title="Search this chat"
          className="p-2 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Search className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Conversation options"
          aria-expanded={menuOpen}
          className="p-2 rounded-lg text-zinc-500 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-5 h-5 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Click-away layer. Separate from the menu so the menu is not
                unmounted by its own click before the handler reads it. */}
            <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              className="absolute right-3 sm:right-6 top-full mt-1 z-20 w-60 bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 dark:border-zinc-800 p-2 origin-top"
            >
              <MenuItem
                icon={conversation.pinnedAt ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                label={conversation.pinnedAt ? 'Unpin conversation' : 'Pin conversation'}
                onClick={() => {
                  onTogglePin();
                  setMenuOpen(false);
                }}
              />
              <MenuItem
                icon={
                  conversation.archivedAt ? (
                    <ArchiveRestore className="w-4 h-4" />
                  ) : (
                    <Archive className="w-4 h-4" />
                  )
                }
                label={conversation.archivedAt ? 'Unarchive conversation' : 'Archive conversation'}
                onClick={() => {
                  onToggleArchive();
                  setMenuOpen(false);
                }}
              />
              {conversation.listingRef && (
                <MenuItem
                  icon={<Tag className="w-4 h-4" />}
                  label={`About ${conversation.listingRef.title}`}
                  onClick={() => setMenuOpen(false)}
                />
              )}
              <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />
              <MenuItem
                icon={<Flag className="w-4 h-4" />}
                label="Report this student"
                onClick={() => {
                  onReport();
                  setMenuOpen(false);
                }}
              />
              <MenuItem
                icon={<UserX className="w-4 h-4 text-rose-500" />}
                label="Block this student"
                tone="danger"
                onClick={() => {
                  onBlock();
                  setMenuOpen(false);
                }}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

const MenuItem: React.FC<{
  icon: React.ReactNode;
  label: string;
  tone?: 'danger';
  onClick: () => void;
}> = ({ icon, label, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors cursor-pointer text-left ${
      tone === 'danger'
        ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
        : 'text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
    }`}
  >
    <span className="flex-shrink-0">{icon}</span>
    <span className="truncate">{label}</span>
  </button>
);
