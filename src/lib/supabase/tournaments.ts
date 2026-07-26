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
