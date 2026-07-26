import type { Team } from "@/types/game";
import type { RoomId } from "@/types/tournament";

/** Accepts tournament rooms ROOM-1..ROOM-4 and legacy ROOM-XXXX codes. */
export function generateRoomCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `ROOM-${digits}`;
}

export function normalizeRoomCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");

  if (/^ROOM-[1-4]$/.test(cleaned)) {
    return cleaned;
  }
  if (/^[1-4]$/.test(cleaned)) {
    return `ROOM-${cleaned}`;
  }
  if (/^\d{4}$/.test(cleaned)) {
    return `ROOM-${cleaned}`;
  }
  if (/^ROOM-\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  return cleaned;
}

export function isTournamentRoomCode(code: string): code is RoomId {
  return /^ROOM-[1-4]$/.test(normalizeRoomCode(code));
}

export type BuzzerEventType =
  | "QUESTION_OPENED"
  | "BUZZERS_UNLOCKED"
  | "BUZZERS_LOCKED"
  | "BUZZER_RESET"
  | "PLAYER_BUZZED"
  | "SESSION_SYNC"
  | "ROOM_STATE_SYNC"
  | "PLAYER_JOINED"
  | "STATE_REFETCH_REQUEST";

export interface QuestionOpenedPayload {
  categoryIndex: number;
  questionIndex: number;
  categoryName: string;
  value: number;
  question: string;
  /** Optional routing metadata for multi-room tournaments */
  roomId?: string;
  tournamentId?: string | null;
  isBuzzerLocked?: boolean;
}

export interface PlayerBuzzedPayload {
  teamId: string;
  teamName: string;
  timestamp: number;
}

export interface BuzzersLockedPayload {
  buzzedTeamId: string | null;
  buzzedTeamName: string | null;
}

export interface SessionSyncPayload {
  sessionId: string;
  roomCode: string;
  gameTitle: string | null;
  teams: Team[];
}

/** Full source-of-truth snapshot pushed on reconnect / join. */
export interface RoomStateSyncPayload {
  sessionId: string;
  roomCode: string;
  gameTitle: string | null;
  teams: Team[];
  activeQuestion: QuestionOpenedPayload | null;
  buzzersOpen: boolean;
  buzzedPlayer: PlayerBuzzedPayload | null;
}

export type BuzzerPayloadMap = {
  QUESTION_OPENED: QuestionOpenedPayload;
  BUZZERS_UNLOCKED: Record<string, never>;
  BUZZERS_LOCKED: BuzzersLockedPayload;
  BUZZER_RESET: Record<string, never>;
  PLAYER_BUZZED: PlayerBuzzedPayload;
  SESSION_SYNC: SessionSyncPayload;
  ROOM_STATE_SYNC: RoomStateSyncPayload;
  PLAYER_JOINED: { playerId: string };
  STATE_REFETCH_REQUEST: { playerId: string };
};
