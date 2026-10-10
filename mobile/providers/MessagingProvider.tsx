/**
 * Messaging state provider.
 *
 * Owns everything about conversations that more than one screen needs: the
 * inbox, the archived section, unread counts, pin/archive, blocked users and the
 * capability set.
 *
 * **Why this sits above `DataProvider`.** DataProvider already owned
 * conversations and unread counts, and half the app reads them from there. Rather
 * than create a second owner and leave two lists to disagree, this provider
 * takes the messaging state outright and DataProvider reads it back through
 * `useMessaging()`. `useData().conversations` and `unreadMessagesCount` keep
 * working exactly as before — there is just one implementation now.
 *
 * **Kept deliberately separate from notifications.** A chat lives in Messages.
 * DataProvider already routes message-type notification rows out of the activity
 * feed; nothing in this provider writes to it. That separation is why an unread
 * message is counted once and shown once.
 *
 * **No global message subscription.** The inbox does not hold a Realtime channel
 * on the whole `messages` table. That would mean receiving every message sent to
 * every conversation the user has, on every screen, to keep one preview string
 * current. Instead the inbox refreshes on focus and on membership changes, and
 * the thread screen subscribes to its own conversation — which is where live
 * delivery actually matters.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { humanizeError } from '@/services/supabase';
import { useStableCallback } from '@/hooks';
import {
  INITIAL_CAPABILITIES,
  getCapabilities,
  resetCapabilities,
  type MessagingCapabilities,
} from '@/services/messaging/capabilities';
import {
  fetchConversations,
  getOrCreateConversation,
  markConversationRead as markConversationReadRpc,
  searchConversations as searchConversationsRpc,
  setConversationArchived,
  setConversationPinned,
  subscribeToMemberships,
} from '@/services/messaging/conversations';
import {
  startPresenceHeartbeat,
  stopPresenceHeartbeat,
  touchLastSeen,
} from '@/services/messaging/presence';
import { blockUser, listBlockedUsers, subscribeToBlocks, unblockUser } from '@/services/messaging/safety';
import { registerIfPermitted, resetPushDedupe, unregisterToken } from '@/services/messaging/push';
import type { BlockedUser, Conversation, ConversationSearchResult, ListingRef } from '@/types';

interface MessagingContextValue {
  // --- Capabilities ------------------------------------------------------
  /**
   * Which messaging features this database supports. `false` means the control
   * is hidden rather than shown-and-broken.
   */
  capabilities: MessagingCapabilities;

  // --- Conversations -----------------------------------------------------
  /** The inbox: not archived, pinned first. */
  conversations: Conversation[];
  /** The Archived section. Empty until the schema migration is applied. */
  archivedConversations: Conversation[];
  conversationsLoading: boolean;
  archivedLoading: boolean;
  activeConversationId: string | null;
  setActiveConversationId: (id: string | null) => void;
  refreshConversations: () => Promise<void>;
  refreshArchived: () => Promise<void>;
  startConversation: (otherUserId: string, listingRef?: ListingRef) => Promise<string | null>;
  markConversationRead: (id: string) => Promise<void>;

  /** Total unread across the inbox, excluding the thread on screen. */
  unreadTotal: number;
  /** How many archived chats there are, for the Archived entry badge. */
  archivedCount: number;

  // --- Organising --------------------------------------------------------
  pinConversation: (id: string, pinned: boolean) => Promise<void>;
  archiveConversation: (id: string, archived: boolean) => Promise<void>;
  unarchiveConversation: (id: string) => Promise<void>;

  // --- Search ------------------------------------------------------------
  searchConversations: (query: string) => Promise<ConversationSearchResult[]>;

  // --- Safety ------------------------------------------------------------
  blockedUsers: BlockedUser[];
  refreshBlockedUsers: () => Promise<void>;
  block: (userId: string) => Promise<void>;
  unblock: (userId: string) => Promise<void>;
}

const MessagingContext = createContext<MessagingContextValue | null>(null);

