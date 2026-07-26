"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useJeopardyBuzzer } from "@/hooks/useJeopardyBuzzer";
import { useRoomBuzzerDb, type DbSyncMode } from "@/hooks/useRoomBuzzerDb";
import { installAudioUnlockListener } from "@/lib/audio";
import {
  resolvePlayerBuzzerState,
  savePlayerBuzzerState,
} from "@/lib/playerLocalState";
import {
  claimRoomBuzz,
  fetchLatestTournamentSession,
  fetchTournamentSession,
  getAssignedRoomTeams,
} from "@/lib/supabase/tournaments";
import { normalizeRoomCode } from "@/types/buzzer";
import { isTournamentId } from "@/types/cloudTournament";
import type { Team } from "@/types/game";

interface MobileBuzzerViewProps {
  initialRoom: string;
  tournamentId?: string | null;
}

function SyncBadge({
  roomCode,
  tournamentId,
  syncMode,
  isConnected,
}: {
  roomCode: string;
  tournamentId: string | null;
  syncMode: DbSyncMode;
  isConnected: boolean;
}) {
  const label =
    syncMode === "realtime"
      ? "DB Live Sync"
      : syncMode === "polling"
        ? "DB Polling 1s"
        : syncMode === "offline"
          ? "DB Offline"
          : "DB Idle";
  const icon =
    syncMode === "realtime"
      ? "🟢"
      : syncMode === "polling"
        ? "🟡"
        : syncMode === "offline"
          ? "🔴"
          : "⚪";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 flex justify-center px-3">
      <p className="max-w-full truncate rounded-full bg-black/55 px-3 py-1.5 text-center font-mono text-[10px] leading-tight text-white/75 ring-1 ring-white/10 backdrop-blur-sm">
        {icon} {label} · {roomCode}
        {tournamentId ? ` · ${tournamentId}` : ""}
        {isConnected ? " · RT" : " · RT…"}
      </p>
    </div>
  );
}

