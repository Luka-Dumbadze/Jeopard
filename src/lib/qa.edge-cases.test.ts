import { beforeEach, describe, expect, it } from "vitest";
import {
  getAllTileKeys,
  getTotalQuestionCount,
  getWinningTeams,
  isBoardComplete,
} from "@/lib/board";
import {
  GameDataValidationError,
  parseGameFile,
  validateGameData,
} from "@/lib/validateGameData";
import { mergeTournamentPersistedState } from "@/lib/tournamentPersist";
import { useTournamentStore } from "@/store/tournamentStore";
import type { GameData, Team } from "@/types/game";
import {
  createDefaultTeams,
  createEmptyRooms,
  getRoomTeamsOrEmpty,
} from "@/types/tournament";

const fiveByFive: GameData = {
  title: "Full Board",
  categories: Array.from({ length: 5 }, (_, c) => ({
    name: `Cat ${c + 1}`,
    questions: Array.from({ length: 5 }, (_, q) => ({
      value: (q + 1) * 100,
      question: `Q${c}-${q}`,
      answer: `A${c}-${q}`,
    })),
  })),
};

describe("board boundary conditions", () => {
  it("treats null gameData as incomplete (0/N)", () => {
    expect(isBoardComplete(null, new Set())).toBe(false);
    expect(isBoardComplete(null, new Set(["0-0", "0-1"]))).toBe(false);
  });

  it("treats empty usedTiles as 0/5 incomplete for a 5-question column pack", () => {
    const oneCategoryFive: GameData = {
      title: "Five",
      categories: [
        {
          name: "Only",
          questions: Array.from({ length: 5 }, (_, i) => ({
            value: (i + 1) * 100,
            question: `Q${i}`,
            answer: `A${i}`,
          })),
        },
      ],
    };

    expect(getTotalQuestionCount(oneCategoryFive)).toBe(5);
    expect(isBoardComplete(oneCategoryFive, new Set())).toBe(false);
  });

  it("detects 5/5 full capacity completion", () => {
    const keys = getAllTileKeys(fiveByFive);
    expect(keys).toHaveLength(25);
    expect(isBoardComplete(fiveByFive, new Set(keys))).toBe(true);
    expect(
      isBoardComplete(fiveByFive, new Set(keys.slice(0, 24)))
    ).toBe(false);
  });

  it("handles empty winners list and zero scores", () => {
    expect(getWinningTeams([])).toEqual([]);
    const tiedZero: Team[] = [
      { id: "1", name: "A", score: 0 },
      { id: "2", name: "B", score: 0 },
    ];
    expect(getWinningTeams(tiedZero)).toHaveLength(2);
  });
});

describe("malformed JSON / CSV payloads", () => {
  it("rejects null, arrays, and primitives", () => {
    expect(() => validateGameData(null)).toThrow(GameDataValidationError);
    expect(() => validateGameData([])).toThrow(GameDataValidationError);
    expect(() => validateGameData("csv,data")).toThrow(GameDataValidationError);
    expect(() => validateGameData(42)).toThrow(GameDataValidationError);
  });

  it("rejects empty object and empty categories", () => {
    expect(() => validateGameData({})).toThrow(GameDataValidationError);
    expect(() =>
      validateGameData({ title: "X", categories: [] })
    ).toThrow(GameDataValidationError);
  });

  it("rejects category with empty questions and bad question fields", () => {
    expect(() =>
      validateGameData({
        title: "X",
        categories: [{ name: "C", questions: [] }],
      })
    ).toThrow(GameDataValidationError);

    expect(() =>
      validateGameData({
        title: "X",
        categories: [
          {
            name: "C",
            questions: [{ value: "100", question: "Q", answer: "A" }],
          },
        ],
      })
    ).toThrow(GameDataValidationError);

    expect(() =>
      validateGameData({
        title: "X",
        categories: [
          {
            name: "C",
            questions: [{ value: 100, question: "  ", answer: "A" }],
          },
        ],
      })
    ).toThrow(GameDataValidationError);
  });

  it("parseGameFile rejects invalid JSON text and CSV-like content", async () => {
    const badJson = new File(["{not json"], "bad.json", {
      type: "application/json",
    });
    await expect(parseGameFile(badJson)).rejects.toThrow(
      GameDataValidationError
    );

    const csv = new File(["name,score\nA,1\n"], "teams.csv", {
      type: "text/csv",
    });
    await expect(parseGameFile(csv)).rejects.toThrow(GameDataValidationError);
  });

  it("parseGameFile accepts a valid JSON pack", async () => {
    const file = new File(
      [
        JSON.stringify({
          title: "OK",
          categories: [
            {
              name: "C",
              questions: [{ value: 100, question: "Q?", answer: "A" }],
            },
          ],
        }),
      ],
      "ok.json",
      { type: "application/json" }
    );
    const data = await parseGameFile(file);
    expect(data.title).toBe("OK");
  });
});

