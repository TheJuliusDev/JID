/**
 * Online / last-seen presence.
 *
 * Two mechanisms, deliberately different, so presence costs no polling:
 *
 *   "Online now"  — Supabase Realtime **Presence** over the websocket the app
 *                   already holds open. The client's own heartbeat inside that
 *                   socket is what marks it online, so this needs no request of
 *                   its own. Going offline (closing the tab, losing signal)
 *                   clears it within seconds with no extra work from us.
 *
 *   "Last seen"   — `profiles.last_seen_at`, written by `touchLastSeen()` at most
 *                   once every 45s and only while the tab is visible and focused.
 *                   The RPC clamps writes server-side too, so a tampered client
 *                   cannot turn this into a polling loop.
 *
 * Privacy: the read paths in `get_my_conversations()` already null out
 * `last_seen_at` when a student sets `presence_visible = false`, and the typing
 * surface hides the Online row entirely in that case. A settings toggle only has
 * to flip the column.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { touchLastSeen } from './database';

export interface PresenceSnapshot {
  /** Ids currently connected on at least one device. */
  onlineIds: string[];
}

/**
 * Track "who is online" for the whole signed-in student.
 *
 * Presence state is per-channel, not per-conversation, so one channel serves the
 * entire app: the conversation list, the chat header and the profile all read
 * the same set. Callers get a live-updating snapshot plus the raw channel if they
 * need to read presence state for a specific user.
 */
export function subscribeToPresence(
  userId: string,
  onChange: (snapshot: PresenceSnapshot, channel: RealtimeChannel) => void
): () => void {
  const client = supabase;
  if (!client) return () => {};

  const channel = client.channel('presence:online', {
    config: { presence: { key: userId } },
  });

  const publish = () => {
    void channel.track({
      userId,
      onlineAt: new Date().toISOString(),
      // Lets the UI show "Last seen today" without a second round trip.
      lastSeenAt: new Date().toISOString(),
    });
  };

  channel
    .on('presence', { event: 'sync' }, () => {
      onChange(readSnapshot(channel), channel);
    })
    // A peer appearing or leaving updates the list immediately. Handling `join`
    // and `leave` separately is what makes someone's status flip the moment they
    // open the app, rather than on the next full sync.
    .on('presence', { event: 'join' }, () => onChange(readSnapshot(channel), channel))
    .on('presence', { event: 'leave' }, () => onChange(readSnapshot(channel), channel))
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') publish();
    });

  return () => {
    // Untrack before closing, otherwise this device can linger as "online" for
    // the channel's presence timeout after logout.
    try {
      void channel.untrack();
    } catch {
      /* socket already gone */
    }
    client.removeChannel(channel);
  };
}

function readSnapshot(channel: RealtimeChannel): PresenceSnapshot {
  const state = channel.presenceState() as Record<string, unknown[]>;
  const ids = new Set<string>();
  for (const presences of Object.values(state)) {
    for (const entry of presences) {
      const id = (entry as { userId?: string })?.userId;
      if (id) ids.add(id);
    }
  }
  return { onlineIds: [...ids] };
}

/** True when a specific user is connected right now, given a live channel. */
export function isOnline(channel: RealtimeChannel | null, userId: string): boolean {
  if (!channel) return false;
  try {
    const state = channel.presenceState<{ userId?: string }>();
    return Object.values(state).some((entries) => entries.some((e) => e?.userId === userId));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Last-seen heartbeat
// ---------------------------------------------------------------------------

const HEARTBEAT_MS = 45_000;

/**
 * Start writing `last_seen_at` while this device is in use.
 *
 * Gated on `visibilitychange` and focus: a backgrounded tab is not "active", so
 * it stops claiming the student is around. Always returns a cleanup function.
 */
export function startLastSeenHeartbeat(userId: string): () => void {
  if (!userId) return () => {};

  let timer: number | null = null;
  let stopped = false;

  const isActive = () => document.visibilityState === 'visible' && document.hasFocus();

  const beat = () => {
    if (stopped || !isActive()) return;
    void touchLastSeen();
  };

  const schedule = () => {
    if (timer) window.clearInterval(timer);
    timer = window.setInterval(beat, HEARTBEAT_MS);
  };

  const onVisible = () => {
    if (!isActive()) return;
    // Catch up immediately after a long background, so a student who left the
    // tab open overnight still shows a fresh timestamp.
    beat();
    schedule();
  };

  const onHidden = () => {
    if (timer) window.clearInterval(timer);
    timer = null;
  };

  beat();
  schedule();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('focus', onVisible);
  window.addEventListener('pagehide', onHidden);

  return () => {
    stopped = true;
    onHidden();
    document.removeEventListener('visibilitychange', onVisible);
    window.removeEventListener('focus', onVisible);
    window.removeEventListener('pagehide', onHidden);
    // One last beat so closing the tab does not leave a stale timestamp.
    void touchLastSeen();
  };
}

// ---------------------------------------------------------------------------
// Human-readable presence text
// ---------------------------------------------------------------------------

/**
 * Format a presence label for the chat header.
 *
 * `isOnline` wins outright. Otherwise the copy is bucketed into the same
 * "recently / today / yesterday" bands people expect from other messaging apps,
 * and anything older than a week is deliberately not shown at all.
 */
export function formatPresence(options: {
  isOnline: boolean;
  lastSeenAt?: string;
  /** False when the other student has hidden their presence in settings. */
  visible?: boolean;
  now?: Date;
}): string {
  const { isOnline, lastSeenAt, visible = true } = options;
  if (!visible) return '';
  if (isOnline) return 'Online';
  if (!lastSeenAt) return 'Offline';

  const then = new Date(lastSeenAt);
  if (Number.isNaN(then.getTime())) return 'Offline';

  const now = options.now ?? new Date();
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return 'Last seen just now';
  if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    return `Last seen ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayMs = 86_400_000;
  const days = Math.floor((startOfToday - then.getTime()) / dayMs);

  if (then.getTime() >= startOfToday) return 'Last seen today';
  if (days === 1) return 'Last seen yesterday';
  if (days < 7) return `Last seen ${days} days ago`;
  return 'Last seen this week';
}
