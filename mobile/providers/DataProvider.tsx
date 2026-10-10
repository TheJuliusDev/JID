/**
 * Cross-feature data provider.
 *
 * Ported from the website's `src/context/DataContext.tsx`. It owns the small
 * number of pieces of state that more than one screen needs — saved items,
 * conversations, notifications, and their unread counts — so that saving an
 * item updates the heart icon on a card behind you without a refetch, and the
 * tab bar badge stays live.
 *
 * Realtime subscriptions are torn down on sign-out so a shared device does not
 * keep another student's notifications in memory.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useFocusEffect } from 'expo-router';
import {
  addSaved,
  listNotifications,
  listSaved,
  markAllNotificationsRead as markAllRead,
  markNotificationRead as markReadOne,
  removeSaved,
  submitListingReport,
  submitUserReport,
  subscribeToNotifications,
} from '@/services/database';
import { humanizeError } from '@/services/supabase';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { useMessaging } from './MessagingProvider';
import { useStableCallback } from '@/hooks';
import type { Conversation, ListingKind, ListingRef, NotificationItem, SavedItem } from '@/types';

interface DataContextValue {
  // --- Saved -------------------------------------------------------------
  saved: SavedItem[];
  isSaved: (kind: ListingKind, id: string) => boolean;
  toggleSave: (kind: ListingKind, id: string) => Promise<void>;
  unsaveAll: () => Promise<void>;
  refreshSaved: () => Promise<void>;

  // --- Conversations -----------------------------------------------------
  conversations: Conversation[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  startConversation: (otherUserId: string, listingRef?: ListingRef) => Promise<string | null>;
  markConversationRead: (id: string) => Promise<void>;

  // --- Notifications -----------------------------------------------------
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // --- Derived badges ----------------------------------------------------
  unreadMessagesCount: number;
  unreadNotificationsCount: number;

  // --- Moderation --------------------------------------------------------
  reportListing: (input: {
    listingType: ListingKind;
    listingId: string;
    listingTitle: string;
    reason: string;
    details?: string;
  }) => Promise<boolean>;
  reportUser: (input: {
    reportedUserId: string;
    reason: string;
    details?: string;
  }) => Promise<boolean>;
}

const DataContext = createContext<DataContextValue | null>(null);

/**
 * Chat activity is a messaging concern, not a notification one.
 *
 * The `notifications` table stores message notices alongside everything else, but
 * on the phone a chat lives in Messages and nowhere else: listing it in two
 * places makes the same unread message count twice and trains people to expect
 * conversations in a feed that is meant for listing, review and system activity.
 * The rows are still written and fetched exactly as before — they are simply
 * routed to the inbox the app actually uses for them.
 */
export const MESSAGE_NOTIFICATION_TYPE = 'message';

