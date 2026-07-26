"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useSearchParams } from "next/navigation";
import {
  useJeopardyBuzzer,
  type HostRoomSnapshot,
  type UseJeopardyBuzzerResult,
} from "@/hooks/useJeopardyBuzzer";
import { useRoomBuzzerDb } from "@/hooks/useRoomBuzzerDb";
import { useRoomId } from "@/components/room/RoomProvider";
import { useTournamentStore } from "@/store/tournamentStore";
import { isTournamentId } from "@/types/cloudTournament";
import { getRoomTeamsOrEmpty } from "@/types/tournament";
import type { QuestionOpenedPayload } from "@/types/buzzer";

const HostBuzzerContext = createContext<UseJeopardyBuzzerResult | null>(null);

export function HostBuzzerProvider({ children }: { children: ReactNode }) {
  const roomId = useRoomId();
  const searchParams = useSearchParams();
  const tournamentParam = searchParams.get("t");

  const room = useTournamentStore((state) => state.rooms[roomId]);
  const teams = useTournamentStore((state) => state.teams);
  const localSessionId = useTournamentStore((state) => state.sessionId);
  const storeTournamentId = useTournamentStore((state) => state.tournamentId);
  const gameTitle = useTournamentStore(
    (state) => state.gameData?.title ?? null
  );
  const gameData = useTournamentStore((state) => state.gameData);

  const tournamentId = useMemo(() => {
    if (storeTournamentId && isTournamentId(storeTournamentId)) {
      return storeTournamentId;
    }
    if (isTournamentId(tournamentParam)) {
      return tournamentParam!.trim();
    }
    return storeTournamentId;
  }, [storeTournamentId, tournamentParam]);

  const buzzerSessionId = tournamentId ?? localSessionId;
  const roomTeams = getRoomTeamsOrEmpty(room, teams);

  const { state: dbBuzzer } = useRoomBuzzerDb({
    tournamentId,
    roomId,
    enabled: Boolean(tournamentId) && Boolean(gameData),
  });

  const getHostSnapshot = useCallback((): HostRoomSnapshot => {
    const latest = useTournamentStore.getState();
    const latestRoom = latest.rooms[roomId];
    const latestTeams = getRoomTeamsOrEmpty(latestRoom, latest.teams);
    const latestTournamentId =
      latest.tournamentId && isTournamentId(latest.tournamentId)
        ? latest.tournamentId
        : isTournamentId(tournamentParam)
          ? tournamentParam!.trim()
          : latest.tournamentId;

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

    const buzzersOpen = Boolean(latestRoom.activeQuestion);

    return {
      sessionId: latestTournamentId ?? latest.sessionId,
      teams: latestTeams,
      gameTitle: latest.gameData?.title ?? null,
      activeQuestion,
      buzzersOpen,
      buzzedPlayer: null,
    };
  }, [roomId, tournamentParam]);

  const buzzer = useJeopardyBuzzer({
    role: "host",
    roomCode: roomId,
    tournamentId,
    teams: roomTeams,
    gameTitle,
    sessionId: buzzerSessionId,
    enabled: Boolean(roomId) && Boolean(gameData),
    getHostSnapshot,
  });

  const merged = useMemo((): UseJeopardyBuzzerResult => {
    const dbBuzzed =
      dbBuzzer?.buzzedTeamId && dbBuzzer.buzzedTeamName
        ? {
            teamId: dbBuzzer.buzzedTeamId,
            teamName: dbBuzzer.buzzedTeamName,
            timestamp: Date.now(),
          }
        : null;

    return {
      ...buzzer,
      buzzedPlayer: buzzer.buzzedPlayer ?? dbBuzzed,
      buzzersOpen: buzzer.buzzersOpen || Boolean(dbBuzzer?.buzzersOpen),
    };
  }, [buzzer, dbBuzzer]);

  return (
    <HostBuzzerContext.Provider value={merged}>
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
