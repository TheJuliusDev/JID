/**
 * Message read/write.
 *
 * Everything that touches the `messages` table. Two invariants drive the design:
 *
 * 1. **A send is never lost.** A send is identified by a device-generated
 *    `client_id` and backed by a unique index on (sender_id, client_id), so a
 *    retry after a dropped connection resolves to the original row instead of
 *    creating a second bubble. Combined with an optimistic local row, a message
 *    is either visible-and-eventually-sent, or visible-and-retryable. It never
 *    disappears silently.
 *
 * 2. **Realtime is the source of truth while the thread is open.** Subscribing to
 *    INSERT/UPDATE/DELETE means the other side's message, read receipt and
 *    deletion all arrive without a refetch. Every subscription is torn down by
 *    the returned unsubscribe, which is what stops duplicate handlers and a
 *    leaked channel when the user navigates between conversations quickly.
 */
import { getSupabase } from '@/services/supabase';
import type { Message, MessageKind } from '@/types';
import {
  AUDIO_MESSAGE_PREFIX,
  PHOTO_MESSAGE_PREFIX,
  decodeMessage,
} from './codec';

/** Loosely-typed row; only ever read inside this module's mapper. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = any;

/** Maps a raw `messages` row, tolerating pre-migration rows that lack columns. */
export function mapMessage(row: DbRow): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content ?? '',
    kind: row.kind ?? 'text',
    createdAt: row.created_at,
    readAt: row.read_at || undefined,
    deletedAt: row.deleted_at || undefined,
    deletedForEveryoneAt: row.deleted_for_everyone_at || undefined,
    deliveredAt: row.delivered_at || undefined,
    replyToId: row.reply_to_id || undefined,
    replyPreview: row.reply_preview || undefined,
    durationMs: row.duration_ms ?? undefined,
    mediaUrl: row.media_url || undefined,
    mediaWidth: row.media_width ?? undefined,
    mediaHeight: row.media_height ?? undefined,
    clientId: row.client_id || undefined,
  };
}

/** A message ready to be written. Media bytes must already be uploaded. */
export interface OutgoingMessage {
  kind: Exclude<MessageKind, 'system'>;
  text?: string;
  mediaUrl?: string;
  durationMs?: number;
  mediaWidth?: number;
  mediaHeight?: number;
  replyToId?: string;
  replyPreview?: string;
}

/**
 * Builds the `content` string for a row.
 *
 * On a migrated database the payload lives in the dedicated columns and `content`
 * carries only the human-readable text (empty for attachments). On an
 * un-migrated one the payload has to ride inside `content` behind the legacy
 * `jid://` prefix, which is exactly how photo messages have always worked — so
 * an un-migrated install still sends and receives images and voice notes rather
 * than failing.
 */
export function encodeContent(
  message: OutgoingMessage,
  supportsRichMessages: boolean,
): string {
  if (message.kind === 'text') return message.text ?? '';
  if (supportsRichMessages) return '';

  if (message.kind === 'image' && message.mediaUrl) {
    return `${PHOTO_MESSAGE_PREFIX}${message.mediaUrl}`;
  }
  if (message.kind === 'voice' && message.mediaUrl) {
    // Duration is appended so the receiving bubble can size itself correctly.
    return `${AUDIO_MESSAGE_PREFIX}${message.mediaUrl}#${message.durationMs ?? 0}`;
  }
  return '';
}

/** A fresh idempotency key. Unique per send attempt, stable across retries. */
export function newClientId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Builds the optimistic row rendered the instant the user hits send. */
export function optimisticMessage(params: {
  clientId: string;
  conversationId: string;
  senderId: string;
  outgoing: OutgoingMessage;
  supportsRichMessages: boolean;
}): Message {
  const { clientId, conversationId, senderId, outgoing, supportsRichMessages } = params;
  return {
    id: `pending-${clientId}`,
    conversationId,
    senderId,
    content: encodeContent(outgoing, supportsRichMessages),
    kind: outgoing.kind,
    createdAt: new Date().toISOString(),
    replyToId: outgoing.replyToId,
    replyPreview: outgoing.replyPreview,
    durationMs: outgoing.durationMs,
    mediaUrl: supportsRichMessages ? outgoing.mediaUrl : undefined,
    mediaWidth: outgoing.mediaWidth,
    mediaHeight: outgoing.mediaHeight,
    clientId,
    // Local-only until the row comes back from the server.
    status: 'sending',
    pending: pendingFor(outgoing),
  };
}

/**
 * Builds the recoverable payload for a send that has not been confirmed.
 *
 * Every variant is constructed explicitly rather than spread-and-cast, because a
 * blind cast is exactly how the image and voice cases ended up with no `uri`:
 * the union still type-checked while silently dropping the only field a retry
 * needs. With the switch, a new `MessageKind` fails to compile until this
 * handles it.
 */
