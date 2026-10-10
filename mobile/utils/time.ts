/**
 * Relative-time formatting for chat, listings and notifications.
 *
 * Mirrors the website's behaviour: "just now", "5m", "2h", "Yesterday",
 * "Mon", "12 Mar". Chats need a compact form so rows stay one line; listings
 * need a slightly more explicit one so "2h ago" is unambiguous about age.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

/** Compact stamp for message-list rows: "9:41", "Yesterday", "12 Mar". */
export const shortTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();

  if (isSameDay(date, now)) {
    return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  }

  const yesterday = new Date(now.getTime() - DAY);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  // Within the last week, a weekday name is more useful than a date.
  if (now.getTime() - date.getTime() < 6 * DAY) {
    return date.toLocaleDateString(undefined, { weekday: 'short' });
  }

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

/** Same as `shortTime`, but with the year once dates are in other years. */
export const timeWithYear = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const base = shortTime(iso);
  return date.getFullYear() === now.getFullYear() ? base : `${base}, ${date.getFullYear()}`;
};

/**
 * Separator above a group of messages: "Today", "Yesterday", or a full date.
 */
export const daySeparator = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const now = new Date();
  if (isSameDay(date, now)) return 'Today';

  const yesterday = new Date(now.getTime() - DAY);
  if (isSameDay(date, yesterday)) return 'Yesterday';

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
  });
};

/** How long ago, in words: "just now", "5 min ago", "3 days ago". */
export const timeAgo = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';

  const diff = Date.now() - date.getTime();
  if (diff < MINUTE) return 'just now';
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} min ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hr${h === 1 ? '' : 's'} ago`;
  }
  if (diff < 7 * DAY) {
    const d = Math.floor(diff / DAY);
    return `${d} day${d === 1 ? '' : 's'} ago`;
  }
  if (diff < 30 * DAY) {
    const w = Math.floor(diff / (7 * DAY));
    return `${w} week${w === 1 ? '' : 's'} ago`;
  }
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** "Listed 3 days ago" / "Listed just now", for listing detail pages. */
export const listedAgo = (iso: string): string => {
  const ago = timeAgo(iso);
  return ago === 'just now' ? 'Listed just now' : `Listed ${ago}`;
};

/**
 * Groups consecutive messages by calendar day for the chat transcript, so day
 * headers can be interleaved without recomputing dates in the list body.
 */
export const groupMessagesByDay = <T extends { createdAt: string }>(
  messages: T[],
): Array<{ day: string; messages: T[] }> => {
  const groups: Array<{ day: string; messages: T[] }> = [];
  let currentKey = '';

  for (const message of messages) {
    const date = new Date(message.createdAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    if (key !== currentKey) {
      currentKey = key;
      groups.push({ day: daySeparator(message.createdAt), messages: [message] });
    } else {
      groups[groups.length - 1].messages.push(message);
    }
  }

  return groups;
};

/** Countdown text for an active boost: "Boosted · 18h left". */
export const boostCountdown = (iso?: string): string => {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return '';
  const hours = Math.ceil(ms / HOUR);
  if (hours >= 24) return `${Math.round(hours / 24)}d left`;
  const minutes = Math.ceil((ms % HOUR) / MINUTE);
  return `${hours}h ${minutes}m left`;
};