import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import type {
  CloudRoomConfig,
  CloudTournamentSession,
} from "@/types/cloudTournament";
import type { RoomId } from "@/types/tournament";
import { isRoomId, ROOM_IDS } from "@/types/tournament";
import type { GameData } from "@/types/game";
import type { TournamentTeam } from "@/types/tournament";

interface TournamentSessionRow {
  id: string;
  game_data: GameData;
  teams: TournamentTeam[];
  rooms: Record<RoomId, CloudRoomConfig>;
  created_at: string;
}

export type TournamentCloudResult =
  | { ok: true; tournamentId: string }
  | { ok: false; error: string; offline?: boolean };

/** Active question payload stored on tournament_rooms.active_question */
export interface RoomActiveQuestionPayload {
  categoryIndex: number;
  questionIndex: number;
  categoryName: string;
  value: number;
  question: string;
}

export interface RoomBuzzerState {
  tournamentId: string;
  roomId: string;
  buzzersOpen: boolean;
  activeQuestion: RoomActiveQuestionPayload | null;
  buzzedTeamId: string | null;
  buzzedTeamName: string | null;
  updatedAt?: string;
}

interface TournamentRoomBuzzerRow {
  tournament_id: string;
  room_id: string;
  buzzers_open: boolean | null;
  active_question: RoomActiveQuestionPayload | null;
  buzzed_team_id: string | null;
  buzzed_team_name: string | null;
  updated_at?: string;
}

function mapRoomBuzzerRow(row: TournamentRoomBuzzerRow): RoomBuzzerState {
  return {
    tournamentId: row.tournament_id,
    roomId: row.room_id,
    buzzersOpen: Boolean(row.buzzers_open),
    activeQuestion: row.active_question ?? null,
    buzzedTeamId: row.buzzed_team_id ?? null,
    buzzedTeamName: row.buzzed_team_name ?? null,
    updatedAt: row.updated_at,
  };
}

export async function saveTournamentSession(
  session: CloudTournamentSession
): Promise<TournamentCloudResult> {
  if (!isSupabaseConfigured()) {
    return {
      ok: false,
      offline: true,
      error: "Supabase is not configured — tournament saved locally only.",
    };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return {
      ok: false,
      offline: true,
      error: "Supabase client unavailable — tournament saved locally only.",
    };
  }

  const { error: sessionError } = await supabase
    .from("tournament_sessions")
    .upsert(
      {
        id: session.id,
        game_data: session.gameData,
        teams: session.teams,
        rooms: session.rooms,
      },
      { onConflict: "id" }
    );

  if (sessionError) {
    return { ok: false, error: sessionError.message };
  }

  const roomRows = ROOM_IDS.map((roomId) => {
    const room = session.rooms[roomId];
    return {
      tournament_id: session.id,
      room_id: room.id,
      room_number: room.number,
      label_ka: room.labelKa,
      team_ids: room.teamIds,
      buzzers_open: false,
      active_question: null,
      buzzed_team_id: null,
      buzzed_team_name: null,
      updated_at: new Date().toISOString(),
    };
  });

  const { error: roomsError } = await supabase
    .from("tournament_rooms")
    .upsert(roomRows, { onConflict: "tournament_id,room_id" });

  if (roomsError) {
    return { ok: false, error: roomsError.message };
  }

  return { ok: true, tournamentId: session.id };
}

export async function fetchTournamentSession(
  tournamentId: string
): Promise<CloudTournamentSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tournament_sessions")
    .select("id, game_data, teams, rooms, created_at")
    .eq("id", tournamentId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[tournament] fetch failed:", error.message);
    }
    return null;
  }

  const row = data as TournamentSessionRow;

  return {
    id: row.id,
    gameData: row.game_data,
    teams: row.teams,
    rooms: row.rooms,
    createdAt: row.created_at,
  };
}

/** Most recently created tournament session (fallback when `t` is missing). */
export async function fetchLatestTournamentSession(): Promise<CloudTournamentSession | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tournament_sessions")
    .select("id, game_data, teams, rooms, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[tournament] latest fetch failed:", error.message);
    }
    return null;
  }

  const row = data as TournamentSessionRow;

  return {
    id: row.id,
    gameData: row.game_data,
    teams: row.teams,
    rooms: row.rooms,
    createdAt: row.created_at,
  };
}

/** Two assigned teams for a room from a cloud tournament session. */
export function getAssignedRoomTeams(
  session: CloudTournamentSession,
  roomId: string
): TournamentTeam[] {
  if (!isRoomId(roomId)) return [];
  const room = session.rooms[roomId];
  if (!room?.teamIds?.length) return [];

  return room.teamIds
    .map((teamId) => session.teams.find((team) => team.id === teamId))
    .filter((team): team is TournamentTeam => Boolean(team));
}

export async function fetchRoomBuzzerState(
  tournamentId: string,
  roomId: string
): Promise<RoomBuzzerState | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("tournament_rooms")
    .select(
      "tournament_id, room_id, buzzers_open, active_question, buzzed_team_id, buzzed_team_name, updated_at"
    )
    .eq("tournament_id", tournamentId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("[room-buzzer] fetch failed:", error.message);
    }
    return null;
  }

  return mapRoomBuzzerRow(data as TournamentRoomBuzzerRow);
}

