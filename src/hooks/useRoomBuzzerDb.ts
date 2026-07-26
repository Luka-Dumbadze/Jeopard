"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  fetchRoomBuzzerState,
  type RoomBuzzerState,
} from "@/lib/supabase/tournaments";

export type DbSyncMode = "idle" | "polling" | "realtime" | "offline";

interface UseRoomBuzzerDbOptions {
  tournamentId: string | null;
  roomId: string;
  enabled?: boolean;
  /** Poll interval ms (default 1000). */
  pollIntervalMs?: number;
}

interface UseRoomBuzzerDbResult {
  state: RoomBuzzerState | null;
  syncMode: DbSyncMode;
  lastPolledAt: number | null;
  refresh: () => Promise<void>;
}

/**
 * Postgres Changes subscription + 1s HTTP polling fallback for tournament_rooms
 * live buzzer columns.
 */
export function useRoomBuzzerDb(
  options: UseRoomBuzzerDbOptions
): UseRoomBuzzerDbResult {
  const {
    tournamentId,
    roomId,
    enabled = true,
    pollIntervalMs = 1000,
  } = options;

  const [state, setState] = useState<RoomBuzzerState | null>(null);
  const [syncMode, setSyncMode] = useState<DbSyncMode>("idle");
  const [lastPolledAt, setLastPolledAt] = useState<number | null>(null);
  const realtimeOkRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!tournamentId || !roomId || !isSupabaseConfigured()) {
      setSyncMode("offline");
      return;
    }

    const next = await fetchRoomBuzzerState(tournamentId, roomId);
    if (next) {
      setState(next);
      setLastPolledAt(Date.now());
      if (!realtimeOkRef.current) {
        setSyncMode("polling");
      }
    }
  }, [tournamentId, roomId]);

  // Initial fetch + 1s polling fallback
  useEffect(() => {
    if (!enabled || !tournamentId || !roomId) {
      setState(null);
      setSyncMode("idle");
      return;
    }

    if (!isSupabaseConfigured()) {
      setSyncMode("offline");
      return;
    }

    let cancelled = false;

    void (async () => {
      await refresh();
      if (cancelled) return;
    })();

    const intervalId = window.setInterval(() => {
      void refresh();
    }, pollIntervalMs);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [enabled, tournamentId, roomId, pollIntervalMs, refresh]);

  // Supabase Postgres Changes on tournament_rooms
  useEffect(() => {
    if (!enabled || !tournamentId || !roomId) return;
    if (!isSupabaseConfigured()) return;

    const supabase = getSupabaseClient();
    if (!supabase) return;

    const channel = supabase
      .channel(`db-buzzer-${tournamentId}-${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tournament_rooms",
          filter: `tournament_id=eq.${tournamentId}`,
        },
        (payload) => {
          const row = (payload.new ?? null) as {
            tournament_id?: string;
            room_id?: string;
            buzzers_open?: boolean;
            active_question?: RoomBuzzerState["activeQuestion"];
            buzzed_team_id?: string | null;
            buzzed_team_name?: string | null;
            updated_at?: string;
          } | null;

          if (!row || row.room_id !== roomId) return;

          realtimeOkRef.current = true;
          setSyncMode("realtime");
          setState({
            tournamentId: row.tournament_id ?? tournamentId,
            roomId: row.room_id,
            buzzersOpen: Boolean(row.buzzers_open),
            activeQuestion: row.active_question ?? null,
            buzzedTeamId: row.buzzed_team_id ?? null,
            buzzedTeamName: row.buzzed_team_name ?? null,
            updatedAt: row.updated_at,
          });
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          realtimeOkRef.current = true;
          setSyncMode((prev) => (prev === "offline" ? prev : "realtime"));
        }
      });

    return () => {
      realtimeOkRef.current = false;
      void supabase.removeChannel(channel);
    };
  }, [enabled, tournamentId, roomId]);

  return { state, syncMode, lastPolledAt, refresh };
}
