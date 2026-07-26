import { describe, expect, it } from "vitest";
import { getAssignedRoomTeams } from "@/lib/supabase/tournaments";
import {
  buildBuzzHref,
  buildRoomHref,
  generateTournamentId,
  isTournamentId,
  toCloudRooms,
} from "@/types/cloudTournament";
import { createDefaultTeams, createEmptyRooms } from "@/types/tournament";

describe("cloud tournament helpers", () => {
  it("generates TOURNAMENT-YEAR-XXXX ids", () => {
    const id = generateTournamentId();
    expect(isTournamentId(id)).toBe(true);
    expect(id).toMatch(/^TOURNAMENT-\d{4}-[A-Z0-9]{4}$/);
  });

  it("builds room and buzz hrefs with tournament query", () => {
    expect(buildRoomHref("ROOM-2", "TOURNAMENT-2026-AB12")).toBe(
      "/room/ROOM-2?t=TOURNAMENT-2026-AB12"
    );
    expect(buildBuzzHref("ROOM-3", "TOURNAMENT-2026-AB12")).toBe(
      "/buzz?room=ROOM-3&t=TOURNAMENT-2026-AB12"
    );
  });

  it("serializes rooms without live usedTiles / modal state", () => {
    const teams = createDefaultTeams();
    const rooms = createEmptyRooms(teams);
    rooms["ROOM-1"].usedTiles.add("0-0");
    rooms["ROOM-1"].activeQuestion = {
      categoryIndex: 0,
      questionIndex: 0,
      question: { value: 100, question: "Q?", answer: "A" },
    };

    const cloud = toCloudRooms(rooms);
    expect(cloud["ROOM-1"]).toEqual({
      id: "ROOM-1",
      number: 1,
      labelKa: rooms["ROOM-1"].labelKa,
      teamIds: rooms["ROOM-1"].teamIds,
    });
    expect(cloud["ROOM-1"]).not.toHaveProperty("usedTiles");
    expect(cloud["ROOM-1"]).not.toHaveProperty("activeQuestion");
  });

  it("extracts exactly 2 assigned teams for a room from cloud session", () => {
    const teams = createDefaultTeams();
    const rooms = createEmptyRooms(teams);
    const session = {
      id: "TOURNAMENT-2026-TEST",
      gameData: { title: "T", categories: [] },
      teams,
      rooms: toCloudRooms(rooms),
    };

    const room1 = getAssignedRoomTeams(session, "ROOM-1");
    expect(room1).toHaveLength(2);
    expect(room1[0].id).toBe(teams[0].id);
    expect(room1[1].id).toBe(teams[1].id);

    const room4 = getAssignedRoomTeams(session, "ROOM-4");
    expect(room4.map((t) => t.id)).toEqual([teams[6].id, teams[7].id]);
    expect(getAssignedRoomTeams(session, "ROOM-9")).toEqual([]);
  });
});