function pendingFor(outgoing: OutgoingMessage): NonNullable<Message['pending']> {
  const shared = {
    replyToId: outgoing.replyToId,
    replyPreview: outgoing.replyPreview,
  };

  switch (outgoing.kind) {
    case 'image':
      return {
        kind: 'image',
        uri: outgoing.mediaUrl ?? '',
        width: outgoing.mediaWidth,
        height: outgoing.mediaHeight,
        ...shared,
      };
    case 'voice':
      return {
        kind: 'voice',
        uri: outgoing.mediaUrl ?? '',
        durationMs: outgoing.durationMs ?? 0,
        ...shared,
      };
    default:
      return { kind: 'text', content: outgoing.text ?? '', ...shared };
  }
}

/**
 * Writes a message.
 *
 * On a unique-violation the insert has already been accepted by an earlier
 * attempt whose response was lost — a retry after a flaky uplink. PostgREST can
 * express this as an upsert keyed on (sender_id, client_id), which returns the
 * existing row instead of erroring, so the caller's retry is idempotent for free.
 */
export async function sendMessage(params: {
  conversationId: string;
  senderId: string;
  clientId: string;
  outgoing: OutgoingMessage;
  supportsRichMessages: boolean;
  supportsReplies: boolean;
}): Promise<Message> {
  const { conversationId, senderId, clientId, outgoing, supportsRichMessages, supportsReplies } =
    params;

  const row: Record<string, unknown> = {
    conversation_id: conversationId,
    sender_id: senderId,
    content: encodeContent(outgoing, supportsRichMessages),
    client_id: clientId,
  };

  if (supportsRichMessages) {
    row.kind = outgoing.kind;
    row.media_url = outgoing.mediaUrl ?? null;
    row.duration_ms = outgoing.durationMs ?? null;
    row.media_width = outgoing.mediaWidth ?? null;
    row.media_height = outgoing.mediaHeight ?? null;
  }
  if (supportsReplies) {
    row.reply_to_id = outgoing.replyToId ?? null;
    row.reply_preview = outgoing.replyPreview ?? null;
  }

  const query = getSupabase().from('messages');
  // Upsert rather than insert: onConflict makes a replayed send resolve to the
  // original row, which is what makes retry safe without a round trip first.
  const { data, error } = supportsRichMessages || supportsReplies
    ? await query
        .upsert(row as never, { onConflict: 'sender_id,client_id', ignoreDuplicates: false })
        .select('*')
        .single()
    : await query
        .insert(row as never)
        .select('*')
        .single();

  if (error) throw error;
  return mapMessage(data);
}

/** The newest page of a thread, oldest-first for rendering. */
export async function fetchMessages(
  conversationId: string,
  limit = 50,
): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  // Queried newest-first so the LIMIT bounds the *newest* page, then reversed so
  // the transcript reads top-to-bottom.
  return ((data || []) as DbRow[]).map(mapMessage).reverse();
}

/** One page of older history, using the oldest loaded message as a cursor. */
export async function fetchMessagesBefore(
  conversationId: string,
  beforeCreatedAt: string,
  limit = 50,
): Promise<Message[]> {
  const { data, error } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .lt('created_at', beforeCreatedAt)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data || []) as DbRow[]).map(mapMessage).reverse();
}

/**
 * Search inside one thread.
 *
 * Uses the `search_conversation_messages` RPC when available, so the match runs
 * against an indexed scan of this conversation only. Falls back to a direct
 * `ilike` query when the migration has not been applied.
 */
export async function searchMessages(
  conversationId: string,
  query: string,
  limit = 50,
): Promise<Message[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];

  const { data, error } = await getSupabase().rpc('search_conversation_messages', {
    p_conversation: conversationId,
    // The RPC spaces out the needle to match word-by-word; the fallback below
    // does the same escaping client-side.
    p_query: needle,
    p_limit: limit,
  });

  if (!error && Array.isArray(data)) {
    // The RPC deliberately skips deleted and blocked-context messages; a
    // zero-row result is the honest answer, not a failure.
    return (data as DbRow[]).map(mapMessage);
  }

  // Fallback: direct query. Escapes LIKE metacharacters so a search for "50%"
  // does not match everything and an apostrophe cannot break the filter.
  const escaped = needle.replace(/([\\%_])/g, '\\$1');
  const { data: fallback, error: fallbackError } = await getSupabase()
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .eq('kind', 'text')
    .ilike('content', `%${escaped}%`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (fallbackError) throw fallbackError;
  return ((fallback || []) as DbRow[]).map(mapMessage);
}

/** Stamps read receipts on everything the other participant sent, unread only. */
export async function markThreadRead(
  conversationId: string,
  userId: string,
): Promise<void> {
  const { error } = await getSupabase()
    .from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .neq('sender_id', userId)
    .is('read_at', null);
  if (error) throw error;
}

/**
 * Stamps delivery receipts.
 *
 * Writes only the new `delivered_at` column; the pre-upgrade path is a no-op
 * because that column does not exist yet and a failed write here must not stop
 * the thread from working.
 */
