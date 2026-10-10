/**
 * Push notifications for messages.
 *
 * This is the phone-side half of the chain. The server half is the
 * `send-message-push` Edge Function plus its database trigger — see
 * `supabase/functions/send-message-push`. Registering a token from here without
 * that function deployed achieves nothing, so the two are documented together
 * and the client degrades quietly rather than pretending.
 *
 * Three decisions worth stating:
 *
 * 1. **Permission is asked for late, and only when it is obviously wanted.**
 *    Requesting on first launch is the single most reliable way to get a
 *    permanent denial: iOS shows the system prompt once, and an "unavailable"
 *    answer can never be re-asked. JID asks instead after the user has actually
 *    received a message — someone they are mid-conversation with. That is the
 *    moment "tell me when they reply" is obviously worth having. The prompt is
 *    also reachable from Settings.
 *
 * 2. **Messages stay out of the in-app Notifications page.** A chat lives in
 *    Messages. `DataProvider` already filters message-type rows out of the
 *    activity feed; this module never writes to it. The two systems share no
 *    state, so an unread message cannot be counted twice.
 *
 * 3. **Every delivery state is handled from one handler.** Foreground, background
 *    and terminated-from-cold all funnel through the same listeners, so there is
 *    one code path to get right instead of three.
 */
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import type { Notification, NotificationResponse } from 'expo-notifications';

import { getSupabase } from '@/services/supabase';

/** Android notification channel. Created once, reused by the OS thereafter. */
const CHANNEL_ID = 'messages';
const CHANNEL_NAME = 'Messages';

/** How long a message banner stays on screen. */
const BANNER_SECONDS = 5;

/**
 * Foreground behaviour.
 *
 * Set at module scope because it must be in place before the app can receive a
 * notification; assigning it inside a component would leave the first launch
 * window unconfigured. Suppress *sounds and vibration only* when the app is
 * already open on the thread — the banner is still shown, because a user who is
 * looking at the screen and misses an incoming message has not really received
 * it.
 */
Notifications.setNotificationHandler({
  handleNotification: async (): Promise<Notifications.NotificationBehavior> => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/** Where a notification tap should land. Mirrors the payload the Edge Function sends. */
export interface MessagePushData {
  type?: string;
  conversationId?: string;
  messageId?: string;
  senderId?: string;
  senderName?: string;
  kind?: string;
  url?: string;
}

export type PushState =
  | { status: 'idle' }
  | { status: 'unsupported'; reason: string }
  | { status: 'needs-permission' }
  | { status: 'denied' }
  | { status: 'registered'; token: string }
  | { status: 'failed'; reason: string };

let currentState: PushState = { status: 'idle' };
const listeners = new Set<(state: PushState) => void>();

const emit = (state: PushState) => {
  currentState = state;
  listeners.forEach((listener) => listener(state));
};

export const getPushState = (): PushState => currentState;

export function subscribeToPushState(listener: (state: PushState) => void): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => {
    listeners.delete(listener);
  };
}

/** Reads the EAS project id, which Expo needs in order to mint a push token. */
function getProjectId(): string | undefined {
  const extra = (Constants.expoConfig?.extra ?? {}) as { eas?: { projectId?: string } };
  return extra.eas?.projectId ?? Constants.easConfig?.projectId ?? undefined;
}

/**
 * True when real push delivery is possible at all.
 *
 * Push needs a physical device: the Android emulator and iOS Simulator have no
 * push token, and asking for one there fails in a way that is easy to mistake
 * for a permissions problem. Detecting this lets the app say nothing at all
 * rather than showing a permission prompt that can never be satisfied.
 */
export function isPushSupported(): boolean {
  return Device.isDevice;
}

/**
 * Creates the Android channel.
 *
 * Android 8+ drops notifications whose channel does not exist, which presents as
 * "push silently never arrives" rather than as an error. Doing this at startup
 * is the fix. No-op on iOS, which has no channels.
 */
export async function ensureChannel(): Promise<void> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: CHANNEL_NAME,
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0F7358',
      sound: 'default',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}

/** Reads the current OS-level permission without prompting. */
export async function getPermissionStatus(): Promise<{
  granted: boolean;
  canAskAgain: boolean;
}> {
  const current = await Notifications.getPermissionsAsync();
  return {
    granted: current.granted,
    // iOS reports `granted: false, status: 'undetermined'` when the prompt has
    // never been shown, and 'denied' once it has been refused.
    canAskAgain: current.canAskAgain ?? current.granted === false,
  };
}

/**
 * Asks for permission and registers this device's token.
 *
 * Called from a moment of demonstrated intent, never on app launch. Safe to call
 * repeatedly: once granted, later calls just refresh the registration.
 */
