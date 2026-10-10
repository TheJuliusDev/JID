/**
 * Conversation list: inbox, pin, archive, search, unread counts.
 *
 * The inbox query lives in Postgres (`get_my_conversations_v2`) because ordering
 * pinned-first and computing per-thread unread counts in SQL keeps the phone from
 * fetching and sorting every thread to render a list. The original v1 function
 * remains the fallback for a database that has not been migrated, and the
 * mapper handles both shapes so the rest of the app cannot tell which ran.
 */
import { getSupabase } from '@/services/supabase';
import type { Conversation, ConversationSearchResult, Message } from '@/types';
import { mapMessage } from './messages';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DbRow = any;

/** Maps a v2 inbox row. */
function mapConversation(row: DbRow): Conversation {
  const lastMessage: Message | undefined = row.last_message
    ? {
        id: row.last_message_id ?? '',
        conversationId: row.conversation_id,
        senderId: row.last_sender_id,
        content: row.last_message,
        kind: row.last_message_kind ?? 'text',
        createdAt: row.last_message_at,
        durationMs: row.last_message_duration_ms ?? undefined,
        readAt: row.last_message_read_at || undefined,
      }
    : undefined;

  return {
    id: row.conversation_id,
    participant: {
      id: row.other_id,
      username: row.other_username || undefined,
      fullName: row.other_full_name || 'JID Student',
      avatarUrl: row.other_avatar_url || undefined,
      department: row.other_department || undefined,
      level: row.other_level || undefined,
      hallOrArea: row.other_hall_or_area || undefined,
      lastSeenAt: row.other_last_seen_at ?? null,
      lastSeenVisible: row.other_last_seen_visible !== false,
    },
    lastMessage,
    unreadCount: Number(row.unread_count) || 0,
    lastMessageAt: row.last_message_at,
    pinnedAt: row.pinned_at || undefined,
    archivedAt: row.archived_at || undefined,
    mutedAt: row.muted_at || undefined,
    listingRef: row.listing_id
      ? {
          id: row.listing_id,
          title: row.listing_title || '',
          price: Number(row.listing_price) || 0,
          image: row.listing_image || '',
          type: row.listing_type,
        }
      : undefined,
  };
}

/** Maps a v1 inbox row, which has no pin, archive or presence fields. */
function mapLegacyConversation(row: DbRow): Conversation {
  return {
    ...mapConversation(row),
    participant: {
      id: row.other_id,
      username: row.other_username || undefined,
      fullName: row.other_full_name || 'JID Student',
      avatarUrl: row.other_avatar_url || undefined,
      department: row.other_department || undefined,
      level: row.other_level || undefined,
      hallOrArea: row.other_hall_or_area || undefined,
      // No presence data available; `undefined` tells the UI to hide the line
      // rather than print an empty one.
      lastSeenAt: undefined,
      lastSeenVisible: false,
    },
  };
}

/**
 * Loads the inbox.
 *
 * `archived` selects the section: false for the main inbox, true for Archived,
 * null for everything. Falls back to the v1 function and filters client-side if
 * the migration has not been applied — with the caveat that on an un-migrated
 * database pin and archive simply do not exist, which is what the capability
 * flags already tell the UI.
 */
export async function fetchConversations(options?: {
  archived?: boolean | null;
  supportsOrganise?: boolean;
}): Promise<Conversation[]> {
  const { archived = false, supportsOrganise = true } = options ?? {};

  if (supportsOrganise) {
    const { data, error } = await getSupabase().rpc('get_my_conversations_v2', {
      p_archived: archived,
    });
    if (!error) return ((data || []) as DbRow[]).map(mapConversation);
  }

  const { data, error } = await getSupabase().rpc('get_my_conversations');
  if (error) throw error;

  const rows = ((data || []) as DbRow[]).map(mapLegacyConversation);
  if (!supportsOrganise) return rows;
  // Without the v2 function there is nowhere to persist an archived flag, so the
  // archived section is empty rather than wrong.
  return archived ? [] : rows;
}

/** How many conversations are archived. Used for the Archived entry badge. */
export async function countArchived(supportsOrganise: boolean): Promise<number> {
  if (!supportsOrganise) return 0;
  const { count, error } = await getSupabase()
    .rpc('get_my_conversations_v2', { p_archived: true })
    .then((r) => ({ count: (r.data as DbRow[] | null)?.length ?? 0, error: r.error }));

  if (error) return 0;
  return count ?? 0;
}

/** The tab-bar / Messages-entry badge. One aggregate, not the whole inbox. */
export async function fetchUnreadTotal(): Promise<number> {
  const { data, error } = await getSupabase().rpc('get_unread_message_count');
  if (error) return 0;
  return Number(data) || 0;
}

/**
 * Pins or unpins a conversation for this user only.
 *
 * These three organise RPCs are shared with the website and take the canonical
 * `conv_id` / `pinned` names (see `supabase/migrations/006`). They return
 * `void`; the new state is learned from the realtime membership echo or the
 * next inbox fetch rather than from the call's result.
 */
export async function setConversationPinned(
  conversationId: string,
  pinned: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('set_conversation_pinned', {
    conv_id: conversationId,
    pinned,
  });
  if (error) throw error;
}

