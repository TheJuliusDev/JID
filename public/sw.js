/* eslint-disable no-restricted-globals */
/**
 * JID service worker — background message notifications.
 *
 * Scope of this file, deliberately narrow:
 *   * receive Web Push messages dispatched by the `notify-push` Edge Function,
 *   * render a notification that deep-links into the right conversation,
 *   * dedupe, so a push delivered twice (retry, two subscribed devices on the
 *     same account) never shows twice.
 *
 * It deliberately does NOT know anything about messages, conversations or the
 * Supabase schema. The push payload is already formatted by the server; this
 * file only displays it.
 *
 * Note on "terminated app" state: on Android, Chrome fires this worker for a
 * push even when no tab is open, and `notificationclick` cold-starts the app.
 * That is the same guarantee a native push token gives.
 */

const CACHE = 'jid-shell-v1';

self.addEventListener('install', (event) => {
  // No pre-cache list: JID is a client-rendered SPA and the shell is already
  // handled by the browser HTTP cache. Failing through to activate immediately
  // keeps a stale worker from pinning an old app version.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  // JID is a client-rendered SPA; the browser's HTTP cache already handles the
  // shell. This worker exists for push only, so it never intercepts requests.
  void event;
});

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

/**
 * Bounded record of which notification tags are already on screen.
 *
 * `tag` alone collapses duplicates in Chrome, but a user can dismiss a
 * notification and then get the same tag again; without this the message would
 * be silently swallowed. Keeping the ids lets us distinguish "still visible"
 * from "already dismissed".
 */
const recentTags = [];
const MAX_RECENT = 50;

function alreadyShown(tag) {
  return recentTags.includes(tag);
}

function remember(tag) {
  recentTags.push(tag);
  if (recentTags.length > MAX_RECENT) recentTags.shift();
}

/**
 * Find a window the student is actually looking at.
 *
 * This is what keeps a background notification from becoming a duplicate of the
 * message the open tab is already rendering over its own realtime socket.
 */
async function findFocusedClient() {
  const clientList = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  return (
    clientList.find((c) => c.visibilityState === 'visible' && c.focused) ||
    clientList.find((c) => c.visibilityState === 'visible') ||
    null
  );
}

self.addEventListener('push', (event) => {
  let payload;
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || 'JIDapp';
  const tag = payload.tag || `jid-${payload.messageId || Date.now()}`;

  event.waitUntil(
    (async () => {
      // Dedupe: the same logical notification must never render twice, even if
      // the server retried the push or two of this student's devices are both
      // subscribed.
      if (alreadyShown(tag)) return;
      remember(tag);

      const focused = await findFocusedClient();

      if (focused) {
        // The app is on screen. Hand the payload over instead of raising a
        // system notification — the page decides whether the student is already
        // reading that thread, and shows an in-app banner only if they are not.
        focused.postMessage({
          type: 'jid:message',
          payload,
        });
        return;
      }

      const options = {
        body: payload.body || '',
        tag,
        renotify: Boolean(payload.tag),
        icon: '/android-chrome-192x192.png',
        badge: '/favicon-32x32.png',
        // Deep link the app acts on when the notification is tapped.
        data: {
          url: payload.url || '/messages',
          conversationId: payload.conversationId || null,
          messageId: payload.messageId || null,
        },
        requireInteraction: false,
        silent: false,
        vibrate: payload.type === 'message' ? [40, 60, 40] : undefined,
        timestamp: payload.at || Date.now(),
      };

      await self.registration.showNotification(title, options);
    })()
  );
});

// ---------------------------------------------------------------------------
// Notification tap -> open the right conversation
// ---------------------------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/messages';
  const conversationId =
    (event.notification.data && event.notification.data.conversationId) || null;

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          // An open tab: hand it the conversation over postMessage so the app
          // navigates without a reload, and focus it.
          client.postMessage({
            type: 'jid:open-conversation',
            conversationId,
            url: target,
          });
          return client.focus();
        }
      }

      // Nothing open: cold start, carrying the target in the URL.
      return self.clients.openWindow(target);
    })()
  );
});

self.addEventListener('notificationclose', () => {
  // Intentionally empty. Recording dismissals is the page's job if it is ever
  // needed; the worker stays stateless apart from the dedupe list above.
});
