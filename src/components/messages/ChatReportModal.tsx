import React, { useEffect, useState } from 'react';
import { AlertTriangle, Loader2, ShieldCheck, X } from 'lucide-react';
import type { ChatReportReason } from '../../types';
import { submitChatReport } from '../../services/database';
import { Modal, useLinger } from '../ui';

interface ChatReportModalProps {
  reportedUserId: string;
  reportedUserName: string;
  conversationId: string;
  messageId?: string;
  /** Also block the student once the report is filed. */
  alsoBlock?: boolean;
  onBlock?: () => Promise<void> | void;
  onClose: () => void;
}

// Mirrors the `chat_report_reason` enum in migration 006 exactly. A value that
// is not in the enum is rejected by Postgres, so this list must not drift.
const REASONS: { value: ChatReportReason; label: string }[] = [
  { value: 'harassment', label: 'Harassment or bullying' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'spam', label: 'Spam or repeated messages' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'fake_listing', label: 'Fake or misleading listing' },
  { value: 'impersonation', label: 'Impersonation or fake profile' },
  { value: 'other', label: 'Something else' },
];

/**
 * Report a chat message or the other participant.
 *
 * Separate from `ReportModal` because the target and the destination table
 * differ: chat reports go to `chat_reports` and always carry the conversation,
 * so a moderator can see the thread in context.
 */
export const ChatReportModal: React.FC<ChatReportModalProps> = ({
  reportedUserId,
  reportedUserName,
  conversationId,
  messageId,
  alsoBlock,
  onBlock,
  onClose,
}) => {
  const [reason, setReason] = useState<ChatReportReason>('harassment');
  const [details, setDetails] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // The parent mounts us only while a report is open, so dismissing has to
  // animate out *before* we hand control back. `open` drives the modal and
  // `onClose` runs once the exit transition has played.
  const [open, setOpen] = useState(true);
  const visible = useLinger(open ? true : undefined);
  useEffect(() => {
    if (!open && visible === null) onClose();
  }, [open, visible]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('submitting');
    setError(null);
    try {
      await submitChatReport({
        reportedUserId,
        conversationId,
        messageId,
        reason,
        details: details.trim() || undefined,
      });
      if (alsoBlock && onBlock) await onBlock();
      setStatus('done');
    } catch (err: any) {
      console.error('[chat] report failed', err);
      setError(err?.message || 'Could not send that report. Please try again.');
      setStatus('idle');
    }
  };

  const requestClose = () => setOpen(false);

  return (
    <Modal
      open={visible !== null}
      onClose={requestClose}
      variant="sheet"
      size="sm"
      ariaLabel="Report message"
      panelClassName="bg-white dark:bg-zinc-900"
    >
          <div className="flex items-start justify-between gap-3 p-5 border-b border-zinc-100 dark:border-zinc-800">
            <div>
              <h3 className="font-bold text-zinc-900 dark:text-white font-display flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                Report {reportedUserName}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Our student safety team reviews every report.
              </p>
            </div>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {status === 'done' ? (
            <div className="p-6 text-center">
              <ShieldCheck className="w-10 h-10 text-emerald-600 mx-auto mb-3" />
              <p className="font-bold text-zinc-900 dark:text-white">Report sent</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Thanks for letting us know. We will review this conversation.
                {alsoBlock ? ' This student has been blocked.' : ''}
              </p>
              <button
                onClick={requestClose}
                className="mt-4 px-5 py-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold rounded-xl cursor-pointer"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {error && (
                <div className="p-3 text-xs font-semibold rounded-xl bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-200 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  Reason
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as ChatReportReason)}
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                >
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1.5">
                  What happened? (optional)
                </label>
                <textarea
                  rows={4}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1000}
                  placeholder="Add anything that would help us understand the situation."
                  className="w-full px-4 py-3 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-none"
                />
                <p className="text-[10px] text-zinc-400 mt-1 text-right">{details.length}/1000</p>
              </div>

              {alsoBlock && (
                <p className="p-3 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-600 dark:text-zinc-300">
                  This student will be blocked after you report. You can unblock them any time in Account Settings.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={requestClose}
                  className="px-4 py-2.5 text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={status === 'submitting'}
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-white text-xs font-bold rounded-xl cursor-pointer flex items-center gap-2"
                >
                  {status === 'submitting' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Submit report
                </button>
              </div>
            </form>
          )}
    </Modal>
  );
};
