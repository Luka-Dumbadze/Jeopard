"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { QRCodeSVG } from "qrcode.react";
import GameBoard from "@/components/board/GameBoard";
import { HostBuzzerProvider, useHostBuzzer } from "@/components/buzzer/HostBuzzerProvider";
import QuestionModal from "@/components/modal/QuestionModal";
import WinnerModal from "@/components/modal/WinnerModal";
import { RoomProvider } from "@/components/room/RoomProvider";
import Scoreboard from "@/components/scoreboard/Scoreboard";
import { useHydration } from "@/hooks/useHydration";
import { isBoardComplete } from "@/lib/board";
import { fetchTournamentSession } from "@/lib/supabase/tournaments";
import { useTournamentStore } from "@/store/tournamentStore";
import {
  buildBuzzHref,
  isTournamentId,
} from "@/types/cloudTournament";
import {
  getRoomTeams,
  isRoomId,
  type RoomId,
} from "@/types/tournament";

function RoomViewInner({ roomId }: { roomId: RoomId }) {
  const hydrated = useHydration();
  const searchParams = useSearchParams();
  const tournamentParam = searchParams.get("t");

  const gameData = useTournamentStore((state) => state.gameData);
  const isTournamentActive = useTournamentStore(
    (state) => state.isTournamentActive
  );
  const tournamentId = useTournamentStore((state) => state.tournamentId);
  const room = useTournamentStore((state) => state.rooms[roomId]);
  const teams = useTournamentStore((state) => state.teams);
  const openWinnerModal = useTournamentStore((state) => state.openWinnerModal);
  const hydrateFromCloud = useTournamentStore((state) => state.hydrateFromCloud);
  const { isConfigured, isConnected } = useHostBuzzer();

  const [origin, setOrigin] = useState("");
  const [showQr, setShowQr] = useState(true);
  const [cloudStatus, setCloudStatus] = useState<
    "idle" | "loading" | "error" | "ready"
  >("idle");
  const [cloudError, setCloudError] = useState<string | null>(null);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  // Remote laptop hydration: empty/mismatched local store → fetch from Supabase
  useEffect(() => {
    if (!hydrated) return;

    const localReady =
      isTournamentActive &&
      Boolean(gameData) &&
      (!tournamentParam || tournamentId === tournamentParam);

    if (localReady) {
      setCloudStatus("ready");
      return;
    }

    if (!isTournamentId(tournamentParam)) {
      setCloudStatus("ready");
      return;
    }

    let cancelled = false;
    setCloudStatus("loading");
    setCloudError(null);

    void (async () => {
      const session = await fetchTournamentSession(tournamentParam!);
      if (cancelled) return;

      if (!session) {
        setCloudStatus("error");
        setCloudError(
          "Could not load tournament from cloud. Check the link or Supabase config."
        );
        return;
      }

      hydrateFromCloud(session);
      setCloudStatus("ready");
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    tournamentParam,
    tournamentId,
    isTournamentActive,
    gameData,
    hydrateFromCloud,
  ]);

  useEffect(() => {
    if (!hydrated || !gameData || !isTournamentActive) return;
    if (room.celebrationPlayed) return;
    if (isBoardComplete(gameData, room.usedTiles)) {
      openWinnerModal(roomId);
    }
  }, [
    hydrated,
    gameData,
    isTournamentActive,
    room.celebrationPlayed,
    room.usedTiles,
    openWinnerModal,
    roomId,
  ]);

  const roomTeams = useMemo(() => getRoomTeams(room, teams), [room, teams]);
  const effectiveTournamentId =
    (tournamentId && isTournamentId(tournamentId) ? tournamentId : null) ??
    (isTournamentId(tournamentParam) ? tournamentParam!.trim() : null);

  // QR must always include both room + tournament when available
  const buzzUrl =
    origin && effectiveTournamentId
      ? `${origin}${buildBuzzHref(roomId, effectiveTournamentId)}`
      : origin
        ? `${origin}/buzz?room=${encodeURIComponent(roomId)}`
        : "";

  if (!hydrated || cloudStatus === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark">
        <p className="text-jeopardy-gold">
          {cloudStatus === "loading"
            ? "Loading tournament from cloud..."
            : "Loading room..."}
        </p>
      </main>
    );
  }

  if (cloudStatus === "error") {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-jeopardy-blue-dark px-6 text-center">
        <p className="text-xl text-jeopardy-gold">{cloudError}</p>
        <Link
          href="/"
          className="rounded-lg bg-jeopardy-gold px-6 py-3 font-bold text-jeopardy-blue-dark"
        >
          Master Dashboard
        </Link>
      </main>
    );
  }

  if (!gameData || !isTournamentActive) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-jeopardy-blue-dark px-6 text-center">
        <p className="text-xl text-jeopardy-gold">
          ტურნირი ჯერ არ შექმნილა / Tournament not created
        </p>
        <p className="max-w-md text-sm text-white/60">
          Open a room link with{" "}
          <code className="text-jeopardy-gold">?t=TOURNAMENT-…</code> from the
          master dashboard, or create a tournament on this device.
        </p>
        <Link
          href="/"
          className="rounded-lg bg-jeopardy-gold px-6 py-3 font-bold text-jeopardy-blue-dark"
        >
          Master Dashboard
        </Link>
      </main>
    );
  }

  const [teamA, teamB] = roomTeams;

  return (
    <main className="flex min-h-screen flex-col bg-jeopardy-blue-dark lg:flex-row">
      <Scoreboard />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-jeopardy-gold/20 px-4 py-3 md:px-6">
          <div>
            <p className="text-sm font-bold text-jeopardy-gold md:text-base">
              ოთახი {room.number}: {teamA.colorEmoji} {teamA.name} vs{" "}
              {teamB.colorEmoji} {teamB.name}
            </p>
            <h1 className="text-lg font-bold text-white md:text-2xl">
              {gameData.title}
            </h1>
            {tournamentId && (
              <p className="font-mono text-[10px] text-white/40">{tournamentId}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isConfigured && isConnected
                  ? "bg-green-900/60 text-green-200"
                  : "bg-white/10 text-white/60"
              }`}
            >
              Buzzers:{" "}
              {isConfigured && isConnected
                ? "LIVE"
                : isConfigured
                  ? "…"
                  : "OFFLINE"}
            </span>
            <button
              type="button"
              onClick={() => setShowQr((value) => !value)}
              className="rounded-lg border border-jeopardy-gold/30 px-3 py-1.5 text-xs font-bold text-jeopardy-gold"
            >
              {showQr ? "Hide QR" : "Show QR"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-jeopardy-gold/30 px-3 py-1.5 text-xs font-bold text-jeopardy-gold"
            >
              Dashboard
            </Link>
          </div>
        </header>

        <div className="flex flex-1 flex-col gap-4 overflow-auto p-3 md:flex-row md:p-6">
          <div className="flex flex-1 items-center justify-center">
            <GameBoard gameData={gameData} />
          </div>

          {showQr && buzzUrl && (
            <div className="mx-auto w-full max-w-[200px] shrink-0 rounded-xl bg-white p-3 text-center md:mx-0">
              <QRCodeSVG value={buzzUrl} size={176} level="M" />
              <p className="mt-2 text-xs font-bold text-jeopardy-blue-dark">
                {roomId}
              </p>
              <p className="text-[10px] text-black/50">Scan to buzz</p>
            </div>
          )}
        </div>
      </div>

      <QuestionModal />
      <WinnerModal />
    </main>
  );
}

export default function RoomPageClient({ roomIdParam }: { roomIdParam: string }) {
  if (!isRoomId(roomIdParam)) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-jeopardy-blue-dark px-6 text-center">
        <p className="text-xl text-jeopardy-gold">Invalid room: {roomIdParam}</p>
        <p className="text-sm text-white/60">Use ROOM-1, ROOM-2, ROOM-3, or ROOM-4</p>
        <Link href="/" className="text-jeopardy-gold underline">
          Back to dashboard
        </Link>
      </main>
    );
  }

  return (
    <RoomProvider roomId={roomIdParam}>
      <HostBuzzerProvider>
        <RoomViewInner roomId={roomIdParam} />
      </HostBuzzerProvider>
    </RoomProvider>
  );
}
