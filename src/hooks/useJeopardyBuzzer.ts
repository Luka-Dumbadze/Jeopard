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
  RoomStateSyncPayload,
  SessionSyncPayload,
} from "@/types/buzzer";
import type { Team } from "@/types/game";

export type BuzzerRole = "host" | "player";

export type PlayerBuzzerUiState =
  | "waiting"
  | "ready"
  | "you_buzzed"
  | "locked_out";

export interface HostRoomSnapshot {
  sessionId: string;
  teams: Team[];
  gameTitle: string | null;
  activeQuestion: QuestionOpenedPayload | null;
  buzzersOpen: boolean;
  buzzedPlayer: PlayerBuzzedPayload | null;
}

interface UseJeopardyBuzzerOptions {
  role: BuzzerRole;
  roomCode: string;
  /** Scopes buzzer channel per cloud tournament when present */
  tournamentId?: string | null;
  /** Host: current teams for SESSION_SYNC */
  teams?: Team[];
  gameTitle?: string | null;
  sessionId?: string;
  enabled?: boolean;
  /** Host: live source-of-truth snapshot for reconnect hydration */
  getHostSnapshot?: () => HostRoomSnapshot | null;
  /** Player identity after team selection */
  playerTeamId?: string | null;
  playerTeamName?: string | null;
}

