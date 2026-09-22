import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  MarketplaceItem, 
  PropertyListing, 
  SavedItem, 
  Conversation, 
  Message, 
  NotificationItem, 
  BoostRecord, 
  ReportItem,
  UserProfile 
} from '../types';
import { 
  INITIAL_MARKETPLACE_ITEMS, 
  INITIAL_PROPERTY_LISTINGS, 
  INITIAL_CONVERSATIONS, 
  INITIAL_NOTIFICATIONS,
  DEMO_USER_JULIUS 
} from '../data/mockData';
import { useAuth } from './AuthContext';

interface DataContextType {
  marketplaceItems: MarketplaceItem[];
  propertyListings: PropertyListing[];
  savedListings: SavedItem[];
  conversations: Conversation[];
  activeConversation: Conversation | null;
  notifications: NotificationItem[];
  reports: ReportItem[];
  unreadMessagesCount: number;
  unreadNotificationsCount: number;
  // Actions
  toggleSaveItem: (type: 'marketplace' | 'property', id: string) => void;
  isItemSaved: (type: 'marketplace' | 'property', id: string) => boolean;
  createMarketplaceItem: (item: Omit<MarketplaceItem, 'id' | 'createdAt' | 'viewsCount' | 'savesCount' | 'isBoosted' | 'seller'>) => MarketplaceItem;
  createPropertyListing: (property: Omit<PropertyListing, 'id' | 'createdAt' | 'viewsCount' | 'savesCount' | 'isBoosted' | 'landlord'>) => PropertyListing;
  updateMarketplaceItem: (id: string, updates: Partial<MarketplaceItem>) => void;
  updatePropertyListing: (id: string, updates: Partial<PropertyListing>) => void;
  deleteListing: (type: 'marketplace' | 'property', id: string) => void;
  togglePauseListing: (type: 'marketplace' | 'property', id: string) => void;
  boostListing: (type: 'marketplace' | 'property', id: string) => void;
  submitReport: (report: Omit<ReportItem, 'id' | 'status' | 'createdAt'>) => void;
  setActiveConversationId: (id: string | null) => void;
  sendMessage: (conversationId: string, content: string) => void;
  startChatWithSeller: (seller: { id: string; fullName: string; avatarUrl?: string; department?: string; level?: string; hallOrArea?: string; isPremium?: boolean }, listingRef?: { id: string; title: string; price: number; image: string; type: 'marketplace' | 'property' }) => string;
  markNotificationAsRead: (id: string) => void;
  markAllNotificationsAsRead: () => void;
  // Admin moderation actions
  dismissReport: (reportId: string) => void;
  resolveReportAction: (reportId: string, action: 'remove_listing' | 'warn_user') => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

const LS_MARKET_KEY = 'jid_data_market';
const LS_PROP_KEY = 'jid_data_properties';
const LS_SAVED_KEY = 'jid_data_saved';
const LS_CONV_KEY = 'jid_data_conversations';
const LS_NOTIF_KEY = 'jid_data_notifications';
const LS_REPORTS_KEY = 'jid_data_reports';

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  // Load initial state with local storage fallback
  const [marketplaceItems, setMarketplaceItems] = useState<MarketplaceItem[]>(() => {
    const saved = localStorage.getItem(LS_MARKET_KEY);
    return saved ? JSON.parse(saved) : INITIAL_MARKETPLACE_ITEMS;
  });

  const [propertyListings, setPropertyListings] = useState<PropertyListing[]>(() => {
    const saved = localStorage.getItem(LS_PROP_KEY);
    return saved ? JSON.parse(saved) : INITIAL_PROPERTY_LISTINGS;
  });