const isChatActivity = (n: NotificationItem): boolean =>
  n.type === MESSAGE_NOTIFICATION_TYPE;

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const toast = useToast();
  const userId = session?.user.id ?? null;

  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [allNotifications, setAllNotifications] = useState<NotificationItem[]>([]);

  /**
   * Conversations and unread counts now live in `MessagingProvider`.
   *
   * They used to be owned here. Moving them keeps a single owner of the inbox —
   * two lists that each think they are authoritative is exactly how an unread
   * count ends up showing a number the conversation screen disagrees with. Every
   * consumer still reads them from `useData()`, so nothing outside this file
   * changes.
   */
  const messaging = useMessaging();
  const {
    conversations,
    conversationsLoading,
    activeConversationId,
    setActiveConversationId,
    refreshConversations,
    startConversation,
    markConversationRead,
    unreadTotal,
  } = messaging;

  // Resets every piece of user-scoped state the instant a session ends, so a
  // signed-out user cannot glimpse the previous account's saved items.
  useEffect(() => {
    if (!userId) {
      setSaved([]);
      setAllNotifications([]);
    }
  }, [userId]);

  const refreshSaved = useStableCallback(async () => {
    if (!userId) return;
    try {
      setSaved(await listSaved(userId));
    } catch (error) {
      toast.error(humanizeError(error));
    }
  });

  const refreshNotifications = useStableCallback(async () => {
    if (!userId) return;
    try {
      setAllNotifications(await listNotifications(userId));
    } catch {
      // A failed notification poll is not worth interrupting the user for;
      // Realtime will still deliver new ones.
    }
  });

  // Load once on sign-in.
  useEffect(() => {
    if (!userId) return;
    void refreshSaved();
    void refreshNotifications();
  }, [userId, refreshSaved, refreshNotifications]);

  // Refresh saved + notification state whenever the app returns to the
  // foreground: an item can be sold, saved or removed from the web app while the
  // phone is in a pocket. The conversation list refreshes itself inside
  // MessagingProvider, which also owns the focus hook for it.
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      void refreshSaved();
      void refreshNotifications();
    }, [userId, refreshSaved, refreshNotifications]),
  );

  // Live notifications.
  useEffect(() => {
    if (!userId) return undefined;
    return subscribeToNotifications(userId, (incoming) => {
      setAllNotifications((current) => {
        if (current.some((n) => n.id === incoming.id)) return current;
        return [incoming, ...current].slice(0, 50);
      });
    });
  }, [userId]);

  const isSaved = useCallback(
    (kind: ListingKind, id: string) =>
      saved.some((s) => s.listingType === kind && s.listingId === id),
    [saved],
  );

  /**
   * Optimistic save/unsave.
   *
   * The heart is updated before the network call so tapping feels instant,
   * then rolled back with a toast if Supabase rejects it. Saving is one of the
   * most-tapped actions in the app and any perceptible latency reads as a
   * broken button.
   */
  const toggleSave = useStableCallback(async (kind: ListingKind, listingId: string) => {
    if (!userId) return;
    const existing = saved.find((s) => s.listingType === kind && s.listingId === listingId);

    if (existing) {
      setSaved((current) =>
        current.filter((s) => s.listingType !== kind || s.listingId !== listingId),
      );
      try {
        await removeSaved(userId, kind, listingId);
      } catch (error) {
        setSaved((current) => [...current, existing]);
        toast.error(humanizeError(error));
      }
      return;
    }

    const optimistic: SavedItem = {
      id: `tmp-${Date.now()}`,
      userId,
      listingType: kind,
      listingId,
      savedAt: new Date().toISOString(),
    };
    setSaved((current) => [optimistic, ...current]);

    try {
      await addSaved(userId, kind, listingId);
      toast.success('Saved. Find it under Saved.');
    } catch (error) {
      setSaved((current) => current.filter((s) => s.id !== optimistic.id));
      toast.error(humanizeError(error));
    }
  });

  /**
   * Unsaves every item at once, used by the Saved screen's "Unsave all".
   *
   * The local list is cleared immediately, then each reference is deleted
   * server-side. `saved_listings` has no bulk-delete RPC, so this is N deletes
   * — but N is small (a saved list is tens of items, not thousands) and a single
   * `Promise.all` keeps it to one round-trip's latency. Individual failures are
   * tolerated: `refreshSaved` below re-reads the truth from the database, so a
   * partial failure surfaces as an item still being there rather than as a
   * silently corrupted screen.
   */
  const unsaveAll = useStableCallback(async () => {
    if (!userId || saved.length === 0) return;
    const previous = saved;
    setSaved([]);
    try {
      await Promise.all(
        previous.map((s) => removeSaved(userId, s.listingType, s.listingId)),
      );
      toast.success(`Unsaved ${previous.length} item${previous.length === 1 ? '' : 's'}.`);
    } catch (error) {
      toast.error(humanizeError(error));
    } finally {
      await refreshSaved();
    }
  });

  const markNotificationRead = useStableCallback(async (id: string) => {
    setAllNotifications((current) =>
      current.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
    );
    try {
      await markReadOne(id);
    } catch {
      // Non-fatal.
    }
  });

  const markAllNotificationsRead = useStableCallback(async () => {
    if (!userId) return;
    setAllNotifications((current) => current.map((n) => ({ ...n, isRead: true })));
    try {
      await markAllRead(userId);
    } catch {
      // Non-fatal.
    }
  });

  const reportListing = useStableCallback(
    async (input: {
      listingType: ListingKind;
      listingId: string;
      listingTitle: string;
      reason: string;
      details?: string;
    }): Promise<boolean> => {
      if (!userId) return false;
      try {
        await submitListingReport({ reporterId: userId, ...input });
        toast.success('Report sent. Our moderators will take a look.');
        return true;
      } catch (error) {
        toast.error(humanizeError(error));
        return false;
      }
    },
  );

  const reportUser = useStableCallback(
    async (input: {
      reportedUserId: string;
      reason: string;
      details?: string;
    }): Promise<boolean> => {
      if (!userId) return false;
      try {
        await submitUserReport({ reporterId: userId, ...input });
        toast.success('Report sent. Our moderators will take a look.');
        return true;
      } catch (error) {
        toast.error(humanizeError(error));
        return false;
      }
    },
  );

  /**
   * The activity feed: everything except chat, which belongs to Messages.
   *
   * Derived rather than filtered at the query so the two lists share one source
   * of truth — a message row can never be half-visible here.
   */
  const notifications = useMemo(
    () => allNotifications.filter((n) => !isChatActivity(n)),
    [allNotifications],
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications],
  );

  const value = useMemo<DataContextValue>(
    () => ({
      saved,
      isSaved,
      toggleSave,
      unsaveAll,
      refreshSaved,
      // Delegated to MessagingProvider, which owns this state.
      conversations,
      conversationsLoading,
      activeConversationId,
      setActiveConversationId,
      refreshConversations,
      startConversation,
      markConversationRead,
      notifications,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      unreadMessagesCount: unreadTotal,
      unreadNotificationsCount,
      reportListing,
      reportUser,
    }),
    [
      saved,
isSaved,
      toggleSave,
      unsaveAll,
      refreshSaved,
      conversations,
      conversationsLoading,
      activeConversationId,
      setActiveConversationId,
      refreshConversations,
      startConversation,
      markConversationRead,
      notifications,
      refreshNotifications,
      markNotificationRead,
      markAllNotificationsRead,
      unreadTotal,
      unreadNotificationsCount,
      reportListing,
      reportUser,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataContextValue {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used inside <DataProvider>.');
  }
  return context;
}