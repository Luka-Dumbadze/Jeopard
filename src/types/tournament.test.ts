import { describe, expect, it } from "vitest";
import {
  createDefaultTeams,
  createEmptyRooms,
  getRoomTeams,
  isRoomId,
  ROOM_IDS,
} from "@/types/tournament";
import {
  isTournamentRoomCode,
  normalizeRoomCode,
} from "@/types/buzzer";
import { getRoomChannelName } from "@/lib/supabase/client";

describe("tournament rooms", () => {
  it("defines exactly 4 room ids", () => {
    expect(ROOM_IDS).toEqual(["ROOM-1", "ROOM-2", "ROOM-3", "ROOM-4"]);
    expect(isRoomId("ROOM-1")).toBe(true);
    expect(isRoomId("ROOM-5")).toBe(false);
  });

  it("pairs 8 teams into 4 isolated 1v1 rooms", () => {
    const teams = createDefaultTeams();
    expect(teams).toHaveLength(8);

    const rooms = createEmptyRooms(teams);

    expect(rooms["ROOM-1"].teamIds).toEqual([teams[0].id, teams[1].id]);
    expect(rooms["ROOM-2"].teamIds).toEqual([teams[2].id, teams[3].id]);
    expect(rooms["ROOM-3"].teamIds).toEqual([teams[4].id, teams[5].id]);
    expect(rooms["ROOM-4"].teamIds).toEqual([teams[6].id, teams[7].id]);

    const [a, b] = getRoomTeams(rooms["ROOM-1"], teams);
    expect(a.name).toBe(teams[0].name);
    expect(b.name).toBe(teams[1].name);
  });

  it("gives each room isolated usedTiles sets", () => {
    const teams = createDefaultTeams();
    const rooms = createEmptyRooms(teams);
    rooms["ROOM-1"].usedTiles.add("0-0");
    expect(rooms["ROOM-2"].usedTiles.has("0-0")).toBe(false);
  });
});

describe("room codes", () => {
  it("normalizes tournament room codes", () => {
    expect(normalizeRoomCode("room-1")).toBe("ROOM-1");
    expect(normalizeRoomCode("2")).toBe("ROOM-2");
    expect(normalizeRoomCode("ROOM-3")).toBe("ROOM-3");
    expect(isTournamentRoomCode("ROOM-4")).toBe(true);
  });

  it("builds stable realtime channel names per room via getRoomChannelName", () => {
    expect(getRoomChannelName("ROOM-1")).toBe("jeopardy-room-ROOM-1");
    expect(getRoomChannelName("room-2")).toBe("jeopardy-room-ROOM-2");
    expect(getRoomChannelName("ROOM-1", "TOURNAMENT-2026-AB12")).toBe(
      "jeopardy-TOURNAMENT-2026-AB12-ROOM-1"
    );
  });
});
