"use client";

import { useEffect, useState } from "react";
import { useTournamentStore } from "@/store/tournamentStore";

/**
 * Unconditional client-mount hydration guard.
 * Always flips to `true` after first browser paint so UI never hangs on
 * "Loading..." when localStorage is empty or Zustand persist callbacks are skipped.
 */
export function useHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);
  const setStoreHydrated = useTournamentStore((state) => state.setHasHydrated);

  useEffect(() => {
    // Hard guarantee: never block the first client paint indefinitely
    setHydrated(true);
    setStoreHydrated(true);

    // Best-effort: still listen for Zustand persist finish (no-op if already done)
    if (useTournamentStore.persist.hasHydrated()) {
      return;
    }

    return useTournamentStore.persist.onFinishHydration(() => {
      setStoreHydrated(true);
    });
  }, [setStoreHydrated]);

  return hydrated;
}
