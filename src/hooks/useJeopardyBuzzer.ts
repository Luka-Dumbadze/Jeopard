"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playBuzzerSound } from "@/lib/audio";
import {
  getBuzzerChannelName,
  getSupabaseClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import type {
  BuzzersLockedPayload,
  BuzzerEventType,
  BuzzerPayloadMap,
  PlayerBuzzedPayload,
  QuestionOpenedPayload,
  SessionSyncPayload,
} from "@/types/buzzer";
import type { Team } from "@/types/game";

export type BuzzerRole = "host" | "player";

export type PlayerBuzzerUiState =
  | "waiting"
  | "ready"
  | "you_buzzed"
  | "locked_out";

interface UseJeopardyBuzzerOptions {
  role: BuzzerRole;
  roomCode: string;
  /** Host: current teams for SESSION_SYNC */
  teams?: Team[];
  gameTitle?: string | null;
  enabled?: boolean;
  /** Player identity after team selection */
  playerTeamId?: string | null;
  playerTeamName?: string | null;
}

interface UseJeopardyBuzzerResult {
  isConfigured: boolean;
  isConnected: boolean;
  buzzedPlayer: PlayerBuzzedPayload | null;
  buzzersOpen: boolean;
  activeQuestion: QuestionOpenedPayload | null;
  sessionTeams: Team[];
  playerUiState: PlayerBuzzerUiState;
  broadcastQuestionOpened: (payload: QuestionOpenedPayload) => void;
  resetBuzzers: () => void;
  lockBuzzers: () => void;
  syncSession: () => void;
  sendBuzz: () => void;
}

export type { UseJeopardyBuzzerResult };

function sendBroadcast<T extends BuzzerEventType>(
  channel: RealtimeChannel | null,
  event: T,
  payload: BuzzerPayloadMap[T]
): void {
  if (!channel) return;
  void channel.send({
    type: "broadcast",
    event,
    payload,
  });
}

export function useJeopardyBuzzer(
  options: UseJeopardyBuzzerOptions
): UseJeopardyBuzzerResult {
  const {
    role,
    roomCode,
    teams = [],
    gameTitle = null,
    enabled = true,
    playerTeamId = null,
    playerTeamName = null,
  } = options;

  const isConfigured = isSupabaseConfigured();
  const [isConnected, setIsConnected] = useState(false);
  const [buzzedPlayer, setBuzzedPlayer] = useState<PlayerBuzzedPayload | null>(
    null
  );
  const [buzzersOpen, setBuzzersOpen] = useState(false);
  const [activeQuestion, setActiveQuestion] =
    useState<QuestionOpenedPayload | null>(null);
  const [sessionTeams, setSessionTeams] = useState<Team[]>(teams);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const firstBuzzLockedRef = useRef(false);
  const teamsRef = useRef(teams);
  const gameTitleRef = useRef(gameTitle);
  const playerIdRef = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `player-${Date.now()}`
  );

  teamsRef.current = teams;
  gameTitleRef.current = gameTitle;

  const syncSession = useCallback(() => {
    if (role !== "host") return;
    const payload: SessionSyncPayload = {
      roomCode,
      gameTitle: gameTitleRef.current,
      teams: teamsRef.current,
    };
    sendBroadcast(channelRef.current, "SESSION_SYNC", payload);
  }, [role, roomCode]);

  const lockBuzzers = useCallback(
    (buzzed?: PlayerBuzzedPayload | null) => {
      setBuzzersOpen(false);
      if (!buzzed) {
        setBuzzedPlayer(null);
        firstBuzzLockedRef.current = false;
        setActiveQuestion(null);
      }
      const payload: BuzzersLockedPayload = {
        buzzedTeamId: buzzed?.teamId ?? null,
        buzzedTeamName: buzzed?.teamName ?? null,
      };
      sendBroadcast(channelRef.current, "BUZZERS_LOCKED", payload);
    },
    []
  );

  const unlockBuzzers = useCallback(() => {
    firstBuzzLockedRef.current = false;
    setBuzzedPlayer(null);
    setBuzzersOpen(true);
    sendBroadcast(channelRef.current, "BUZZERS_UNLOCKED", {});
  }, []);

  const resetBuzzers = useCallback(() => {
    unlockBuzzers();
    sendBroadcast(channelRef.current, "BUZZER_RESET", {});
  }, [unlockBuzzers]);

  const broadcastQuestionOpened = useCallback(
    (payload: QuestionOpenedPayload) => {
      firstBuzzLockedRef.current = false;
      setBuzzedPlayer(null);
      setActiveQuestion(payload);
      setBuzzersOpen(true);
      sendBroadcast(channelRef.current, "QUESTION_OPENED", payload);
      sendBroadcast(channelRef.current, "BUZZERS_UNLOCKED", {});
      syncSession();
    },
    [syncSession]
  );

  const sendBuzz = useCallback(() => {
    if (role !== "player") return;
    if (!buzzersOpen || firstBuzzLockedRef.current) return;
    if (!playerTeamId || !playerTeamName) return;

    const payload: PlayerBuzzedPayload = {
      teamId: playerTeamId,
      teamName: playerTeamName,
      timestamp: Date.now(),
    };

    sendBroadcast(channelRef.current, "PLAYER_BUZZED", payload);
  }, [role, buzzersOpen, playerTeamId, playerTeamName]);

  // Keep host session teams in sync for local state
  useEffect(() => {
    if (role === "host") {
      setSessionTeams(teams);
    }
  }, [role, teams]);

  // Rebroadcast session when host teams change
  useEffect(() => {
    if (role !== "host" || !isConnected) return;
    syncSession();
  }, [role, isConnected, teams, syncSession]);

  useEffect(() => {
    if (!enabled || !roomCode || !isConfigured) {
      setIsConnected(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsConnected(false);
      return;
    }

    const channelName = getBuzzerChannelName(roomCode);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "SESSION_SYNC" }, ({ payload }) => {
        const data = payload as SessionSyncPayload;
        setSessionTeams(data.teams ?? []);
      })
      .on("broadcast", { event: "QUESTION_OPENED" }, ({ payload }) => {
        const data = payload as QuestionOpenedPayload;
        setActiveQuestion(data);
        if (role === "player") {
          firstBuzzLockedRef.current = false;
          setBuzzedPlayer(null);
          setBuzzersOpen(true);
        }
      })
      .on("broadcast", { event: "BUZZERS_UNLOCKED" }, () => {
        if (!firstBuzzLockedRef.current) {
          setBuzzersOpen(true);
        }
      })
      .on("broadcast", { event: "BUZZERS_LOCKED" }, ({ payload }) => {
        const data = payload as BuzzersLockedPayload;
        setBuzzersOpen(false);

        if (data.buzzedTeamId && data.buzzedTeamName) {
          firstBuzzLockedRef.current = true;
          setBuzzedPlayer({
            teamId: data.buzzedTeamId,
            teamName: data.buzzedTeamName,
            timestamp: Date.now(),
          });
        } else {
          // Soft lock (question closed / no winner) → waiting state
          firstBuzzLockedRef.current = false;
          setBuzzedPlayer(null);
          setActiveQuestion(null);
        }
      })
      .on("broadcast", { event: "BUZZER_RESET" }, () => {
        firstBuzzLockedRef.current = false;
        setBuzzedPlayer(null);
        setBuzzersOpen(true);
      })
      .on("broadcast", { event: "PLAYER_BUZZED" }, ({ payload }) => {
        const data = payload as PlayerBuzzedPayload;

        // Host-only concurrency gate: first buzz wins; players wait for BUZZERS_LOCKED
        if (role !== "host") return;
        if (firstBuzzLockedRef.current) return;

        firstBuzzLockedRef.current = true;
        setBuzzedPlayer(data);
        setBuzzersOpen(false);
        playBuzzerSound();
        sendBroadcast(channel, "BUZZERS_LOCKED", {
          buzzedTeamId: data.teamId,
          buzzedTeamName: data.teamName,
        });
      })
      .on("broadcast", { event: "PLAYER_JOINED" }, () => {
        if (role === "host") {
          syncSession();
        }
      })
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);
        if (connected && role === "host") {
          syncSession();
        }
        if (connected && role === "player") {
          sendBroadcast(channel, "PLAYER_JOINED", {
            playerId: playerIdRef.current,
          });
        }
      });

    return () => {
      setIsConnected(false);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [enabled, roomCode, isConfigured, role, syncSession]);

  let playerUiState: PlayerBuzzerUiState = "waiting";
  if (role === "player") {
    if (buzzedPlayer) {
      playerUiState =
        playerTeamId && buzzedPlayer.teamId === playerTeamId
          ? "you_buzzed"
          : "locked_out";
    } else if (buzzersOpen && activeQuestion) {
      playerUiState = "ready";
    } else {
      playerUiState = "waiting";
    }
  }

  return {
    isConfigured,
    isConnected,
    buzzedPlayer,
    buzzersOpen,
    activeQuestion,
    sessionTeams,
    playerUiState,
    broadcastQuestionOpened,
    resetBuzzers,
    lockBuzzers: () => lockBuzzers(null),
    syncSession,
    sendBuzz,
  };
}
