import React, { useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Check, CheckCheck, Clock, AlertTriangle, CornerUpLeft, Image as ImageIcon } from 'lucide-react';
import type { Message } from '../../types';
import { PhotoLightbox } from './PhotoLightbox';
import { VoiceNote } from './VoiceNote';

/**
 * How far a sent message has got.
 *
 * `pending` and `failed` are client-side only: they exist because `sendMessage`
 * inserts optimistically and a send can fail on a flaky campus connection. The
 * server has no column for either — a message that failed to insert is simply
 * absent, so there is nothing to reconcile against on the next load.
 */
export type DeliveryState = 'sending' | 'sent' | 'delivered' | 'read' | 'failed';

interface MessageBubbleProps {
  message: Message;
  mine: boolean;
  delivery: DeliveryState;
  /** Grouped with the previous bubble from the same sender within 5 minutes. */
  grouped: boolean;
  onOpenActions: (message: Message, element: HTMLElement) => void;
  onOpenLightbox: (urls: string[], index: number) => void;
  onJumpToReply: (messageId: string) => void;
  /** Ids highlighted by an active in-conversation search. */
  highlightedIds?: Set<string>;
}

/** Long-press threshold. Below this a tap still registers as a tap. */
const LONG_PRESS_MS = 450;

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  mine,
  delivery,
  grouped,
  onOpenActions,
  onOpenLightbox,
  onJumpToReply,
  highlightedIds,
}) => {
  const [pressing, setPressing] = useState(false);
  const timerRef = useRef<number | null>(null);

  const deleted = isDeleted(message.content);
  const kind = message.kind ?? 'text';
  const urls = message.imageMeta?.urls ?? [];
  const isImage = kind === 'image' && !deleted;
  const isVoice = kind === 'voice' && !deleted;
  const isText = kind === 'text' && !deleted;
  const highlighted = highlightedIds?.has(message.id) ?? false;

  // Long-press opens the action sheet; a pointer that moves or is released early
  // cancels, so scrolling a thread never triggers it.
  const startPress = (element: HTMLElement) => {
    setPressing(true);
    timerRef.current = window.setTimeout(() => {
      setPressing(false);
      onOpenActions(message, element);
    }, LONG_PRESS_MS);
  };
  const cancelPress = () => {
    setPressing(false);
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const bubbleTone = deleted
    ? 'bg-zinc-100/70 dark:bg-zinc-800/50 text-zinc-400 dark:text-zinc-500'
    : mine
      ? 'bg-emerald-600 text-white'
      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100';

  // Media sits flush against its own bubble, so the padding moves onto the
  // media element instead of being baked into the rounded container.
  const padded = isText || isVoice;

  return (
    <div
      className={`flex ${mine ? 'justify-end' : 'justify-start'} ${grouped ? 'mt-0.5' : 'mt-3'}`}
    >
      <div
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenActions(message, e.currentTarget as HTMLElement);
        }}
        onPointerDown={(e) => startPress(e.currentTarget as HTMLElement)}
        onPointerUp={cancelPress}
        onPointerLeave={cancelPress}
        onPointerCancel={cancelPress}
        onContextMenuCapture={cancelPress}
        className={`relative max-w-[82%] sm:max-w-[70%] rounded-2xl transition-shadow ${
          grouped ? (mine ? 'rounded-br-md' : 'rounded-bl-md') : mine ? 'rounded-br-md' : 'rounded-bl-md'
        } ${padded ? 'px-4 py-2.5' : 'p-1'} ${bubbleTone} ${
          highlighted ? 'ring-2 ring-amber-400 ring-offset-2 ring-offset-white dark:ring-offset-zinc-900' : ''
        } ${pressing ? 'scale-[0.98]' : ''}`}
        style={{ transformOrigin: mine ? 'bottom right' : 'bottom left' }}
      >
        {/* Quoted parent. Tapping it scrolls the thread to that message. */}
        {message.replyTo && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              cancelPress();
              onJumpToReply(message.replyTo!.id);
            }}
            className={`w-full text-left mb-2 pl-2.5 border-l-2 rounded-r-lg ${
              mine ? 'border-emerald-300 bg-white/10' : 'border-emerald-600 bg-white/60 dark:bg-zinc-900/40'
            }`}
          >
            <p className={`flex items-center gap-1 text-[11px] font-bold ${mine ? 'text-emerald-50' : 'text-emerald-700 dark:text-emerald-400'}`}>
              <CornerUpLeft className="w-3 h-3" />
              {message.replyTo.senderId === message.senderId ? 'You' : 'Reply'}
            </p>
            <p className={`text-[11px] truncate mt-0.5 ${mine ? 'text-emerald-50/90' : 'text-zinc-600 dark:text-zinc-300'}`}>
              {message.replyTo.preview}
            </p>
          </button>
        )}

        {deleted ? (
          <p className="italic text-[13px] whitespace-pre-wrap break-words">Message deleted</p>
        ) : isImage ? (
          <MultiImage urls={urls} mine={mine} onOpen={onOpenLightbox} />
        ) : isVoice ? (
          <VoiceNote
            url={message.voiceMeta?.url || ''}
            peaks={message.voiceMeta?.peaks}
            durationMs={message.voiceMeta?.durationMs}
            mine={mine}
          />
        ) : (
          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p>
        )}

        <div
          className={`mt-1 text-[10px] flex items-center justify-end gap-1 ${padded ? '' : 'px-1.5 pb-1'} ${
            mine ? 'text-emerald-100/80' : 'text-zinc-400'
          }`}
        >
          {delivery === 'failed' ? (
            <span className="flex items-center gap-1 text-rose-200 font-semibold">
              <AlertTriangle className="w-3 h-3" />
              Not sent
            </span>
          ) : (
            <span>{formatTime(message.createdAt)}</span>
          )}
          {mine && <DeliveryTick state={delivery} />}
        </div>
      </div>
    </div>
  );
};

