import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  normalizeRoomCode,
} from "@/types/buzzer";
import { getBuzzerChannelName } from "@/lib/supabase/client";

describe("legacy room codes", () => {
  it("generates ROOM-XXXX format", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^ROOM-\d{4}$/);
  });

  it("normalizes 4-digit legacy codes", () => {
    expect(normalizeRoomCode("4821")).toBe("ROOM-4821");
    expect(normalizeRoomCode("room-4821")).toBe("ROOM-4821");
  });

  it("builds channel names for legacy codes", () => {
    expect(getBuzzerChannelName("ROOM-4821")).toBe("jeopardy-room-ROOM-4821");
  });
});
