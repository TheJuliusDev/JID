/**
 * Safety controls: blocking and reporting.
 *
 * Two very different mechanisms, kept in one module because they are the two
 * halves of "this person is causing a problem":
 *
 *   **Block** is a private, technical silence. Nothing is sent to moderators,
 *   the other person is not told, and their messages stop arriving. It is
 *   enforced symmetrically and server-side, so a block cannot be bypassed by
 *   opening a new thread.
 *
 *   **Report** is a signal to JID's moderation system. The reporter gets a
 *   confirmation and nothing else — there is no queue, no status, no ability to
 *   see what happened, because the mobile app has no moderation surface at all.
 *
 * That separation is deliberate and is the reason both live here rather than
 * being scattered into a chat screen: it is much harder to accidentally ship an
 * admin queue into the consumer app when the queue has no read path here.
 */
import { getSupabase } from '@/services/supabase';
import type { BlockedUser, SafetyReportInput, SafetyReportReason } from '@/types';

/**
 * Report categories.
 *
 * Deliberately jargon-free and few. A long list reads as a legal form and gets
 * abandoned; these six cover what JID actually sees, and "Other" means nobody
 * ever has to pick a wrong box to be believed.
 */
export const REPORT_REASONS: ReadonlyArray<{
  value: SafetyReportReason;
  label: string;
  /** Shown under the label so the user knows what will happen next. */
  help: string;
}> = [
  {
    value: 'scam',
    label: 'Scam or fraud',
    help: 'Asked for money or details up front, then disappeared.',
  },
  {
    value: 'harassment',
    label: 'Harassment or abuse',
    help: 'Threatening, abusive or targeting you repeatedly.',
  },
  {
    value: 'spam',
    label: 'Spam',
    help: 'Repeated adverts or messages unrelated to JID.',
  },
  {
    value: 'inappropriate',
    label: 'Inappropriate content',
    help: 'Offensive images, or content that is not safe to work with.',
  },
  {
    value: 'fake_listing',
    label: 'Fake or misleading listing',
    help: 'The item or room does not exist, or was never really available.',
  },
  {
    value: 'other',
    label: 'Something else',
    help: 'Tell us what happened in your own words.',
  },
];

/** Human label for a stored reason, for the confirmation copy. */
export const reportReasonLabel = (reason: SafetyReportReason): string =>
  REPORT_REASONS.find((r) => r.value === reason)?.label ?? 'Report';

/** Blocks a user. Symmetric: neither party can exchange messages afterwards. */
export async function blockUser(userId: string, reason?: string): Promise<void> {
  const { error } = await getSupabase().rpc('block_user', {
    other_user: userId,
    p_reason: reason ?? null,
  });
  if (error) throw error;
}

/** Lifts a block. */
export async function unblockUser(userId: string): Promise<void> {
  const { error } = await getSupabase().rpc('unblock_user', { other_user: userId });
  if (error) throw error;
}

/** Everyone this account has blocked, newest first. */
export async function listBlockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await getSupabase().rpc('list_blocked_users');
  if (error) throw error;
  return ((data || []) as Array<Record<string, unknown>>).map((row) => ({
    id: row.id as string,
    username: (row.username as string) || undefined,
    fullName: (row.full_name as string) || 'JID Student',
    avatarUrl: (row.avatar_url as string) || undefined,
    blockedAt: row.blocked_at as string,
  }));
}

/**
 * Reports a user.
 *
 * Inserts directly into `user_reports` — the same table and the same RLS policy
 * (`ureports_insert`) the website and `DataProvider.reportUser` already write
 * through, so a report raised from a chat lands in the same moderation queue as
 * one raised from a profile and is triaged identically.
 *
 * There is deliberately no `submit_user_report` RPC: `user_reports` has no
 * server-side derivation, so wrapping the insert would add a hop without adding
 * a single guarantee. The `message_reports` variant below does need one, because
 * it snapshots the reported message.
 */
export async function reportUser(
  reportedUserId: string,
  input: SafetyReportInput,
): Promise<void> {
  const { data: auth } = await getSupabase().auth.getUser();
  const reporterId = auth?.user?.id;
  if (!reporterId) throw new Error('You need to be signed in to send a report.');

  const { error } = await getSupabase().from('user_reports').insert({
    reporter_id: reporterId,
    reported_user_id: reportedUserId,
    reason: input.reason,
    details: input.details ?? null,
    // Present only for a conversation-level report; null for a profile report,
    // which is not about any conversation. See migration 005 for why this is
    // worth recording: without it a "this whole thread is a scam" report reaches
    // moderation with no thread to read.
    conversation_id: input.conversationId ?? null,
  });
  if (error) throw error;
}

/**
 * Reports a specific message.
 *
 * Writes to `message_reports`, which carries `message_id` and `conversation_id`
 * so a moderator can see the offending message in its thread context. That
 * linkage is the whole reason it is a separate table: a user report says "this
 * person is a problem", a message report says "this specific line is a problem",
 * and they have different lifetimes and different triage.
 */
export async function reportMessage(
  reportedUserId: string,
  input: SafetyReportInput & { messageId: string; conversationId: string },
): Promise<void> {
  const { error } = await getSupabase().rpc('submit_message_report', {
    p_reported_user: reportedUserId,
    p_message: input.messageId,
    p_conversation: input.conversationId,
    p_reason: input.reason,
    p_details: input.details ?? null,
  });
  if (error) throw error;
}

/**
 * What a report is being raised against.
 *
 * `user` and `conversation` both resolve to a `user_reports` row — from the
 * recipient's point of view "this account" and "this chat" are the same
 * complaint — while `message` additionally snapshots the offending message and
 * its thread so a moderator can see it in context.
 */
export type SafetyReportTarget =
  | { type: 'user'; userId: string; displayName?: string }
  | { type: 'conversation'; userId: string; conversationId: string; displayName?: string }
  | { type: 'message'; userId: string; conversationId: string; messageId: string; displayName?: string };

/** True when the two users are blocked in either direction. */
export async function isBlockedBetween(otherUserId: string): Promise<boolean> {
  const { data, error } = await getSupabase().rpc('is_blocked_between', {
    p_other: otherUserId,
  });
  if (error) return false;
  return Boolean(data);
}

export interface SafetySubscription {
  onChange: () => void;
}

/**
 * Watches this user's blocks.
 *
 * Used to close a thread the moment the user blocks the person on the other
 * side, instead of leaving an open conversation that silently stops receiving.
 *
 * The canonical table is `blocks` (see migration 006), not the phone draft's
 * `user_blocks` — the website reads and writes the same rows.
 */
export function subscribeToBlocks(userId: string, handlers: SafetySubscription): () => void {
  const sb = getSupabase();
  const channel = sb
    .channel(`blocks:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'blocks',
        filter: `blocker_id=eq.${userId}`,
      },
      () => handlers.onChange(),
    );
  channel.subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}