import React, { useEffect, useRef } from 'react';

/**
 * Keeps the previous non-null value alive for `ms` after it becomes null.
 *
 * Overlay hosts store "what is open" as nullable state, so the moment a modal
 * closes its content is already gone and there is nothing left to animate out.
 * Lingering the last value lets the shell stay mounted for the length of its
 * exit animation, which is what turns an instant disappear into a smooth
 * reverse — without the host having to duplicate its state.
 */
export function useLinger<T>(value: T | null | undefined, ms = 200): T | null {
  const [held, setHeld] = React.useState<T | null>(value ?? null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (value !== null && value !== undefined) {
      window.clearTimeout(timer.current);
      setHeld(value);
      return;
    }
    timer.current = window.setTimeout(() => setHeld(null), ms);
    return () => window.clearTimeout(timer.current);
  }, [value, ms]);

  return held;
}
