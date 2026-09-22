import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, X, Sparkles, ArrowRight } from 'lucide-react';

interface ToastProps {
  isVisible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  passNumber?: number;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  isVisible,
  onClose,
  title,
  message,
  passNumber,
  duration = 7000,
}) => {
  useEffect(() => {
    if (!isVisible) return;
    const timer = setTimeout(() => {
      onClose();
    }, duration);
    return () => clearTimeout(timer);
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <div className="fixed bottom-6 right-6 sm:bottom-8 sm:right-8 z-50 max-w-md w-[calc(100vw-3rem)] pointer-events-auto">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="bg-zinc-950 text-white rounded-2xl border border-zinc-800/90 p-4 sm:p-5 shadow-2xl shadow-zinc-950/40 relative overflow-hidden"
          >
            <div className="flex items-start gap-3.5">
              <div className="w-9 h-9 rounded-full bg-emerald-950/80 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-850">
                <CheckCircle2 className="w-5 h-5" />
              </div>

              <div className="flex-1 pr-2">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-bold text-sm tracking-tight text-white">
                    {title}
                  </h4>
                  {passNumber && (
                    <span className="bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      Pass #{passNumber}
                    </span>
                  )}
                </div>
                <p className="text-xs text-zinc-400 leading-relaxed">
                  {message}
                </p>
              </div>

              <button
                onClick={onClose}
                aria-label="Dismiss notification"
                className="text-zinc-500 hover:text-white transition-colors p-1 -mr-1 -mt-1 cursor-pointer rounded-lg hover:bg-zinc-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Subtle Progress Bar */}
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: '0%' }}
              transition={{ duration: duration / 1000, ease: 'linear' }}
              className="absolute bottom-0 left-0 h-0.5 bg-emerald-500"
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
