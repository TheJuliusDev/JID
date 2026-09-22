import React, { useState } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useAuth } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { MarketplaceCard } from '../marketplace/MarketplaceCard';
import { 
  Sparkles, 
  ShieldCheck, 
  MapPin, 
  GraduationCap, 
  Phone, 
  Mail, 
  Edit3, 
  LogOut, 
  Check, 
  User, 
  Settings, 
  Package, 
  Heart,
  Calendar
} from 'lucide-react';

interface StudentProfileViewProps {
  onSelectItem: (item: MarketplaceItem) => void;
  onOpenUpgrade: () => void;
}

export const StudentProfileView: React.FC<StudentProfileViewProps> = ({
  onSelectItem,
  onOpenUpgrade
}) => {
  const { user, updateProfile, logout, switchDemoUser } = useAuth();
  const { marketplaceItems, savedListings } = useData();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'listings' | 'settings'>('listings');

  // Form states for editing
  const [fullName, setFullName] = useState(user?.fullName || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [level, setLevel] = useState(user?.level || '400L');
  const [hallOrArea, setHallOrArea] = useState(user?.hallOrArea || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const myItems = marketplaceItems.filter(
    item => item.userId === user?.id || item.seller.name === user?.fullName
  );

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      fullName,
      department,
      level,
      hallOrArea,
      phoneNumber,
      bio
    });
    setSavedSuccess(true);
    setIsEditing(false);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-8">
      {/* Profile Header Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        {savedSuccess && (
          <div className="mb-4 p-3 bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-200 text-xs font-semibold rounded-xl text-center flex items-center justify-center gap-2">
            <Check className="w-4 h-4" /> Profile details updated successfully!
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="relative w-24 h-24 rounded-full overflow-hidden bg-orange-100 dark:bg-orange-950 border-2 border-orange-500/30 flex-shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.fullName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center font-bold text-2xl text-orange-600">
                  {user?.fullName.charAt(0)}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-zinc-950 dark:text-white font-display">
                  {user?.fullName}
                </h1>
                {user?.isPremium && (
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 text-xs font-bold rounded-full">
                    <Sparkles className="w-3 h-3 fill-current" />
                    Premium Member
                  </span>
                )}
                {user?.isVerified && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-100 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 text-xs font-semibold rounded-full">
                    <ShieldCheck className="w-3 h-3" />
                    Verified Student
                  </span>
                )}
              </div>

              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 flex items-center gap-1.5">
                <GraduationCap className="w-4 h-4 text-orange-600" />
                {user?.department} • {user?.level}
              </p>

              <p className="text-xs text-zinc-500 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-zinc-400" />
                Resident: {user?.hallOrArea}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-zinc-100 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              {isEditing ? 'Close Editor' : 'Edit Profile'}
            </button>
            <button
              onClick={logout}
              className="px-4 py-2.5 border border-zinc-200 dark:border-zinc-800 hover:border-rose-400 text-rose-600 dark:text-rose-400 text-xs font-bold rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>

        {/* Bio */}
        {user?.bio && (
          <div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-300">
            <span className="font-bold text-zinc-800 dark:text-zinc-200">About: </span>
            {user.bio}
          </div>
        )}

        {/* Demo profile switcher banner */}
        <div className="mt-6 p-3.5 bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Demo Mode Account Switcher:</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => switchDemoUser('julius')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                user?.email.includes('julius')
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Julius (Student)
            </button>
            <button
              onClick={() => switchDemoUser('praise')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                user?.email.includes('praise')
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Praise (Seller)
            </button>
            <button
              onClick={() => switchDemoUser('admin')}
              className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                user?.role === 'admin'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
              }`}
            >
              Platform Admin
            </button>
          </div>
        </div>
      </div>

      {/* Editing Form */}
      {isEditing && (
        <form onSubmit={handleSaveProfile} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-4 animate-fadeIn">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white font-display">
            Update Student Information
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Level
              </label>
              <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
              >
                {['100L', '200L', '300L', '400L', '500L', 'Graduating Stalite', 'Postgraduate'].map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Hall or Off-Campus Location
              </label>
              <input
                type="text"
                value={hallOrArea}
                onChange={(e) => setHallOrArea(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">
                Student Bio
              </label>
              <input
                type="text"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Short bio visible to buyers..."
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-5 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              Save Changes
            </button>
          </div>
        </form>
      )}

      {/* Tabs: My Listings / Saved */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
          <button
            onClick={() => setActiveTab('listings')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'listings'
                ? 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900'
                : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
            }`}
          >
            My Active Listings ({myItems.length})
          </button>
        </div>

        {myItems.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {myItems.map((item) => (
              <MarketplaceCard
                key={item.id}
                item={item}
                onClick={() => onSelectItem(item)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-sm text-zinc-500">
            You currently have no active listings.
          </div>
        )}
      </div>
    </div>
  );
};