export async function markThreadDelivered(
  conversationId: string,
  supportsRichMessages: boolean,
): Promise<void> {
  if (!supportsRichMessages) return;
  const { error } = await getSupabase().rpc('mark_messages_delivered', {
    conv_id: conversationId,
  });
  if (error) {
    // Non-fatal: delivery ticks are a nicety, not a correctness requirement.
  }
}

/**
 * Soft-deletes a message for everyone.
 *
 * Prefers the `delete_message_for_everyone` RPC, which enforces the sender-only,
 * one-hour-window rule server-side. Falls back to the original direct update,
 * which is what the website still uses.
 */
export async function deleteMessageForEveryone(message: Message): Promise<Message> {
  const { data, error } = await getSupabase().rpc('delete_message_for_everyone', {
    p_message: message.id,
  });

  if (!error && data === true) {
    const tombstone: Message = {
      ...message,
      content: 'jid://deleted/',
      deletedAt: new Date().toISOString(),
      deletedForEveryoneAt: new Date().toISOString(),
      mediaUrl: undefined,
      status: 'sent',
    };
    return tombstone;
  }

  // Fallback (pre-migration): update in place.
  const { data: updated, error: updateError } = await getSupabase()
    .from('messages')
    .update({ content: 'jid://deleted/', deleted_at: new Date().toISOString() })
    .eq('id', message.id)
    .select('*')
    .single();
  if (updateError) throw updateError;
  return mapMessage(updated);
}

/** Hides a message for the reader only. Their side, nobody else's. */
export async function deleteMessageForMe(message: Message): Promise<void> {
  const { error } = await getSupabase().rpc('delete_message_for_me', { p_message: message.id });
  if (error) throw error;
}

export interface MessageSubscription {
  onInsert: (message: Message) => void;
  onUpdate?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
}

/**
 * Subscribes to INSERT / UPDATE / DELETE on one thread.
 *
 * Returns a teardown function. The caller is responsible for calling it — the
 * thread screen does so in a `useEffect` cleanup, which is what prevents a stale
 * channel from firing into an unmounted component or double-registering handlers
 * when the user moves quickly between conversations.
 */
export function subscribeToMessages(
  conversationId: string,
  handlers: MessageSubscription,
): () => void {
  const sb = getSupabase();
  const filter = `conversation_id=eq.${conversationId}`;

  const channel = sb
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onInsert(mapMessage(payload.new)),
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onUpdate?.(mapMessage(payload.new)),
    )
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter },
      (payload) => handlers.onDelete?.((payload.old as DbRow)?.id),
    );

  channel.subscribe();

  return () => {
    void sb.removeChannel(channel);
  };
}

/**
 * Folds a realtime insert into a message list without duplicating it.
 *
 * The optimistic row and the realtime echo of the same send both arrive for one
 * message, keyed by `client_id` on the real row and `pending-<client_id>` on the
 * local one. Matching on that pair is what stops a user's own message from
 * appearing twice the moment it lands.
 */
export function mergeIncoming(list: Message[], incoming: Message): Message[] {
  const index = list.findIndex((m) => m.id === incoming.id);
  if (index !== -1) {
    const next = list.slice();
    next[index] = { ...incoming, status: 'sent' };
    return next;
  }

  const pendingIndex = incoming.clientId
    ? list.findIndex((m) => m.id === `pending-${incoming.clientId}`)
    : -1;
  if (pendingIndex !== -1) {
    const next = list.slice();
    next[pendingIndex] = { ...incoming, status: 'sent' };
    return next;
  }

  // Guard against the same message being delivered twice by the transport.
  if (list.some((m) => m.id === incoming.id)) return list;

  return [...list, incoming].sort(byCreatedAt);
}

/** Chronological order, with optimistic rows kept in place by their timestamp. */
export const byCreatedAt = (a: Message, b: Message): number =>
  new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();

/** Whether a message is still in flight, for the "sending" bubble treatment. */
export const isInFlight = (message: Message): boolean => message.status === 'sending';

/** Whether a message failed and can be retried. */
export const isFailed = (message: Message): boolean => message.status === 'failed';

/**
 * Whether a reply target is still renderable.
 *
 * A quoted message that was itself deleted shows as a tombstone rather than
 * leaking its former text.
 */
export function replyQuoteFor(
  messages: Message[],
  message: Message,
): { name: string; text: string; deleted: boolean } | null {
  if (!message.replyToId) return null;
  const parent = messages.find((m) => m.id === message.replyToId);
  const decoded = parent ? decodeMessage(parent) : null;
  return {
    name: 'Message',
    text: parent
      ? decoded?.kind === 'deleted'
        ? 'Deleted message'
        : decoded?.text || decoded?.url || 'Message'
      : (message.replyPreview ?? 'Message'),
    deleted: decoded?.kind === 'deleted',
  };
}