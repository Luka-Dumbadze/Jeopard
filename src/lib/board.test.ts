import { describe, expect, it } from "vitest";
import {
  getAllTileKeys,
  getTotalQuestionCount,
  getWinningTeams,
  isBoardComplete,
} from "@/lib/board";
import { validateGameData, GameDataValidationError } from "@/lib/validateGameData";
import type { GameData, Team } from "@/types/game";

const sampleGame: GameData = {
  title: "Test Game",
  categories: [
    {
      name: "Cats",
      questions: [
        { value: 100, question: "Q1", answer: "A1" },
        { value: 200, question: "Q2", answer: "A2" },
      ],
    },
    {
      name: "Dogs",
      questions: [{ value: 100, question: "Q3", answer: "A3" }],
    },
  ],
};

describe("board helpers", () => {
  it("counts all questions across categories", () => {
    expect(getTotalQuestionCount(sampleGame)).toBe(3);
    expect(getAllTileKeys(sampleGame)).toEqual(["0-0", "0-1", "1-0"]);
  });

  it("detects incomplete board", () => {
    expect(isBoardComplete(sampleGame, new Set(["0-0"]))).toBe(false);
    expect(isBoardComplete(null, new Set())).toBe(false);
  });

  it("detects complete board when every tile is used", () => {
    expect(isBoardComplete(sampleGame, new Set(["0-0", "0-1", "1-0"]))).toBe(
      true
    );
  });

  it("returns top-scoring team(s), including ties", () => {
    const teams: Team[] = [
      { id: "a", name: "Alpha", score: 500 },
      { id: "b", name: "Beta", score: 300 },
      { id: "c", name: "Gamma", score: 500 },
    ];

    const winners = getWinningTeams(teams);
    expect(winners).toHaveLength(2);
    expect(winners.map((t) => t.name).sort()).toEqual(["Alpha", "Gamma"]);
  });
});

describe("validateGameData", () => {
  it("accepts a valid payload", () => {
    const result = validateGameData(sampleGame);
    expect(result.title).toBe("Test Game");
    expect(result.categories).toHaveLength(2);
  });

  it("rejects invalid payloads", () => {
    expect(() => validateGameData({})).toThrow(GameDataValidationError);
    expect(() => validateGameData({ title: "", categories: [] })).toThrow(
      GameDataValidationError
    );
  });
});
