import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { isBoardComplete } from "@/lib/board";
import { mergeTournamentPersistedState } from "@/lib/tournamentPersist";
import { saveTournamentSession } from "@/lib/supabase/tournaments";
import {
  generateTournamentId,
  toCloudRooms,
  type CloudTournamentSession,
} from "@/types/cloudTournament";
import type { ActiveQuestion, GameData, TileKey } from "@/types/game";
import {
  ROOM_IDS,
  createDefaultTeams,
  createEmptyRooms,
  type RoomId,
  type RoomState,
  type TournamentTeam,
} from "@/types/tournament";

function createSessionId(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** SSR-safe storage: never touch localStorage during server render. */
function createSafeStorage() {
  return createJSONStorage(() => {
    if (typeof window === "undefined") {
      return {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      };
    }
    return window.localStorage;
  });
}

export type CreateTournamentResult = {
  ok: boolean;
  tournamentId?: string;
  error?: string;
  warning?: string;
  offline?: boolean;
};

function roomsFromCloud(
  cloud: CloudTournamentSession["rooms"]
): Record<RoomId, RoomState> {
  const rooms = {} as Record<RoomId, RoomState>;
  for (const id of ROOM_IDS) {
    const config = cloud[id];
    rooms[id] = {
      id: config.id,
      number: config.number,
      labelKa: config.labelKa,
      teamIds: config.teamIds,
      usedTiles: new Set(),
      activeQuestion: null,
      isAnswerRevealed: false,
      isWinnerModalOpen: false,
      celebrationPlayed: false,
    };
  }
  return rooms;
}

interface TournamentState {
  gameData: GameData | null;
  teams: TournamentTeam[];
  rooms: Record<RoomId, RoomState>;
  isTournamentActive: boolean;
  /** Local device session (player cache invalidation) */
  sessionId: string;
  /** Cloud tournament id shared across laptops, e.g. TOURNAMENT-2026-AB12 */
  tournamentId: string | null;
  hasHydrated: boolean;

  setHasHydrated: (value: boolean) => void;
  setGameData: (data: GameData) => void;
  updateTeamName: (teamId: string, name: string) => void;
  updateTeamColor: (
    teamId: string,
    color: string,
    colorLabelKa: string,
    colorEmoji: string
  ) => void;
  createTournament: () => Promise<CreateTournamentResult>;
  hydrateFromCloud: (session: CloudTournamentSession) => void;
  resetTournament: () => void;

  openQuestion: (roomId: RoomId, question: ActiveQuestion) => void;
  revealAnswer: (roomId: RoomId) => void;
  closeQuestion: (roomId: RoomId) => void;
  incrementScore: (roomId: RoomId, teamId: string, amount?: number) => void;
  decrementScore: (roomId: RoomId, teamId: string, amount?: number) => void;
  awardTileValue: (roomId: RoomId, teamId: string) => void;
  deductTileValue: (roomId: RoomId, teamId: string) => void;
  openWinnerModal: (roomId: RoomId) => void;
  closeWinnerModal: (roomId: RoomId) => void;
  resetRoomBoard: (roomId: RoomId) => void;
}

function adjustTeamScore(
  teams: TournamentTeam[],
  teamId: string,
  amount: number
): TournamentTeam[] {
  return teams.map((team) =>
    team.id === teamId ? { ...team, score: team.score + amount } : team
  );
}

function patchRoom(
  rooms: Record<RoomId, RoomState>,
  roomId: RoomId,
  patch: Partial<RoomState>
): Record<RoomId, RoomState> {
  return {
    ...rooms,
    [roomId]: {
      ...rooms[roomId],
      ...patch,
    },
  };
}

function createInitialState(): Pick<
  TournamentState,
  | "gameData"
  | "teams"
  | "rooms"
  | "isTournamentActive"
  | "sessionId"
  | "tournamentId"
> {
  const teams = createDefaultTeams();
  return {
    gameData: null,
    teams,
    rooms: createEmptyRooms(teams),
    isTournamentActive: false,
    sessionId: createSessionId(),
    tournamentId: null,
  };
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      ...createInitialState(),
      hasHydrated: false,

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setGameData: (data) => set({ gameData: data }),

      updateTeamName: (teamId, name) =>
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId ? { ...team, name } : team
          ),
        })),

      updateTeamColor: (teamId, color, colorLabelKa, colorEmoji) =>
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === teamId
              ? { ...team, color, colorLabelKa, colorEmoji }
              : team
          ),
        })),

      createTournament: async () => {
        const { gameData, teams } = get();
        if (!gameData || teams.length !== 8) {
          return {
            ok: false,
            error: "Upload a pack and configure 8 teams first.",
          };
        }

        const resetTeams = teams.map((team) => ({ ...team, score: 0 }));
        const rooms = createEmptyRooms(resetTeams);
        const tournamentId = generateTournamentId();
        const sessionId = createSessionId();

        set({
          teams: resetTeams,
          rooms,
          isTournamentActive: true,
          sessionId,
          tournamentId,
        });

        const cloud = await saveTournamentSession({
          id: tournamentId,
          gameData,
          teams: resetTeams,
          rooms: toCloudRooms(rooms),
        });

        if (!cloud.ok) {
          return {
            ok: true,
            tournamentId,
            offline: cloud.offline,
            warning: cloud.error,
          };
        }

        return { ok: true, tournamentId };
      },

      hydrateFromCloud: (session) => {
        const current = get();
        // Same tournament already active on this device — keep local room progress
        if (
          current.isTournamentActive &&
          current.tournamentId === session.id &&
          current.gameData
        ) {
          return;
        }

        const teams = session.teams.map((team) => ({ ...team, score: 0 }));
        set({
          gameData: session.gameData,
          teams,
          rooms: roomsFromCloud(session.rooms),
          isTournamentActive: true,
          tournamentId: session.id,
          sessionId: createSessionId(),
        });
      },

      resetTournament: () => set({ ...createInitialState(), hasHydrated: true }),

      openQuestion: (roomId, question) =>
        set((state) => ({
          rooms: patchRoom(state.rooms, roomId, {
            activeQuestion: question,
            isAnswerRevealed: false,
          }),
        })),

      revealAnswer: (roomId) =>
        set((state) => ({
          rooms: patchRoom(state.rooms, roomId, { isAnswerRevealed: true }),
        })),

      closeQuestion: (roomId) => {
        const { rooms, gameData, teams } = get();
        const room = rooms[roomId];
        if (!room?.activeQuestion) {
          set({
            rooms: patchRoom(rooms, roomId, {
              activeQuestion: null,
              isAnswerRevealed: false,
            }),
          });
          return;
        }

        const key =
          `${room.activeQuestion.categoryIndex}-${room.activeQuestion.questionIndex}` as TileKey;
        const usedTiles = new Set(room.usedTiles);
        usedTiles.add(key);

        const boardDone = isBoardComplete(gameData, usedTiles);
        const shouldCelebrate = boardDone && !room.celebrationPlayed;

        set({
          rooms: patchRoom(rooms, roomId, {
            usedTiles,
            activeQuestion: null,
            isAnswerRevealed: false,
            isWinnerModalOpen: shouldCelebrate ? true : room.isWinnerModalOpen,
            celebrationPlayed: shouldCelebrate
              ? true
              : room.celebrationPlayed,
          }),
          teams,
        });
      },

      incrementScore: (roomId, teamId, amount = 100) => {
        const room = get().rooms[roomId];
        if (!room.teamIds.includes(teamId)) return;
        set((state) => ({
          teams: adjustTeamScore(state.teams, teamId, amount),
        }));
      },

      decrementScore: (roomId, teamId, amount = 100) => {
        const room = get().rooms[roomId];
        if (!room.teamIds.includes(teamId)) return;
        set((state) => ({
          teams: adjustTeamScore(state.teams, teamId, -amount),
        }));
      },

      awardTileValue: (roomId, teamId) => {
        const room = get().rooms[roomId];
        if (!room?.activeQuestion || !room.teamIds.includes(teamId)) return;
        const value = room.activeQuestion.question.value;
        set((state) => ({
          teams: adjustTeamScore(state.teams, teamId, value),
        }));
      },

      deductTileValue: (roomId, teamId) => {
        const room = get().rooms[roomId];
        if (!room?.activeQuestion || !room.teamIds.includes(teamId)) return;
        const value = room.activeQuestion.question.value;
        set((state) => ({
          teams: adjustTeamScore(state.teams, teamId, -value),
        }));
      },

      openWinnerModal: (roomId) =>
        set((state) => ({
          rooms: patchRoom(state.rooms, roomId, {
            isWinnerModalOpen: true,
            celebrationPlayed: true,
          }),
        })),

      closeWinnerModal: (roomId) =>
        set((state) => ({
          rooms: patchRoom(state.rooms, roomId, {
            isWinnerModalOpen: false,
          }),
        })),

      resetRoomBoard: (roomId) =>
        set((state) => {
          const room = state.rooms[roomId];
          const resetTeams = state.teams.map((team) =>
            room.teamIds.includes(team.id) ? { ...team, score: 0 } : team
          );
          return {
            teams: resetTeams,
            rooms: patchRoom(state.rooms, roomId, {
              usedTiles: new Set(),
              activeQuestion: null,
              isAnswerRevealed: false,
              isWinnerModalOpen: false,
              celebrationPlayed: false,
            }),
          };
        }),
    }),
    {
      name: "jeopardy-tournament-storage",
      storage: createSafeStorage(),
      partialize: (state) => ({
        gameData: state.gameData,
        teams: state.teams,
        isTournamentActive: state.isTournamentActive,
        sessionId: state.sessionId,
        tournamentId: state.tournamentId,
        rooms: Object.fromEntries(
          ROOM_IDS.map((id) => {
            const room = state.rooms[id];
            return [
              id,
              {
                ...room,
                usedTiles: Array.from(room.usedTiles),
                activeQuestion: null,
                isAnswerRevealed: false,
                isWinnerModalOpen: false,
              },
            ];
          })
        ),
      }),
      merge: (persisted, current) => {
        const data = mergeTournamentPersistedState(persisted, {
          gameData: current.gameData,
          teams: current.teams,
          rooms: current.rooms,
          isTournamentActive: current.isTournamentActive,
          sessionId: current.sessionId,
          tournamentId: current.tournamentId,
          hasHydrated: current.hasHydrated,
        });

        return {
          ...current,
          gameData: data.gameData,
          teams: data.teams,
          rooms: data.rooms,
          isTournamentActive: data.isTournamentActive,
          sessionId: data.sessionId,
          tournamentId: data.tournamentId,
          hasHydrated: data.hasHydrated,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to rehydrate tournament store", error);
          return;
        }
        state?.setHasHydrated?.(true);
      },
    }
  )
);
