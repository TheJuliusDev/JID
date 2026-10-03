/**
 * Web Push for message notifications.
 *
 * Division of labour, so there is exactly one thing that ever raises a
 * notification for a given message:
 *
 *   service worker  — the only thing that shows a system notification. If the
 *                     student has the app open and focused, the worker
 *                     postMessages the payload to the page instead, and the page
 *                     shows an in-app banner (or nothing, if they are already
 *                     reading that thread).
 *   this module     — permission, subscription, and handing the subscription to
 *                     the server so it can be dispatched to.
 *   notify-push     — the Supabase Edge Function that actually sends.
 *
 * There is deliberately no local `new Notification(...)` anywhere: that is what
 * produces the classic double-notification.
 */
import { VAPID_PUBLIC_KEY, hasPushConfig } from '../config/env';
import { requireSupabase } from './supabase';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

/** A push the worker handed us because the app was on screen. */
export interface InAppPushMessage {
  conversationId: string | null;
  messageId: string | null;
  title: string;
  body: string;
  kind: string;
}

export interface PushStatus {
  supported: boolean;
  configured: boolean;
  permission: PushPermission;
  /** True when this browser has a live subscription the server knows about. */
  subscribed: boolean;
}

// ---------------------------------------------------------------------------
// Capability + permission
// ---------------------------------------------------------------------------

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export function getPushPermission(): PushPermission {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission as PushPermission;
}

export function getPushStatus(): PushStatus {
  return {
    supported: isPushSupported(),
    configured: hasPushConfig,
    permission: getPushPermission(),
    subscribed: false,
  };
}

// ---------------------------------------------------------------------------
// Service worker registration
// ---------------------------------------------------------------------------

let registrationPromise: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register `/sw.js` once per page load. Safe to call repeatedly. */
export function registerPushWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return Promise.resolve(null);
  if (registrationPromise) return registrationPromise;

  registrationPromise = navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      // A worker can survive a deploy with an old script; make sure the page is
      // running the version that ships the current push handlers.
      void reg.update();
      return reg;
    })
    .catch((err) => {
      console.warn('[push] service worker registration failed', err);
      return null;
    });

  return registrationPromise;
}

// ---------------------------------------------------------------------------
// Subscription
// ---------------------------------------------------------------------------

// Return type is left to inference: `new Uint8Array(n)` is specifically typed as
// Uint8Array<ArrayBuffer>, which is what PushManager's `applicationServerKey`
// requires. An explicit `Uint8Array` annotation widens it to ArrayBufferLike and
// no longer satisfies the BufferSource overload.
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getSubscription(registration: ServiceWorkerRegistration): Promise<PushSubscription | null> {
  if (!('pushManager' in registration)) return null;
  return registration.pushManager.getSubscription();
}

/**
 * Subscribe this browser and register the subscription with the server.
 *
 * Idempotent: an existing subscription for this origin is reused and its
 * server-side row is refreshed, so calling it on every sign-in is safe and does
 * not create duplicate rows.
 */
export async function enablePush(userId: string): Promise<PushStatus> {
  if (!isPushSupported() || !hasPushConfig) {
    return { supported: isPushSupported(), configured: hasPushConfig, permission: getPushPermission(), subscribed: false };
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    return { supported: true, configured: true, permission, subscribed: false };
  }

  const registration = await registerPushWorker();
  if (!registration || !('pushManager' in registration)) {
    return { supported: true, configured: true, permission, subscribed: false };
  }

  let subscription = await getSubscription(registration);
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await saveSubscription(userId, subscription);

  return { supported: true, configured: true, permission, subscribed: true };
}

/**
 * Store (or refresh) the subscription for this user.
 *
 * `upsert` on `endpoint` means a re-subscribed browser — which gets a brand new
 * endpoint — replaces its old row instead of accumulating dead ones.
 */
export async function saveSubscription(userId: string, subscription: PushSubscription): Promise<void> {
  const sb = requireSupabase();
  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error('This browser returned an incomplete push subscription.');
  }

  const { error } = await sb.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent.slice(0, 300),
    },
    { onConflict: 'endpoint' }
  );
  if (error) throw error;
}

/**
 * Tell the server this browser is no longer reachable (signed out, or push
 * revoked). Best effort — a failure here only means the server retries and gets
 * a 410 back, which it prunes.
 */
export async function removeSubscription(): Promise<void> {
  try {
    const registration = await registerPushWorker();
    const subscription = registration ? await getSubscription(registration) : null;
    if (!subscription) return;
    const sb = requireSupabase();
    await sb.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint);
    await subscription.unsubscribe();
  } catch (err) {
    console.warn('[push] could not remove subscription', err);
  }
}

/** Re-assert the current subscription against the server. Called on sign-in. */
export async function syncPushSubscription(userId: string): Promise<boolean> {
  if (!isPushSupported() || getPushPermission() !== 'granted') return false;
  try {
    const registration = await registerPushWorker();
    if (!registration) return false;
    const subscription = await getSubscription(registration);
    if (!subscription) return false;
    await saveSubscription(userId, subscription);
    return true;
  } catch (err) {
    console.warn('[push] sync failed', err);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Messages handed over by the service worker
// ---------------------------------------------------------------------------

/**
 * Listen for payloads the worker forwarded because the app was on screen.
 * Returns an unsubscribe function.
 */
export function listenForPushMessages(handler: (message: InAppPushMessage) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};

  const onMessage = (event: MessageEvent) => {
    if (!event.data || event.data.type !== 'jid:message') return;
    const p = event.data.payload || {};
    handler({
      conversationId: p.conversationId ?? null,
      messageId: p.messageId ?? null,
      title: p.title || 'JIDapp',
      body: p.body || '',
      kind: p.messageKind || 'text',
    });
  };

  navigator.serviceWorker.addEventListener('message', onMessage);
  return () => navigator.serviceWorker.removeEventListener('message', onMessage);
}

/**
 * Read a `?c=` deep link, so tapping a notification with the app closed lands on
 * the right conversation. Returns null when there is no link.
 */
export function readConversationDeepLink(): string | null {
  if (typeof window === 'undefined') return null;
  const param = new URLSearchParams(window.location.search).get('c');
  return param && /^[0-9a-f-]{36}$/i.test(param) ? param : null;
}
