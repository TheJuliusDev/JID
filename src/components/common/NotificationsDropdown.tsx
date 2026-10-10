import React from 'react';
import { useData } from '../../context/DataContext';
import { BellOff, CheckCheck, Zap, MessageSquare, Info, ShieldAlert, TrendingDown, BellRing } from 'lucide-react';
import type { ViewType } from '../../types';
import { isViewType } from '../../router/routes';

interface NotificationsDropdownProps {
  onClose: () => void;
  onNavigate: (view: ViewType) => void;
}

/**
 * Notification tray contents.
 *
 * Positioning, glass and the enter/exit animation belong to the `Dropdown`
 * wrapper that renders this, so the panel only describes its own content. That
 * also means it is mounted only while open — a fresh list every time, and no
 * way for the panel to outlive its dismissal.
 */
export const NotificationsDropdown: React.FC<NotificationsDropdownProps> = ({
  onClose,
  onNavigate
}) => {
  const { notifications, markNotificationRead, markAllNotificationsRead } = useData();

  const getIcon = (type: string, category?: string) => {
    if (category === 'price_drop') return <TrendingDown className="w-4 h-4 text-emerald-500" />;
    if (category === 'saved_search') return <BellRing className="w-4 h-4 text-amber-500" />;
    switch (type) {
      case 'boost': return <Zap className="w-4 h-4 text-amber-500 fill-current" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-blue-500" />;
      case 'report': return <ShieldAlert className="w-4 h-4 text-rose-500" />;
      default: return <Info className="w-4 h-4 text-emerald-500" />;
    }
  };

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-2 pb-2 border-b border-zinc-200/70 dark:border-zinc-700/70">
        <div>
          <h4 className="font-bold text-zinc-900 dark:text-white text-sm font-display leading-tight">
            Notifications
          </h4>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
            {unread > 0 ? `${unread} new` : 'You’re all caught up'}
          </p>
        </div>
        <button
          type="button"
          onClick={markAllNotificationsRead}
          disabled={unread === 0}
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 rounded-lg px-2 py-1 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 disabled:opacity-40 disabled:hover:bg-transparent transition-colors cursor-pointer"
        >
          <CheckCheck className="w-3.5 h-3.5" />
          Mark all read
        </button>
      </div>

      <div className="max-h-80 overflow-y-auto overscroll-contain">
        {notifications.length > 0 ? (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60 -mx-2">
            {notifications.map((notif) => (
              <li key={notif.id}>
                <button
                  type="button"
                  onClick={() => {
                    markNotificationRead(notif.id);
                    // `link` is a plain text column holding a view name; ignore
                    // anything the route table does not recognise.
                    if (isViewType(notif.link)) onNavigate(notif.link);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-2xl flex items-start gap-3 transition-colors cursor-pointer ${
                    notif.isRead
                      ? 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40 opacity-70'
                      : 'bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50 dark:hover:bg-emerald-950/35'
                  }`}
                >
                  <span className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex-shrink-0">
                    {getIcon(notif.type, notif.category)}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="flex items-center gap-2">
                      <span className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {notif.title}
                      </span>
                      {!notif.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                      )}
                    </span>
                    <span className="block text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2">
                      {notif.message}
                    </span>
                    <span className="block text-[10px] text-zinc-400 pt-0.5">
                      {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-8 px-4 space-y-2">
            <div className="w-11 h-11 mx-auto rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center">
              <BellOff className="w-5 h-5" />
            </div>
            <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-200">Nothing new right now</p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              Price drops on your saved searches and listings you follow will show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