interface UseJeopardyBuzzerResult {
  isConfigured: boolean;
  isConnected: boolean;
  sessionId: string | null;
  buzzedPlayer: PlayerBuzzedPayload | null;
  buzzersOpen: boolean;
  activeQuestion: QuestionOpenedPayload | null;
  sessionTeams: Team[];
  playerUiState: PlayerBuzzerUiState;
  broadcastQuestionOpened: (payload: QuestionOpenedPayload) => void;
  resetBuzzers: () => void;
  lockBuzzers: () => void;
  syncSession: () => void;
  resyncFromSourceOfTruth: () => void;
  sendBuzz: () => boolean;
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
    tournamentId = null,
    teams = [],
    gameTitle = null,
    sessionId: sessionIdProp = "",
    enabled = true,
    getHostSnapshot,
    playerTeamId = null,
    playerTeamName = null,
  } = options;

  const isConfigured = isSupabaseConfigured();
  const [isConnected, setIsConnected] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(
    sessionIdProp || null
  );
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
  const sessionIdRef = useRef(sessionIdProp);
  const getHostSnapshotRef = useRef(getHostSnapshot);
  const buzzedPlayerRef = useRef<PlayerBuzzedPayload | null>(null);
  const activeQuestionRef = useRef<QuestionOpenedPayload | null>(null);
  const buzzersOpenRef = useRef(false);
  const playerIdRef = useRef(
    typeof crypto !== "undefined" ? crypto.randomUUID() : `player-${Date.now()}`
  );

  teamsRef.current = teams;
  gameTitleRef.current = gameTitle;
  sessionIdRef.current = sessionIdProp || sessionId || "";
  getHostSnapshotRef.current = getHostSnapshot;
  buzzedPlayerRef.current = buzzedPlayer;
  activeQuestionRef.current = activeQuestion;
  buzzersOpenRef.current = buzzersOpen;

  const applyRoomState = useCallback((data: RoomStateSyncPayload) => {
    setSessionId(data.sessionId);
    setSessionTeams(data.teams ?? []);
    setActiveQuestion(data.activeQuestion);
    setBuzzersOpen(Boolean(data.buzzersOpen));
    setBuzzedPlayer(data.buzzedPlayer);
    firstBuzzLockedRef.current = Boolean(data.buzzedPlayer);
  }, []);

  const buildHostSnapshotPayload = useCallback((): RoomStateSyncPayload => {
    const snapshot = getHostSnapshotRef.current?.();
    const baseTeams = snapshot?.teams ?? teamsRef.current;
    const baseTitle = snapshot?.gameTitle ?? gameTitleRef.current;
    const baseSession = snapshot?.sessionId ?? sessionIdRef.current;

    // Prefer live hook buzz/question state (authoritative during an open tile)
    return {
      sessionId: baseSession,
      roomCode,
      gameTitle: baseTitle,
      teams: baseTeams,
      activeQuestion:
        activeQuestionRef.current ?? snapshot?.activeQuestion ?? null,
      buzzersOpen: buzzedPlayerRef.current
        ? false
        : (buzzersOpenRef.current || Boolean(snapshot?.buzzersOpen)),
      buzzedPlayer: buzzedPlayerRef.current ?? snapshot?.buzzedPlayer ?? null,
    };
  }, [roomCode]);

  const resyncFromSourceOfTruth = useCallback(() => {
    if (role === "host") {
      const payload = buildHostSnapshotPayload();
      sendBroadcast(channelRef.current, "ROOM_STATE_SYNC", payload);
      sendBroadcast(channelRef.current, "SESSION_SYNC", {
        sessionId: payload.sessionId,
        roomCode: payload.roomCode,
        gameTitle: payload.gameTitle,
        teams: payload.teams,
      });
      return;
    }

    // Player asks host for authoritative snapshot after reconnect
    sendBroadcast(channelRef.current, "STATE_REFETCH_REQUEST", {
      playerId: playerIdRef.current,
    });
  }, [role, buildHostSnapshotPayload]);

  const syncSession = useCallback(() => {
    if (role !== "host") return;
    const payload: SessionSyncPayload = {
      sessionId: sessionIdRef.current,
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
      resyncFromSourceOfTruth();
    },
    [syncSession, resyncFromSourceOfTruth]
  );

  const sendBuzz = useCallback((): boolean => {
    if (role !== "player") return false;
    if (!buzzersOpen || firstBuzzLockedRef.current) return false;
    if (!playerTeamId || !playerTeamName) return false;

    const payload: PlayerBuzzedPayload = {
      teamId: playerTeamId,
      teamName: playerTeamName,
      timestamp: Date.now(),
    };

    sendBroadcast(channelRef.current, "PLAYER_BUZZED", payload);
    return true;
  }, [role, buzzersOpen, playerTeamId, playerTeamName]);

  useEffect(() => {
    if (role === "host") {
      setSessionTeams(teams);
      if (sessionIdProp) setSessionId(sessionIdProp);
    }
  }, [role, teams, sessionIdProp]);

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

    const channelName = getBuzzerChannelName(roomCode, tournamentId);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "SESSION_SYNC" }, ({ payload }) => {
        const data = payload as SessionSyncPayload;
        setSessionId(data.sessionId ?? null);
        setSessionTeams(data.teams ?? []);
      })
      .on("broadcast", { event: "ROOM_STATE_SYNC" }, ({ payload }) => {
        applyRoomState(payload as RoomStateSyncPayload);
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
          resyncFromSourceOfTruth();
        }
      })
      .on("broadcast", { event: "STATE_REFETCH_REQUEST" }, () => {
        if (role === "host") {
          resyncFromSourceOfTruth();
        }
      })
      .subscribe((status) => {
        const connected = status === "SUBSCRIBED";
        setIsConnected(connected);

        // Reconnect / first subscribe: always push or request source-of-truth
        if (connected) {
          if (role === "host") {
            resyncFromSourceOfTruth();
          } else {
            sendBroadcast(channel, "PLAYER_JOINED", {
              playerId: playerIdRef.current,
            });
            sendBroadcast(channel, "STATE_REFETCH_REQUEST", {
              playerId: playerIdRef.current,
            });
          }
        }
      });

    return () => {
      setIsConnected(false);
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [
    enabled,
    roomCode,
    tournamentId,
    isConfigured,
    role,
    syncSession,
    resyncFromSourceOfTruth,
    applyRoomState,
  ]);

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
    sessionId,
    buzzedPlayer,
    buzzersOpen,
    activeQuestion,
    sessionTeams,
    playerUiState,
    broadcastQuestionOpened,
    resetBuzzers,
    lockBuzzers: () => lockBuzzers(null),
    syncSession,
    resyncFromSourceOfTruth,
    sendBuzz,
  };
}
