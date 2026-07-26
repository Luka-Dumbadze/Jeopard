"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { RoomId } from "@/types/tournament";

const RoomIdContext = createContext<RoomId | null>(null);

export function RoomProvider({
  roomId,
  children,
}: {
  roomId: RoomId;
  children: ReactNode;
}) {
  return (
    <RoomIdContext.Provider value={roomId}>{children}</RoomIdContext.Provider>
  );
}

export function useRoomId(): RoomId {
  const roomId = useContext(RoomIdContext);
  if (!roomId) {
    throw new Error("useRoomId must be used within RoomProvider");
  }
  return roomId;
}