export function MessagingProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const toast = useToast();
  const userId = session?.user.id ?? null;

  const [capabilities, setCapabilities] = useState<MessagingCapabilities>(
    INITIAL_CAPABILITIES,
  );
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [archivedConversations, setArchivedConversations] = useState<Conversation[]>([]);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);

  // --- Capability probe ---------------------------------------------------
  useEffect(() => {
    if (!userId) {
      resetCapabilities();
      setCapabilities(INITIAL_CAPABILITIES);
      return;
    }

    let cancelled = false;
    void getCapabilities().then((result) => {
      if (!cancelled) setCapabilities(result);
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // --- Sign-out -----------------------------------------------------------
  // Every user-scoped value is dropped the instant the session ends, so a
  // signed-out user cannot glimpse the previous account's conversations on a
  // shared device, and no Realtime channel outlives the account that owned it.
  useEffect(() => {
    if (userId) return;

    resetCapabilities();
    stopPresenceHeartbeat();
    void unregisterToken();
    resetPushDedupe();
    setConversations([]);
    setArchivedConversations([]);
    setUnreadTotal(0);
    setBlockedUsers([]);
    setActiveConversationId(null);
  }, [userId]);

  // --- Presence heartbeat -------------------------------------------------
  // One write every five minutes, and only while the app is foregrounded. The
  // SQL function rate-limits it too, so this cannot become a poll.
  useEffect(() => {
    if (!userId || !capabilities.presence || !capabilities.resolved) return;
    startPresenceHeartbeat(true);
    return () => stopPresenceHeartbeat();
  }, [userId, capabilities.presence, capabilities.resolved]);

  // --- Push registration --------------------------------------------------
  // Registers on sign-in without prompting. If permission has never been
  // granted this is a no-op, which is what keeps the first-launch experience
  // free of a permission dialog.
  useEffect(() => {
    if (!userId) return;
    void registerIfPermitted();
  }, [userId]);

  // --- Loaders ------------------------------------------------------------
  const refreshConversations = useStableCallback(async () => {
    if (!userId) return;
    setConversationsLoading(true);
    try {
      const rows = await fetchConversations({
        archived: false,
        supportsOrganise: capabilities.organise,
      });
      setConversations(rows);
      setUnreadTotal(
        rows.reduce((total, c) => (c.id === activeConversationId ? total : total + c.unreadCount), 0),
      );
    } catch (error) {
      toast.error(humanizeError(error));
    } finally {
      setConversationsLoading(false);
    }
  });

  const refreshArchived = useStableCallback(async () => {
    if (!userId) return;
    setArchivedLoading(true);
    try {
      setArchivedConversations(
        await fetchConversations({ archived: true, supportsOrganise: capabilities.organise }),
      );
    } catch (error) {
      toast.error(humanizeError(error));
    } finally {
      setArchivedLoading(false);
    }
  });

  const refreshBlockedUsers = useStableCallback(async () => {
    if (!userId || !capabilities.blocks) return;
    try {
      setBlockedUsers(await listBlockedUsers());
    } catch (error) {
      toast.error(humanizeError(error));
    }
  });

  // --- Realtime: membership changes --------------------------------------
  // Pinning or archiving on one device lands on the other without a refetch.
  // Torn down on unmount and on sign-out, so the channel cannot outlive the
  // session and double-fire after a re-login.
  useEffect(() => {
    if (!userId || !capabilities.organise || !capabilities.resolved) return undefined;

    return subscribeToMemberships(userId, {
      onMembershipChange: (conversationId, row) => {
        const pinnedAt = row.pinned_at ?? undefined;
        const archivedAt = row.archived_at ?? undefined;

        const applyTo = (list: Conversation[]) =>
          list.map((c) =>
            c.id === conversationId ? { ...c, pinnedAt, archivedAt } : c,
          );

        setConversations((current) => applyTo(current));
        setArchivedConversations((current) => applyTo(current));
      },
    });
  }, [userId, capabilities.organise, capabilities.resolved]);

  // --- Realtime: blocks ----------------------------------------------------
  useEffect(() => {
    if (!userId || !capabilities.blocks || !capabilities.resolved) return undefined;

    return subscribeToBlocks(userId, {
      // Re-reads the inbox because a blocked conversation is filtered out
      // server-side; leaving it visible would offer a thread that cannot work.
      onChange: () => {
        void refreshBlockedUsers();
        void refreshConversations();
      },
    });
  }, [userId, capabilities.blocks, capabilities.resolved, refreshBlockedUsers, refreshConversations]);

  // --- Initial load -------------------------------------------------------
  useEffect(() => {
    if (!userId || !capabilities.resolved) return;
    void refreshConversations();
    void refreshBlockedUsers();
    void touchLastSeen(capabilities.presence);
  }, [userId, capabilities.resolved, capabilities.presence, refreshConversations, refreshBlockedUsers]);

  // --- Actions ------------------------------------------------------------
  const startConversation = useStableCallback(
    async (otherUserId: string, listingRef?: ListingRef): Promise<string | null> => {
      try {
        const id = await getOrCreateConversation(otherUserId, listingRef);
        await refreshConversations();
        return id;
      } catch (error) {
        toast.error(humanizeError(error));
        return null;
      }
    },
  );

  const markConversationRead = useStableCallback(async (id: string) => {
    // Drop the badge before the write: the RPC only affects the other person's
    // view, and the user's own count should not wait on the network.
    setConversations((current) =>
      current.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );

    // Decrement by exactly what this thread contributed, so a second thread with
    // unread messages is unaffected.
    const target = conversations.find((c) => c.id === id);
    const removed = target?.unreadCount ?? 0;
    if (removed > 0) {
      setUnreadTotal((current) => Math.max(0, current - removed));
    }

    try {
      await markConversationReadRpc(id);
    } catch {
      // Non-fatal: the badge is already gone locally.
    }
  });

  /**
   * Pin or unpin.
   *
   * Updates local state first and rolls back on failure, because the pinned list
   * reorders visibly and waiting for a round trip makes the row appear to jump
   * twice.
   */
  const pinConversation = useStableCallback(async (id: string, pinned: boolean) => {
    const previous = conversations;
    const apply = (list: Conversation[]) =>
      list
        .map((c) => (c.id === id ? { ...c, pinnedAt: pinned ? new Date().toISOString() : undefined } : c))
        // Pinned rows sort to the top, so the list has to be re-sorted too.
        .sort(sortConversations);

    setConversations(apply);

    try {
      if (capabilities.organise) {
        await setConversationPinned(id, pinned);
      } else {
        // No column to write: keep the change for this session and say so.
        toast.error('Pinning needs the messaging update. Pull down to refresh later.');
      }
    } catch (error) {
      setConversations(previous);
      toast.error(humanizeError(error));
    }
  });

  /**
   * Archive or unarchive.
   *
   * The row leaves the inbox immediately — archiving exists precisely so the
   * main list is not cluttered — and reappears only in the Archived section.
   */
  const archiveConversation = useStableCallback(async (id: string, archived: boolean) => {
    const previousInbox = conversations;
    const previousArchived = archivedConversations;

    if (archived) {
      const moving = conversations.find((c) => c.id === id);
      setConversations((current) => current.filter((c) => c.id !== id));
      if (moving) {
        setArchivedConversations((current) =>
          [{ ...moving, archivedAt: new Date().toISOString() }, ...current],
        );
      }
    } else {
      const moving = archivedConversations.find((c) => c.id === id);
      setArchivedConversations((current) => current.filter((c) => c.id !== id));
      if (moving) {
        // Re-sort: an unarchived chat lands by recency, or at the top if it is
        // still pinned, and the inbox has to reflect that immediately.
        setConversations((current) =>
          [{ ...moving, archivedAt: undefined }, ...current].sort(sortConversations),
        );
      }
    }

    try {
      if (capabilities.organise) {
        await setConversationArchived(id, archived);
        if (archived) toast.success('Chat archived.');
      } else {
        toast.error('Archiving needs the messaging update.');
        setConversations(previousInbox);
        setArchivedConversations(previousArchived);
      }
    } catch (error) {
      setConversations(previousInbox);
      setArchivedConversations(previousArchived);
      toast.error(humanizeError(error));
    }
  });

  const unarchiveConversation = useStableCallback(
    async (id: string) => archiveConversation(id, false),
  );

  const searchConversations = useStableCallback(
    async (query: string): Promise<ConversationSearchResult[]> => {
      try {
        return await searchConversationsRpc(query, conversations);
      } catch (error) {
        toast.error(humanizeError(error));
        return [];
      }
    },
  );

  const block = useStableCallback(async (userIdToBlock: string) => {
    try {
      await blockUser(userIdToBlock);
      await refreshBlockedUsers();
      // The conversation disappears from the inbox, because a blocked thread is
      // filtered out server-side and leaving it would be a dead row.
      await refreshConversations();
      toast.success('User blocked. They can no longer message you.');
    } catch (error) {
      toast.error(humanizeError(error));
    }
  });

  const unblock = useStableCallback(async (userIdToUnblock: string) => {
    try {
      await unblockUser(userIdToUnblock);
      await refreshBlockedUsers();
      await refreshConversations();
      toast.success('User unblocked.');
    } catch (error) {
      toast.error(humanizeError(error));
    }
  });

  const value = useMemo<MessagingContextValue>(
    () => ({
      capabilities,
      conversations,
      archivedConversations,
      conversationsLoading,
      archivedLoading,
      activeConversationId,
      setActiveConversationId,
      refreshConversations,
      refreshArchived,
      startConversation,
      markConversationRead,
      unreadTotal,
      archivedCount: archivedConversations.length,
      pinConversation,
      archiveConversation,
      unarchiveConversation,
      searchConversations,
      blockedUsers,
      refreshBlockedUsers,
      block,
      unblock,
    }),
    [
      capabilities,
      conversations,
      archivedConversations,
      conversationsLoading,
      archivedLoading,
      activeConversationId,
      refreshConversations,
      refreshArchived,
      startConversation,
      markConversationRead,
      unreadTotal,
      pinConversation,
      archiveConversation,
      unarchiveConversation,
      searchConversations,
      blockedUsers,
      refreshBlockedUsers,
      block,
      unblock,
    ],
  );

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

/** Pinned first, then most recent activity. Matches the server's ordering. */
const sortConversations = (a: Conversation, b: Conversation): number => {
  const aPinned = a.pinnedAt ? 1 : 0;
  const bPinned = b.pinnedAt ? 1 : 0;
  if (aPinned !== bPinned) return bPinned - aPinned;
  return new Date(b.lastMessageAt ?? 0).getTime() - new Date(a.lastMessageAt ?? 0).getTime();
};

export function useMessaging(): MessagingContextValue {
  const context = useContext(MessagingContext);
  if (!context) {
    throw new Error('useMessaging must be used inside <MessagingProvider>.');
  }
  return context;
}