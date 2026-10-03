import React, { useCallback, useEffect, useState } from 'react';
import { Bell, ShieldOff, UserX, Volume2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import {
  fetchMyPresenceSettings,
  setPresenceVisible as dbSetPresenceVisible,
  setLastSeenVisible as dbSetLastSeenVisible,
} from '../../services/database';
import { getPushPermission, isPushSupported } from '../../services/push';

/**
 * Presence & push settings, plus the blocked-student list.
 *
 * Grouped into one card because they are all answers to the same question — who
 * can tell that I am here, and who can reach me.
 */
const MessagingPrivacySection: React.FC = () => {
  const { user } = useAuth();
  const { blockedUsers, unblockUser } = useData();

  const [presenceVisible, setPresenceVisibleState] = useState(true);
  const [lastSeenVisible, setLastSeenVisibleState] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const settings = await fetchMyPresenceSettings(user.id);
        if (cancelled) return;
        setPresenceVisibleState(settings.presenceVisible);
        setLastSeenVisibleState(settings.lastSeenVisible);
      } catch (err) {
        console.error('[settings] load presence settings failed', err);
      } finally {
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Applied optimistically and reverted on failure, so the switch responds on
  // tap instead of after a round trip.
  const applyPresence = useCallback(
    async (next: boolean) => {
      if (!user) return;
      const previous = presenceVisible;
      setPresenceVisibleState(next);
      // Hiding presence implies hiding the timestamp; re-enabling restores both.
      if (next !== previous) setLastSeenVisibleState(next);
      setBusy('presence');
      setError(null);
      try {
        await dbSetPresenceVisible(user.id, next);
      } catch (err) {
        console.error('[settings] update presence failed', err);
        setPresenceVisibleState(previous);
        setLastSeenVisibleState(previous);
        setError('Could not save that change. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [user, presenceVisible]
  );

  const applyLastSeen = useCallback(
    async (next: boolean) => {
      if (!user) return;
      const previous = lastSeenVisible;
      setLastSeenVisibleState(next);
      setBusy('lastSeen');
      setError(null);
      try {
        await dbSetLastSeenVisible(user.id, next);
      } catch (err) {
        console.error('[settings] update last seen failed', err);
        setLastSeenVisibleState(previous);
        setError('Could not save that change. Please try again.');
      } finally {
        setBusy(null);
      }
    },
    [user, lastSeenVisible]
  );

  const pushState = getPushPermission();
  const pushAvailable = isPushSupported();

  return (
    <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
      <h3 className="text-lg font-bold text-zinc-900 dark:text-white font-display flex items-center gap-2">
        <ShieldOff className="w-4 h-4 text-emerald-600" />
        Messaging &amp; Privacy
      </h3>

      {error && (
        <div className="p-3 text-xs font-semibold rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200">
          {error}
        </div>
      )}

      <ToggleRow
        icon={<Volume2 className="w-4 h-4" />}
        title="Show when I'm online"
        description="Other students see a green dot and 'Online' in your chats."
        checked={presenceVisible}
        disabled={!loaded || busy !== null}
        onChange={applyPresence}
      />

      <ToggleRow
        icon={<Bell className="w-4 h-4" />}
        title="Show my last seen"
        description="Chats show when you were last active. Turning off online status also turns this off."
        checked={lastSeenVisible}
        // Meaningless while presence itself is hidden.
        disabled={!loaded || busy !== null || !presenceVisible}
        onChange={applyLastSeen}
      />

      {!pushAvailable && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          This browser does not support notifications. Messages will still appear in the app when it is open.
        </p>
      )}
      {pushAvailable && pushState === 'denied' && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Notifications are blocked for this site in your browser settings, so messages will not alert you when the
          app is closed.
        </p>
      )}

      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
        <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
          <UserX className="w-3.5 h-3.5" />
          Blocked students
        </h4>

        {blockedUsers.length === 0 ? (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-2">
            You have not blocked anyone.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {blockedUsers.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-3 p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {b.fullName}
                    {b.username ? (
                      <span className="ml-1.5 text-xs font-normal text-zinc-500">@{b.username}</span>
                    ) : null}
                  </p>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Blocked {new Date(b.blockedAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => unblockUser(b.id)}
                  className="shrink-0 px-3 py-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                >
                  Unblock
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const ToggleRow: React.FC<{
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (next: boolean) => void;
}> = ({ icon, title, description, checked, disabled, onChange }) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0 flex items-start gap-3">
      <span className="mt-0.5 text-zinc-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{description}</p>
      </div>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={title}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
        checked ? 'bg-emerald-600' : 'bg-zinc-300 dark:bg-zinc-700'
      }`}
    >
      <span
        className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

export default MessagingPrivacySection;
