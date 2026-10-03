import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ImagePlus, Loader2, Mic, RotateCcw, Send, Trash2, X, AlertTriangle, Zap } from 'lucide-react';
import {
  MAX_IMAGES_PER_MESSAGE,
  MAX_VOICE_SECONDS,
  VoiceRecorder,
  canRecordVoice,
  compressImage,
  uploadChatImage,
  uploadVoiceNote,
} from '../../services/media';
import { hasCloudinaryConfig } from '../../config/env';

export interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
  progress: number;
  error?: string;
  /** Already uploaded; carries the final URL. */
  url?: string;
}

interface ChatComposerProps {
  onSendText: (text: string) => void | Promise<void>;
  onSendImages: (urls: string[]) => void | Promise<void>;
  onSendVoice: (url: string, durationMs: number, peaks: number[]) => void | Promise<void>;
  replyTo: { id: string; preview: string; mine: boolean } | null;
  onCancelReply: () => void;
  onTyping: (typing: boolean) => void;
  listingTitle?: string;
  disabled?: boolean;
}

/**
 * Quick replies.
 *
 * These are the openers people actually send about a listing — availability,
 * price, and viewing arrangements. Typing "is this still available?" for the
 * ninth time is exactly what a shortcut is for. They are suggestions, not
 * canned canned responses: tapping one puts the text in the composer so it can
 * be edited before sending.
 */
function quickRepliesFor(listingTitle?: string): string[] {
  const item = listingTitle ? `"${listingTitle}"` : 'this item';
  return [
    `Hi, is ${item} still available?`,
    'Is the price negotiable?',
    'Can I come see it this week?',
    'Would you take a bundle deal?',
    'Thanks — I am interested. Please share more details.',
  ];
}

