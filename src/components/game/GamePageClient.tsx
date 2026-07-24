"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import GameBoard from "@/components/board/GameBoard";
import BuzzerQrModal from "@/components/buzzer/BuzzerQrModal";
import {
  HostBuzzerProvider,
  useHostBuzzer,
} from "@/components/buzzer/HostBuzzerProvider";
import QuestionModal from "@/components/modal/QuestionModal";
import WinnerModal from "@/components/modal/WinnerModal";
import Scoreboard from "@/components/scoreboard/Scoreboard";
import { isBoardComplete } from "@/lib/board";
import { useGameStore } from "@/store/gameStore";

function GamePageInner() {
  const router = useRouter();
  const hasHydrated = useGameStore((state) => state.hasHydrated);
  const gameData = useGameStore((state) => state.gameData);
  const usedTiles = useGameStore((state) => state.usedTiles);
  const celebrationPlayed = useGameStore((state) => state.celebrationPlayed);
  const roomCode = useGameStore((state) => state.roomCode);
  const resetGame = useGameStore((state) => state.resetGame);
  const setHasHydrated = useGameStore((state) => state.setHasHydrated);
  const openWinnerModal = useGameStore((state) => state.openWinnerModal);

  const { isConfigured, isConnected } = useHostBuzzer();
  const [showQr, setShowQr] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const buzzUrl = useMemo(
    () => (origin ? `${origin}/buzz?room=${encodeURIComponent(roomCode)}` : ""),
    [origin, roomCode]
  );

  useEffect(() => {
    const finish = () => setHasHydrated(true);

    if (useGameStore.persist.hasHydrated()) {
      finish();
      return;
    }

    return useGameStore.persist.onFinishHydration(finish);
  }, [setHasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    if (!gameData) {
      router.replace("/");
    }
  }, [hasHydrated, gameData, router]);

  useEffect(() => {
    if (!hasHydrated || !gameData || celebrationPlayed) return;
    if (isBoardComplete(gameData, usedTiles)) {
      openWinnerModal();
    }
  }, [
    hasHydrated,
    gameData,
    usedTiles,
    celebrationPlayed,
    openWinnerModal,
  ]);

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark">
        <p className="text-jeopardy-gold">Loading game...</p>
      </main>
    );
  }

  if (!gameData) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark">
        <p className="text-jeopardy-gold">Redirecting...</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-jeopardy-blue-dark lg:flex-row">
      <Scoreboard />

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-jeopardy-gold/20 px-4 py-3 md:px-8">
          <div>
            <h1 className="text-xl font-bold text-jeopardy-gold md:text-2xl lg:text-3xl">
              {gameData.title}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className={`rounded-full px-3 py-1.5 text-xs font-bold uppercase tracking-wide transition md:text-sm ${
                isConfigured && isConnected
                  ? "bg-green-900/60 text-green-200 ring-1 ring-green-400/40"
                  : isConfigured
                    ? "bg-yellow-900/50 text-yellow-200 ring-1 ring-yellow-400/40"
                    : "bg-white/10 text-white/60 ring-1 ring-white/20"
              }`}
              aria-label="Open mobile buzzer QR code"
            >
              {isConfigured && isConnected
                ? "Mobile Buzzers: LIVE"
                : isConfigured
                  ? "Mobile Buzzers: CONNECTING"
                  : "Mobile Buzzers: OFFLINE"}
            </button>
            <Link
              href="/"
              className="rounded-lg border border-jeopardy-gold/30 px-4 py-2 text-sm font-bold text-jeopardy-gold transition hover:bg-jeopardy-gold/10"
            >
              New Game
            </Link>
            <button
              type="button"
              onClick={() => {
                resetGame();
                router.push("/");
              }}
              className="rounded-lg bg-red-900/50 px-4 py-2 text-sm font-bold text-red-200 transition hover:bg-red-800/60"
            >
              Reset
            </button>
          </div>
        </header>

        <div className="flex flex-1 items-center justify-center overflow-auto p-3 md:p-6 lg:p-8">
          <GameBoard gameData={gameData} />
        </div>
      </div>

      <QuestionModal />
      <WinnerModal />
      <BuzzerQrModal
        open={showQr}
        onClose={() => setShowQr(false)}
        roomCode={roomCode}
        buzzUrl={buzzUrl}
        isConnected={isConnected}
        isConfigured={isConfigured}
      />
    </main>
  );
}

export default function GamePageClient() {
  return (
    <HostBuzzerProvider>
      <GamePageInner />
    </HostBuzzerProvider>
  );
}
