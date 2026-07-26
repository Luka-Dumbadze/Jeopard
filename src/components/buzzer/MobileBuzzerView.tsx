"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useJeopardyBuzzer } from "@/hooks/useJeopardyBuzzer";
import { installAudioUnlockListener } from "@/lib/audio";
import {
  resolvePlayerBuzzerState,
  savePlayerBuzzerState,
} from "@/lib/playerLocalState";
import {
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
    playerUiState,
    buzzedPlayer,
    activeQuestion,
    sendBuzz,
  } = useJeopardyBuzzer({
    role: "player",
    roomCode,
    tournamentId: resolvedTournamentId,
    enabled: Boolean(roomCode),
    playerTeamId,
    playerTeamName,
  });

  // Prefer live host sync; fall back to DB-hydrated room teams
  const displayTeams = sessionTeams.length > 0 ? sessionTeams : dbTeams;

  // Prefer host sessionId; fall back to tournament id so join works before sync
  const effectiveSessionId = sessionId ?? resolvedTournamentId;

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
    }
  }, [playerUiState, activeQuestion]);

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

    // Instant client-side debounce / spam prevention
    setIsBuzzing(true);

    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate([150]);
    }

    const sent = sendBuzz();
    if (!sent) {
      setIsBuzzing(false);
    }
  };

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
      </main>
    );
  }

  const buzzDisabled = playerUiState !== "ready" || isBuzzing;

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

      {activeQuestion && (
        <div className="mt-6 rounded-xl bg-jeopardy-blue/60 px-4 py-3 text-center ring-1 ring-jeopardy-gold/20">
          <p className="text-xs uppercase tracking-widest text-jeopardy-gold/70">
            {activeQuestion.categoryName} · ${activeQuestion.value}
          </p>
          <p className="mt-2 text-sm leading-snug text-white/90">
            {activeQuestion.question}
          </p>
        </div>
      )}

      <div className="flex flex-1 flex-col items-center justify-center py-10">
        {playerUiState === "waiting" && (
          <button
            type="button"
            disabled
            className="flex h-56 w-56 items-center justify-center rounded-full bg-white/10 text-center text-lg font-bold text-white/40"
          >
            Waiting for
            <br />
            next question…
          </button>
        )}

        {(playerUiState === "ready" || isBuzzing) &&
          playerUiState !== "you_buzzed" &&
          playerUiState !== "locked_out" && (
            <motion.button
              type="button"
              disabled={buzzDisabled}
              onClick={handleBuzz}
              whileTap={buzzDisabled ? undefined : { scale: 0.94 }}
              animate={
                buzzDisabled
                  ? undefined
                  : {
                      boxShadow: [
                        "0 0 0 0 rgba(255, 215, 0, 0.55)",
                        "0 0 0 28px rgba(255, 215, 0, 0)",
                      ],
                    }
              }
              transition={{ duration: 1.2, repeat: Infinity }}
              className={`flex h-56 w-56 items-center justify-center rounded-full text-center text-2xl font-black leading-tight ${
                isBuzzing
                  ? "bg-yellow-700/80 text-white/80"
                  : "bg-gradient-to-b from-jeopardy-gold to-yellow-500 text-jeopardy-blue-dark"
              } disabled:cursor-not-allowed`}
            >
              {isBuzzing ? (
                <>
                  BUZZ
                  <br />
                  SENT…
                </>
              ) : (
                <>
                  READY!
                  <br />
                  PRESS BUZZ!
                </>
              )}
            </motion.button>
          )}

        {playerUiState === "you_buzzed" && (
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ duration: 0.9, repeat: Infinity }}
            className="flex h-56 w-56 items-center justify-center rounded-full bg-green-500 text-center text-xl font-black leading-tight text-white shadow-[0_0_40px_rgba(34,197,94,0.55)]"
          >
            YOU BUZZED
            <br />
            IN FIRST!
          </motion.div>
        )}

        {playerUiState === "locked_out" && (
          <div className="flex h-56 w-56 flex-col items-center justify-center rounded-full bg-red-950/80 px-4 text-center text-lg font-bold leading-snug text-red-200 ring-2 ring-red-500/40">
            <span>{buzzedPlayer?.teamName ?? "Another team"}</span>
            <span>buzzed in first</span>
            <span className="mt-2 text-sm opacity-70">Locked</span>
          </div>
        )}
      </div>
    </main>
  );
}