export const ChatComposer: React.FC<ChatComposerProps> = ({
  onSendText,
  onSendImages,
  onSendVoice,
  replyTo,
  onCancelReply,
  onTyping,
  listingTitle,
  disabled,
}) => {
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [level, setLevel] = useState(0);
  const [uploadingVoice, setUploadingVoice] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<VoiceRecorder | null>(null);
  const recordingTimerRef = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Object URLs for previews are revoked when the attachment list changes, so a
  // long session picking photos does not accumulate blobs in memory.
  useEffect(() => {
    return () => {
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
    };
  }, [attachments]);

  const busy = attachments.length > 0 || uploadingVoice || recording;

  // ---- Text -----------------------------------------------------------------

  const growTextarea = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  };

  useEffect(growTextarea, [text]);

  const submitText = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setText('');
    onTyping(false);
    await onSendText(body);
  };

  // ---- Images ---------------------------------------------------------------

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming = Array.from(files).slice(0, MAX_IMAGES_PER_MESSAGE - attachments.length);
      if (incoming.length === 0) return;

      const queued: PendingAttachment[] = incoming.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        previewUrl: URL.createObjectURL(file),
        progress: 0,
      }));
      setAttachments((prev) => [...prev, ...queued]);

      // Compress before uploading: a 12MP phone photo is several megabytes on a
      // campus connection, and every student here is on mobile data.
      for (const item of queued) {
        try {
          const prepared = await compressImage(item.file);
          const url = await uploadChatImage(prepared.file, (percent) => {
            setAttachments((prev) =>
              prev.map((a) => (a.id === item.id ? { ...a, progress: percent } : a))
            );
          });
          setAttachments((prev) =>
            prev.map((a) => (a.id === item.id ? { ...a, progress: 100, url } : a))
          );
        } catch (err: any) {
          setAttachments((prev) =>
            prev.map((a) =>
              a.id === item.id ? { ...a, error: err?.message || 'Could not upload this photo.' } : a
            )
          );
        }
      }
    },
    [attachments.length]
  );

  const retryAttachment = (id: string) => {
    const item = attachments.find((a) => a.id === id);
    if (!item) return;
    setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, error: undefined, progress: 0 } : a)));
    void (async () => {
      try {
        const prepared = await compressImage(item.file);
        const url = await uploadChatImage(prepared.file, (percent) => {
          setAttachments((prev) =>
            prev.map((a) => (a.id === id ? { ...a, progress: percent } : a))
          );
        });
        setAttachments((prev) => prev.map((a) => (a.id === id ? { ...a, progress: 100, url } : a)));
      } catch (err: any) {
        setAttachments((prev) =>
          prev.map((a) => (a.id === id ? { ...a, error: err?.message || 'Could not upload this photo.' } : a))
        );
      }
    })();
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  };

  const submitImages = async () => {
    if (attachments.some((a) => a.error || !a.url)) return;
    const urls = attachments.map((a) => a.url!).filter(Boolean);
    if (urls.length === 0) return;
    const ids = attachments.map((a) => a.id);
    setAttachments([]);
    await onSendImages(urls);
    ids.forEach((id) => {
      const target = attachments.find((a) => a.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
    });
  };

  // ---- Voice ----------------------------------------------------------------

  const stopRecordingTimers = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const beginRecording = async () => {
    setVoiceError(null);
    try {
      const recorder = new VoiceRecorder();
      recorder.onLevel = (l) => setLevel(l);
      await recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = window.setInterval(() => {
        const secs = Math.floor(recorder.elapsedMs / 1000);
        setRecordingSeconds(secs);
        // Hard stop at the cap. The composer needs a bound: an unbounded
        // recording on a metered connection is a bill, not a feature.
        if (secs >= MAX_VOICE_SECONDS) void finishRecording();
      }, 250);
    } catch (err: any) {
      setVoiceError(
        err?.name === 'NotAllowedError'
          ? 'Microphone access was blocked. Allow it in your browser settings to send voice messages.'
          : 'Could not start recording on this device.'
      );
    }
  };

  const finishRecording = async () => {
    stopRecordingTimers();
    const recorder = recorderRef.current;
    recorderRef.current = null;
    setRecording(false);
    setLevel(0);
    if (!recorder) return;

    try {
      const recorded = await recorder.stop();
      setUploadingVoice(true);
      const url = await uploadVoiceNote(recorded.blob);
      setUploadingVoice(false);
      await onSendVoice(url, recorded.durationMs, recorded.peaks);
      URL.revokeObjectURL(recorded.previewUrl);
    } catch (err: any) {
      setUploadingVoice(false);
      setVoiceError(err?.message || 'Could not send that voice message.');
    }
  };

  // Abandon the recording if the composer unmounts mid-press (conversation
  // switched), otherwise the mic stays hot.
  useEffect(() => {
    return () => {
      stopRecordingTimers();
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder) recorder.cancel();
    };
  }, []);

  const voiceSupported = canRecordVoice();
  const canSend = !busy && (text.trim().length > 0 || attachments.some((a) => a.url));

  return (
    <div className="flex-shrink-0 bg-white dark:bg-zinc-900">
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-zinc-200 dark:border-zinc-800"
          >
            <div className="px-3 sm:px-4 py-2.5 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-3">
              <div className="flex-1 min-w-0 pl-2.5 border-l-2 border-emerald-500">
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                  Replying to {replyTo.mine ? 'yourself' : 'them'}
                </p>
                <p className="text-xs text-zinc-600 dark:text-zinc-300 truncate">{replyTo.preview}</p>
              </div>
              <button
                type="button"
                onClick={onCancelReply}
                aria-label="Cancel reply"
                className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {attachments.length > 0 && (
        <div className="px-3 sm:px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 overflow-x-auto">
          {attachments.map((a) => (
            <div key={a.id} className="relative w-20 h-20 flex-shrink-0">
              <img
                src={a.previewUrl}
                alt=""
                className={`w-full h-full object-cover rounded-xl ${a.error ? 'opacity-40' : ''}`}
              />
              {a.error ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-0.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <button
                    type="button"
                    onClick={() => retryAttachment(a.id)}
                    aria-label="Retry upload"
                    className="p-1 rounded-full bg-white/90 dark:bg-zinc-900/90 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              ) : !a.url ? (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20 rounded-b-xl overflow-hidden">
                  <motion.div className="h-full bg-emerald-500" animate={{ width: `${a.progress}%` }} />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => removeAttachment(a.id)}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 flex items-center justify-center cursor-pointer shadow"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {attachments.length < MAX_IMAGES_PER_MESSAGE && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Add another photo"
              className="w-20 h-20 flex-shrink-0 rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-zinc-400 hover:text-emerald-600 hover:border-emerald-400 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
          )}
        </div>
      )}

      {recording && (
        <div className="px-3 sm:px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-rose-50 dark:bg-rose-950/30 flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse flex-shrink-0" />
          <span className="text-xs font-bold text-rose-700 dark:text-rose-300 tabular-nums">
            {Math.floor(recordingSeconds / 60)}:{(recordingSeconds % 60).toString().padStart(2, '0')}
          </span>
          <div className="flex-1 flex items-center gap-[2px] h-5 overflow-hidden">
            {Array.from({ length: 32 }).map((_, i) => {
              // Bars within `level` are lit; the rest sit flat. A CSS transition
              // smooths the jumpiness that raw analyser values produce.
              const active = i / 32 < level;
              return (
                <span
                  key={i}
                  className={`flex-1 rounded-full transition-all duration-100 ${
                    active ? 'bg-rose-500' : 'bg-rose-200 dark:bg-rose-900'
                  }`}
                  style={{ height: `${30 + ((i * 37) % 70)}%` }}
                />
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => {
              const recorder = recorderRef.current;
              recorderRef.current = null;
              stopRecordingTimers();
              setRecording(false);
              setLevel(0);
              void recorder?.cancel();
            }}
            aria-label="Cancel recording"
            className="p-2 rounded-full text-zinc-500 hover:bg-rose-100 dark:hover:bg-rose-950 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => void finishRecording()}
            aria-label="Send voice message"
            className="p-2 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      )}

      {voiceError && (
        <div className="px-3 sm:px-4 py-2 border-t border-zinc-200 dark:border-zinc-800 bg-rose-50 dark:bg-rose-950/30 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300 flex-1">{voiceError}</span>
          <button
            type="button"
            onClick={() => setVoiceError(null)}
            aria-label="Dismiss"
            className="text-rose-400 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {showQuickReplies && !recording && attachments.length === 0 && (
        <div className="px-3 sm:px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 flex gap-2 overflow-x-auto">
          {quickRepliesFor(listingTitle).map((reply) => (
            <button
              key={reply}
              type="button"
              onClick={() => {
                setText(reply);
                setShowQuickReplies(false);
                textareaRef.current?.focus();
              }}
              className="px-3 py-1.5 text-[11px] font-semibold rounded-full border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 whitespace-nowrap transition-colors cursor-pointer flex-shrink-0"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 sm:p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-end gap-2 sm:gap-3 bg-white dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => (attachments.length === 0 ? cameraInputRef.current?.click() : fileInputRef.current?.click())}
          disabled={disabled || recording}
          aria-label="Add photos"
          title="Add photos"
          className="p-3 rounded-2xl text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
        >
          <ImagePlus className="w-6 h-6" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
        {/* `capture` opens the camera directly on mobile instead of the file
            picker. Omitted on desktop, where it would force a file dialog. */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <div className="flex-1 min-w-0 flex items-end gap-2 px-4 py-2 bg-zinc-50 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 rounded-2xl focus-within:ring-2 focus-within:ring-emerald-500/50">
          {!recording && (
            <button
              type="button"
              onClick={() => setShowQuickReplies((v) => !v)}
              disabled={disabled}
              aria-label="Quick replies"
              title="Quick replies"
              className="text-zinc-400 hover:text-emerald-600 transition-colors cursor-pointer disabled:opacity-40 flex-shrink-0 pb-0.5"
            >
              <Zap className="w-4 h-4" />
            </button>
          )}
          <textarea
            ref={textareaRef}
            rows={1}
            value={recording ? '' : text}
            disabled={disabled || recording}
            onChange={(e) => {
              const next = e.target.value;
              setText(next);
              if (next.trim()) onTyping(true);
              else onTyping(false);
            }}
            onBlur={() => onTyping(false)}
            placeholder={recording ? 'Recording…' : 'Type a message…'}
            className="flex-1 min-w-0 bg-transparent text-base sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none resize-none py-1 max-h-[140px] disabled:opacity-60"
          />
        </div>

        {voiceSupported && (
          <button
            type="button"
            onClick={() => void beginRecording()}
            disabled={disabled || recording || attachments.length > 0}
            aria-label="Record a voice message"
            title="Hold to record"
            className="p-3 rounded-2xl text-zinc-500 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            {uploadingVoice ? <Loader2 className="w-6 h-6 animate-spin" /> : <Mic className="w-6 h-6" />}
          </button>
        )}

        <button
          type="button"
          onClick={() => (attachments.length > 0 ? void submitImages() : void submitText())}
          disabled={!canSend || disabled || recording}
          className="p-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-2xl shadow transition-all cursor-pointer flex-shrink-0"
          aria-label={attachments.length > 0 ? 'Send photos' : 'Send message'}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>

      {!hasCloudinaryConfig && (
        <p className="px-4 pb-2 text-[10px] text-amber-600 dark:text-amber-400">
          Photo and voice uploads are not configured yet, so only text can be sent.
        </p>
      )}
    </div>
  );
};
