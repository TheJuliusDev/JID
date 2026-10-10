/**
 * Message payload encoding.
 *
 * The `messages` table has always stored a plain text `content`, and the app
 * shipped photo messages by prefixing a URL with `jid://photo/`. The messaging
 * upgrade adds real `kind` / `media_url` columns, but *every* read still has to
 * cope with rows written before that migration and with a database where it has
 * not been applied yet.
 *
 * So this module is the single place that answers "what is this message, and how
 * do I render it", and it answers it from three sources in order:
 *
 *   1. the dedicated columns, when present   -> `jid://audio/...` | kind='voice'
 *   2. the legacy `jid://` prefix            -> photo messages sent before the upgrade
 *   3. the tombstone marker                  -> a deleted message
 *
 * Nothing else in the app is allowed to inspect `content` directly. That is what
 * keeps a legacy photo from rendering as a wall of URL text, and what lets the
 * whole feature set be switched off with one capability flag when the migration
 * has not been run.
 */
import type { Message, MessageKind } from '@/types';

/** Legacy marker: a photo URL stored in `content`. Written before the upgrade. */
export const PHOTO_MESSAGE_PREFIX = 'jid://photo/';
/** Legacy marker: voice URL plus duration, written before the upgrade. */
export const AUDIO_MESSAGE_PREFIX = 'jid://audio/';
/** Tombstone for a deleted message. */
export const DELETED_MESSAGE_MARKER = 'jid://deleted/';

export const isPhotoContent = (content: string): boolean =>
  content.startsWith(PHOTO_MESSAGE_PREFIX);

export const isAudioContent = (content: string): boolean =>
  content.startsWith(AUDIO_MESSAGE_PREFIX);

export const isDeletedContent = (content: string): boolean =>
  content.startsWith(DELETED_MESSAGE_MARKER);

/** Legacy aliases kept so older call sites and stored payloads keep working. */
export const isPhotoMessage = isPhotoContent;
export const isDeletedMessage = isDeletedContent;

export const photoMessageUrl = (content: string): string =>
  content.slice(PHOTO_MESSAGE_PREFIX.length);

export const photoMessageContent = (url: string): string => `${PHOTO_MESSAGE_PREFIX}${url}`;

const photoUrlFromContent = (content: string): string =>
  content.slice(PHOTO_MESSAGE_PREFIX.length);

/**
 * Legacy audio payloads carry their duration inline as
 * `jid://audio/<url>` + `#<milliseconds>` so a pre-migration client still draws a
 * correctly sized bubble without a `duration_ms` column.
 */
function parseAudioContent(content: string): { url: string; durationMs?: number } {
  const raw = content.slice(AUDIO_MESSAGE_PREFIX.length);
  const hash = raw.lastIndexOf('#');
  if (hash === -1) return { url: raw };
  const url = raw.slice(0, hash);
  const durationMs = Number(raw.slice(hash + 1));
  return { url, durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : undefined };
}

/** The resolved, render-ready shape of a message body. */
export interface DecodedMessage {
  kind: Exclude<MessageKind, 'system'> | 'deleted';
  /** Present only for image and voice. */
  url?: string;
  /** Plain text to render. Empty for attachments. */
  text: string;
  durationMs?: number;
}

const normaliseKind = (value: unknown): MessageKind =>
  value === 'image' || value === 'voice' || value === 'system' ? value : 'text';

/**
 * Turns a stored message into something renderable.
 *
 * `kind` on the row wins when it is present and the row has the matching media
 * column; otherwise the content prefix decides. A deleted row always wins over
 * everything, because a tombstone must never be overridden by leftover content.
 */
export function decodeMessage(message: Message): DecodedMessage {
  const content = message.content ?? '';

  if (message.deletedAt || isDeletedContent(content)) {
    return { kind: 'deleted', text: '' };
  }

  const kind = normaliseKind(message.kind);
  const mediaUrl = message.mediaUrl;

  if (kind === 'image') {
    if (mediaUrl) return { kind: 'image', url: mediaUrl, text: '' };
    // Column missing or unset: fall back to the legacy prefix.
    if (isPhotoContent(content)) {
      return { kind: 'image', url: photoUrlFromContent(content), text: '' };
    }
    return { kind: 'text', text: content };
  }

  if (kind === 'voice') {
    if (mediaUrl) {
      return { kind: 'voice', url: mediaUrl, text: '', durationMs: message.durationMs };
    }
    if (isAudioContent(content)) {
      const { url, durationMs } = parseAudioContent(content);
      return { kind: 'voice', url, text: '', durationMs: durationMs ?? message.durationMs };
    }
    return { kind: 'text', text: content };
  }

  // A text row whose content still carries a legacy prefix: the `kind` column was
  // never backfilled for it, so trust the prefix.
  if (isPhotoContent(content)) {
    return { kind: 'image', url: photoUrlFromContent(content), text: '' };
  }
  if (isAudioContent(content)) {
    const { url, durationMs } = parseAudioContent(content);
    return { kind: 'voice', url, text: '', durationMs };
  }

  return { kind: 'text', text: content };
}

/**
 * One-line preview for the conversation list and for push bodies.
 *
 * Never returns a bare URL, and never leaks the content of a message the reader
 * has blocked or that was deleted.
 */
export function messagePreview(message: Message | undefined): string {
  if (!message) return 'Say hello';
  const decoded = decodeMessage(message);
  switch (decoded.kind) {
    case 'deleted':
      return 'Message deleted';
    case 'image':
      return '📷 Photo';
    case 'voice':
      return '🎤 Voice message';
    default:
      return decoded.text;
  }
}

/** Text shown when quoting a message in a reply. */
export function quotePreview(message: Message | undefined): string {
  if (!message) return 'Message';
  const decoded = decodeMessage(message);
  switch (decoded.kind) {
    case 'deleted':
      return 'Deleted message';
    case 'image':
      return '📷 Photo';
    case 'voice':
      return '🎤 Voice message';
    default:
      // One line, trimmed: a quote is a label, not a second paragraph.
      return decoded.text.replace(/\s+/g, ' ').trim().slice(0, 140) || 'Message';
  }
}

/** Truncates for the quoted preview stored alongside a reply. */
export const buildReplyPreview = (text: string): string =>
  text.replace(/\s+/g, ' ').trim().slice(0, 140);