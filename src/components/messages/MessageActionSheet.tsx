import React, { useEffect, useState } from 'react';
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
import { Modal, useLinger } from '../ui';

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
  // The parent mounts us only while the menu is open, so we run our own close
  // cycle: play the exit animation, then hand control back for the unmount.
  const [open, setOpen] = useState(true);
  const visible = useLinger(open ? true : undefined);
  useEffect(() => {
    if (!open && visible === null) onClose();
  }, [open, visible]);

  if (actions.length === 0) return null;

  const requestClose = () => setOpen(false);

  return (
    <Modal
      open={visible !== null}
      onClose={requestClose}
      variant="sheet"
      size="xs"
      ariaLabel="Message options"
      panelClassName="bg-white dark:bg-zinc-900"
    >
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Message</p>
            <button
              type="button"
              onClick={requestClose}
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
    </Modal>
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
