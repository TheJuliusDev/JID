import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SavedItem, SavedSearch, Conversation, NotificationItem } from '../types';
import { useAuth } from './AuthContext';
import {
  listSaved,
  addSaved,
  removeSaved,
  listSavedSearches,
  createSavedSearch,
  removeSavedSearch,
  setSavedSearchNotify,
  generateSavedSearchAlerts,
  fetchConversations,
  getOrCreateConversation,
  markConversationRead as dbMarkConversationRead,
  listNotifications,
  markNotificationRead as dbMarkNotificationRead,
  markAllNotificationsRead as dbMarkAllNotificationsRead,
  subscribeToNotifications,
  submitListingReport,
  submitUserReport,
  subscribeToConversationActivity,
  subscribeToParticipantChanges,
  setConversationPinned,
  setConversationArchived,
  blockUser as dbBlockUser,
  unblockUser as dbUnblockUser,
  listBlockedUsers,
} from '../services/database';
import { subscribeToPresence, startLastSeenHeartbeat } from '../services/presence';
import { syncPushSubscription } from '../services/push';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { BlockedUser } from '../types';

interface ListingRef {
  id: string;
  title: string;
  price: number;
  image: string;
  type: 'marketplace' | 'property';
}

interface DataContextType {
  // Saved
  saved: SavedItem[];
  isSaved: (type: 'marketplace' | 'property', id: string) => boolean;
  toggleSave: (type: 'marketplace' | 'property', id: string) => Promise<void>;
  refreshSaved: () => Promise<void>;

  // Saved searches & alerts
  savedSearches: SavedSearch[];
  refreshSavedSearches: () => Promise<void>;
  saveSearch: (input: {
    listingType: 'marketplace' | 'property';
    label: string;
    filters: Record<string, string | number | boolean>;
  }) => Promise<void>;
  deleteSavedSearch: (id: string) => Promise<void>;
  toggleSavedSearchNotify: (id: string, notify: boolean) => Promise<void>;

