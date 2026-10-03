import React, { useEffect, useState } from 'react';
import { MarketplaceItem, PropertyListing, ViewType } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { listMarketplaceByUser, listPropertiesByUser } from '../../services/database';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { AvatarUploader } from './AvatarUploader';
import MessagingPrivacySection from '../messages/MessagingPrivacySection';
import { Toast } from '../Toast';
import {
  MapPin,
  GraduationCap,
  Edit3,
  LogOut,
  Check,
  Settings,
  Package,
  Home,
  Loader2,
  Lock,
  Trash2,
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react';

interface StudentProfileViewProps {
  onSelectItem: (item: MarketplaceItem) => void;
  onNavigate: (view: ViewType) => void;
}

const LEVEL_OPTIONS = ['100L', '200L', '300L', '400L', '500L', '600L', 'Graduating Stalite', 'Postgraduate', 'Alumnus'];

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({ onSelectItem, onNavigate }) => {
  const { user, updateProfile, logout, changePassword, deleteAccount } = useAuth();

  const [activeTab, setActiveTab] = useState<'listings' | 'settings'>('listings');

  const [myItems, setMyItems] = useState<MarketplaceItem[]>([]);
  const [myProps, setMyProps] = useState<PropertyListing[]>([]);
  const [loadingListings, setLoadingListings] = useState(true);

  // Profile edit form
  const [isEditing, setIsEditing] = useState(false);
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [username, setUsername] = useState(user?.username || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [level, setLevel] = useState(user?.level || '');
  const [hallOrArea, setHallOrArea] = useState(user?.hallOrArea || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Password change
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ ok: boolean; text: string } | null>(null);

  // Delete account
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Avatar toast feedback
  const [toast, setToast] = useState<{ title: string; message: string } | null>(null);

  const handleAvatarChange = async (url: string | null) => {
    const res = await updateProfile({ avatarUrl: url || '' });
    if (res.success) {
      setToast({ title: 'Profile photo updated', message: 'Your new photo is live across your listings and chats.' });
    } else {
      setToast({ title: 'Could not update photo', message: res.error || 'Please try again.' });
    }
  };

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    setLoadingListings(true);
    (async () => {
      try {
        const [items, props] = await Promise.all([listMarketplaceByUser(user.id), listPropertiesByUser(user.id)]);
        if (cancelled) return;
        setMyItems(items);
        setMyProps(props);
      } catch (err) {
        if (!cancelled) console.error('[profile] listings failed', err);
      } finally {
        if (!cancelled) setLoadingListings(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Keep the edit form in sync if the signed-in profile changes.
  useEffect(() => {
    if (!user) return;
    setFullName(user.fullName || '');
    setUsername(user.username || '');
    setDepartment(user.department || '');
    setLevel(user.level || '');
    setHallOrArea(user.hallOrArea || '');
    setBio(user.bio || '');
  }, [user]);

  if (!user) return null;

  const activeItems = myItems.filter((i) => i.status === 'active');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);
    const res = await updateProfile({
      fullName: fullName.trim(),
      username: username.trim().toLowerCase(),
      department: department.trim(),
      level: level.trim(),
      hallOrArea: hallOrArea.trim(),
      bio: bio.trim(),
    });
    setSavingProfile(false);
    if (res.success) {
      setProfileMsg({ ok: true, text: 'Profile updated successfully.' });
      setIsEditing(false);
    } else {
      setProfileMsg({ ok: false, text: res.error || 'Could not update your profile.' });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);
    if (newPassword.length < 6) {
      setPasswordMsg({ ok: false, text: 'Password must be at least 6 characters.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ ok: false, text: 'Passwords do not match.' });
      return;
    }
    setSavingPassword(true);
    const res = await changePassword(newPassword);
    setSavingPassword(false);
    if (res.success) {
      setPasswordMsg({ ok: true, text: 'Password updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
    } else {
      setPasswordMsg({ ok: false, text: res.error || 'Could not update password.' });
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    setDeleteError(null);
    const res = await deleteAccount();
    setDeleting(false);
    if (!res.success) {
      setDeleteError(res.error || 'Could not delete your account. Please try again.');
      setConfirmingDelete(false);
    }
    // On success the auth state clears and App redirects home automatically.
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Identity header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <AvatarUploader name={user.fullName} avatarUrl={user.avatarUrl} onChange={handleAvatarChange} />

            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">{user.fullName}</h1>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">@{user.username}</p>
              {(user.department || user.level) && (
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4 text-emerald-600" />
                  {[user.department, user.level].filter(Boolean).join(' • ')}
                </p>
              )}
              {user.hallOrArea && (
                <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                  {user.hallOrArea}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => {
                setActiveTab('settings');
                setIsEditing(true);
              }}
              className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit Profile
            </button>
            <button
              onClick={logout}
              className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:border-rose-400 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {user.bio && (
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-sm text-zinc-600 dark:text-zinc-300">
            <span className="font-bold text-zinc-800 dark:text-zinc-200">About: </span>
            {user.bio}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setActiveTab('listings')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
            activeTab === 'listings'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Package className="w-4 h-4" />
          My Listings
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 px-4 py-3 text-sm font-bold border-b-2 -mb-px transition-colors ${
            activeTab === 'settings'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400'
              : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
          }`}
        >
          <Settings className="w-4 h-4" />
          Account Settings
        </button>
      </div>

      {activeTab === 'listings' ? (
        <div className="space-y-5">
          {/* Manage summary */}
          <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6 text-sm">
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <Package className="w-4 h-4 text-emerald-600" />
                <b className="text-zinc-950 dark:text-white">{loadingListings ? '—' : myItems.length}</b> items
              </span>
              <span className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                <Home className="w-4 h-4 text-emerald-600" />
                <b className="text-zinc-950 dark:text-white">{loadingListings ? '—' : myProps.length}</b> lodges
              </span>
            </div>
            <button
              onClick={() => onNavigate('my-listings')}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
            >
              Manage all listings
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {loadingListings ? (
            <div className="flex items-center justify-center py-16 text-zinc-400">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : activeItems.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {activeItems.map((item) => (
                <MarketplaceCard key={item.id} item={item} onClick={() => onSelectItem(item)} />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-700 text-sm text-zinc-500">
              You have no active marketplace items right now.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Profile photo */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white font-display flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-emerald-600" />
              Profile Photo
            </h3>
            <div className="mt-5 flex flex-col sm:flex-row items-start sm:items-center gap-6">
              <AvatarUploader
                name={user.fullName}
                avatarUrl={user.avatarUrl}
                showRemove
                onChange={handleAvatarChange}
              />
              <div className="text-xs text-zinc-500 dark:text-zinc-400 space-y-1.5">
                <p className="font-semibold text-zinc-700 dark:text-zinc-300">
                  Your photo shows next to your listings, profile and chats.
                </p>
                <p>Tap the camera icon to upload. JPG, PNG or WEBP — up to 10MB.</p>
                <p className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Uploads go to a secure media host, never your device gallery.
                </p>
              </div>
            </div>
          </div>

          {/* Edit profile */}
          <form onSubmit={handleSaveProfile} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white font-display">Student Information</h3>
              {!isEditing && (
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              )}
            </div>

            {profileMsg && (
              <div
                className={`p-3 text-xs font-semibold rounded-xl flex items-center gap-2 ${
                  profileMsg.ok
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200'
                }`}
              >
                {profileMsg.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {profileMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name">
                <input
                  type="text"
                  value={fullName}
                  disabled={!isEditing}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Username">
                <input
                  type="text"
                  value={username}
                  disabled={!isEditing}
                  onChange={(e) => setUsername(e.target.value.replace(/\s/g, ''))}
                  className={inputClass}
                />
              </Field>
              <Field label="Department">
                <input
                  type="text"
                  value={department}
                  disabled={!isEditing}
                  onChange={(e) => setDepartment(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Level">
                <select value={level} disabled={!isEditing} onChange={(e) => setLevel(e.target.value)} className={inputClass}>
                  <option value="">Select level</option>
                  {LEVEL_OPTIONS.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Hall or Off-Campus Area">
                <input
                  type="text"
                  value={hallOrArea}
                  disabled={!isEditing}
                  onChange={(e) => setHallOrArea(e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Short Bio">
                <input
                  type="text"
                  value={bio}
                  disabled={!isEditing}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Visible to buyers on your public profile"
                  className={inputClass}
                />
              </Field>
            </div>

            {isEditing && (
              <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(false);
                    setProfileMsg(null);
                  }}
                  className="px-5 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-2"
                >
                  {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            )}
          </form>

          {/* Change password */}
          <form onSubmit={handleChangePassword} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white font-display flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-600" />
              Change Password
            </h3>

            {passwordMsg && (
              <div
                className={`p-3 text-xs font-semibold rounded-xl flex items-center gap-2 ${
                  passwordMsg.ok
                    ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200'
                }`}
              >
                {passwordMsg.ok ? <Check className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {passwordMsg.text}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="New Password">
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 6 characters"
                  className={inputClass}
                />
              </Field>
              <Field label="Confirm New Password">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className={inputClass}
                />
              </Field>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingPassword || !newPassword}
                className="px-6 py-2.5 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 disabled:opacity-60 font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-2"
              >
                {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Update Password
              </button>
            </div>
          </form>

          <MessagingPrivacySection />

          {/* Danger zone */}
          <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-3xl p-6 sm:p-8">
            <h3 className="text-lg font-bold text-rose-700 dark:text-rose-300 font-display flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Delete Account
            </h3>
            <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-1 mb-4 max-w-lg">
              This permanently removes your profile and listings from JID. This action cannot be undone.
            </p>

            {deleteError && (
              <div className="p-3 mb-4 text-xs font-semibold rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {deleteError}
              </div>
            )}

            {!confirmingDelete ? (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="px-5 py-2.5 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-950/50 font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                Delete my account
              </button>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">Are you absolutely sure?</span>
                <button
                  onClick={handleDeleteAccount}
                  disabled={deleting}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-2 cursor-pointer"
                >
                  {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                  Yes, delete permanently
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  className="px-4 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <Toast
        isVisible={Boolean(toast)}
        onClose={() => setToast(null)}
        title={toast?.title || ''}
        message={toast?.message || ''}
        duration={4200}
      />
    </div>
  );
};

const inputClass =
  'w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-base sm:text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 disabled:opacity-70 disabled:cursor-not-allowed';

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{label}</label>
    {children}
  </div>
);