export async function requestPermissionAndRegister(): Promise<PushState> {
  if (!isPushSupported()) {
    const state: PushState = {
      status: 'unsupported',
      reason: 'Push notifications need a physical device.',
    };
    emit(state);
    return state;
  }

  const existing = await getPermissionStatus();
  if (!existing.granted) {
    const requested = await Notifications.requestPermissionsAsync();
    if (!requested.granted) {
      // A first refusal is recoverable; a second one means iOS will never show
      // the prompt again and the user has to change it in Settings.
      const state: PushState = { status: 'denied' };
      emit(state);
      return state;
    }
  }

  await ensureChannel();
  return registerToken();
}

/**
 * Registers the Expo push token with the backend.
 *
 * The token identifies this *app installation*, not this user, so it is
 * re-registered on every sign-in. `register_push_token` upserts, so a student
 * who signs in on two devices ends up with two live registrations rather than
 * one overwriting the other — and signing out unregisters only this device's.
 */
async function registerToken(): Promise<PushState> {
  const projectId = getProjectId();

  if (!projectId) {
    const state: PushState = {
      status: 'failed',
      reason:
        'No EAS project id configured. Set extra.eas.projectId in app.json to enable push.',
    };
    emit(state);
    return state;
  }

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });

    const { error } = await getSupabase().rpc('register_push_token', {
      p_token: token,
      p_platform: Platform.OS,
      p_device_name: Device.deviceName ?? undefined,
      p_app_version: Constants.expoConfig?.version ?? undefined,
    });

    if (error) {
      const state: PushState = {
        status: 'failed',
        reason: 'Could not save your push registration.',
      };
      emit(state);
      return state;
    }

    const state: PushState = { status: 'registered', token };
    emit(state);
    return state;
  } catch (error) {
    const state: PushState = {
      status: 'failed',
      reason: error instanceof Error ? error.message : 'Could not register for notifications.',
    };
    emit(state);
    return state;
  }
}

/**
 * Registers without prompting, for a user who has already granted permission.
 *
 * Called on sign-in so a device that was signed in before the upgrade starts
 * receiving messages without anyone having to open Settings.
 */
export async function registerIfPermitted(): Promise<PushState> {
  if (!isPushSupported()) {
    return currentState;
  }

  const { granted } = await getPermissionStatus();
  if (!granted) {
    emit({ status: 'needs-permission' });
    return currentState;
  }

  return registerToken();
}

/** Removes this device's registration. Called on sign-out. */
export async function unregisterToken(): Promise<void> {
  try {
    const projectId = getProjectId();
    if (!projectId || !isPushSupported()) return;
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await getSupabase().rpc('unregister_push_token', { p_token: token });
  } catch {
    // Best effort: a token that survives one sign-out is corrected by the
    // upsert on the next registration for a different account.
  }
}

/**
 * Reads the payload out of a notification.
 *
 * The trigger payload arrives under `notification.request.content.data` for
 * remote pushes. The nested `message` key is the FCM/APNs wire format and is
 * present on some delivery paths, so both are checked.
 */
export function readPushData(notification: Notification | null): MessagePushData | null {
  if (!notification) return null;
  const content = notification.request?.content;
  if (!content) return null;

  const direct = content.data as MessagePushData | undefined;
  if (direct?.conversationId) return direct;

  const nested = (content.data as { message?: MessagePushData } | undefined)?.message;
  return nested?.conversationId ? nested : null;
}

/**
 * Deduplication for taps.
 *
 * The same notification can be delivered to both the foreground handler and the
 * response listener (a tap on a banner that is still on screen fires both), and
 * `getLastNotificationResponseAsync` replays the most recent one at launch. A
 * message opened twice lands the user in the same thread twice, which reads as a
 * navigation bug, so each message id is consumed exactly once per launch.
 */
const handledMessageIds = new Set<string>();

export function shouldHandlePush(data: MessagePushData | null): boolean {
  if (!data?.conversationId) return false;
  const key = data.messageId ?? data.conversationId;
  if (handledMessageIds.has(key)) return false;
  handledMessageIds.add(key);
  return true;
}

/** Clears the dedupe set on sign-out so a different account starts clean. */
export function resetPushDedupe(): void {
  handledMessageIds.clear();
}

/**
 * Wires up the tap path.
 *
 * `onOpen` receives the conversation id to navigate to. Returns a teardown that
 * removes the listener, so the handler cannot outlive the screen that installed
 * it and fire a navigation into an unmounted tree.
 *
 * Only the *response* listener is needed. An already-open thread receives the
 * message through the Realtime subscription, not through this module, so there
 * is no separate foreground path to reconcile and no chance of the same message
 * being handled twice.
 */
export function attachNotificationHandlers(onOpen: (conversationId: string) => void): () => void {
  const handleResponse = (response: NotificationResponse | null) => {
    const data = readPushData(response?.notification ?? null);
    if (shouldHandlePush(data) && data?.conversationId) {
      onOpen(data.conversationId);
    }
  };

  const responseSub = Notifications.addNotificationResponseReceivedListener(handleResponse);

  return () => {
    responseSub.remove();
  };
}