/**
 * Contextual quick replies.
 *
 * Most first messages in a campus marketplace conversation are one of a handful
 * of questions. Typing "is this still available?" for the fortieth time is the
 * kind of friction that pushes people off-platform into SMS, which is exactly
 * what JID exists to avoid.
 *
 * The sets are chosen by what the conversation is *about* — a room behaves
 * differently from an item — and are written as a student would actually phrase
 * them, because the whole point is that the wording can be sent unedited.
 *
 * The rail is deliberately quiet: it appears on an empty thread or an untouched
 * composer, disappears as soon as the user types or sends, and can be dismissed
 * for the rest of the session. It never blocks the composer or takes a full row
 * of visual weight.
 */
import type { ListingKind } from '@/types';

/**
 * Questions about a room.
 *
 * Ordered by how often a student actually needs the answer, cheapest first:
 * whether it exists at all, then whether they can go and see it, then where, then
 * whether the number is final.
 */
export const ACCOMMODATION_REPLIES: readonly string[] = [
  'Is this still available?',
  'Can I inspect it?',
  'What is the exact location?',
  'Is the price negotiable?',
];

/** Questions about an item for sale. */
export const MARKETPLACE_REPLIES: readonly string[] = [
  'Is this still available?',
  "What's your final price?",
  'Where can I pick it up?',
  'Do you offer delivery?',
];

/**
 * Generic fallbacks, used when a conversation has no listing context at all —
 * usually one started from a profile rather than from a listing.
 */
export const GENERAL_REPLIES: readonly string[] = [
  'Is this still available?',
  'Can I ask a quick question?',
  'Are you available to chat now?',
];

/**
 * Picks the set for a conversation.
 *
 * A conversation carries the listing it was started from, which is the only
 * reliable signal about what is being discussed — the messages themselves may be
 * empty.
 */
export function quickRepliesFor(kind?: ListingKind): readonly string[] {
  if (kind === 'property') return ACCOMMODATION_REPLIES;
  if (kind === 'marketplace') return MARKETPLACE_REPLIES;
  return GENERAL_REPLIES;
}