  // Conversations & messaging
  conversations: Conversation[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  startConversation: (otherUserId: string, listingRef?: ListingRef) => Promise<string | null>;
  markConversationRead: (id: string) => Promise<void>;
  /** Ids with a live Realtime presence connection right now. */
  onlineUserIds: Set<string>;
  /** Exposed so the chat header can read presence for one specific student. */
  presenceChannel: RealtimeChannel | null;
  isOnline: (userId: string) => boolean;

  // Conversation organisation & safety
  togglePinConversation: (id: string, pinned: boolean) => Promise<void>;
  toggleArchiveConversation: (id: string, archived: boolean) => Promise<void>;
  blockUser: (userId: string, reason?: string) => Promise<void>;
  unblockUser: (userId: string) => Promise<void>;
  blockedUsers: BlockedUser[];
  refreshBlockedUsers: () => Promise<void>;

  // Notifications
  notifications: NotificationItem[];
  refreshNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;

  // Derived
  unreadMessagesCount: number;
  unreadNotificationsCount: number;

  // Reports
  reportListing: (input: {
    listingType: 'marketplace' | 'property';
    listingId: string;
    listingTitle: string;
    reason: string;
    details?: string;
  }) => Promise<void>;
  reportUser: (input: { reportedUserId: string; reason: string; details?: string }) => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

/**
 * Pinned first, then most recent, archived last.
 *
 * This mirrors the `order by` in `get_my_conversations()` exactly. It is
 * duplicated here on purpose: re-sorting locally after a pin/archive tap is what
 * makes the list move instantly, and if the two ever disagree the server sort
 * simply wins on the next refresh.
 */
function sortConversations(a: Conversation, b: Conversation): number {
  const aPinned = a.pinnedAt ? 0 : 1;
  const bPinned = b.pinnedAt ? 0 : 1;
  if (aPinned !== bPinned) return aPinned - bPinned;
  if (a.pinnedAt && b.pinnedAt) {
    const byPin = new Date(b.pinnedAt).getTime() - new Date(a.pinnedAt).getTime();
    if (byPin !== 0) return byPin;
  }
  const aArchived = a.archivedAt ? 1 : 0;
  const bArchived = b.archivedAt ? 1 : 0;
  if (aArchived !== bArchived) return aArchived - bArchived;
  return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
}

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(() => new Set());
  const [presenceChannel, setPresenceChannel] = useState<RealtimeChannel | null>(null);
  const activeRef = useRef<string | null>(null);
  activeRef.current = activeConversationId;

  const refreshSaved = useCallback(async () => {
    if (!user) {
      setSaved([]);
      return;
    }
    try {
      setSaved(await listSaved(user.id));
    } catch (err) {
      console.error('[data] load saved failed', err);
    }
  }, [user]);

  const refreshSavedSearches = useCallback(async () => {
    if (!user) {
      setSavedSearches([]);
      return;
    }
    try {
      setSavedSearches(await listSavedSearches(user.id));
    } catch (err) {
      console.error('[data] load saved searches failed', err);
    }
  }, [user]);

  const refreshConversations = useCallback(async () => {
    if (!user) {
      setConversations([]);
      return;
    }
    try {
      setConversations(await fetchConversations());
    } catch (err) {
      console.error('[data] load conversations failed', err);
    }
  }, [user]);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      setNotifications(await listNotifications(user.id));
    } catch (err) {
      console.error('[data] load notifications failed', err);
    }
  }, [user]);

  const refreshBlockedUsers = useCallback(async () => {
    if (!user) {
      setBlockedUsers([]);
      return;
    }
    try {
      // No user id: the `blocks` SELECT policy already restricts rows to the
      // caller's own blocks, so there is no argument to get wrong.
      setBlockedUsers(await listBlockedUsers());
    } catch (err) {
      console.error('[data] load blocked users failed', err);
    }
  }, [user]);

  // Load user-scoped data + subscribe to realtime notifications on sign-in.
  useEffect(() => {
    if (!user) {
      setSaved([]);
      setConversations([]);
      setNotifications([]);
      setBlockedUsers([]);
      setOnlineUserIds(new Set());
      setActiveConversationId(null);
      return;
    }

    let cancelled = false;
    setConversationsLoading(true);
    (async () => {
      await Promise.all([refreshSaved(), refreshSavedSearches(), refreshConversations()]);
      // Generate any new saved-search matches before loading the bell so the
      // alerts are visible immediately on this visit.
      try {
        await generateSavedSearchAlerts();
      } catch (err) {
        console.error('[data] generate search alerts failed', err);
      }
      await refreshNotifications();
      await refreshBlockedUsers();
      if (!cancelled) setConversationsLoading(false);
    })();

    const unsubscribe = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
    });

    // Messages no longer create `notifications` rows (migration 006), so the
    // conversation list is kept live off the messages table directly.
    //
    // Debounced: a student sending three images in a row produces three INSERT
    // events, and each refresh is a full `get_my_conversations()` round trip.
    // Coalescing them into one keeps a burst of sends to a single query.
    let refreshTimer: number | null = null;
    const unsubscribeActivity = subscribeToConversationActivity(() => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        refreshTimer = null;
        refreshConversations();
      }, 400);
    });

    // Pin/archive and read markers live on the participant row, so the list has
    // to react to those too — otherwise pinning on one device does nothing on
    // the other until a reload.
    const unsubscribeParticipants = subscribeToParticipantChanges(user.id, () => {
      refreshConversations();
    });

    // "Online now" is Realtime presence over the socket we already hold open.
    // The channel handle is kept so the chat header can ask about one specific
    // student without the chat view needing its own presence subscription.
    const stopPresence = subscribeToPresence(user.id, (snapshot, channel) => {
      setOnlineUserIds(new Set(snapshot.onlineIds));
      setPresenceChannel(channel);
    });

    // Last-seen + the "app is awake" signal `notify-push` uses to skip pushes
    // for students already looking at the app.
    const stopHeartbeat = startLastSeenHeartbeat(user.id);

    // Re-assert this browser's push subscription. Idempotent, so running it on
    // every sign-in keeps the server's endpoint list honest after a redeploy.
    void syncPushSubscription(user.id);

    return () => {
      cancelled = true;
      if (refreshTimer) window.clearTimeout(refreshTimer);
      unsubscribe();
      unsubscribeActivity();
      unsubscribeParticipants();
      stopPresence();
      stopHeartbeat();
      setPresenceChannel(null);
    };
  }, [user, refreshSaved, refreshSavedSearches, refreshConversations, refreshNotifications, refreshBlockedUsers]);

  const isSaved = useCallback(
    (type: 'marketplace' | 'property', id: string) =>
      saved.some((s) => s.listingType === type && s.listingId === id),
    [saved]
  );

  const toggleSave = useCallback(
    async (type: 'marketplace' | 'property', id: string) => {
      if (!user) return;
      const existing = saved.find((s) => s.listingType === type && s.listingId === id);
      if (existing) {
        setSaved((prev) => prev.filter((s) => s.id !== existing.id));
        try {
          await removeSaved(user.id, type, id);
        } catch (err) {
          console.error('[data] unsave failed', err);
          setSaved((prev) => [existing, ...prev]);
        }
      } else {
        const optimistic: SavedItem = {
          id: `tmp-${Date.now()}`,
          userId: user.id,
          listingType: type,
          listingId: id,
          savedAt: new Date().toISOString(),
        };
        setSaved((prev) => [optimistic, ...prev]);
        try {
          await addSaved(user.id, type, id);
          await refreshSaved();
        } catch (err) {
          console.error('[data] save failed', err);
          setSaved((prev) => prev.filter((s) => s.id !== optimistic.id));
        }
      }
    },
    [user, saved, refreshSaved]
  );

  const saveSearch = useCallback(
    async (input: {
      listingType: 'marketplace' | 'property';
      label: string;
      filters: Record<string, string | number | boolean>;
    }) => {
      if (!user) throw new Error('Please sign in to save a search.');
      const created = await createSavedSearch(user.id, input);
      setSavedSearches((prev) => [created, ...prev]);
    },
    [user]
  );

  const deleteSavedSearch = useCallback(async (id: string) => {
    const snapshot = savedSearches;
    setSavedSearches((prev) => prev.filter((s) => s.id !== id));
    try {
      await removeSavedSearch(id);
    } catch (err) {
      console.error('[data] delete saved search failed', err);
      setSavedSearches(snapshot);
    }
  }, [savedSearches]);

  const toggleSavedSearchNotify = useCallback(async (id: string, notify: boolean) => {
    setSavedSearches((prev) => prev.map((s) => (s.id === id ? { ...s, notify } : s)));
    try {
      await setSavedSearchNotify(id, notify);
    } catch (err) {
      console.error('[data] update saved search failed', err);
      setSavedSearches((prev) => prev.map((s) => (s.id === id ? { ...s, notify: !notify } : s)));
    }
  }, []);

  const startConversation = useCallback(
    async (otherUserId: string, listingRef?: ListingRef): Promise<string | null> => {
      if (!user) return null;
      try {
        const convId = await getOrCreateConversation(otherUserId, listingRef);
        await refreshConversations();
        setActiveConversationId(convId);
        return convId;
      } catch (err) {
        // `get_or_create_direct_conversation()` raises this when either side has
        // blocked the other. It is a normal outcome of the feature, not a fault,
        // so it is not logged as an error — returning null lets the caller show
        // the blocked state instead of a generic failure.
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes('cannot start a conversation')) return null;
        console.error('[data] start conversation failed', err);
        return null;
      }
    },
    [user, refreshConversations]
  );

  const markConversationRead = useCallback(async (id: string) => {
    try {
      await dbMarkConversationRead(id);
      setConversations((prev) => prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)));
    } catch (err) {
      console.error('[data] mark conversation read failed', err);
    }
  }, []);

  // Pin/archive/block all update the row server-side. Each is applied locally
  // first so the list reorders the instant it is tapped, and rolled back if the
  // write fails — the alternative is a visible lag on every action.

  const togglePinConversation = useCallback(async (id: string, pinned: boolean) => {
    const previous = conversations;
    const at = pinned ? new Date().toISOString() : undefined;
    setConversations((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, pinnedAt: at } : c))
        .sort(sortConversations)
    );
    try {
      await setConversationPinned(id, pinned);
    } catch (err) {
      console.error('[data] pin failed', err);
      setConversations(previous);
    }
  }, [conversations]);

  const toggleArchiveConversation = useCallback(async (id: string, archived: boolean) => {
    const previous = conversations;
    const at = archived ? new Date().toISOString() : undefined;
    setConversations((prev) =>
      prev
        .map((c) => (c.id === id ? { ...c, archivedAt: at } : c))
        .sort(sortConversations)
    );
    try {
      await setConversationArchived(id, archived);
    } catch (err) {
      console.error('[data] archive failed', err);
      setConversations(previous);
    }
  }, [conversations]);

  const blockUser = useCallback(
    async (userId: string, reason?: string) => {
      await dbBlockUser(userId, reason);
      await refreshBlockedUsers();
      // The blocked thread drops out of the list (the RPC filters it), and the
      // thread that was open is no longer something to read.
      await refreshConversations();
      setActiveConversationId((prev) => {
        const target = conversations.find((c) => c.participant.id === userId);
        return target && target.id === prev ? null : prev;
      });
    },
    [refreshBlockedUsers, refreshConversations, conversations]
  );

  const unblockUser = useCallback(
    async (userId: string) => {
      await dbUnblockUser(userId);
      await refreshBlockedUsers();
    },
    [refreshBlockedUsers]
  );

  const isOnlineUser = useCallback((userId: string) => onlineUserIds.has(userId), [onlineUserIds]);

  const markNotificationRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    try {
      await dbMarkNotificationRead(id);
    } catch (err) {
      console.error('[data] mark notification read failed', err);
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await dbMarkAllNotificationsRead(user.id);
    } catch (err) {
      console.error('[data] mark all notifications read failed', err);
    }
  }, [user]);

  const reportListing = useCallback(
    async (input: { listingType: 'marketplace' | 'property'; listingId: string; listingTitle: string; reason: string; details?: string }) => {
      if (!user) throw new Error('Please sign in to report a listing.');
      await submitListingReport({ reporterId: user.id, ...input });
    },
    [user]
  );

  const reportUser = useCallback(
    async (input: { reportedUserId: string; reason: string; details?: string }) => {
      if (!user) throw new Error('Please sign in to report a user.');
      await submitUserReport({ reporterId: user.id, ...input });
    },
    [user]
  );

  const unreadMessagesCount = useMemo(
    () => conversations.reduce((acc, c) => acc + (c.unreadCount || 0), 0),
    [conversations]
  );  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.isRead).length,
    [notifications]
  );

  return (
    <DataContext.Provider
      value={{
        saved,
        isSaved,
        toggleSave,
        refreshSaved,
        savedSearches,
        refreshSavedSearches,
        saveSearch,
        deleteSavedSearch,
        toggleSavedSearchNotify,
        conversations,
        conversationsLoading,
        activeConversationId,
        setActiveConversationId,
        refreshConversations,
        startConversation,
        markConversationRead,
        onlineUserIds,
        presenceChannel,
        isOnline: isOnlineUser,
        togglePinConversation,
        toggleArchiveConversation,
        blockUser,
        unblockUser,
        blockedUsers,
        refreshBlockedUsers,
        notifications,
        refreshNotifications,
        markNotificationRead,
        markAllNotificationsRead,
        unreadMessagesCount,
        unreadNotificationsCount,
        reportListing,
        reportUser,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData must be used within a DataProvider');
  return context;
};
