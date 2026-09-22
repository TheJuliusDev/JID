import React from 'react';
import { useData } from '../../context/DataContext';
import { Bell, Check, Zap, MessageSquare, Info, ShieldAlert } from 'lucide-react';

interface NotificationsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: any) => void;
}

export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  if (!isOpen) return null;

  const { notifications, markNotificationAsRead, markAllNotificationsAsRead } = useData();

  const getIcon = (type: string) => {
    switch (type) {
      case 'boost': return <Zap className="w-4 h-4 text-amber-500 fill-current" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'report': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      default: return <Info className="w-4 h-4 text-orange-500" />;
    }
  };

  return (
    <div 
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-4 z-50 animate-fadeIn space-y-3"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between pb-2 border-b border-zinc-100 dark:border-zinc-800">
        <h4 className="font-bold text-zinc-900 dark:text-white text-sm font-display">
          Campus Notifications
        </h4>
        <button
          onClick={markAllNotificationsAsRead}
          className="text-[11px] font-semibold text-orange-600 dark:text-orange-400 hover:underline"
        >
          Mark all as read
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
        {notifications.length > 0 ? (
          notifications.map((notif) => (
            <div
              key={notif.id}
              onClick={() => {
                markNotificationAsRead(notif.id);
                if (notif.link) onNavigate(notif.link);
                onClose();
              }}
              className={`p-3 rounded-2xl flex items-start gap-3 cursor-pointer transition-colors ${
                notif.isRead ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 opacity-70' : 'bg-orange-50/50 dark:bg-orange-950/20'
              }`}
            >
              <div className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                {getIcon(notif.type)}
              </div>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                  {notif.title}
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                  {notif.message}
                </p>
                <span className="text-[9px] text-zinc-400 block pt-0.5">
                  {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center py-6 text-xs text-zinc-400">
            No notifications at the moment.
          </p>
        )}
      </div>
    </div>
  );
};
