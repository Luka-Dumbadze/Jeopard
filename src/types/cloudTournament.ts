import type { GameData } from "@/types/game";
import type { RoomId, RoomState, TournamentTeam } from "@/types/tournament";
import { ROOM_IDS } from "@/types/tournament";

/** Cloud-serializable room config (no live usedTiles / modal state). */
export interface CloudRoomConfig {
  id: RoomId;
  number: number;
  labelKa: string;
  teamIds: [string, string];
}

export interface CloudTournamentSession {
  id: string;
  gameData: GameData;
  teams: TournamentTeam[];
  rooms: Record<RoomId, CloudRoomConfig>;
  createdAt?: string;
}

export function generateTournamentId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `TOURNAMENT-${year}-${suffix}`;
}

export function isTournamentId(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^TOURNAMENT-\d{4}-[A-Z0-9]+$/i.test(value.trim());
}

export function toCloudRooms(
  rooms: Record<RoomId, RoomState>
): Record<RoomId, CloudRoomConfig> {
  const result = {} as Record<RoomId, CloudRoomConfig>;
  for (const id of ROOM_IDS) {
    const room = rooms[id];
    result[id] = {
      id: room.id,
      number: room.number,
      labelKa: room.labelKa,
      teamIds: [...room.teamIds] as [string, string],
    };
  }
  return result;
}

export function buildRoomHref(roomId: RoomId, tournamentId: string): string {
  return `/room/${roomId}?t=${encodeURIComponent(tournamentId)}`;
}

export function buildBuzzHref(roomId: RoomId, tournamentId: string): string {
  return `/buzz?room=${encodeURIComponent(roomId)}&t=${encodeURIComponent(tournamentId)}`;
}
