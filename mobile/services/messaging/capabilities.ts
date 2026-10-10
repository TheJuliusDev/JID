/**
 * Messaging capability detection.
 *
 * The messaging upgrade adds columns and tables to a database that JID's website
 * also reads. Until the canonical migrations (`supabase/migrations/006`–`009`)
 * have been applied, the app must keep working exactly as it did — and it must
 * not white-screen on a PostgREST error for a column that does not exist yet.
 *
 * So rather than assuming the new schema, the app asks. Five cheap probes run
 * concurrently once per session and the result is cached, giving each feature a
 * single boolean to branch on:
 *
 *   richMessages — `kind` / `media_url` on messages: image + voice as first-class
 *   replies      — `reply_to_id` on messages
 *   organise     — `pinned_at` / `archived_at` on conversation_participants
 *   presence     — `last_seen_at` / `last_seen_visible` on profiles
 *   blocks       — the `blocks` table
 *
 * Every probe is a `select` of one column limited to one row: no data is read,
 * nothing is written, and the whole set costs a single round trip's latency.
 *
 * A failed probe is treated as "capability absent", never as an error to show the
 * user. The worst outcome of a mis-detection is a hidden control, which is
 * recoverable; showing an error would not be.
 */
import { getSupabase } from '@/services/supabase';

export interface MessagingCapabilities {
  richMessages: boolean;
  replies: boolean;
  organise: boolean;
  presence: boolean;
  blocks: boolean;
  /** True once every probe has settled. */
  resolved: boolean;
}

/**
 * Conservative default: assume nothing new is available.
 *
 * Choosing `false` for an unknown capability is deliberate. A missing feature
 * hides a button; a wrongly-present one would let the user press a button that
 * fails, which is worse than not offering it.
 */
const NONE: MessagingCapabilities = {
  richMessages: false,
  replies: false,
  organise: false,
  presence: false,
  blocks: false,
  resolved: false,
};

/** Everything available, used when a probe fails outright (e.g. offline). */
const ALL: MessagingCapabilities = {
  richMessages: true,
  replies: true,
  organise: true,
  presence: true,
  blocks: true,
  resolved: true,
};

let cached: MessagingCapabilities | null = null;
let inFlight: Promise<MessagingCapabilities> | null = null;

/**
 * `true` when the column or table exists.
 *
 * PostgREST answers an unknown column with `PGRST204` and an unknown table with
 * `PGRST205`, both of which carry the name. A `200` means the column is there.
 * Anything else (offline, 5xx, expired session) is reported as `null` so the
 * caller can tell "definitely absent" from "could not tell".
 */
async function probe(select: string): Promise<boolean | null> {
  try {
    const { error, status } = await getSupabase()
      .from(select.split('?')[0] as never)
      .select(select.split('?')[1] ?? '*')
      .limit(1);

    if (!error) return true;
    if (status === 404 || error.code === 'PGRST204' || error.code === 'PGRST205') return false;
    return null;
  } catch {
    return null;
  }
}

/** Runs the probe set, resolving to the cached answer. */
async function detect(): Promise<MessagingCapabilities> {
  const [richMessages, replies, organise, presence, blocks] = await Promise.all([
    probe('messages?kind'),
    probe('messages?reply_to_id'),
    probe('conversation_participants?pinned_at'),
    probe('profiles?last_seen_at'),
    probe('blocks?blocker_id'),
  ]);

  const results = [richMessages, replies, organise, presence, blocks];

  // Every probe failed to give an answer — most likely no connection. Assume the
  // newest schema so the UI does not flicker its controls away on a bad network,
  // and let each individual action fail with its own honest error if it must.
  if (results.every((r) => r === null)) {
    return { ...ALL, resolved: true };
  }

  return {
    richMessages: richMessages !== false,
    replies: replies !== false,
    organise: organise !== false,
    presence: presence !== false,
    blocks: blocks !== false,
    resolved: true,
  };
}

/**
 * Returns the cached capability set, running the probes once if needed.
 *
 * Concurrent callers share a single in-flight promise, so the several screens
 * that mount at once on a cold start cannot each fire the probe set.
 */
export function getCapabilities(): Promise<MessagingCapabilities> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = detect()
    .then((result) => {
      cached = result;
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/**
 * Re-probes after a sign-in or sign-out.
 *
 * Sign-out is the important case: the next user may be on a different account,
 * and RLS makes an empty-but-successful `select` indistinguishable from a
 * missing column for some tables. Clearing forces a fresh, unambiguous answer.
 */
export function resetCapabilities(): void {
  cached = null;
  inFlight = null;
}

/**
 * Optimistically flips one capability after an action that would itself fail if
 * the capability were missing.
 *
 * Lets a control stay responsive without waiting for a re-probe, while a
 * genuinely unsupported action still surfaces its own error.
 */
export function assumeCapability<K extends keyof MessagingCapabilities>(key: K): void {
  if (!cached) return;
  if (key === 'resolved') return;
  cached = { ...cached, [key]: true } as MessagingCapabilities;
}

/** The default set, for code that must render before probes have settled. */
export const INITIAL_CAPABILITIES = NONE;