/** Archives or unarchives a conversation for this user only. */
export async function setConversationArchived(
  conversationId: string,
  archived: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('set_conversation_archived', {
    conv_id: conversationId,
    archived,
  });
  if (error) throw error;
}

/** Mutes or unmutes push notifications for one conversation. */
export async function setConversationMuted(
  conversationId: string,
  muted: boolean,
): Promise<void> {
  const { error } = await getSupabase().rpc('set_conversation_muted', {
    conv_id: conversationId,
    muted,
  });
  if (error) throw error;
}

/**
 * Searches conversations by participant name, username or message text.
 *
 * Includes archived threads, so "archived chats are still searchable" is a real
 * behaviour rather than an aspiration. Uses the RPC when available; otherwise
 * filters the already-loaded inbox, which is honest about its limits.
 */
export async function searchConversations(
  query: string,
  loaded: Conversation[],
): Promise<ConversationSearchResult[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];

  const { data, error } = await getSupabase().rpc('search_my_conversations', {
    p_query: needle,
    p_limit: 25,
  });

  if (!error && Array.isArray(data)) {
    return (data as DbRow[]).map((row) => ({
      conversationId: row.conversation_id,
      participant: {
        id: row.participant_id,
        username: row.participant_username || undefined,
        fullName: row.participant_name || 'JID Student',
        avatarUrl: row.participant_avatar_url || undefined,
      },
      lastMessage: row.last_message
        ? {
            id: '',
            conversationId: row.conversation_id,
            senderId: row.matched_sender_id ?? '',
            content: row.last_message,
            kind: 'text',
            createdAt: row.last_message_at,
          }
        : undefined,
      lastMessageAt: row.last_message_at || undefined,
      unreadCount: Number(row.unread_count) || 0,
      pinnedAt: row.pinned_at || undefined,
      archivedAt: row.archived_at || undefined,
      matchedMessageId: row.matched_message_id || undefined,
      matchedMessageKind: row.matched_message_kind || undefined,
      matchedSenderId: row.matched_sender_id || undefined,
      matchedMessageContent: row.matched_message_content || undefined,
    }));
  }

  // Fallback: participant name / username only. Message-text search needs the RPC
  // because an un-migrated inbox query returns one row per conversation.
  const lower = needle.toLowerCase();
  return loaded
    .filter(
      (c) =>
        c.participant.fullName.toLowerCase().includes(lower) ||
        c.participant.username?.toLowerCase().includes(lower),
    )
    .map((c) => ({
      conversationId: c.id,
      participant: {
        id: c.participant.id,
        username: c.participant.username,
        fullName: c.participant.fullName,
        avatarUrl: c.participant.avatarUrl,
      },
      lastMessage: c.lastMessage,
      lastMessageAt: c.lastMessageAt,
      unreadCount: c.unreadCount,
      pinnedAt: c.pinnedAt,
      archivedAt: c.archivedAt,
    }));
}

/** The other person in a thread, with presence already filtered by their privacy setting. */
export async function fetchParticipant(conversationId: string): Promise<{
  id: string;
  username?: string;
  fullName: string;
  avatarUrl?: string;
  lastSeenAt?: string | null;
  lastSeenVisible: boolean;
}> {
  const { data, error } = await getSupabase().rpc('get_conversation_participant', {
    p_conversation: conversationId,
  });
  if (error) throw error;
  const row = ((data || []) as DbRow[])[0];
  if (!row) throw new Error('Participant not found');
  return {
    id: row.id,
    username: row.username || undefined,
    fullName: row.full_name || 'JID Student',
    avatarUrl: row.avatar_url || undefined,
    lastSeenAt: row.last_seen_at ?? null,
    lastSeenVisible: row.last_seen_visible !== false,
  };
}

/** Creates (or finds) a 1:1 thread with another user. */
export async function getOrCreateConversation(
  otherUserId: string,
  listingRef?: {
    id: string;
    title: string;
    price: number;
    image: string;
    type: 'marketplace' | 'property';
  },
): Promise<string> {
  const { data, error } = await getSupabase().rpc('get_or_create_direct_conversation', {
    other_user: otherUserId,
    p_listing_type: listingRef?.type ?? null,
    p_listing_id: listingRef?.id ?? null,
    p_listing_title: listingRef?.title ?? null,
    p_listing_price: listingRef?.price ?? null,
    p_listing_image: listingRef?.image ?? null,
  });
  if (error) throw error;
  return data as string;
}

/** Marks every message in a thread read for the current user. */
export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await getSupabase().rpc('mark_conversation_read', {
    conv_id: conversationId,
  });
  if (error) throw error;
}

export interface ConversationSubscription {
  /** Fires when a membership row changes — pin, archive or mute. */
  onMembershipChange: (conversationId: string, row: DbRow) => void;
}

/**
 * Subscribes to this user's membership rows.
 *
 * Pinning or archiving on one device then updates the other without a refetch.
 * The filter is on `user_id`, which RLS already scopes to the caller.
 */
export function subscribeToMemberships(
  userId: string,
  handlers: ConversationSubscription,
): () => void {
  const sb = getSupabase();
  const channel = sb
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'conversation_participants',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const row = payload.new as DbRow;
        if (row?.conversation_id) handlers.onMembershipChange(row.conversation_id, row);
      },
    );

  channel.subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}

export { mapMessage };