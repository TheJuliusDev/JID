import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { SavedItem, Conversation, NotificationItem } from '../types';
import { useAuth } from './AuthContext';
import {
  listSaved,
  addSaved,
  removeSaved,
  fetchConversations,
  getOrCreateConversation,
  markConversationRead as dbMarkConversationRead,
  listNotifications,
  markNotificationRead as dbMarkNotificationRead,
  markAllNotificationsRead as dbMarkAllNotificationsRead,
  subscribeToNotifications,
  submitListingReport,
  submitUserReport,
} from '../services/database';

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

  // Conversations & messaging
  conversations: Conversation[];
  conversationsLoading: boolean;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  startConversation: (otherUserId: string, listingRef?: ListingRef) => Promise<string | null>;
  markConversationRead: (id: string) => Promise<void>;

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

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
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

  // Load user-scoped data + subscribe to realtime notifications on sign-in.
  useEffect(() => {
    if (!user) {
      setSaved([]);
      setConversations([]);
      setNotifications([]);
      setActiveConversationId(null);
      return;
    }

    let cancelled = false;
    setConversationsLoading(true);
    (async () => {
      await Promise.all([refreshSaved(), refreshConversations(), refreshNotifications()]);
      if (!cancelled) setConversationsLoading(false);
    })();

    const unsubscribe = subscribeToNotifications(user.id, (n) => {
      setNotifications((prev) => (prev.some((x) => x.id === n.id) ? prev : [n, ...prev]));
      // A new message notification means a conversation changed — refresh the list
      // (unless the user is already reading that thread, which marks it read itself).
      if (n.type === 'message') {
        refreshConversations();
      }
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [user, refreshSaved, refreshConversations, refreshNotifications]);

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

  const startConversation = useCallback(
    async (otherUserId: string, listingRef?: ListingRef): Promise<string | null> => {
      if (!user) return null;
      try {
        const convId = await getOrCreateConversation(otherUserId, listingRef);
        await refreshConversations();
        setActiveConversationId(convId);
        return convId;
      } catch (err) {
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
  );
  const unreadNotificationsCount = useMemo(
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
