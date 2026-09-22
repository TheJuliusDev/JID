import React, { useState } from 'react';
import { Conversation, Message, MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { 
  Send, 
  MessageSquare, 
  Sparkles, 
  CheckCheck, 
  Clock, 
  MapPin, 
  ShoppingBag, 
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

interface MessagingViewProps {
  onSelectItem?: (item: MarketplaceItem) => void;
  onSelectProperty?: (prop: PropertyListing) => void;
}

export const MessagingView: React.FC<MessagingViewProps> = ({
  onSelectItem,
  onSelectProperty
}) => {
  const { user } = useAuth();
  const { 
    conversations, 
    activeConversation, 
    setActiveConversationId, 
    sendMessage,
    marketplaceItems,
    propertyListings
  } = useData();

  const [messageText, setMessageText] = useState('');

  const currentUserId = user?.id || 'user-julius-adeyemi';

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeConversation) return;
    sendMessage(activeConversation.id, messageText.trim());
    setMessageText('');
  };

  const handleViewListing = () => {
    if (!activeConversation?.listingRef) return;
    const ref = activeConversation.listingRef;
    if (ref.type === 'marketplace' && onSelectItem) {
      const found = marketplaceItems.find(i => i.id === ref.id);
      if (found) onSelectItem(found);
    } else if (ref.type === 'property' && onSelectProperty) {
      const found = propertyListings.find(p => p.id === ref.id);
      if (found) onSelectProperty(found);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl overflow-hidden h-[78vh] flex flex-col md:flex-row">
        {/* Left Column: Conversation Thread List */}
        <div className="w-full md:w-80 lg:w-96 border-r border-zinc-200 dark:border-zinc-800 flex flex-col h-full bg-zinc-50/50 dark:bg-zinc-900/50">
          {/* Header */}
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
            <h2 className="font-bold text-zinc-950 dark:text-white font-display text-lg">
              Campus Messages
            </h2>
            <span className="text-xs font-semibold px-2.5 py-0.5 bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-300 rounded-full">
              {conversations.length} chats
            </span>
          </div>

          {/* Conversations List */}
          <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {conversations.map((conv) => {
              const isSelected = activeConversation?.id === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className={`p-4 flex items-start gap-3 cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-white dark:bg-zinc-800/90 shadow-sm border-l-4 border-orange-600'
                      : 'hover:bg-white/60 dark:hover:bg-zinc-800/40'
                  }`}
                >
                  <div className="relative w-11 h-11 rounded-full bg-orange-100 dark:bg-orange-950 flex items-center justify-center font-bold text-orange-700 dark:text-orange-300 flex-shrink-0">
                    {conv.participant.avatarUrl ? (
                      <img src={conv.participant.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      conv.participant.fullName.charAt(0)
                    )}
                    {conv.unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1 mb-0.5">
                      <h3 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {conv.participant.fullName}
                      </h3>
                      <span className="text-[10px] text-zinc-400 flex-shrink-0">
                        {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <p className="text-[11px] text-zinc-500 truncate mb-1">
                      {conv.participant.department}
                    </p>

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">
                      {conv.lastMessage.content}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Active Conversation Chat */}
        {activeConversation ? (
          <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-900">
            {/* Chat Header */}
            <div className="px-6 py-3.5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/75 dark:bg-zinc-900/75 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 font-bold flex items-center justify-center flex-shrink-0">
                  {activeConversation.participant.fullName.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-1.5">
                    {activeConversation.participant.fullName}
                    {activeConversation.participant.isPremium && (
                      <span className="text-amber-500" title="Premium Member">
                        <Sparkles className="w-3 h-3 fill-current" />
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {activeConversation.participant.department} • {activeConversation.participant.hallOrArea}
                  </p>
                </div>
              </div>

              {/* Listing Context Pill */}
              {activeConversation.listingRef && (
                <button
                  onClick={handleViewListing}
                  className="flex items-center gap-2 p-1.5 pr-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-colors cursor-pointer text-left"
                >
                  <img
                    src={activeConversation.listingRef.image}
                    alt=""
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                  <div className="hidden sm:block">
                    <p className="text-[11px] font-bold text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]">
                      {activeConversation.listingRef.title}
                    </p>
                    <p className="text-[10px] text-orange-600 dark:text-orange-400 font-bold">
                      {BRAND_CONFIG.currency.format(activeConversation.listingRef.price)}
                    </p>
                  </div>
                  <ExternalLink className="w-3 h-3 text-zinc-400" />
                </button>
              )}
            </div>

            {/* Chat Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Trust & Safety Warning */}
              <div className="p-3 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-[11px] text-zinc-500 dark:text-zinc-400 flex items-center gap-2 max-w-lg mx-auto text-center justify-center">
                <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>Tip: Meet at SUB or Hezekiah Library. Never make payment before physical inspection.</span>
              </div>

              {/* Initial message thread */}
              <div className="space-y-3">
                {/* Last message from conversation */}
                <div className={`flex ${activeConversation.lastMessage.senderId === currentUserId ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    activeConversation.lastMessage.senderId === currentUserId
                      ? 'bg-orange-600 text-white rounded-br-none'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none'
                  }`}>
                    <p>{activeConversation.lastMessage.content}</p>
                    <div className={`mt-1 text-[9px] flex items-center justify-end gap-1 ${
                      activeConversation.lastMessage.senderId === currentUserId ? 'text-orange-200' : 'text-zinc-400'
                    }`}>
                      <span>{new Date(activeConversation.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <CheckCheck className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Message Composer Input */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3 bg-white dark:bg-zinc-900">
              <input
                type="text"
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a campus message (e.g., Can we meet at SUB Car Park by 4pm?)..."
                className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              />
              <button
                type="submit"
                className="p-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl shadow transition-all cursor-pointer flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
            <MessageSquare className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-3" />
            <h3 className="font-bold text-zinc-700 dark:text-zinc-300">Select a conversation</h3>
            <p className="text-xs text-zinc-400 max-w-xs mt-1">
              Choose a chat from the left or contact any student seller directly from a listing page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
