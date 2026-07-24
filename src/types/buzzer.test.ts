import { describe, expect, it } from "vitest";
import {
  generateRoomCode,
  normalizeRoomCode,
} from "@/types/buzzer";
import { getBuzzerChannelName } from "@/lib/supabase/client";

describe("room codes", () => {
  it("generates ROOM-XXXX format", () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^ROOM-\d{4}$/);
  });

  it("normalizes room codes from URL input", () => {
    expect(normalizeRoomCode("4821")).toBe("ROOM-4821");
    expect(normalizeRoomCode("room-4821")).toBe("ROOM-4821");
    expect(normalizeRoomCode(" ROOM-9999 ")).toBe("ROOM-9999");
  });

  it("builds stable realtime channel names", () => {
    expect(getBuzzerChannelName("ROOM-4821")).toBe("jeopardy-room-ROOM-4821");
    expect(getBuzzerChannelName("room-4821")).toBe("jeopardy-room-ROOM-4821");
  });
});
