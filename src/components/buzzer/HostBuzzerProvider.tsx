"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useJeopardyBuzzer,
  type UseJeopardyBuzzerResult,
} from "@/hooks/useJeopardyBuzzer";
import { useRoomId } from "@/components/room/RoomProvider";
import { useTournamentStore } from "@/store/tournamentStore";
import { getRoomTeamsOrEmpty } from "@/types/tournament";

const HostBuzzerContext = createContext<UseJeopardyBuzzerResult | null>(null);

export function HostBuzzerProvider({ children }: { children: ReactNode }) {
  const roomId = useRoomId();
  const room = useTournamentStore((state) => state.rooms[roomId]);
  const teams = useTournamentStore((state) => state.teams);
  const gameTitle = useTournamentStore(
    (state) => state.gameData?.title ?? null
  );

  const roomTeams = getRoomTeamsOrEmpty(room, teams);

  const buzzer = useJeopardyBuzzer({
    role: "host",
    roomCode: roomId,
    teams: roomTeams,
    gameTitle,
    enabled: Boolean(roomId),
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
