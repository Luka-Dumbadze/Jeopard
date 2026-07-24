"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import { playVictoryFanfare } from "@/lib/audio";
import { getWinningTeams } from "@/lib/board";
import { useGameStore } from "@/store/gameStore";

export default function WinnerModal() {
  const router = useRouter();
  const isOpen = useGameStore((state) => state.isWinnerModalOpen);
  const teams = useGameStore((state) => state.teams);
  const closeWinnerModal = useGameStore((state) => state.closeWinnerModal);
  const resetGame = useGameStore((state) => state.resetGame);
  const hasCelebrated = useRef(false);

  const winners = getWinningTeams(teams);
  const isTie = winners.length > 1;

  useEffect(() => {
    if (!isOpen) {
      hasCelebrated.current = false;
      return;
    }

    if (hasCelebrated.current) return;
    hasCelebrated.current = true;

    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 },
      colors: ["#FFD700", "#060CE9", "#FFFFFF", "#FFA500"],
    });

    const burst = window.setTimeout(() => {
      confetti({
        particleCount: 80,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#FFD700", "#060CE9"],
      });
      confetti({
        particleCount: 80,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#FFD700", "#FFFFFF"],
      });
    }, 250);

    playVictoryFanfare();

    return () => window.clearTimeout(burst);
  }, [isOpen]);

  const handleNewGame = () => {
    closeWinnerModal();
    resetGame();
    router.push("/");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="winner-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-6"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 40 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 20 }}
            className="w-full max-w-xl rounded-3xl bg-gradient-to-b from-jeopardy-blue to-jeopardy-blue-dark p-8 text-center shadow-2xl ring-2 ring-jeopardy-gold/50 md:p-12"
          >
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
              className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-jeopardy-gold/15"
              aria-hidden
            >
              <svg
                viewBox="0 0 64 64"
                className="h-14 w-14 text-jeopardy-gold"
                fill="currentColor"
              >
                <path d="M18 8h28v6c0 7.7-6.3 14-14 14S18 21.7 18 14V8z" />
                <path d="M14 10h-4c0 8 4.5 12.5 10 14.5A15.9 15.9 0 0114 14v-4zM50 10h4c0 8-4.5 12.5-10 14.5A15.9 15.9 0 0050 14v-4z" />
                <rect x="28" y="28" width="8" height="14" rx="1" />
                <path d="M22 46h20l-2 8H24l-2-8z" />
                <rect x="18" y="54" width="28" height="4" rx="2" />
              </svg>
            </motion.div>

            <p className="text-sm font-bold uppercase tracking-[0.3em] text-jeopardy-gold/80">
              Board Complete
            </p>

            <h2 className="mt-3 text-3xl font-bold text-jeopardy-gold md:text-4xl">
              {isTie ? "It's a Tie!" : "Winner!"}
            </h2>

            <div className="mt-8 space-y-4">
              {winners.map((team) => (
                <div
                  key={team.id}
                  className="rounded-2xl bg-black/30 px-6 py-5 ring-1 ring-jeopardy-gold/30"
                >
                  <p className="text-2xl font-bold text-white md:text-3xl">
                    {team.name}
                  </p>
                  <p className="mt-2 text-4xl font-bold tabular-nums text-jeopardy-gold md:text-5xl">
                    ${team.score.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {!isTie && winners[0] && (
              <p className="mt-6 text-white/70">
                Congratulations to{" "}
                <span className="font-bold text-jeopardy-gold">
                  {winners[0].name}
                </span>
                !
              </p>
            )}

            <button
              type="button"
              onClick={handleNewGame}
              className="mt-10 rounded-xl bg-jeopardy-gold px-10 py-4 text-lg font-bold text-jeopardy-blue-dark transition hover:bg-yellow-300 active:scale-95"
            >
              Start New Game
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
