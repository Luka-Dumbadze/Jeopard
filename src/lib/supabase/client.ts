import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let initAttempted = false;

function readSupabaseEnv(): { url: string; key: string } | null {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (!url || !key) return null;

  // Reject placeholder / non-URL values that throw TypeError: Invalid URL
  if (
    url === "undefined" ||
    url === "null" ||
    key === "undefined" ||
    key === "null"
  ) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return { url, key };
}

export function isSupabaseConfigured(): boolean {
  return readSupabaseEnv() !== null;
}

/**
 * Lazy browser Supabase client (singleton).
 * Never throws at import time — returns null when env is missing/invalid.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (client) return client;
  if (initAttempted) return null;

  const env = readSupabaseEnv();
  if (!env) {
    initAttempted = true;
    return null;
  }

  initAttempted = true;

  try {
    client = createClient(env.url, env.key, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
    return client;
  } catch (error) {
    console.error("[supabase] Failed to create client:", error);
    client = null;
    return null;
  }
}

/**
 * Deterministic Realtime channel for a room projector + its mobile buzzers.
 * Host (`/room/[roomId]`) and players (`/buzz`) MUST use the same name.
 */
export function getRoomChannelName(
  roomId: string,
  tournamentId?: string | null
): string {
  const room = roomId.trim().toUpperCase().replace(/\s+/g, "");
  if (tournamentId && tournamentId.trim()) {
    const tournament = tournamentId.trim().toUpperCase().replace(/\s+/g, "");
    return `jeopardy-${tournament}-${room}`;
  }
  return `jeopardy-room-${room}`;
}

/** @deprecated Prefer getRoomChannelName — kept as a stable alias. */
export function getBuzzerChannelName(
  roomCode: string,
  tournamentId?: string | null
): string {
  return getRoomChannelName(roomCode, tournamentId);
}

