/**
 * send-message-push — Expo push delivery for new chat messages.
 *
 * Invoked by a Postgres trigger over `pg_net` whenever a row lands in
 * `public.messages`. Runs in Deno (Supabase Edge Functions).
 *
 * WHY A SERVER-SIDE SENDER IS REQUIRED
 * A phone can register its own Expo push token, but delivering a notification
 * to somebody *else's* phone needs a party that holds the recipient's token and
 * can reach Expo's push API. That is this function. Without it a client-side
 * token is inert.
 *
 * DESIGN RULES
 * - Idempotent on `message_id`: Expo may redeliver a trigger invocation and
 *   re-sending would double-notify. Deduped for an hour.
 * - Silent for the sender's own devices.
 * - Respects, in order: OS-level permission (Expo drops these for us), the
 *   recipient's JID preferences, a blocked relationship in either direction,
 *   and a muted conversation.
 * - Never throws into the caller's face: a failed push must not roll back or
 *   block the message insert, so all errors are swallowed after being logged.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Expo's push gateway. Batching is capped at 100 per request.
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_GATEWAY = 'https://gateway.expo.dev/v3/attachments';
const MAX_BATCH = 100;
/** Long enough to absorb an at-least-once trigger redelivery. */
const DEDUPE_WINDOW_MS = 60 * 60 * 1000;

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  kind: 'text' | 'image' | 'voice' | 'system';
  created_at: string;
};

interface PushJob {
  to: string;
  title: string;
  body: string;
  sound: string | null;
  data: Record<string, unknown>;
  badge: number;
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  });

/** Minimal user-facing label for an attachment, since it has no text to quote. */
function attachmentLabel(kind: MessageRow['kind']): string {
  if (kind === 'image') return '📷 Photo';
  if (kind === 'voice') return '🎤 Voice message';
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  // Shared secret the trigger puts in the request. Without it anyone who knows
  // the URL could make the project send arbitrary pushes to arbitrary users.
  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET');

  if (!supabaseUrl || !serviceRole) return json({ error: 'not configured' }, 500);

  const db = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let payload: { type?: string; record?: MessageRow; table?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: 'bad json' }, 400);
  }

  if (webhookSecret) {
    const provided = req.headers.get('x-jid-webhook-secret');
    if (provided !== webhookSecret) return json({ error: 'unauthorised' }, 401);
  }

  const message = payload.record;
  // Only inserts generate a notification. An UPDATE here is a read receipt or a
  // delete, and notifying on those would be nonsense.
  if (payload.type !== 'INSERT' || !message?.conversation_id) {
    return json({ skipped: 'not an insert' });
  }

  const senderId = message.sender_id;

  try {
    // ---- Who is on the other end, and what may they receive? --------------
    const { data: members } = await db
      .from('conversation_participants')
      .select('user_id, muted_at')
      .eq('conversation_id', message.conversation_id);

    const recipients = (members ?? [])
      .map((m) => ({ id: m.user_id as string, mutedAt: m.muted_at as string | null }))
      // Never notify the person who just sent it, on their own other devices.
      .filter((m) => m.id !== senderId);

    if (recipients.length === 0) return json({ sent: 0, reason: 'no recipients' });

    // ---- Blocked relationships are silent in both directions --------------
    const { data: blocks } = await db
      .from('user_blocks')
      .select('blocker_id, blocked_id')
      .or(
        recipients
          .flatMap((r) => [
            `and(blocker_id.eq.${senderId},blocked_id.eq.${r.id})`,
            `and(blocker_id.eq.${r.id},blocked_id.eq.${senderId})`,
          ])
          .join(','),
      );

    const blockedPair = (a: string, b: string) =>
      (blocks ?? []).some(
        (x) =>
          (x.blocker_id === a && x.blocked_id === b) ||
          (x.blocker_id === b && x.blocked_id === a),
      );

    const eligible = recipients.filter((r) => !blockedPair(senderId, r.id));
    if (eligible.length === 0) return json({ sent: 0, reason: 'blocked' });

    // ---- Sender identity for the notification title ----------------------
    const { data: senderProfile } = await db
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderId)
      .single()
      .catch(() => ({ data: null }));

    const senderName = senderProfile?.full_name?.trim() || 'Someone';

    // ---- Per-recipient preferences and tokens -----------------------------
    const ids = eligible.map((r) => r.id);
    const { data: prefs } = await db.from('push_preferences').select('*').in('user_id', ids);
    const { data: tokens } = await db
      .from('push_tokens')
      .select('id, user_id, token, platform')
      .in('user_id', ids)
      .eq('active', true);

    const prefFor = (uid: string) => (prefs ?? []).find((p) => p.user_id === uid) as
      | { messages_enabled: boolean; show_preview: boolean; sound_enabled: boolean }
      | undefined;

    const mutedIds = new Set(eligible.filter((r) => r.mutedAt).map((r) => r.id));

    const attachment = attachmentLabel(message.kind);
    const jobs: PushJob[] = [];

    for (const row of tokens ?? []) {
      const pref = prefFor(row.user_id);

      // Default to sending when no preference row exists: an absent opt-out is
      // not a consent, but it is also not a refusal, and a student who has
      // never opened settings still wants their messages.
      const messagesEnabled = pref?.messages_enabled ?? true;
      if (!messagesEnabled) continue;
      if (mutedIds.has(row.user_id)) continue;

      const showPreview = pref?.show_preview ?? true;
      const soundEnabled = pref?.sound_enabled ?? true;

      let body: string;
      if (attachment) {
        body = showPreview ? `${senderName}: ${attachment}` : `${senderName} sent an attachment`;
      } else if (showPreview) {
        body = `${senderName}: ${message.content}`;
      } else {
        // Redacted: still answers "who and how", not "what".
        body = `${senderName} sent you a message`;
      }

      jobs.push({
        to: row.token,
        title: senderName,
        body,
        sound: soundEnabled ? 'default' : null,
        badge: 1,
        data: {
          type: 'message',
          conversationId: message.conversation_id,
          messageId: message.id,
          senderId,
          senderName,
          kind: message.kind,
          // Tapping the notification opens this exact thread.
          url: `jid://messages/${message.conversation_id}`,
        },
      });
    }

    if (jobs.length === 0) return json({ sent: 0, reason: 'no devices' });

    // ---- Dedupe against a redelivered trigger invocation ------------------
    // Keyed on message id + token so two recipients with the same (impossible,
    // but cheap to defend) token cannot collide.
    const seenKeys = jobs.map((j) => `${message.id}:${j.to}`);
    const { data: recent } = await db
      .from('push_deliveries')
      .select('dedupe_key')
      .in('dedupe_key', seenKeys)
      .gte('created_at', new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString());

    const alreadySent = new Set((recent ?? []).map((r) => r.dedupe_key as string));
    const fresh = jobs.filter((_, i) => !alreadySent.has(seenKeys[i]));

    if (fresh.length === 0) return json({ sent: 0, reason: 'duplicate' });

    // ---- Hand off to Expo, in batches ------------------------------------
    const receipts = await sendToExpo(fresh);
    await recordDeliveries(db, seenKeys, receipts);
    await pruneDeviceTokens(db, receipts);

    return json({
      sent: fresh.length,
      skipped: jobs.length - fresh.length,
      ids: receipts.filter((r) => r.status === 'ok').map((r) => r.id),
    });
  } catch (error) {
    // Never surface an error to the trigger: the message is already saved and
    // the user's chat must not depend on a third-party push gateway.
    console.error('send-message-push failed:', error);
    return json({ error: 'failed' }, 200);
  }
});

