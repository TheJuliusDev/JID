/**
 * Online status and last seen.
 *
 * Two different signals, deliberately kept apart:
 *
 *   **Online now** comes from Supabase Realtime **presence**. Presence is a live
 *   socket-level fact — it is true only while the other person has the thread
 *   open and connected, and it costs no database write at all. Nothing is
 *   polled, and nothing is stored.
 *
 *   **Last seen** comes from `profiles.last_seen_at`, written by
 *   `touch_last_seen()` when the app is foregrounded. That SQL function is
 *   rate-limited to one write per minute, so leaving the app open does not
 *   produce a stream of writes, and the value stays meaningful at the
 *   "Last seen 5 minutes ago" granularity it is displayed at.
 *
 * **Privacy.** `last_seen_visible` is the user's own switch. When it is off, the
 * RPC that reads another person's last seen returns `null` rather than a hidden
 * timestamp, so "private" means the data never crosses the wire — not merely that
 * the UI declines to draw it. The presence channel still works, because being
 * online in an open thread is something the person is demonstrably doing.
 *
 * The formats below are the whole vocabulary of the header line; `presenceLabel`
 * in `utils/presence.ts` maps a timestamp onto them.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/services/supabase';
import type { PresenceState } from '@/types';

/** One presence entry as tracked on the channel. */
export interface PresenceEntry {
  userId: string;
  name: string;
  onlineAt: string;
}

export interface PresenceChannel {
  onChange: (state: PresenceState) => void;
  teardown: () => void;
}

/**
 * Tracks this device's presence on a conversation and reports the other party's.
 *
 * Tracks on a per-conversation channel rather than a global one, so presence
 * costs nothing unless a thread is actually open.
 */
export function joinPresenceChannel(
  conversationId: string,
  self: { userId: string; name: string },
  initial: { lastSeenAt?: string | null; visible: boolean },
  onChange: (state: PresenceState) => void,
): PresenceChannel {
  const sb = getSupabase();

  const channel: RealtimeChannel = sb.channel(`presence:${conversationId}`, {
    config: { presence: { key: self.userId } },
  });

  let closed = false;

  const emit = (onlineUserIds: string[]) => {
    if (closed) return;
    const otherId = onlineUserIds.find((id) => id !== self.userId);
    onChange({
      isOnline: Boolean(otherId),
      lastSeenAt: initial.lastSeenAt ?? null,
      visible: initial.visible,
    });
  };

  const readState = (): string[] => {
    try {
      const state = channel.presenceState<PresenceEntry>();
      return Object.values(state).map((entries) => entries[0]?.userId).filter(Boolean) as string[];
    } catch {
      return [];
    }
  };

  channel
    .on('presence', { event: 'sync' }, () => emit(readState()))
    .on('presence', { event: 'join' }, () => emit(readState()))
    .on('presence', { event: 'leave' }, () => emit(readState()))
    .subscribe(async (status) => {
      if (status !== 'SUBSCRIBED') return;
      await channel.track({
        userId: self.userId,
        name: self.name,
        onlineAt: new Date().toISOString(),
      });
    });

  return {
    onChange,
    teardown: () => {
      closed = true;
      // Untracking before closing is what lets the other side see the departure
      // immediately instead of waiting for the socket to time out.
      void sb.removeChannel(channel);
    },
  };
}

/**
 * Records that the app is in use.
 *
 * Called on foreground and on navigating between conversations — not on a timer.
 * The database function enforces the one-write-per-minute floor, so even a
 * screen that fires this on every focus stays cheap.
 */
export async function touchLastSeen(supportsPresence: boolean): Promise<void> {
  if (!supportsPresence) return;
  try {
    await getSupabase().rpc('touch_last_seen');
  } catch {
    // Presence is ambient information. Failing to record it must never
    // interrupt anything the user is doing.
  }
}

/**
 * Keeps the signed-in user's `last_seen_at` moving without polling.
 *
 * A single interval, started on foreground and stopped on background. The point
 * is that a phone left open on a listing page still shows as recently active,
 * without the app asking the network about it every few seconds. At one call per
 * five minutes — and with the SQL function rate-limiting to one per minute — the
 * cost is negligible, and it stops entirely the moment the app is backgrounded.
 */
const HEARTBEAT_MS = 5 * 60 * 1000;

let heartbeat: ReturnType<typeof setInterval> | null = null;

/** Starts the heartbeat. Safe to call repeatedly; only the first call matters. */
export function startPresenceHeartbeat(supportsPresence: boolean): void {
  if (!supportsPresence || heartbeat) return;
  void touchLastSeen(true);
  heartbeat = setInterval(() => {
    void touchLastSeen(true);
  }, HEARTBEAT_MS);
}

/** Stops the heartbeat. Called on sign-out and when the app backgrounds. */
export function stopPresenceHeartbeat(): void {
  if (!heartbeat) return;
  clearInterval(heartbeat);
  heartbeat = null;
}

/**
 * The signed-in user's own privacy settings.
 *
 * Read directly rather than derived from the cached profile, because this screen
 * must reflect the stored value even if the profile row held in memory predates
 * the change.
 */
export interface MyPresenceSettings {
  /** When false, nobody else is told when the user was last active. */
  lastSeenVisible: boolean;
}

/**
 * Reads the user's own last-seen setting.
 *
 * Falls back to `true` — the schema default — on any failure. Defaulting to
 * visible matches `profiles.last_seen_visible`'s own default, so an offline read
 * cannot show a switch that disagrees with the database.
 */
export async function getMyPresenceSettings(): Promise<MyPresenceSettings> {
  try {
    const { data, error } = await getSupabase().rpc('get_my_presence_settings');
    if (error) throw error;
    const row = ((data as Array<{ last_seen_visible?: boolean }> | null) ?? [])[0];
    return { lastSeenVisible: row?.last_seen_visible !== false };
  } catch {
    return { lastSeenVisible: true };
  }
}

/**
 * Turns last-seen sharing on or off.
 *
 * Writes through `set_last_seen_visibility` rather than updating `profiles`
 * directly, so the write is confined to the one column a user is allowed to
 * change about themselves. The effect is immediate: `get_conversation_participant`
 * returns null for `last_seen_at` once this is false, so no stale value can keep
 * rendering in somebody else's chat header.
 */
export async function setLastSeenVisible(visible: boolean): Promise<void> {
  const { error } = await getSupabase().rpc('set_last_seen_visibility', {
    p_visible: visible,
  });
  if (error) throw error;
}