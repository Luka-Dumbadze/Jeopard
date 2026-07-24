import type { Team } from "@/types/game";

/** Format: ROOM-4821 */
export function generateRoomCode(): string {
  const digits = Math.floor(1000 + Math.random() * 9000);
  return `ROOM-${digits}`;
}

export function normalizeRoomCode(input: string): string {
  const cleaned = input.trim().toUpperCase().replace(/\s+/g, "");
  if (/^\d{4}$/.test(cleaned)) {
    return `ROOM-${cleaned}`;
  }
  if (/^ROOM-\d{4}$/.test(cleaned)) {
    return cleaned;
  }
  return cleaned;
}

export type BuzzerEventType =
  | "QUESTION_OPENED"
  | "BUZZERS_UNLOCKED"
  | "BUZZERS_LOCKED"
  | "BUZZER_RESET"
  | "PLAYER_BUZZED"
  | "SESSION_SYNC"
  | "PLAYER_JOINED";

export interface QuestionOpenedPayload {
  categoryIndex: number;
  questionIndex: number;
  categoryName: string;
  value: number;
  question: string;
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
  roomCode: string;
  gameTitle: string | null;
  teams: Team[];
}

export type BuzzerPayloadMap = {
  QUESTION_OPENED: QuestionOpenedPayload;
  BUZZERS_UNLOCKED: Record<string, never>;
  BUZZERS_LOCKED: BuzzersLockedPayload;
  BUZZER_RESET: Record<string, never>;
  PLAYER_BUZZED: PlayerBuzzedPayload;
  SESSION_SYNC: SessionSyncPayload;
  PLAYER_JOINED: { playerId: string };
};
