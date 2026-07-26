import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Instant client-side lock to prevent double-taps / spam on critical actions.
 * Sets locked=true synchronously on fire; auto-clears after `ms` (optional).
 */
export function useActionLock(ms = 0): {
  locked: boolean;
  run: (action: () => void | Promise<void>) => void;
  unlock: () => void;
} {
  const [locked, setLocked] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const unlock = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setLocked(false);
  }, []);

  const run = useCallback(
    (action: () => void | Promise<void>) => {
      if (locked) return;
      setLocked(true);

      void Promise.resolve(action()).finally(() => {
        if (ms > 0) {
          timerRef.current = setTimeout(() => {
            timerRef.current = null;
            setLocked(false);
          }, ms);
        }
      });
    },
    [locked, ms]
  );

  return { locked, run, unlock };
}
