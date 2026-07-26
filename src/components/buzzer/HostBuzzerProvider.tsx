"use client";

import { createContext, useCallback, useContext, type ReactNode } from "react";
import {
  useJeopardyBuzzer,
  type HostRoomSnapshot,
  type UseJeopardyBuzzerResult,
} from "@/hooks/useJeopardyBuzzer";
import { useRoomId } from "@/components/room/RoomProvider";
import { useTournamentStore } from "@/store/tournamentStore";
import { getRoomTeamsOrEmpty } from "@/types/tournament";
import type { QuestionOpenedPayload } from "@/types/buzzer";

const HostBuzzerContext = createContext<UseJeopardyBuzzerResult | null>(null);

export function HostBuzzerProvider({ children }: { children: ReactNode }) {
  const roomId = useRoomId();
  const room = useTournamentStore((state) => state.rooms[roomId]);
  const teams = useTournamentStore((state) => state.teams);
  const sessionId = useTournamentStore((state) => state.sessionId);
  const tournamentId = useTournamentStore((state) => state.tournamentId);
  const gameTitle = useTournamentStore(
    (state) => state.gameData?.title ?? null
  );
  const gameData = useTournamentStore((state) => state.gameData);

  const roomTeams = getRoomTeamsOrEmpty(room, teams);

  const getHostSnapshot = useCallback((): HostRoomSnapshot => {
    const latest = useTournamentStore.getState();
    const latestRoom = latest.rooms[roomId];
    const latestTeams = getRoomTeamsOrEmpty(latestRoom, latest.teams);

    let activeQuestion: QuestionOpenedPayload | null = null;
    if (latestRoom.activeQuestion && latest.gameData) {
      const aq = latestRoom.activeQuestion;
      activeQuestion = {
        categoryIndex: aq.categoryIndex,
        questionIndex: aq.questionIndex,
        categoryName:
          latest.gameData.categories[aq.categoryIndex]?.name ?? "Category",
        value: aq.question.value,
        question: aq.question.question,
      };
    }

    // Buzz open state: question is open and answer not yet closed
    const buzzersOpen = Boolean(latestRoom.activeQuestion);

    return {
      sessionId: latest.sessionId,
      teams: latestTeams,
      gameTitle: latest.gameData?.title ?? null,
      activeQuestion,
      buzzersOpen,
      // Host buzz lock lives in the hook; snapshot uses active question only.
      // Concurrent buzz winner is re-broadcast via BUZZERS_LOCKED separately.
      buzzedPlayer: null,
    };
  }, [roomId]);

  const buzzer = useJeopardyBuzzer({
    role: "host",
    roomCode: roomId,
    tournamentId,
    teams: roomTeams,
    gameTitle,
    sessionId,
    enabled: Boolean(roomId) && Boolean(gameData),
    getHostSnapshot,
  });

  return (
    <HostBuzzerContext.Provider value={buzzer}>
      {children}
    </HostBuzzerContext.Provider>
  );
}

export function useHostBuzzer(): UseJeopardyBuzzerResult {
  const ctx = useContext(HostBuzzerContext);
  if (!ctx) {
    throw new Error("useHostBuzzer must be used within HostBuzzerProvider");
  }
  return ctx;
}
