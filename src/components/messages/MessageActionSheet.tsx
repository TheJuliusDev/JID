import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Copy,
  CornerUpLeft,
  Flag,
  Trash2,
  UserX,
  EyeOff,
  Ban,
  X,
} from 'lucide-react';

export interface MessageAction {
  id: 'reply' | 'copy' | 'delete' | 'hide' | 'report' | 'block' | 'blockAndReport';
  label: string;
  icon: React.ReactNode;
  tone?: 'danger';
}

interface MessageActionSheetProps {
  actions: MessageAction[];
  onSelect: (id: MessageAction['id']) => void;
  onClose: () => void;
}

/**
 * Long-press / right-click menu for a message.
 *
 * The native context menu is suppressed on touch because "Copy link" and
 * "Select text" are useless on a bubble, and on desktop because the app's own
 * actions are what a student expects there.
 */
export const MessageActionSheet: React.FC<MessageActionSheetProps> = ({ actions, onSelect, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (actions.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label="Message options"
      >
        <div className="absolute inset-0 bg-zinc-950/50 backdrop-blur-sm" />

        <motion.div
          initial={{ y: 24, scale: 0.97, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 12, scale: 0.98, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full sm:max-w-xs bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Message</p>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-2">
            {actions.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => onSelect(a.id)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-2xl text-sm font-semibold transition-colors cursor-pointer ${
                  a.tone === 'danger'
                    ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    : 'text-zinc-800 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                <span className="shrink-0">{a.icon}</span>
                {a.label}
              </button>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

/** Build the action list appropriate to one message. */
export function buildMessageActions(options: {
  mine: boolean;
  deleted: boolean;
  isText: boolean;
  canBlock: boolean;
}): MessageAction[] {
  if (options.deleted) return [];

  const actions: MessageAction[] = [
    { id: 'reply', label: 'Reply', icon: <CornerUpLeft className="w-4 h-4" /> },
  ];

  if (options.isText) {
    actions.push({ id: 'copy', label: 'Copy text', icon: <Copy className="w-4 h-4" /> });
  }

  if (options.mine) {
    actions.push({ id: 'delete', label: 'Delete for everyone', icon: <Trash2 className="w-4 h-4" />, tone: 'danger' });
  } else {
    actions.push({ id: 'hide', label: 'Delete for me', icon: <EyeOff className="w-4 h-4" /> });
    actions.push({ id: 'report', label: 'Report message', icon: <Flag className="w-4 h-4" />, tone: 'danger' });
    if (options.canBlock) {
      actions.push({ id: 'block', label: 'Block student', icon: <UserX className="w-4 h-4" />, tone: 'danger' });
      actions.push({
        id: 'blockAndReport',
        label: 'Block and report',
        icon: <Ban className="w-4 h-4" />,
        tone: 'danger',
      });
    }
  }

  return actions;
}
