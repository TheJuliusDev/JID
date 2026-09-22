import React, { useState } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { useAuth } from '../../context/AuthContext';
import { X, AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface ReportModalProps {
  target: MarketplaceItem | PropertyListing | null;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ target, onClose }) => {
  if (!target) return null;

  const { submitReport } = useData();
  const { user } = useAuth();

  const [reason, setReason] = useState(BRAND_CONFIG.reportReasons[0].label);
  const [details, setDetails] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    submitReport({
      reporterId: user?.id,
      targetType: 'roomType' in target ? 'property' : 'marketplace',
      targetId: target.id,
      targetTitle: target.title,
      reason,
      details: details.trim()
    });
    setIsSubmitted(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn">
      <div 
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-zinc-950 dark:text-white text-base font-display">
              Report Community Violation
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {isSubmitted ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-zinc-900 dark:text-white text-base font-display">
                Report Submitted to Moderation
              </h4>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                Thank you for protecting the Great Ife campus community. Our moderators will review this listing within 2 hours.
              </p>
            </div>
            <button
              onClick={onClose}
              className="px-6 py-2.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs rounded-xl shadow cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs">
              <span className="text-zinc-400">Reporting:</span>
              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">
                {target.title}
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Reason for Report
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                {BRAND_CONFIG.reportReasons.map((r) => (
                  <option key={r.id} value={r.label}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Additional Details (Optional)
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide specific notes or suspicious details..."
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-semibold text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow cursor-pointer"
              >
                Submit Report
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
