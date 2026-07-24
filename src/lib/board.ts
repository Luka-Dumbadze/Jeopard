import type { GameData, Team, TileKey } from "@/types/game";
import { getTileKey } from "@/types/game";

/** Every real question cell on the board (excludes padding empties). */
export function getAllTileKeys(gameData: GameData): TileKey[] {
  const keys: TileKey[] = [];

  gameData.categories.forEach((category, categoryIndex) => {
    category.questions.forEach((_, questionIndex) => {
      keys.push(getTileKey(categoryIndex, questionIndex));
    });
  });

  return keys;
}

export function getTotalQuestionCount(gameData: GameData): number {
  return gameData.categories.reduce(
    (total, category) => total + category.questions.length,
    0
  );
}

export function isBoardComplete(
  gameData: GameData | null,
  usedTiles: Set<TileKey>
): boolean {
  if (!gameData) return false;

  const keys = getAllTileKeys(gameData);
  if (keys.length === 0) return false;

  return keys.every((key) => usedTiles.has(key));
}

/** Highest-scoring team(s). Ties return multiple winners. */
export function getWinningTeams(teams: Team[]): Team[] {
  if (teams.length === 0) return [];

  const topScore = Math.max(...teams.map((team) => team.score));
  return teams.filter((team) => team.score === topScore);
}
