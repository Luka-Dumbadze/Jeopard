import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isBoardComplete } from "@/lib/board";
import { mergeTournamentPersistedState } from "@/lib/tournamentPersist";
import type { ActiveQuestion, GameData, TileKey } from "@/types/game";
import {
  ROOM_IDS,
  createDefaultTeams,
  createEmptyRooms,
  type RoomId,
  type RoomState,
  type TournamentTeam,
} from "@/types/tournament";

interface TournamentState {
  gameData: GameData | null;
  teams: TournamentTeam[];
  rooms: Record<RoomId, RoomState>;
  isTournamentActive: boolean;
  /** Unique id per tournament instance — used to invalidate stale player caches */
  sessionId: string;
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
  createTournament: () => void;
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
  "gameData" | "teams" | "rooms" | "isTournamentActive" | "sessionId"
> {
  const teams = createDefaultTeams();
  return {
    gameData: null,
    teams,
    rooms: createEmptyRooms(teams),
    isTournamentActive: false,
    sessionId: crypto.randomUUID(),
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

      createTournament: () => {
        const { gameData, teams } = get();
        if (!gameData || teams.length !== 8) return;

        const resetTeams = teams.map((team) => ({ ...team, score: 0 }));
        set({
          teams: resetTeams,
          rooms: createEmptyRooms(resetTeams),
          isTournamentActive: true,
          sessionId: crypto.randomUUID(),
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
      partialize: (state) => ({
        gameData: state.gameData,
        teams: state.teams,
        isTournamentActive: state.isTournamentActive,
        sessionId: state.sessionId,
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
      merge: (persisted, current) =>
        mergeTournamentPersistedState(persisted, {
          gameData: current.gameData,
          teams: current.teams,
          rooms: current.rooms,
          isTournamentActive: current.isTournamentActive,
          sessionId: current.sessionId,
          hasHydrated: current.hasHydrated,
        }) as typeof current,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to rehydrate tournament store", error);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
