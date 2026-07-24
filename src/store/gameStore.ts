import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isBoardComplete } from "@/lib/board";
import { generateRoomCode } from "@/types/buzzer";
import type { ActiveQuestion, GameData, Team, TileKey } from "@/types/game";

interface GameState {
  gameData: GameData | null;
  teams: Team[];
  usedTiles: Set<TileKey>;
  activeQuestion: ActiveQuestion | null;
  isAnswerRevealed: boolean;
  hasHydrated: boolean;
  isWinnerModalOpen: boolean;
  celebrationPlayed: boolean;
  roomCode: string;

  setHasHydrated: (value: boolean) => void;
  setGameData: (data: GameData) => void;
  resetGame: () => void;
  regenerateRoomCode: () => void;
  addTeam: () => void;
  removeTeam: (id: string) => void;
  updateTeamName: (id: string, name: string) => void;
  incrementScore: (id: string, amount?: number) => void;
  decrementScore: (id: string, amount?: number) => void;
  awardTileValue: (id: string) => void;
  deductTileValue: (id: string) => void;
  openQuestion: (question: ActiveQuestion) => void;
  revealAnswer: () => void;
  closeQuestion: () => void;
  markTileUsed: (key: TileKey) => void;
  isTileUsed: (key: TileKey) => boolean;
  checkBoardComplete: () => boolean;
  openWinnerModal: () => void;
  closeWinnerModal: () => void;
}

const createTeamId = () => crypto.randomUUID();

const defaultTeams = (): Team[] => [
  { id: createTeamId(), name: "Team 1", score: 0 },
  { id: createTeamId(), name: "Team 2", score: 0 },
];

function adjustScore(teams: Team[], id: string, amount: number): Team[] {
  return teams.map((team) =>
    team.id === id ? { ...team, score: team.score + amount } : team
  );
}

export const useGameStore = create<GameState>()(
  persist(
    (set, get) => ({
      gameData: null,
      teams: defaultTeams(),
      usedTiles: new Set<TileKey>(),
      activeQuestion: null,
      isAnswerRevealed: false,
      hasHydrated: false,
      isWinnerModalOpen: false,
      celebrationPlayed: false,
      roomCode: generateRoomCode(),

      setHasHydrated: (value) => set({ hasHydrated: value }),

      setGameData: (data) =>
        set({
          gameData: data,
          usedTiles: new Set(),
          activeQuestion: null,
          isAnswerRevealed: false,
          isWinnerModalOpen: false,
          celebrationPlayed: false,
          roomCode: generateRoomCode(),
        }),

      resetGame: () =>
        set({
          gameData: null,
          usedTiles: new Set(),
          activeQuestion: null,
          isAnswerRevealed: false,
          isWinnerModalOpen: false,
          celebrationPlayed: false,
          teams: defaultTeams(),
          roomCode: generateRoomCode(),
        }),

      regenerateRoomCode: () => set({ roomCode: generateRoomCode() }),

      addTeam: () =>
        set((state) => ({
          teams: [
            ...state.teams,
            {
              id: createTeamId(),
              name: `Team ${state.teams.length + 1}`,
              score: 0,
            },
          ],
        })),

      removeTeam: (id) =>
        set((state) => ({
          teams: state.teams.filter((team) => team.id !== id),
        })),

      updateTeamName: (id, name) =>
        set((state) => ({
          teams: state.teams.map((team) =>
            team.id === id ? { ...team, name } : team
          ),
        })),

      incrementScore: (id, amount = 100) =>
        set((state) => ({
          teams: adjustScore(state.teams, id, amount),
        })),

      decrementScore: (id, amount = 100) =>
        set((state) => ({
          teams: adjustScore(state.teams, id, -amount),
        })),

      awardTileValue: (id) => {
        const { activeQuestion } = get();
        if (!activeQuestion) return;
        set((state) => ({
          teams: adjustScore(state.teams, id, activeQuestion.question.value),
        }));
      },

      deductTileValue: (id) => {
        const { activeQuestion } = get();
        if (!activeQuestion) return;
        set((state) => ({
          teams: adjustScore(state.teams, id, -activeQuestion.question.value),
        }));
      },

      openQuestion: (question) =>
        set({ activeQuestion: question, isAnswerRevealed: false }),

      revealAnswer: () => set({ isAnswerRevealed: true }),

      closeQuestion: () => {
        const { activeQuestion, celebrationPlayed } = get();

        if (!activeQuestion) {
          set({ activeQuestion: null, isAnswerRevealed: false });
          return;
        }

        const key =
          `${activeQuestion.categoryIndex}-${activeQuestion.questionIndex}` as TileKey;

        set((state) => {
          const usedTiles = new Set(state.usedTiles);
          usedTiles.add(key);

          const boardDone = isBoardComplete(state.gameData, usedTiles);
          const shouldCelebrate = boardDone && !celebrationPlayed;

          return {
            usedTiles,
            activeQuestion: null,
            isAnswerRevealed: false,
            isWinnerModalOpen: shouldCelebrate ? true : state.isWinnerModalOpen,
            celebrationPlayed: shouldCelebrate
              ? true
              : state.celebrationPlayed,
          };
        });
      },

      markTileUsed: (key) =>
        set((state) => {
          const usedTiles = new Set(state.usedTiles);
          usedTiles.add(key);
          return { usedTiles };
        }),

      isTileUsed: (key) => get().usedTiles.has(key),

      checkBoardComplete: () => {
        const { gameData, usedTiles } = get();
        return isBoardComplete(gameData, usedTiles);
      },

      openWinnerModal: () =>
        set({ isWinnerModalOpen: true, celebrationPlayed: true }),

      closeWinnerModal: () => set({ isWinnerModalOpen: false }),
    }),
    {
      name: "jeopardy-game-storage",
      partialize: (state) => ({
        gameData: state.gameData,
        teams: state.teams,
        usedTiles: Array.from(state.usedTiles),
        celebrationPlayed: state.celebrationPlayed,
        roomCode: state.roomCode,
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<GameState> & {
          usedTiles?: TileKey[];
        };
        return {
          ...current,
          ...persistedState,
          usedTiles: new Set(persistedState.usedTiles ?? []),
          roomCode: persistedState.roomCode ?? current.roomCode,
          hasHydrated: current.hasHydrated,
          isWinnerModalOpen: false,
          activeQuestion: null,
          isAnswerRevealed: false,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error("Failed to rehydrate game store", error);
        }
        state?.setHasHydrated(true);
      },
    }
  )
);
