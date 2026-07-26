"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { playBuzzerSound } from "@/lib/audio";
import {
  getRoomChannelName,
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

type PendingBroadcast = {
  event: BuzzerEventType;
  payload: BuzzerPayloadMap[BuzzerEventType];
};

function flushBroadcast(
  channel: RealtimeChannel,
  event: BuzzerEventType,
  payload: BuzzerPayloadMap[BuzzerEventType]
): void {
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
  const isSubscribedRef = useRef(false);
  const pendingBroadcastsRef = useRef<PendingBroadcast[]>([]);
  const firstBuzzLockedRef = useRef(false);
  const teamsRef = useRef(teams);
  const gameTitleRef = useRef(gameTitle);
  const sessionIdRef = useRef(sessionIdProp);
  const tournamentIdRef = useRef(tournamentId);
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
  tournamentIdRef.current = tournamentId;
  getHostSnapshotRef.current = getHostSnapshot;
  buzzedPlayerRef.current = buzzedPlayer;
  activeQuestionRef.current = activeQuestion;
  buzzersOpenRef.current = buzzersOpen;

  const sendBroadcast = useCallback(
    <T extends BuzzerEventType>(
      event: T,
      payload: BuzzerPayloadMap[T]
    ): void => {
      const channel = channelRef.current;
      if (!channel || !isSubscribedRef.current) {
        pendingBroadcastsRef.current.push({ event, payload });
        return;
      }
      flushBroadcast(channel, event, payload);
    },
    []
  );

  const flushPendingBroadcasts = useCallback(() => {
    const channel = channelRef.current;
    if (!channel || !isSubscribedRef.current) return;
    const pending = pendingBroadcastsRef.current;
    pendingBroadcastsRef.current = [];
    for (const item of pending) {
      flushBroadcast(channel, item.event, item.payload);
    }
  }, []);

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

    return {
      sessionId: baseSession,
      roomCode,
      gameTitle: baseTitle,
      teams: baseTeams,
      activeQuestion:
        activeQuestionRef.current ?? snapshot?.activeQuestion ?? null,
      buzzersOpen: buzzedPlayerRef.current
        ? false
        : buzzersOpenRef.current || Boolean(snapshot?.buzzersOpen),
      buzzedPlayer: buzzedPlayerRef.current ?? snapshot?.buzzedPlayer ?? null,
    };
  }, [roomCode]);

  const resyncFromSourceOfTruth = useCallback(() => {
    if (role === "host") {
      const payload = buildHostSnapshotPayload();
      sendBroadcast("ROOM_STATE_SYNC", payload);
      sendBroadcast("SESSION_SYNC", {
        sessionId: payload.sessionId,
        roomCode: payload.roomCode,
        gameTitle: payload.gameTitle,
        teams: payload.teams,
      });
      return;
    }

    sendBroadcast("STATE_REFETCH_REQUEST", {
      playerId: playerIdRef.current,
    });
  }, [role, buildHostSnapshotPayload, sendBroadcast]);

  const syncSession = useCallback(() => {
    if (role !== "host") return;
    const payload: SessionSyncPayload = {
      sessionId: sessionIdRef.current,
      roomCode,
      gameTitle: gameTitleRef.current,
      teams: teamsRef.current,
    };
    sendBroadcast("SESSION_SYNC", payload);
  }, [role, roomCode, sendBroadcast]);

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
      sendBroadcast("BUZZERS_LOCKED", payload);
    },
    [sendBroadcast]
  );

  const unlockBuzzers = useCallback(() => {
    firstBuzzLockedRef.current = false;
    setBuzzedPlayer(null);
    setBuzzersOpen(true);
    sendBroadcast("BUZZERS_UNLOCKED", {});
  }, [sendBroadcast]);

  const resetBuzzers = useCallback(() => {
    unlockBuzzers();
    sendBroadcast("BUZZER_RESET", {});
    // Re-assert open question state so late joiners / missed events recover
    if (activeQuestionRef.current) {
      sendBroadcast("QUESTION_OPENED", {
        ...activeQuestionRef.current,
        isBuzzerLocked: false,
      });
      sendBroadcast("BUZZERS_UNLOCKED", {});
    }
    resyncFromSourceOfTruth();
  }, [unlockBuzzers, sendBroadcast, resyncFromSourceOfTruth]);

  const broadcastQuestionOpened = useCallback(
    (payload: QuestionOpenedPayload) => {
      const enriched: QuestionOpenedPayload = {
        ...payload,
        roomId: payload.roomId ?? roomCode,
        tournamentId: payload.tournamentId ?? tournamentIdRef.current,
        isBuzzerLocked: false,
      };
      firstBuzzLockedRef.current = false;
      setBuzzedPlayer(null);
      setActiveQuestion(enriched);
      setBuzzersOpen(true);
      sendBroadcast("QUESTION_OPENED", enriched);
      sendBroadcast("BUZZERS_UNLOCKED", {});
      syncSession();
      resyncFromSourceOfTruth();
    },
    [roomCode, sendBroadcast, syncSession, resyncFromSourceOfTruth]
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

    sendBroadcast("PLAYER_BUZZED", payload);
    return true;
  }, [role, buzzersOpen, playerTeamId, playerTeamName, sendBroadcast]);

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
      isSubscribedRef.current = false;
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setIsConnected(false);
      isSubscribedRef.current = false;
      return;
    }

    const channelName = getRoomChannelName(roomCode, tournamentId);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: true } },
    });
    channelRef.current = channel;
    isSubscribedRef.current = false;

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
          setBuzzersOpen(data.isBuzzerLocked === true ? false : true);
        }
      })
      .on("broadcast", { event: "BUZZERS_UNLOCKED" }, () => {
        // Always clear lock — manual host unlock / new question must win
        firstBuzzLockedRef.current = false;
        setBuzzedPlayer(null);
        setBuzzersOpen(true);
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
        sendBroadcast("BUZZERS_LOCKED", {
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
        isSubscribedRef.current = connected;
        setIsConnected(connected);

        if (connected) {
          flushPendingBroadcasts();
          if (role === "host") {
            resyncFromSourceOfTruth();
          } else {
            sendBroadcast("PLAYER_JOINED", {
              playerId: playerIdRef.current,
            });
            sendBroadcast("STATE_REFETCH_REQUEST", {
              playerId: playerIdRef.current,
            });
          }
        }
      });

    return () => {
      setIsConnected(false);
      isSubscribedRef.current = false;
      channelRef.current = null;
      pendingBroadcastsRef.current = [];
      void supabase.removeChannel(channel);
    };
  }, [
    enabled,
    roomCode,
    tournamentId,
    isConfigured,
    role,
    sendBroadcast,
    flushPendingBroadcasts,
    resyncFromSourceOfTruth,
    applyRoomState,
  ]);

  // Host heartbeat: keep re-broadcasting unlock while a question is open
  // so late / flaky mobile connections still flip to READY.
  useEffect(() => {
    if (role !== "host") return;
    if (!activeQuestion || !buzzersOpen || buzzedPlayer) return;
    if (!isConnected) return;

    const tick = () => {
      if (firstBuzzLockedRef.current) return;
      sendBroadcast("BUZZERS_UNLOCKED", {});
    };

    tick();
    const intervalId = window.setInterval(tick, 1500);
    return () => window.clearInterval(intervalId);
  }, [
    role,
    activeQuestion,
    buzzersOpen,
    buzzedPlayer,
    isConnected,
    sendBroadcast,
  ]);

  let playerUiState: PlayerBuzzerUiState = "waiting";
  if (role === "player") {
    if (buzzedPlayer) {
      playerUiState =
        playerTeamId && buzzedPlayer.teamId === playerTeamId
          ? "you_buzzed"
          : "locked_out";
    } else if (buzzersOpen && playerTeamId) {
      // Joined + unlocked → READY (even if QUESTION_OPENED payload was thin)
      playerUiState = "ready";
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
