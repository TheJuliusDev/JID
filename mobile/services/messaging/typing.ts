/**
 * Typing indicators.
 *
 * Built on Supabase Realtime **broadcast**, not on a database table. That choice
 * is what makes typing indicators cheap enough to have: nothing is written, so
 * there is no row per keystroke, no index to bloat, and no cleanup job when
 * somebody's phone dies mid-sentence. Presence of the event *is* the signal.
 *
 * Traffic is shaped deliberately. A person typing "good afternoon" generates
 * dozens of keystrokes and a naive implementation would broadcast every one of
 * them. Instead:
 *
 *   - the first keystroke sends immediately, so the indicator appears instantly;
 *   - subsequent keystrokes within `THROTTLE_MS` send nothing;
 *   - after `THROTTLE_MS` of silence an explicit "stopped" is sent;
 *   - sending a message, blurring the composer or leaving the screen all send a
 *     stop, so the indicator cannot get stuck on.
 *
 * That is one or two messages per burst of typing rather than one per character.
 */
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase } from '@/services/supabase';

/** Minimum gap between two broadcasts for one user. */
const THROTTLE_MS = 2000;
/**
 * How long a remote indicator stays lit without a refresh.
 *
 * A safety net for the case where the "stopped" broadcast never arrives — the
 * sender's process was killed, their connection dropped, or they force-quit the
 * app. Without it the other person would stare at "typing…" forever.
 */
const STALE_AFTER_MS = 5000;
/** One past STALE_AFTER_MS, so state can be evaluated without re-arming timers. */
const EXPIRY_MS = 6000;

export interface TypingState {
  userId: string;
  name: string;
  /** Epoch ms of the last broadcast seen. Compared against EXPIRY_MS. */
  at: number;
}

export interface TypingChannel {
  /** Notifies on every state change, including the automatic expiry. */
  onChange: (typing: TypingState | null) => void;
  /** Call on every composer change. Throttles internally. */
  notifyTyping: (name: string) => void;
  /** Call on send, blur or unmount. Sends the stop immediately. */
  notifyStopped: () => void;
  teardown: () => void;
}

/**
 * Joins the typing channel for one conversation.
 *
 * Returns a handle whose `teardown` removes the channel; the thread screen calls
 * it from its effect cleanup. Both an explicit stop and the teardown send a
 * "stopped" so the other side's indicator clears the moment the user leaves
 * rather than lingering for the stale timeout.
 */
export function joinTypingChannel(
  conversationId: string,
  self: { userId: string; name: string },
  onChange: (typing: TypingState | null) => void,
): TypingChannel {
  const sb = getSupabase();

  // `self: false` keeps the sender from receiving their own broadcast, so a user
  // typing in a thread with nobody else in it does not see "You are typing…".
  const channel: RealtimeChannel = sb.channel(`typing:${conversationId}`, {
    config: { broadcast: { self: false } },
  });

  let remote: TypingState | null = null;
  let lastSentAt = 0;
  let stopTimer: ReturnType<typeof setTimeout> | null = null;
  let expiryTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const publish = (payload: Record<string, unknown>) => {
    // `send` is fire-and-forget; the promise resolves when the socket accepts
    // the frame. A rejection here would be an unhandled rejection, so it is
    // caught rather than surfaced — a missed typing hint is not worth an error.
    void channel.send({ type: 'broadcast', event: 'typing', payload }).catch(() => undefined);
  };

  const emit = () => {
    if (closed) return;
    onChange(remote);
  };

  /** Clears the remote indicator once its last update goes stale. */
  const armExpiry = () => {
    if (expiryTimer) clearTimeout(expiryTimer);
    if (!remote) return;
    expiryTimer = setTimeout(() => {
      if (!remote) return;
      remote = null;
      emit();
    }, EXPIRY_MS);
  };

  const setRemote = (next: TypingState | null) => {
    remote = next;
    armExpiry();
    emit();
  };

  channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
    const data = payload as { userId?: string; name?: string; isTyping?: boolean };
    if (!data?.userId || data.userId === self.userId) return;

    if (data.isTyping) {
      setRemote({ userId: data.userId, name: data.name || 'Someone', at: Date.now() });
      return;
    }

    // An explicit stop, but only if it is the person currently shown as typing.
    if (remote?.userId === data.userId) setRemote(null);
  });

  channel.subscribe();

  const clearStopTimer = () => {
    if (stopTimer) {
      clearTimeout(stopTimer);
      stopTimer = null;
    }
  };

  const notifyTyping = (name: string) => {
    if (closed) return;
    const now = Date.now();

    // First keystroke of a burst goes out at once: the indicator appearing
    // instantly is most of what makes it feel responsive.
    if (now - lastSentAt >= THROTTLE_MS) {
      lastSentAt = now;
      publish({ userId: self.userId, name, isTyping: true });
    }

    // Schedule the stop for whenever this burst goes quiet.
    clearStopTimer();
    stopTimer = setTimeout(() => {
      if (closed) return;
      lastSentAt = 0;
      publish({ userId: self.userId, name, isTyping: false });
    }, THROTTLE_MS);
  };

  const notifyStopped = () => {
    if (closed) return;
    clearStopTimer();
    if (lastSentAt === 0) return;
    lastSentAt = 0;
    publish({ userId: self.userId, name: self.name, isTyping: false });
  };

  return {
    onChange,
    notifyTyping,
    notifyStopped,
    teardown: () => {
      // Leaving is itself a signal to stop, sent before the channel closes.
      if (!closed) notifyStopped();
      closed = true;
      clearStopTimer();
      if (expiryTimer) clearTimeout(expiryTimer);
      void sb.removeChannel(channel);
    },
  };
}

/** Whether a remote typing state is still fresh enough to show. */
export const isTypingFresh = (state: TypingState | null, now = Date.now()): boolean =>
  Boolean(state && now - state.at <= STALE_AFTER_MS);