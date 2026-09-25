import React, { useState } from 'react';
import { MarketplaceItem, PropertyListing } from '../../types';
import { BRAND_CONFIG } from '../../config/brand';
import { useData } from '../../context/DataContext';
import { X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

/**
 * What is being reported. App builds a listing target from a detail modal
 * (`{ kind, item }`); a public profile builds a user target (`{ kind: 'user', user }`).
 */
export type ReportTarget =
  | { kind: 'marketplace' | 'property'; item: MarketplaceItem | PropertyListing }
  | { kind: 'user'; user: { id: string; username: string; fullName: string } };

interface ReportModalProps {
  target: ReportTarget;
  onClose: () => void;
}

export const ReportModal: React.FC<ReportModalProps> = ({ target, onClose }) => {
  const { reportListing, reportUser } = useData();

  const [reason, setReason] = useState(BRAND_CONFIG.reportReasons[0].label);
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  const targetTitle =
    target.kind === 'user' ? `@${target.user.username || target.user.fullName}` : target.item.title;
  const targetLabel = target.kind === 'user' ? 'Reporting user' : 'Reporting listing';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === 'submitting') return;
    setError(null);
    setStatus('submitting');
    try {
      if (target.kind === 'user') {
        await reportUser({
          reportedUserId: target.user.id,
          reason,
          details: details.trim() || undefined,
        });
      } else {
        await reportListing({
          listingType: target.kind,
          listingId: target.item.id,
          listingTitle: target.item.title,
          reason,
          details: details.trim() || undefined,
        });
      }
      setStatus('done');
    } catch (err: any) {
      console.error('[report] submit failed', err);
      setError(err?.message || 'Could not submit your report. Please try again.');
      setStatus('idle');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl p-6 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <div className="flex items-center gap-2 text-rose-600">
            <AlertTriangle className="w-5 h-5" />
            <h3 className="font-bold text-zinc-950 dark:text-white text-base font-display">
              Report to Moderators
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-white rounded-full"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {status === 'done' ? (
          <div className="text-center py-6 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-zinc-900 dark:text-white text-base font-display">
                Report submitted
              </h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto">
                Thank you for helping keep the Great Ife community safe. Our moderators will review
                this and take action where needed.
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
              <span className="text-zinc-400">{targetLabel}:</span>
              <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">{targetTitle}</p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-300 text-xs rounded-xl border border-rose-200 dark:border-rose-900">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Reason for report
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-medium text-zinc-800 dark:text-zinc-200"
              >
                {BRAND_CONFIG.reportReasons.map((r) => (
                  <option key={r.id} value={r.label}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                Additional details (optional)
              </label>
              <textarea
                rows={3}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1000}
                placeholder="Share specific notes or suspicious details that help our moderators…"
                className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-zinc-100 resize-none"
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
                disabled={status === 'submitting'}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-2"
              >
                {status === 'submitting' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {status === 'submitting' ? 'Submitting…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