export default function MobileBuzzerView({
  initialRoom,
  tournamentId = null,
}: MobileBuzzerViewProps) {
  const roomCode = useMemo(
    () => normalizeRoomCode(initialRoom || ""),
    [initialRoom]
  );

  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [selectedTeamName, setSelectedTeamName] = useState<string | null>(null);
  const [joined, setJoined] = useState(false);
  const [isBuzzing, setIsBuzzing] = useState(false);
  const [sessionMismatchNotice, setSessionMismatchNotice] = useState(false);
  const [localWonBuzz, setLocalWonBuzz] = useState(false);

  const [dbTeams, setDbTeams] = useState<Team[]>([]);
  const [resolvedTournamentId, setResolvedTournamentId] = useState<string | null>(
    isTournamentId(tournamentId) ? tournamentId!.trim() : null
  );
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  useEffect(() => {
    installAudioUnlockListener();
  }, []);

  // Direct Supabase DB hydration — do not wait for host SESSION_SYNC
  useEffect(() => {
    if (!roomCode) {
      setTeamsLoading(false);
      return;
    }

    let cancelled = false;
    setTeamsLoading(true);
    setTeamsError(null);

    void (async () => {
      try {
        const session = isTournamentId(tournamentId)
          ? await fetchTournamentSession(tournamentId!.trim())
          : await fetchLatestTournamentSession();

        if (cancelled) return;

        if (!session) {
          setDbTeams([]);
          setTeamsError(
            isTournamentId(tournamentId)
              ? "Tournament not found in cloud."
              : "No active tournament found. Ask the host to share a buzz link with ?t=…"
          );
          setTeamsLoading(false);
          return;
        }

        const roomTeams = getAssignedRoomTeams(session, roomCode);
        setResolvedTournamentId(session.id);
        setDbTeams(roomTeams);
        if (roomTeams.length === 0) {
          setTeamsError(`No teams assigned to ${roomCode} in this tournament.`);
        }
      } catch (err) {
        if (cancelled) return;
        console.error("[buzz] team hydrate failed", err);
        setTeamsError("Could not load teams from cloud.");
        setDbTeams([]);
      } finally {
        if (!cancelled) setTeamsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [roomCode, tournamentId]);

  const playerTeamId = joined ? selectedTeamId : null;
  const playerTeamName = joined ? selectedTeamName : null;

  const {
    isConfigured,
    isConnected,
    sessionId,
    sessionTeams,
    playerUiState: realtimeUiState,
    buzzersOpen: realtimeBuzzersOpen,
    buzzedPlayer: realtimeBuzzed,
    activeQuestion: realtimeQuestion,
    sendBuzz,
  } = useJeopardyBuzzer({
    role: "player",
    roomCode,
    tournamentId: resolvedTournamentId,
    enabled: Boolean(roomCode),
    playerTeamId,
    playerTeamName,
  });

  const {
    state: dbBuzzer,
    syncMode,
  } = useRoomBuzzerDb({
    tournamentId: resolvedTournamentId,
    roomId: roomCode,
    enabled: Boolean(resolvedTournamentId) && Boolean(roomCode),
    pollIntervalMs: 1000,
  });

  // Prefer live host sync; fall back to DB-hydrated room teams
  const displayTeams = sessionTeams.length > 0 ? sessionTeams : dbTeams;
  const effectiveSessionId = sessionId ?? resolvedTournamentId;

  // DB is source of truth for unlock; realtime is a bonus
  const dbReady =
    Boolean(dbBuzzer?.buzzersOpen) && dbBuzzer?.buzzedTeamId == null;
  const dbYouBuzzed =
    Boolean(joined) &&
    Boolean(selectedTeamId) &&
    dbBuzzer?.buzzedTeamId === selectedTeamId;
  const dbLockedOut =
    Boolean(joined) &&
    Boolean(dbBuzzer?.buzzedTeamId) &&
    dbBuzzer?.buzzedTeamId !== selectedTeamId;

  const effectiveBuzzersOpen = dbReady || realtimeBuzzersOpen;
  const effectiveActiveQuestion =
    dbBuzzer?.activeQuestion ?? realtimeQuestion ?? null;

  let playerUiState: "waiting" | "ready" | "you_buzzed" | "locked_out" =
    "waiting";
  if (localWonBuzz || dbYouBuzzed) {
    playerUiState = "you_buzzed";
  } else if (dbLockedOut) {
    playerUiState = "locked_out";
  } else if (joined && dbReady) {
    playerUiState = "ready";
  } else if (realtimeUiState === "you_buzzed" || realtimeUiState === "locked_out") {
    playerUiState = realtimeUiState;
  } else if (joined && effectiveBuzzersOpen) {
    playerUiState = "ready";
  } else {
    playerUiState = "waiting";
  }

  const lockedTeamName =
    dbBuzzer?.buzzedTeamName ?? realtimeBuzzed?.teamName ?? "Another team";

  // Stale localStorage invalidation when tournament session changes
  useEffect(() => {
    if (!roomCode || !effectiveSessionId) return;

    const { state, clearedDueToMismatch } = resolvePlayerBuzzerState(
      roomCode,
      effectiveSessionId
    );

    if (clearedDueToMismatch) {
      setSelectedTeamId(null);
      setSelectedTeamName(null);
      setJoined(false);
      setSessionMismatchNotice(true);
      setLocalWonBuzz(false);
      return;
    }

    if (!state) return;

    setSelectedTeamId(state.teamId);
    setSelectedTeamName(state.teamName);
    setJoined(true);
    setSessionMismatchNotice(false);
  }, [roomCode, effectiveSessionId]);

  // Reset buzz lock when host unlocks / new question
  useEffect(() => {
    if (playerUiState === "ready" || playerUiState === "waiting") {
      setIsBuzzing(false);
      if (playerUiState === "waiting" || dbReady) {
        setLocalWonBuzz(false);
      }
    }
  }, [playerUiState, dbReady, effectiveActiveQuestion]);

  const resolvedName = playerTeamName ?? "Player";
  const canJoin = roomCode.length > 0 && Boolean(selectedTeamId);

  const handleJoin = () => {
    if (!canJoin || !selectedTeamId || !selectedTeamName || !effectiveSessionId) {
      return;
    }
    savePlayerBuzzerState({
      sessionId: effectiveSessionId,
      roomId: roomCode,
      teamId: selectedTeamId,
      teamName: selectedTeamName,
    });
    setJoined(true);
    setSessionMismatchNotice(false);
  };

  const handleBuzz = () => {
    if (playerUiState !== "ready" || isBuzzing) return;
    if (!selectedTeamId || !selectedTeamName) return;

    setIsBuzzing(true);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([150]);
    }

    // Keep broadcast for host sound / legacy listeners
    sendBuzz();

    if (!resolvedTournamentId) {
      return;
    }

    void (async () => {
      const result = await claimRoomBuzz(
        resolvedTournamentId,
        roomCode,
        selectedTeamId,
        selectedTeamName
      );

      if (!result.ok) {
        setIsBuzzing(false);
        return;
      }

      if (result.won) {
        setLocalWonBuzz(true);
      } else {
        setLocalWonBuzz(false);
        setIsBuzzing(false);
      }
    })();
  };

  const badge = (
    <SyncBadge
      roomCode={roomCode || "—"}
      tournamentId={resolvedTournamentId}
      syncMode={syncMode}
      isConnected={isConnected}
    />
  );

  if (!roomCode) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-jeopardy-blue-dark px-6 text-center">
        <h1 className="text-2xl font-bold text-jeopardy-gold">Join a Room</h1>
        <p className="mt-3 text-white/70">
          Scan the room QR or open{" "}
          <code className="text-jeopardy-gold">
            /buzz?room=ROOM-1&amp;t=TOURNAMENT-…
          </code>
        </p>
        {badge}
      </main>
    );
  }

  if (!isConfigured) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center bg-jeopardy-blue-dark px-6 text-center">
        <h1 className="text-2xl font-bold text-jeopardy-gold">Buzzers Offline</h1>
        <p className="mt-3 text-sm text-white/70">
          Supabase env vars are not configured on this deployment.
        </p>
        {badge}
      </main>
    );
  }

  if (!joined) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center bg-jeopardy-blue-dark px-5 py-10">
        <p className="text-center text-xs font-bold uppercase tracking-[0.25em] text-jeopardy-gold/70">
          {roomCode}
        </p>
        {resolvedTournamentId && (
          <p className="mt-1 text-center font-mono text-[10px] text-white/40">
            {resolvedTournamentId}
          </p>
        )}
        <h1 className="mt-2 text-center text-3xl font-bold text-jeopardy-gold">
          აირჩიე გუნდი
        </h1>
        <p className="mt-2 text-center text-sm text-white/60">
          {teamsLoading
            ? "Loading teams from cloud…"
            : isConnected
              ? "Connected — only this room's 2 teams are listed"
              : "Connecting to realtime room…"}
        </p>

        {sessionMismatchNotice && (
          <p className="mt-4 rounded-lg bg-amber-900/40 px-3 py-2 text-center text-sm text-amber-100">
            New tournament detected — please pick your team again.
          </p>
        )}

        {teamsError && displayTeams.length === 0 && (
          <p className="mt-4 rounded-lg bg-red-900/40 px-3 py-2 text-center text-sm text-red-100">
            {teamsError}
          </p>
        )}

        <div className="mt-8 space-y-3">
          {teamsLoading && displayTeams.length === 0 ? (
            <p className="rounded-xl bg-black/30 px-4 py-6 text-center text-sm text-white/60">
              Loading teams…
            </p>
          ) : displayTeams.length === 0 ? (
            <p className="rounded-xl bg-black/30 px-4 py-6 text-center text-sm text-white/60">
              Waiting for host projector to sync teams…
            </p>
          ) : (
            displayTeams.map((team) => (
              <button
                key={team.id}
                type="button"
                onClick={() => {
                  setSelectedTeamId(team.id);
                  setSelectedTeamName(team.name);
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-4 text-left text-lg font-bold transition ${
                  selectedTeamId === team.id
                    ? "bg-jeopardy-gold text-jeopardy-blue-dark ring-2 ring-white/40"
                    : "bg-jeopardy-blue text-white ring-1 ring-jeopardy-gold/30"
                }`}
                style={
                  team.color
                    ? { boxShadow: `inset 6px 0 0 ${team.color}` }
                    : undefined
                }
              >
                <span aria-hidden>{team.colorEmoji ?? "•"}</span>
                <span>{team.name}</span>
              </button>
            ))
          )}
        </div>

        <button
          type="button"
          disabled={!canJoin || !effectiveSessionId}
          onClick={handleJoin}
          className="mt-8 rounded-xl bg-jeopardy-gold py-4 text-lg font-bold text-jeopardy-blue-dark transition enabled:active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Join Buzzer
        </button>
        {badge}
      </main>
    );
  }

  const buzzDisabled = playerUiState !== "ready" || isBuzzing;
  const showFullScreenBuzz =
    joined &&
    (playerUiState === "ready" ||
      playerUiState === "you_buzzed" ||
      playerUiState === "locked_out" ||
      isBuzzing ||
      effectiveBuzzersOpen);

  if (showFullScreenBuzz && (playerUiState === "ready" || isBuzzing) && playerUiState !== "you_buzzed" && playerUiState !== "locked_out") {
    return (
      <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden px-4 py-6">
        <motion.div
          aria-hidden
          className="absolute inset-0"
          animate={{
            background: [
              "radial-gradient(circle at 50% 45%, rgba(34,197,94,0.55) 0%, rgba(8,22,72,1) 70%)",
              "radial-gradient(circle at 50% 45%, rgba(255,215,0,0.65) 0%, rgba(8,22,72,1) 72%)",
              "radial-gradient(circle at 50% 45%, rgba(34,197,94,0.55) 0%, rgba(8,22,72,1) 70%)",
            ],
          }}
          transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          animate={{ opacity: [0.25, 0.55, 0.25] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          style={{
            background:
              "radial-gradient(circle at center, rgba(255,215,0,0.45), transparent 60%)",
          }}
        />

        <div className="relative z-10 mb-4 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-jeopardy-gold/80">
            {roomCode}
          </p>
          <p className="mt-1 text-base font-bold text-white drop-shadow">
            {resolvedName}
          </p>
        </div>

        <motion.button
          type="button"
          disabled={buzzDisabled}
          onClick={handleBuzz}
          whileTap={buzzDisabled ? undefined : { scale: 0.92, rotateX: 12 }}
          animate={
            isBuzzing
              ? { scale: 0.96 }
              : {
                  scale: [1, 1.06, 1],
                  rotateX: [0, -6, 0],
                  boxShadow: [
                    "0 18px 0 #b45309, 0 0 0 0 rgba(255,215,0,0.55)",
                    "0 22px 0 #b45309, 0 0 60px 18px rgba(34,197,94,0.45)",
                    "0 18px 0 #b45309, 0 0 0 0 rgba(255,215,0,0.55)",
                  ],
                }
          }
          transition={{ duration: 0.85, repeat: Infinity, ease: "easeInOut" }}
          className={`relative z-10 flex aspect-square w-[min(80vw,80vh)] max-w-[28rem] items-center justify-center rounded-full border-8 border-white/30 text-center font-black leading-none text-jeopardy-blue-dark ${
            isBuzzing
              ? "bg-gradient-to-b from-yellow-600 to-amber-800 text-white/90"
              : "bg-gradient-to-b from-jeopardy-gold via-yellow-300 to-amber-500"
          }`}
          style={{
            transformStyle: "preserve-3d",
            textShadow: "0 2px 0 rgba(255,255,255,0.35)",
          }}
        >
          <span className="flex flex-col items-center gap-2 px-4">
            <span className="text-[clamp(3.5rem,14vw,6rem)] leading-none">
              {isBuzzing ? "…" : "🔔"}
            </span>
            <span className="text-[clamp(2.4rem,11vw,4.5rem)] tracking-tight">
              {isBuzzing ? "SENT" : "BUZZ!"}
            </span>
            {!isBuzzing && (
              <span className="text-[clamp(1.1rem,4.5vw,1.75rem)] font-extrabold tracking-wide text-jeopardy-blue-dark/80">
                დააჭირე!
              </span>
            )}
          </span>
        </motion.button>

        {effectiveActiveQuestion && (
          <p className="relative z-10 mt-5 max-w-sm text-center text-xs text-white/70">
            {effectiveActiveQuestion.categoryName} · $
            {effectiveActiveQuestion.value}
          </p>
        )}
        {badge}
      </main>
    );
  }

  if (showFullScreenBuzz && playerUiState === "you_buzzed") {
    return (
      <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-green-600 via-green-700 to-jeopardy-blue-dark px-4">
        <motion.div
          animate={{ scale: [1, 1.05, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 0.9, repeat: Infinity }}
          className="flex aspect-square w-[min(80vw,80vh)] max-w-[28rem] flex-col items-center justify-center rounded-full bg-green-400 text-center shadow-[0_0_80px_rgba(34,197,94,0.7)] ring-8 ring-white/40"
        >
          <span className="text-[clamp(3rem,12vw,5rem)]">⚡</span>
          <span className="mt-2 text-[clamp(1.6rem,7vw,2.75rem)] font-black leading-tight text-white">
            YOU BUZZED
            <br />
            IN!
          </span>
        </motion.div>
        <p className="mt-6 text-lg font-bold text-white">{resolvedName}</p>
        {badge}
      </main>
    );
  }

  if (showFullScreenBuzz && playerUiState === "locked_out") {
    return (
      <main className="relative flex min-h-dvh w-full flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-red-950 via-jeopardy-blue-dark to-black px-4">
        <div className="flex aspect-square w-[min(80vw,80vh)] max-w-[28rem] flex-col items-center justify-center rounded-full bg-red-950/90 px-6 text-center ring-8 ring-red-500/40">
          <span className="text-[clamp(3rem,12vw,5rem)]">🔒</span>
          <span className="mt-3 text-[clamp(1.4rem,6vw,2.25rem)] font-black leading-tight text-red-100">
            LOCKED
          </span>
          <span className="mt-3 text-base font-bold text-red-200/90">
            {lockedTeamName} buzzed first
          </span>
        </div>
        {badge}
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-jeopardy-blue-dark px-5 py-8">
      <div className="text-center">
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-jeopardy-gold/60">
          {roomCode}
        </p>
        <p className="mt-1 text-lg font-bold text-white">{resolvedName}</p>
        <p
          className={`mt-1 text-xs font-bold ${
            isConnected ? "text-green-400" : "text-yellow-300"
          }`}
        >
          {isConnected ? "LIVE" : "Reconnecting…"}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center py-10">
        <button
          type="button"
          disabled
          className="flex h-56 w-56 items-center justify-center rounded-full bg-white/10 text-center text-lg font-bold text-white/40"
        >
          Waiting for
          <br />
          next question…
        </button>
      </div>
      {badge}
    </main>
  );
}
