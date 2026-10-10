/**
 * Last-seen wording.
 *
 * One function owns every way a person's availability is described, so the chat
 * header, the conversation list and a push-notification preview can never
 * disagree, and so a change to the vocabulary is a one-line change.
 *
 * The ladder — Online, Last seen just now, Last seen <n> minutes ago, Last seen
 * today, Last seen this week, Last seen <n> months ago — is deliberately
 * coarse. Precise timestamps ("last seen 47 minutes ago") invite people to build
 * a picture of somebody's movements, which is exactly the surveillance the
 * privacy switch is meant to avoid. Approximate buckets say the same thing with
 * far less personal data implied.
 */

/** Anything inside this window is "just now" rather than a minute count. */
const JUST_NOW_MS = 45 * 1000;
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export type PresenceLabel =
  | { kind: 'online'; text: 'Online' }
  | { kind: 'recent'; text: string }
  | { kind: 'stale'; text: string }
  | { kind: 'hidden' }
  | { kind: 'unavailable' };

/** Starts a capital, used where the label begins a sentence (push bodies). */
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function presenceLabel(params: {
  isOnline: boolean;
  lastSeenAt?: string | null;
  visible: boolean;
  now?: number;
}): PresenceLabel {
  const { isOnline, lastSeenAt, visible } = params;
  const now = params.now ?? Date.now();

  // Live presence beats everything: they are in the thread right now.
  if (isOnline) return { kind: 'online', text: 'Online' };

  // Opted out. Returning a distinct kind means callers cannot accidentally
  // render a stale "Last seen" cached from before the switch was flipped.
  if (!visible) return { kind: 'hidden' };

  if (!lastSeenAt) return { kind: 'unavailable' };

  const then = new Date(lastSeenAt).getTime();
  if (Number.isNaN(then)) return { kind: 'unavailable' };

  const elapsed = now - then;

  // A clock skew between two phones can put last_seen_at slightly in the future.
  // Clamping to zero reads as "just now" rather than as a negative duration.
  if (elapsed < JUST_NOW_MS) return { kind: 'recent', text: 'Last seen just now' };

  if (elapsed < HOUR) {
    const minutes = Math.floor(elapsed / MINUTE);
    return { kind: 'recent', text: `Last seen ${minutes} min ago` };
  }

  if (elapsed < DAY) {
    const hours = Math.floor(elapsed / HOUR);
    return hours === 1 ? { kind: 'recent', text: 'Last seen an hour ago' } : { kind: 'recent', text: `Last seen ${hours} hours ago` };
  }

  if (elapsed < 2 * DAY) return { kind: 'stale', text: 'Last seen yesterday' };
  if (elapsed < 7 * DAY) return { kind: 'stale', text: 'Last seen this week' };
  if (elapsed < 30 * DAY) {
    const weeks = Math.floor(elapsed / (7 * DAY));
    return { kind: 'stale', text: `Last seen ${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago` };
  }
  if (elapsed < 365 * DAY) {
    const months = Math.floor(elapsed / (30 * DAY));
    return { kind: 'stale', text: `Last seen ${months} ${months === 1 ? 'month' : 'months'} ago` };
  }
  return { kind: 'stale', text: 'Last seen a long time ago' };
}

/** Plain-text form, for the subtitle line and accessibility labels. */
export function presenceText(params: Parameters<typeof presenceLabel>[0]): string | null {
  const label = presenceLabel(params);
  if (label.kind === 'hidden') return null;
  if (label.kind === 'unavailable') return null;
  return label.text;
}

/**
 * What the chat header shows instead of last seen while somebody is typing.
 *
 * "typing" is strictly more informative than any timestamp, so it takes the slot.
 */
export function typingSubtitle(name: string): string {
  const first = name.split(' ')[0] || name;
  return `${first} is typing…`;
}

/** Push-notification form of a last-seen string, capitalised. */
export const forNotification = (text: string | null): string | null =>
  text ? capitalise(text) : null;