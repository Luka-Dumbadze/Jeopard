"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  useJeopardyBuzzer,
  type UseJeopardyBuzzerResult,
} from "@/hooks/useJeopardyBuzzer";
import { useGameStore } from "@/store/gameStore";

const HostBuzzerContext = createContext<UseJeopardyBuzzerResult | null>(null);

export function HostBuzzerProvider({ children }: { children: ReactNode }) {
  const roomCode = useGameStore((state) => state.roomCode);
  const teams = useGameStore((state) => state.teams);
  const gameTitle = useGameStore((state) => state.gameData?.title ?? null);

  const buzzer = useJeopardyBuzzer({
    role: "host",
    roomCode,
    teams,
    gameTitle,
    enabled: Boolean(roomCode),
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
