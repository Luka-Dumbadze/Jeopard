import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Browser Supabase client (singleton).
 * Returns null when env vars are missing so the app still builds/runs offline.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) {
    return null;
  }

  if (client) return client;

  client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    }
  );

  return client;
}

export function getBuzzerChannelName(roomCode: string): string {
  const normalized = roomCode.trim().toUpperCase().replace(/\s+/g, "");
  return `jeopardy-room-${normalized}`;
}