describe("localStorage hydration merge", () => {
  const teams = createDefaultTeams();
  const current = {
    gameData: null as GameData | null,
    teams,
    rooms: createEmptyRooms(teams),
    isTournamentActive: false,
    sessionId: "session-current",
    hasHydrated: false,
  };

  it("handles null / undefined persisted state without crashing", () => {
    expect(mergeTournamentPersistedState(null, current).teams).toHaveLength(8);
    expect(
      mergeTournamentPersistedState(undefined, current).isTournamentActive
    ).toBe(false);
  });

  it("restores usedTiles Set from persisted arrays and clears ephemeral modal flags", () => {
    const merged = mergeTournamentPersistedState(
      {
        gameData: fiveByFive,
        teams,
        isTournamentActive: true,
        sessionId: "session-restored",
        rooms: {
          "ROOM-1": {
            ...current.rooms["ROOM-1"],
            usedTiles: ["0-0", "0-1"],
            activeQuestion: {
              categoryIndex: 0,
              questionIndex: 0,
              question: fiveByFive.categories[0].questions[0],
            },
            isAnswerRevealed: true,
            isWinnerModalOpen: true,
          },
          "ROOM-2": {
            ...current.rooms["ROOM-2"],
            usedTiles: [],
          },
          "ROOM-3": {
            ...current.rooms["ROOM-3"],
            usedTiles: [],
          },
          "ROOM-4": {
            ...current.rooms["ROOM-4"],
            usedTiles: [],
          },
        },
      },
      current
    );

    expect(merged.gameData?.title).toBe("Full Board");
    expect(merged.isTournamentActive).toBe(true);
    expect(merged.sessionId).toBe("session-restored");
    expect(merged.rooms["ROOM-1"].usedTiles).toBeInstanceOf(Set);
    expect(merged.rooms["ROOM-1"].usedTiles.has("0-0")).toBe(true);
    expect(merged.rooms["ROOM-1"].activeQuestion).toBeNull();
    expect(merged.rooms["ROOM-1"].isAnswerRevealed).toBe(false);
    expect(merged.rooms["ROOM-1"].isWinnerModalOpen).toBe(false);
    expect(merged.hasHydrated).toBe(false);
  });
});

describe("tournament store concurrency & isolation", () => {
  beforeEach(() => {
    useTournamentStore.getState().resetTournament();
  });

  it("createTournament is a no-op without gameData (idempotent guard)", () => {
    useTournamentStore.getState().createTournament();
    expect(useTournamentStore.getState().isTournamentActive).toBe(false);
  });

  it("createTournament activates only at full 8-team capacity", () => {
    useTournamentStore.getState().setGameData(fiveByFive);
    useTournamentStore.getState().createTournament();
    expect(useTournamentStore.getState().isTournamentActive).toBe(true);
    expect(useTournamentStore.getState().teams).toHaveLength(8);
  });

  it("scoring in ROOM-1 does not affect ROOM-2 opponent scores isolation of teams list updates", () => {
    const store = useTournamentStore.getState();
    store.setGameData(fiveByFive);
    store.createTournament();

    const room1 = useTournamentStore.getState().rooms["ROOM-1"];
    const room2 = useTournamentStore.getState().rooms["ROOM-2"];
    const teamRoom1 = room1.teamIds[0];
    const teamRoom2 = room2.teamIds[0];

    store.incrementScore("ROOM-1", teamRoom1, 500);
    // Cross-room score mutation attempt must be ignored
    store.incrementScore("ROOM-1", teamRoom2, 999);

    const teams = useTournamentStore.getState().teams;
    expect(teams.find((t) => t.id === teamRoom1)?.score).toBe(500);
    expect(teams.find((t) => t.id === teamRoom2)?.score).toBe(0);
  });

  it("usedTiles remain isolated across rooms; closeQuestion is idempotent without active question", () => {
    const store = useTournamentStore.getState();
    store.setGameData(fiveByFive);
    store.createTournament();

    store.openQuestion("ROOM-1", {
      categoryIndex: 0,
      questionIndex: 0,
      question: fiveByFive.categories[0].questions[0],
    });
    store.closeQuestion("ROOM-1");
    store.closeQuestion("ROOM-1"); // idempotent second close

    expect(
      useTournamentStore.getState().rooms["ROOM-1"].usedTiles.has("0-0")
    ).toBe(true);
    expect(
      useTournamentStore.getState().rooms["ROOM-2"].usedTiles.has("0-0")
    ).toBe(false);
    expect(
      useTournamentStore.getState().rooms["ROOM-1"].activeQuestion
    ).toBeNull();
  });

  it("awardTileValue is idempotent-safe when no active question", () => {
    const store = useTournamentStore.getState();
    store.setGameData(fiveByFive);
    store.createTournament();
    const teamId = useTournamentStore.getState().rooms["ROOM-1"].teamIds[0];
    const before = useTournamentStore
      .getState()
      .teams.find((t) => t.id === teamId)?.score;

    store.awardTileValue("ROOM-1", teamId);
    expect(
      useTournamentStore.getState().teams.find((t) => t.id === teamId)?.score
    ).toBe(before);
  });

  it("getRoomTeamsOrEmpty returns [] for broken assignments", () => {
    const teams = createDefaultTeams();
    const rooms = createEmptyRooms(teams);
    rooms["ROOM-1"].teamIds = ["missing-a", "missing-b"];
    expect(getRoomTeamsOrEmpty(rooms["ROOM-1"], teams)).toEqual([]);
  });
});