const MultiImage: React.FC<{
  urls: string[];
  mine: boolean;
  onOpen: (urls: string[], index: number) => void;
}> = ({ urls, mine, onOpen }) => {
  if (urls.length === 0) {
    return (
      <div className={`w-40 h-28 rounded-xl flex items-center justify-center ${mine ? 'bg-white/15' : 'bg-zinc-200 dark:bg-zinc-700'}`}>
        <ImageIcon className={`w-6 h-6 ${mine ? 'text-white/70' : 'text-zinc-400'}`} />
      </div>
    );
  }

  // One image renders full width; two or more become a grid, which keeps four
  // photos from turning into a full-screen vertical strip in a chat bubble.
  if (urls.length === 1) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onOpen(urls, 0);
        }}
        className="block overflow-hidden rounded-xl cursor-zoom-in"
        aria-label="View photo"
      >
        <img
          src={urls[0]}
          alt="Photo message"
          loading="lazy"
          className="max-h-72 max-w-full object-cover rounded-xl"
        />
      </button>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-1 w-56 sm:w-64">
      {urls.slice(0, 4).map((url, i) => (
        <button
          key={`${url}-${i}`}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpen(urls, i);
          }}
          className="relative overflow-hidden rounded-lg cursor-zoom-in aspect-square"
          aria-label={`View photo ${i + 1}`}
        >
          <img src={url} alt="" loading="lazy" className="w-full h-full object-cover" />
          {i === 3 && urls.length > 4 && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white text-sm font-bold">
              +{urls.length - 4}
            </span>
          )}
        </button>
      ))}
    </div>
  );
};

const DeliveryTick: React.FC<{ state: DeliveryState }> = ({ state }) => {
  if (state === 'sending') {
    return <Clock className="w-3 h-3 text-emerald-100/60" aria-label="Sending" />;
  }
  if (state === 'sent') {
    return <Check className="w-3 h-3 text-emerald-100/60" aria-label="Sent" />;
  }
  // `delivered` and `read` are the same proof of life here: the only signal the
  // schema carries is `read_at`, so an unread message is shown as delivered
  // rather than inventing a second timestamp the database does not store.
  if (state === 'delivered') {
    return <CheckCheck className="w-3 h-3 text-emerald-100/80" aria-label="Delivered" />;
  }
  return <CheckCheck className="w-3 h-3 text-white" aria-label="Read" />;
};

function isDeleted(content: string): boolean {
  return content.startsWith('jid://deleted/');
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