export interface RoomBuzzerUpsertMeta {
  roomNumber?: number;
  labelKa?: string;
  teamIds?: string[];
}

function resolveRoomMeta(roomId: string, meta?: RoomBuzzerUpsertMeta) {
  const parsed = /^ROOM-([1-4])$/i.exec(roomId.trim());
  const roomNumber = meta?.roomNumber ?? (parsed ? Number(parsed[1]) : 1);
  return {
    room_number: roomNumber,
    label_ka: meta?.labelKa ?? `ოთახი ${roomNumber}`,
    team_ids: meta?.teamIds ?? [],
  };
}

/**
 * Host: open tile / force unlock → UPSERT tournament_rooms so the row
 * always exists with buzzers_open=true (unique on tournament_id,room_id).
 * Note: DB column is tournament_id (session/tournament id), not session_id.
 */
export async function openRoomBuzzers(
  tournamentId: string,
  roomId: string,
  activeQuestion: RoomActiveQuestionPayload,
  meta?: RoomBuzzerUpsertMeta
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const roomMeta = resolveRoomMeta(roomId, meta);
  const { error } = await supabase.from("tournament_rooms").upsert(
    {
      tournament_id: tournamentId,
      room_id: roomId,
      room_number: roomMeta.room_number,
      label_ka: roomMeta.label_ka,
      team_ids: roomMeta.team_ids,
      buzzers_open: true,
      active_question: activeQuestion,
      buzzed_team_id: null,
      buzzed_team_name: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "tournament_id,room_id" }
  );

  if (error) {
    console.error("[room-buzzer] upsert open failed:", error.message);
    return false;
  }
  return true;
}

/** Host: unlock / reset buzzers for the current question (UPSERT). */
export async function resetRoomBuzzers(
  tournamentId: string,
  roomId: string,
  meta?: RoomBuzzerUpsertMeta & {
    activeQuestion?: RoomActiveQuestionPayload | null;
  }
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const roomMeta = resolveRoomMeta(roomId, meta);
  const row: Record<string, unknown> = {
    tournament_id: tournamentId,
    room_id: roomId,
    room_number: roomMeta.room_number,
    label_ka: roomMeta.label_ka,
    team_ids: roomMeta.team_ids,
    buzzers_open: true,
    buzzed_team_id: null,
    buzzed_team_name: null,
    updated_at: new Date().toISOString(),
  };
  if (meta?.activeQuestion !== undefined) {
    row.active_question = meta.activeQuestion;
  }

  const { error } = await supabase
    .from("tournament_rooms")
    .upsert(row, { onConflict: "tournament_id,room_id" });

  if (error) {
    console.error("[room-buzzer] upsert reset failed:", error.message);
    return false;
  }
  return true;
}

/** Host: close question modal → clear live buzzer state. */
export async function closeRoomBuzzers(
  tournamentId: string,
  roomId: string
): Promise<boolean> {
  if (!isSupabaseConfigured()) return false;
  const supabase = getSupabaseClient();
  if (!supabase) return false;

  const { error } = await supabase
    .from("tournament_rooms")
    .update({
      buzzers_open: false,
      active_question: null,
      buzzed_team_id: null,
      buzzed_team_name: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tournament_id", tournamentId)
    .eq("room_id", roomId);

  if (error) {
    console.error("[room-buzzer] close failed:", error.message);
    return false;
  }
  return true;
}

export type ClaimRoomBuzzResult =
  | { ok: true; won: true; state: RoomBuzzerState }
  | { ok: true; won: false; state: RoomBuzzerState | null }
  | { ok: false; error: string };

/**
 * Atomic first-buzz-wins claim.
 * Only succeeds when buzzers_open and buzzed_team_id is still null.
 */
export async function claimRoomBuzz(
  tournamentId: string,
  roomId: string,
  teamId: string,
  teamName: string
): Promise<ClaimRoomBuzzResult> {
  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase not configured" };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, error: "Supabase client unavailable" };
  }

  const { data, error } = await supabase
    .from("tournament_rooms")
    .update({
      buzzed_team_id: teamId,
      buzzed_team_name: teamName,
      updated_at: new Date().toISOString(),
    })
    .eq("tournament_id", tournamentId)
    .eq("room_id", roomId)
    .eq("buzzers_open", true)
    .is("buzzed_team_id", null)
    .select(
      "tournament_id, room_id, buzzers_open, active_question, buzzed_team_id, buzzed_team_name, updated_at"
    )
    .maybeSingle();

  if (error) {
    console.error("[room-buzzer] claim failed:", error.message);
    return { ok: false, error: error.message };
  }

  if (data) {
    return {
      ok: true,
      won: true,
      state: mapRoomBuzzerRow(data as TournamentRoomBuzzerRow),
    };
  }

  const current = await fetchRoomBuzzerState(tournamentId, roomId);
  return { ok: true, won: false, state: current };
}