/** Posts the jobs to Expo in <=100 message batches. */
async function sendToExpo(jobs: PushJob[]) {
  const out: Array<{ id?: string; status: string; to: string; errorCode?: string }> = [];

  for (let i = 0; i < jobs.length; i += MAX_BATCH) {
    const batch = jobs.slice(i, i + MAX_BATCH);

    const messages = batch.map((job) => ({
      to: job.to,
      title: job.title,
      body: job.body,
      sound: job.sound ?? undefined,
      badge: job.badge,
      data: job.data,
      // Android needs an explicit channel for the notification to be
      // heads-up rather than silently dropped into the tray.
      channelId: 'messages',
      priority: 'high',
      // iOS only: shows a preview on the lock screen.
      interruptionLevel: 'active',
      ttl: 3600,
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages),
      });

      if (!res.ok) {
        console.error('Expo push HTTP', res.status, await res.text());
        continue;
      }

      const body = (await res.json()) as {
        data?: Array<{
          status: string;
          id?: string;
          message?: string;
          details?: { error?: string };
        }>;
      };

      batch.forEach((job, index) => {
        const entry = body.data?.[index];
        out.push({
          id: entry?.id,
          status: entry?.status ?? 'error',
          to: job.to,
          errorCode: entry?.details?.error ?? entry?.message,
        });
      });
    } catch (error) {
      console.error('Expo push request failed:', error);
    }
  }

  return out;
}

/** Persists what was dispatched so a redelivered trigger can skip it. */
async function recordDeliveries(
  db: ReturnType<typeof createClient>,
  keys: string[],
  receipts: Array<{ id?: string; status: string; to: string }>,
) {
  const byToken = new Map(receipts.map((r) => [r.to, r]));
  const rows = keys
    .map((key) => {
      const token = key.slice(key.lastIndexOf(':') + 1);
      const receipt = byToken.get(token);
      if (!receipt) return null;
      return {
        dedupe_key: key,
        expo_id: receipt.id ?? null,
        status: receipt.status,
      };
    })
    .filter(Boolean) as Array<{ dedupe_key: string; expo_id: string | null; status: string }>;

  if (rows.length === 0) return;
  await db.from('push_deliveries').upsert(rows, { onConflict: 'dedupe_key', ignoreDuplicates: true });
}

/**
 * Deactivates tokens Expo reports as permanently invalid.
 *
 * This is what stops a student's phone number being recycled and the new owner
 * receiving messages meant for the previous owner.
 */
async function pruneDeviceTokens(
  db: ReturnType<typeof createClient>,
  receipts: Array<{ status: string; to: string; errorCode?: string }>,
) {
  // Only a permanent rejection justifies deactivating a device. A rate limit or
  // a gateway 5xx is Expo's problem, not the student's registration.
  const permanentlyInvalid = new Set(['DeviceNotRegistered', 'Unregistered', 'MismatchSenderId']);

  const deadTokens = receipts
    .filter((r) => r.status === 'error' && r.errorCode && permanentlyInvalid.has(r.errorCode))
    .map((r) => r.to);

  if (deadTokens.length === 0) return;

  await db.from('push_tokens').update({ active: false }).in('token', deadTokens);
}