/**
 * notify-push — sends a Web Push notification for each new chat message.
 *
 * Supabase cannot send Web Push by itself, so this function is the sender. It is
 * invoked by a Database Webhook on `public.messages` (INSERT only), which means
 * a message never waits on push: the webhook runs after the row commits and a
 * slow or failing push service can never delay or fail the actual send.
 *
 * Required secrets (supabase secrets set notify-push-vapid-private ...):
 *   VAPID_PRIVATE_KEY   the private half of the pair
 *   VAPID_PUBLIC_KEY    (optional here; only used for logging)
 *   VAPID_SUBJECT       mailto: or https: contact for the push service
 *
 * The `web-push` npm package is imported from esm.sh; there is no lockfile to
 * maintain for an Edge Function.
 *
 * Deploy:
 *   supabase functions deploy notify-push --no-verify-jwt
 *
 * Webhook setup (Dashboard -> Database -> Webhooks):
 *   INSERT on public.messages -> POST this function, with a body of:
 *   { "record": <the new messages row> }
 */
// @ts-nocheck — Deno runtime, types are not available in this repo.
import webpush from 'https://esm.sh/web-push@3.6.7';

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:support@jidapp.ng';

const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');

if (!privateKey || !publicKey) {
  console.error('[notify-push] VAPID keys are not set; nothing will be sent.');
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, privateKey);
}

/** Messages longer than this are trimmed in the notification preview. */
const PREVIEW_LIMIT = 140;

/**
 * Only notify a student who is not already looking at the app.
 *
 * The service worker suppresses the system notification when it can find a
 * visible window and forwards the payload to the page instead, so this is a
 * bandwidth optimisation as much as a courtesy — but it is the difference
 * between a push arriving instantly and arriving after a slow round trip.
 *
 * `app_sessions.last_ping_at` is maintained by the client (see
 * `src/services/push.ts` consumers) on the same 45s cadence as `last_seen_at`.
 */
const APP_AWAKE_WINDOW_SECONDS = 70;

function buildNotification({ row, senderName, conversationId, otherTitle, otherImage }) {
  const isImage = row.kind === 'image';
  const isVoice = row.kind === 'voice';
  const deleted = Boolean(row.deleted_at);

  let body;
  if (deleted) {
    body = 'This message was deleted.';
  } else if (isImage) {
    // Image previews in a push notification are not supported across browsers,
    // and pushing the raw image would leak the URL to the lock screen. Say what
    // it is instead.
    body = otherImage ? '📷 Photo' : 'Sent a photo';
  } else if (isVoice) {
    body = '🎤 Voice message';
  } else {
    body = String(row.content || '').slice(0, PREVIEW_LIMIT);
  }

  return {
    type: 'message',
    title: senderName || 'New message',
    body,
    // One notification per message. The worker also dedupes on this, so a
    // retried webhook cannot produce a second notification.
    tag: `jid-msg-${row.id}`,
    messageId: row.id,
    messageKind: row.kind || 'text',
    conversationId,
    // Deep link. `c` is the conversation, which is what the app needs to open
    // the right thread on a cold start.
    url: conversationId ? `/messages?c=${conversationId}` : '/messages',
    icon: '/android-chrome-192x192.png',
    badge: '/favicon-32x32.png',
    at: Date.now(),
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!privateKey || !publicKey) {
    // 200 so the webhook does not retry forever on a misconfiguration.
    return new Response(JSON.stringify({ ok: false, reason: 'vapid-not-configured' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }

  let record;
  try {
    const body = await req.json();
    record = body.record ?? body;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  if (!record?.conversation_id || !record?.sender_id) {
    return new Response('Missing conversation_id or sender_id', { status: 400 });
  }

  // Service role: this is the only code path allowed to read other students'
  // push subscriptions, which RLS deliberately denies to the client.
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Recipients = everyone in the thread except the person who just sent it.
    const { data: participants, error: partErr } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', record.conversation_id)
      .neq('user_id', record.sender_id);

    if (partErr) throw partErr;
    if (!participants?.length) {
      return ok({ delivered: 0, reason: 'no-recipients' });
    }

    const recipientIds = participants.map((p) => p.user_id);

    const { data: senders } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', record.sender_id)
      .maybeSingle();

    const { data: conversation } = await supabase
      .from('conversations')
      .select('listing_title, listing_image')
      .eq('id', record.conversation_id)
      .maybeSingle();

    const senderName = senders?.full_name || 'New message';

    const { data: subs, error: subErr } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', recipientIds);

    if (subErr) throw subErr;
    if (!subs?.length) {
      return ok({ delivered: 0, reason: 'no-subscriptions' });
    }

    // Skip students who have the app open right now — the worker will hand the
    // payload to their visible page instead.
    const { data: awake } = await supabase
      .from('app_sessions')
      .select('user_id')
      .in('user_id', recipientIds)
      .gte('last_ping_at', new Date(Date.now() - APP_AWAKE_WINDOW_SECONDS * 1000).toISOString());

    const awakeIds = new Set((awake || []).map((a) => a.user_id));
    const targets = subs.filter((s) => !awakeIds.has(s.user_id));

    if (!targets.length) {
      return ok({ delivered: 0, reason: 'all-recipients-awake' });
    }

    const payload = buildNotification({
      row: record,
      senderName,
      conversationId: record.conversation_id,
      otherTitle: conversation?.listing_title,
      otherImage: conversation?.listing_image,
    });

    // Fire in parallel but bounded: a 1,000-subscriber thread must not open
    // 1,000 sockets at once.
    const results = await mapWithConcurrency(targets, 10, async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload),
          { TTL: 300, urgency: 'high' }
        );
        await supabase
          .from('push_subscriptions')
          .update({ last_ok_at: new Date().toISOString() })
          .eq('id', sub.id);
        return { ok: true };
      } catch (err) {
        const status = err?.statusCode;
        // 404/410 mean the browser dropped the subscription; prune the row so
        // the list does not grow without bound.
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          return { ok: false, pruned: true };
        }
        console.warn('[notify-push] send failed', status, err?.message);
        return { ok: false, pruned: false };
      }
    });

    const delivered = results.filter((r) => r.ok).length;
    return ok({ delivered, recipients: recipientIds.length, skippedAwake: awakeIds.size });
  } catch (err) {
    // Always answer 200: a non-2xx makes Supabase retry the webhook, and a
    // retry cannot fix a bug in here — it would only spam the push service.
    console.error('[notify-push] failed', err);
    return ok({ delivered: 0, error: 'dispatch-failed' });
  }
});

function ok(payload) {
  return new Response(JSON.stringify({ ok: true, ...payload }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

/** `Promise.all` in slices, so one thread cannot exhaust the function's sockets. */
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}