  const [savedListings, setSavedListings] = useState<SavedItem[]>(() => {
    const saved = localStorage.getItem(LS_SAVED_KEY);
    return saved ? JSON.parse(saved) : [
      {
        id: 'saved-init-1',
        userId: 'user-julius-adeyemi',
        listingType: 'marketplace',
        listingId: 'item-2',
        savedAt: new Date().toISOString()
      },
      {
        id: 'saved-init-2',
        userId: 'user-julius-adeyemi',
        listingType: 'property',
        listingId: 'apt-1',
        savedAt: new Date().toISOString()
      }
    ];
  });

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    const saved = localStorage.getItem(LS_CONV_KEY);
    return saved ? JSON.parse(saved) : INITIAL_CONVERSATIONS;
  });

  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    conversations.length > 0 ? conversations[0].id : null
  );

  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(LS_NOTIF_KEY);
    return saved ? JSON.parse(saved) : INITIAL_NOTIFICATIONS;
  });

  const [reports, setReports] = useState<ReportItem[]>(() => {
    const saved = localStorage.getItem(LS_REPORTS_KEY);
    return saved ? JSON.parse(saved) : [
      {
        id: 'rep-demo-1',
        reporterId: 'user-student-99',
        targetType: 'marketplace',
        targetId: 'item-3',
        targetTitle: 'Engineering Mathematics (Bird 8th Ed)',
        reason: 'Misleading description of past questions',
        status: 'pending',
        createdAt: '2026-09-21T19:00:00Z'
      }
    ];
  });

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem(LS_MARKET_KEY, JSON.stringify(marketplaceItems));
  }, [marketplaceItems]);

  useEffect(() => {
    localStorage.setItem(LS_PROP_KEY, JSON.stringify(propertyListings));
  }, [propertyListings]);

  useEffect(() => {
    localStorage.setItem(LS_SAVED_KEY, JSON.stringify(savedListings));
  }, [savedListings]);

  useEffect(() => {
    localStorage.setItem(LS_CONV_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    localStorage.setItem(LS_NOTIF_KEY, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(LS_REPORTS_KEY, JSON.stringify(reports));
  }, [reports]);

  // Unread badges
  const unreadMessagesCount = conversations.reduce((acc, c) => acc + c.unreadCount, 0);
  const unreadNotificationsCount = notifications.filter(n => !n.isRead).length;

  const isItemSaved = (type: 'marketplace' | 'property', id: string) => {
    const currentUserId = user?.id || DEMO_USER_JULIUS.id;
    return savedListings.some(s => s.userId === currentUserId && s.listingType === type && s.listingId === id);
  };

  const toggleSaveItem = (type: 'marketplace' | 'property', id: string) => {
    const currentUserId = user?.id || DEMO_USER_JULIUS.id;
    const existing = savedListings.find(s => s.userId === currentUserId && s.listingType === type && s.listingId === id);

    if (existing) {
      setSavedListings(prev => prev.filter(s => s.id !== existing.id));
      // Decrement counter
      if (type === 'marketplace') {
        setMarketplaceItems(prev => prev.map(item => item.id === id ? { ...item, savesCount: Math.max(0, item.savesCount - 1) } : item));
      } else {
        setPropertyListings(prev => prev.map(p => p.id === id ? { ...p, savesCount: Math.max(0, p.savesCount - 1) } : p));
      }
    } else {
      const newSaved: SavedItem = {
        id: `saved-${Date.now()}`,
        userId: currentUserId,
        listingType: type,
        listingId: id,
        savedAt: new Date().toISOString()
      };
      setSavedListings(prev => [newSaved, ...prev]);
      // Increment counter
      if (type === 'marketplace') {
        setMarketplaceItems(prev => prev.map(item => item.id === id ? { ...item, savesCount: item.savesCount + 1 } : item));
      } else {
        setPropertyListings(prev => prev.map(p => p.id === id ? { ...p, savesCount: p.savesCount + 1 } : p));
      }
    }
  };

  const createMarketplaceItem = (
    itemData: Omit<MarketplaceItem, 'id' | 'createdAt' | 'viewsCount' | 'savesCount' | 'isBoosted' | 'seller'>
  ): MarketplaceItem => {
    const currentUser = user || DEMO_USER_JULIUS;
    const newItem: MarketplaceItem = {
      ...itemData,
      id: `item-${Date.now()}`,
      userId: currentUser.id,
      viewsCount: 1,
      savesCount: 0,
      isBoosted: false,
      createdAt: new Date().toISOString(),
      seller: {
        name: currentUser.fullName,
        department: currentUser.department,
        level: currentUser.level,
        hallOrArea: currentUser.hallOrArea,
        avatarUrl: currentUser.avatarUrl,
        isPremium: currentUser.isPremium,
        isVerified: currentUser.isVerified
      }
    };

    setMarketplaceItems(prev => [newItem, ...prev]);

    // Create confirmation notification
    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: currentUser.id,
        title: 'Listing Published! 🎉',
        message: `Your "${newItem.title}" is now active and visible to all OAU students.`,
        type: 'system',
        link: 'my-listings',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);

    return newItem;
  };

  const createPropertyListing = (
    propData: Omit<PropertyListing, 'id' | 'createdAt' | 'viewsCount' | 'savesCount' | 'isBoosted' | 'landlord'>
  ): PropertyListing => {
    const currentUser = user || DEMO_USER_JULIUS;
    const newProperty: PropertyListing = {
      ...propData,
      id: `apt-${Date.now()}`,
      userId: currentUser.id,
      viewsCount: 1,
      savesCount: 0,
      isBoosted: false,
      createdAt: new Date().toISOString(),
      landlord: {
        name: currentUser.fullName,
        role: currentUser.role === 'landlord' ? 'Direct Landlord' : 'Student Subletter',
        phone: currentUser.phoneNumber || '+234 812 000 1122',
        avatarUrl: currentUser.avatarUrl,
        isVerified: currentUser.isVerified
      }
    };

    setPropertyListings(prev => [newProperty, ...prev]);

    setNotifications(prev => [
      {
        id: `notif-${Date.now()}`,
        userId: currentUser.id,
        title: 'Accommodation Lodge Posted 🏠',
        message: `"${newProperty.title}" is now live on the OAU student housing feed.`,
        type: 'system',
        link: 'my-listings',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);

    return newProperty;
  };

  const updateMarketplaceItem = (id: string, updates: Partial<MarketplaceItem>) => {
    setMarketplaceItems(prev => prev.map(item => item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item));
  };

  const updatePropertyListing = (id: string, updates: Partial<PropertyListing>) => {
    setPropertyListings(prev => prev.map(p => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p));
  };

  const deleteListing = (type: 'marketplace' | 'property', id: string) => {
    if (type === 'marketplace') {
      setMarketplaceItems(prev => prev.filter(item => item.id !== id));
    } else {
      setPropertyListings(prev => prev.filter(p => p.id !== id));
    }
  };

  const togglePauseListing = (type: 'marketplace' | 'property', id: string) => {
    if (type === 'marketplace') {
      setMarketplaceItems(prev => prev.map(item => {
        if (item.id === id) {
          const nextStatus = item.status === 'active' ? 'paused' : 'active';
          return { ...item, status: nextStatus };
        }
        return item;
      }));
    } else {
      setPropertyListings(prev => prev.map(p => {
        if (p.id === id) {
          const nextStatus = p.status === 'active' ? 'paused' : 'active';
          return { ...p, status: nextStatus };
        }
        return p;
      }));
    }
  };

  const boostListing = (type: 'marketplace' | 'property', id: string) => {
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const currentUserId = user?.id || DEMO_USER_JULIUS.id;

    if (type === 'marketplace') {
      setMarketplaceItems(prev => prev.map(item => item.id === id ? {
        ...item,
        isBoosted: true,
        boostedUntil: expiry
      } : item));
    } else {
      setPropertyListings(prev => prev.map(p => p.id === id ? {
        ...p,
        isBoosted: true,
        boostedUntil: expiry
      } : p));
    }

    setNotifications(prev => [
      {
        id: `notif-boost-${Date.now()}`,
        userId: currentUserId,
        title: 'Listing Boost Activated 🚀',
        message: 'Your listing will remain featured at the top of search for the next 24 hours.',
        type: 'boost',
        link: 'my-listings',
        isRead: false,
        createdAt: new Date().toISOString()
      },
      ...prev
    ]);
  };

  const submitReport = (reportData: Omit<ReportItem, 'id' | 'status' | 'createdAt'>) => {
    const newReport: ReportItem = {
      ...reportData,
      id: `rep-${Date.now()}`,
      status: 'pending',
      createdAt: new Date().toISOString()
    };
    setReports(prev => [newReport, ...prev]);
  };

  const startChatWithSeller = (
    seller: { id: string; fullName: string; avatarUrl?: string; department?: string; level?: string; hallOrArea?: string; isPremium?: boolean },
    listingRef?: { id: string; title: string; price: number; image: string; type: 'marketplace' | 'property' }
  ): string => {
    const currentUserId = user?.id || DEMO_USER_JULIUS.id;
    // Check if conversation already exists with this seller
    const existing = conversations.find(c => c.participant.id === seller.id);
    if (existing) {
      setActiveConversationId(existing.id);
      return existing.id;
    }

    const newConvId = `conv-${Date.now()}`;
    const newConv: Conversation = {
      id: newConvId,
      participant: seller,
      lastMessage: {
        id: `msg-${Date.now()}`,
        senderId: currentUserId,
        receiverId: seller.id,
        listingId: listingRef?.id,
        listingTitle: listingRef?.title,
        content: `Hi ${seller.fullName}, I am interested in your listing "${listingRef?.title || 'item'}". Is it still available?`,
        isRead: true,
        createdAt: new Date().toISOString()
      },
      unreadCount: 0,
      listingRef
    };

    setConversations(prev => [newConv, ...prev]);
    setActiveConversationId(newConvId);
    return newConvId;
  };

  const sendMessage = (conversationId: string, content: string) => {
    const currentUserId = user?.id || DEMO_USER_JULIUS.id;
    const conv = conversations.find(c => c.id === conversationId);
    if (!conv) return;

    const newMessage: Message = {
      id: `msg-${Date.now()}`,
      senderId: currentUserId,
      receiverId: conv.participant.id,
      listingId: conv.listingRef?.id,
      listingTitle: conv.listingRef?.title,
      content,
      isRead: true,
      createdAt: new Date().toISOString()
    };

    setConversations(prev => prev.map(c => c.id === conversationId ? {
      ...c,
      lastMessage: newMessage
    } : c));

    // In demo mode: simulate realistic reply after 1.8s
    setTimeout(() => {
      const simulatedReplies = [
        `Great! I can meet you at ${conv.listingRef?.type === 'property' ? 'the lodge entrance' : 'SUB Car Park'} later today.`,
        'Yes bro, it is still available. What time works best for you?',
        'I am currently around Faculty of Tech Spider Web. Feel free to call or WhatsApp me if urgent.',
        'Sounds good! Let me know if you would like to inspect it.'
      ];
      const randomReply = simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];

      const replyMsg: Message = {
        id: `reply-${Date.now()}`,
        senderId: conv.participant.id,
        receiverId: currentUserId,
        content: randomReply,
        isRead: false,
        createdAt: new Date().toISOString()
      };

      setConversations(current => current.map(c => c.id === conversationId ? {
        ...c,
        lastMessage: replyMsg,
        unreadCount: activeConversationId === conversationId ? 0 : c.unreadCount + 1
      } : c));
    }, 1800);
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllNotificationsAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  // Admin moderation actions
  const dismissReport = (reportId: string) => {
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'dismissed' } : r));
  };

  const resolveReportAction = (reportId: string, action: 'remove_listing' | 'warn_user') => {
    const report = reports.find(r => r.id === reportId);
    if (report && action === 'remove_listing') {
      if (report.targetType === 'marketplace') {
        deleteListing('marketplace', report.targetId);
      } else if (report.targetType === 'property') {
        deleteListing('property', report.targetId);
      }
    }
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: 'action_taken' } : r));
  };

  const activeConversation = conversations.find(c => c.id === activeConversationId) || null;

  return (
    <DataContext.Provider
      value={{
        marketplaceItems,
        propertyListings,
        savedListings,
        conversations,
        activeConversation,
        notifications,
        reports,
        unreadMessagesCount,
        unreadNotificationsCount,
        toggleSaveItem,
        isItemSaved,
        createMarketplaceItem,
        createPropertyListing,
        updateMarketplaceItem,
        updatePropertyListing,
        deleteListing,
        togglePauseListing,
        boostListing,
        submitReport,
        setActiveConversationId,
        sendMessage,
        startChatWithSeller,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        dismissReport,
        resolveReportAction
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
