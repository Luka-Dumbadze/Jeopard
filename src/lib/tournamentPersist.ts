import {
  ROOM_IDS,
  createEmptyRooms,
  type RoomId,
  type RoomState,
  type TournamentTeam,
} from "@/types/tournament";
import type { GameData, TileKey } from "@/types/game";

export type PersistedRoom = Omit<RoomState, "usedTiles"> & {
  usedTiles: TileKey[];
};

export interface TournamentPersistedSlice {
  gameData?: GameData | null;
  teams?: TournamentTeam[];
  isTournamentActive?: boolean;
  sessionId?: string;
  tournamentId?: string | null;
  rooms?: Record<RoomId, PersistedRoom>;
}

export interface TournamentMergeCurrent {
  gameData: GameData | null;
  teams: TournamentTeam[];
  rooms: Record<RoomId, RoomState>;
  isTournamentActive: boolean;
  sessionId: string;
  tournamentId: string | null;
  hasHydrated: boolean;
}

/**
 * Rehydrates persisted tournament state safely when localStorage is
 * null/undefined/partial (Zustand persist merge).
 */
export function mergeTournamentPersistedState(
  persisted: unknown,
  current: TournamentMergeCurrent
): TournamentMergeCurrent {
  if (persisted == null || typeof persisted !== "object") {
    return {
      ...current,
      hasHydrated: current.hasHydrated,
    };
  }

  const data = persisted as TournamentPersistedSlice;
  const teams = data.teams ?? current.teams;

  const baseRooms = data.rooms
    ? (Object.fromEntries(
        ROOM_IDS.map((id) => {
          const persistedRoom = data.rooms?.[id];
          const fallback = current.rooms[id];
          return [
            id,
            {
              ...(persistedRoom ?? fallback),
              usedTiles: new Set<TileKey>(persistedRoom?.usedTiles ?? []),
              activeQuestion: null,
              isAnswerRevealed: false,
              isWinnerModalOpen: false,
            } as RoomState,
          ];
        })
      ) as Record<RoomId, RoomState>)
    : createEmptyRooms(teams);

  return {
    ...current,
    gameData: data.gameData !== undefined ? data.gameData : current.gameData,
    teams,
    rooms: baseRooms,
    isTournamentActive:
      data.isTournamentActive !== undefined
        ? data.isTournamentActive
        : current.isTournamentActive,
    sessionId: data.sessionId ?? current.sessionId,
    tournamentId:
      data.tournamentId !== undefined ? data.tournamentId : current.tournamentId,
    hasHydrated: current.hasHydrated,
  };
}
