import React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useRouter } from '../../router/RouterProvider';

/**
 * Cross-page transition.
 *
 * Uses `mode="wait"` with a very short exit so the incoming page never lands
 * alongside the outgoing one (which would cause a scroll jump between pages of
 * very different heights). The wrapper keeps a `min-h` so the footer never
 * jumps up during the swap, and the app-level background shows through — the
 * JID background stays put, so there is no white flash on navigation.
 */
export const PageTransition: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { view } = useRouter();
  const reduceMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={view}
        initial={reduceMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? { opacity: 1 } : { opacity: 0, y: -6 }}
        transition={
          reduceMotion
            ? { duration: 0.1 }
            : { opacity: { duration: 0.18 }, y: { duration: 0.28, ease: [0.21, 1, 0.36, 1] } }
        }
        className="min-h-[70vh] flex flex-col"
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};
