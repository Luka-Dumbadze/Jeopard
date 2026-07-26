const STORAGE_KEY = "jeopardy-player-buzzer-v1";

export interface PlayerBuzzerLocalState {
  sessionId: string;
  roomId: string;
  teamId: string;
  teamName: string;
}

export interface PlayerStateResolution {
  state: PlayerBuzzerLocalState | null;
  clearedDueToMismatch: boolean;
}

export function clearPlayerBuzzerState(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

export function savePlayerBuzzerState(state: PlayerBuzzerLocalState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Loads player buzzer assignment. If savedSessionId !== currentActiveSessionId,
 * clears stale team assignment and returns clearedDueToMismatch=true.
 */
export function resolvePlayerBuzzerState(
  roomId: string,
  currentActiveSessionId: string | null
): PlayerStateResolution {
  if (typeof window === "undefined") {
    return { state: null, clearedDueToMismatch: false };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { state: null, clearedDueToMismatch: false };
    }

    const parsed = JSON.parse(raw) as PlayerBuzzerLocalState;
    if (!parsed?.sessionId || !parsed.roomId || !parsed.teamId) {
      clearPlayerBuzzerState();
      return { state: null, clearedDueToMismatch: false };
    }

    if (
      currentActiveSessionId &&
      parsed.sessionId !== currentActiveSessionId
    ) {
      clearPlayerBuzzerState();
      return { state: null, clearedDueToMismatch: true };
    }

    if (parsed.roomId !== roomId) {
      return { state: null, clearedDueToMismatch: false };
    }

    return { state: parsed, clearedDueToMismatch: false };
  } catch {
    clearPlayerBuzzerState();
    return { state: null, clearedDueToMismatch: false };
  }
}
