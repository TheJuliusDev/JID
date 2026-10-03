import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight, Download, X } from 'lucide-react';

interface PhotoLightboxProps {
  urls: string[];
  /** Index of the image that was tapped. */
  startIndex: number;
  onClose: () => void;
}

/**
 * Full-screen image viewer.
 *
 * Takes the whole set rather than a single url so a multi-image message can be
 * swiped through without closing and reopening: that is the difference between
 * "viewing photos" and "opening four separate dialogs".
 */
export const PhotoLightbox: React.FC<PhotoLightboxProps> = ({ urls, startIndex, onClose }) => {
  const [index, setIndex] = useState(startIndex);

  const go = useCallback(
    (delta: number) => setIndex((i) => (i + delta + urls.length) % urls.length),
    [urls.length]
  );

  // Arrow keys navigate, Escape closes. Only bound while this is open, and the
  // listener is removed on unmount so the chat's own shortcuts are unaffected.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, onClose]);

  // Lock the page behind the overlay so a scroll gesture does not move the thread.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  if (urls.length === 0) return null;
  const current = urls[Math.min(index, urls.length - 1)];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
        aria-label={`Photo ${index + 1} of ${urls.length}`}
      >
        <motion.img
          key={current}
          src={current}
          alt={`Photo ${index + 1}`}
          initial={{ scale: 0.94, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="max-w-full max-h-[88vh] object-contain select-none"
          draggable={false}
        />

        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="absolute top-4 right-4 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white cursor-pointer transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Save is a plain link, so it works with no JS and respects the browser's
            own download handling rather than routing a blob through the app. */}
        <a
          href={current}
          download
          onClick={(e) => e.stopPropagation()}
          aria-label="Save this photo"
          className="absolute top-4 left-4 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white cursor-pointer transition-colors"
        >
          <Download className="w-5 h-5" />
        </a>

        {urls.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              aria-label="Previous photo"
              className="absolute left-2 sm:left-6 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              aria-label="Next photo"
              className="absolute right-2 sm:right-6 p-2.5 rounded-full bg-black/40 hover:bg-black/70 text-white cursor-pointer transition-colors"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
              <span className="text-xs font-bold text-white/80 bg-black/50 px-3 py-1.5 rounded-full">
                {index + 1} / {urls.length}
              </span>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
