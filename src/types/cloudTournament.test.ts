import { describe, expect, it } from "vitest";
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
});
