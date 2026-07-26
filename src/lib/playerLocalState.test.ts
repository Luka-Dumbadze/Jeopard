import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  clearPlayerBuzzerState,
  resolvePlayerBuzzerState,
  savePlayerBuzzerState,
} from "@/lib/playerLocalState";

const memory = new Map<string, string>();

beforeEach(() => {
  memory.clear();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => {
        memory.set(key, value);
      },
      removeItem: (key: string) => {
        memory.delete(key);
      },
      clear: () => memory.clear(),
    },
  });
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: globalThis,
  });
});

afterEach(() => {
  clearPlayerBuzzerState();
});

describe("player localStorage session invalidation", () => {
  it("clears stale assignment when session ids mismatch", () => {
    savePlayerBuzzerState({
      sessionId: "old-session",
      roomId: "ROOM-1",
      teamId: "t1",
      teamName: "Alpha",
    });

    const result = resolvePlayerBuzzerState("ROOM-1", "new-session");
    expect(result.clearedDueToMismatch).toBe(true);
    expect(result.state).toBeNull();
  });

  it("keeps assignment when session ids match", () => {
    savePlayerBuzzerState({
      sessionId: "live-session",
      roomId: "ROOM-2",
      teamId: "t2",
      teamName: "Beta",
    });

    const result = resolvePlayerBuzzerState("ROOM-2", "live-session");
    expect(result.clearedDueToMismatch).toBe(false);
    expect(result.state?.teamName).toBe("Beta");
  });
});
