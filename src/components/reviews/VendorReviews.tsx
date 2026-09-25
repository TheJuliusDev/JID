import React, { useState, useEffect, useCallback } from 'react';
import { VendorReview, VendorRatingSummary } from '../../types';
import {
  listVendorReviews,
  summarizeReviews,
  upsertReview,
  deleteReview,
} from '../../services/database';
import { useAuth } from '../../context/AuthContext';
import { StarRating } from '../common/StarRating';
import { Loader2, Trash2, Star, AlertTriangle } from 'lucide-react';

interface VendorReviewsProps {
  vendorId: string;
  vendorName: string;
}

const relativeDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

const emptySummary: VendorRatingSummary = {
  average: 0,
  count: 0,
  distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
};

export const VendorReviews: React.FC<VendorReviewsProps> = ({ vendorId, vendorName }) => {
  const { user, isAuthenticated } = useAuth();

  const [reviews, setReviews] = useState<VendorReview[]>([]);
  const [summary, setSummary] = useState<VendorRatingSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const isOwnProfile = user?.id === vendorId;
  const myReview = user ? reviews.find((r) => r.reviewerId === user.id) : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await listVendorReviews(vendorId);
      setReviews(list);
      setSummary(summarizeReviews(list));
    } catch (err: any) {
      console.error('[reviews] load failed', err);
      setLoadError('Could not load reviews right now.');
    } finally {
      setLoading(false);
    }
  }, [vendorId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const list = await listVendorReviews(vendorId);
        if (cancelled) return;
        setReviews(list);
        setSummary(summarizeReviews(list));
      } catch (err) {
        if (!cancelled) {
          console.error('[reviews] load failed', err);
          setLoadError('Could not load reviews right now.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vendorId]);

  // Prefill the form with the user's existing review when it loads.
  useEffect(() => {
    if (myReview) {
      setRating(myReview.rating);
      setComment(myReview.comment || '');
    } else {
      setRating(0);
      setComment('');
    }
  }, [myReview?.id, myReview?.rating, myReview?.comment]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (rating < 1) {
      setFormError('Please choose a star rating.');
      return;
    }
    setFormError(null);
    setSubmitting(true);
    try {
      await upsertReview(vendorId, user.id, rating, comment.trim() || undefined);
      await load();
    } catch (err: any) {
      console.error('[reviews] submit failed', err);
      setFormError(err?.message || 'Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!myReview) return;
    if (!window.confirm('Remove your review of this seller?')) return;
    try {
      await deleteReview(myReview.id);
      await load();
    } catch (err) {
      console.error('[reviews] delete failed', err);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-end justify-between gap-4">
        <h2 className="text-lg font-bold text-zinc-950 dark:text-white font-display">
          Ratings &amp; Reviews
        </h2>
        {summary.count > 0 && (
          <div className="flex items-center gap-2">
            <StarRating value={summary.average} size={16} />
            <span className="text-sm font-bold text-zinc-900 dark:text-white">{summary.average.toFixed(1)}</span>
            <span className="text-xs text-zinc-500">({summary.count})</span>
          </div>
        )}
      </div>

      {/* Review form (signed-in, not own profile) */}
      {isAuthenticated && !isOwnProfile && (
        <form
          onSubmit={handleSubmit}
          className="p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3"
        >
          <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
            {myReview ? 'Update your review' : `Rate your experience with ${vendorName}`}
          </p>
          <StarRating value={rating} size={26} interactive onChange={setRating} />
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            maxLength={500}
            placeholder="Share how the transaction went (optional)…"
            className="w-full px-3.5 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 resize-none focus:ring-2 focus:ring-emerald-500/50 focus:outline-none"
          />
          {formError && (
            <p className="text-xs text-rose-600 dark:text-rose-400 flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5" />
              {formError}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-2"
            >
              {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {myReview ? 'Update review' : 'Post review'}
            </button>
            {myReview && (
              <button
                type="button"
                onClick={handleDelete}
                className="px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            )}
          </div>
        </form>
      )}

      {isOwnProfile && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">
          This is how buyers rate your storefront. You can’t review your own account.
        </p>
      )}

      {/* Review list */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-zinc-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-2 p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 rounded-xl border border-rose-200 dark:border-rose-900">
          <AlertTriangle className="w-4 h-4" />
          {loadError}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <Star className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No reviews yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div
              key={r.id}
              className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-2"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-emerald-100 dark:bg-emerald-950 flex-shrink-0 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    {r.reviewer?.avatarUrl ? (
                      <img src={r.reviewer.avatarUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      (r.reviewer?.fullName || 'S').charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate">
                      {r.reviewer?.fullName || 'JID Student'}
                    </p>
                    <p className="text-[11px] text-zinc-400">{relativeDate(r.createdAt)}</p>
                  </div>
                </div>
                <StarRating value={r.rating} size={13} />
              </div>
              {r.comment && (
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{r.comment}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
