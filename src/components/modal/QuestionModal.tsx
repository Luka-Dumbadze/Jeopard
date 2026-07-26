"use client";

import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useHostBuzzer } from "@/components/buzzer/HostBuzzerProvider";
import { useRoomId } from "@/components/room/RoomProvider";
import { useActionLock } from "@/hooks/useActionLock";
import { playRevealSound, playScoreAwardSound } from "@/lib/audio";
import { useTournamentStore } from "@/store/tournamentStore";
import { getRoomTeams } from "@/types/tournament";

export default function QuestionModal() {
  const roomId = useRoomId();
  const room = useTournamentStore((state) => state.rooms[roomId]);
  const gameData = useTournamentStore((state) => state.gameData);
  const allTeams = useTournamentStore((state) => state.teams);
  const revealAnswer = useTournamentStore((state) => state.revealAnswer);
  const closeQuestion = useTournamentStore((state) => state.closeQuestion);
  const awardTileValue = useTournamentStore((state) => state.awardTileValue);
  const deductTileValue = useTournamentStore((state) => state.deductTileValue);

  const activeQuestion = room.activeQuestion;
  const isAnswerRevealed = room.isAnswerRevealed;
  const teams = getRoomTeams(room, allTeams);

  const {
    buzzedPlayer,
    broadcastQuestionOpened,
    resetBuzzers,
    lockBuzzers,
  } = useHostBuzzer();

  const { locked: scoreLocked, run: runScoreAction, unlock: unlockScore } =
    useActionLock(400);

  const categoryName = useMemo(() => {
    if (!activeQuestion || !gameData) return "";
    return (
      gameData.categories[activeQuestion.categoryIndex]?.name ?? "Category"
    );
  }, [activeQuestion, gameData]);

  const lastBroadcastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activeQuestion) {
      lastBroadcastKeyRef.current = null;
      lockBuzzers();
      unlockScore();
      return;
    }

    const key = `${activeQuestion.categoryIndex}-${activeQuestion.questionIndex}`;
    if (lastBroadcastKeyRef.current === key) return;
    lastBroadcastKeyRef.current = key;

    broadcastQuestionOpened({
      categoryIndex: activeQuestion.categoryIndex,
      questionIndex: activeQuestion.questionIndex,
      categoryName,
      value: activeQuestion.question.value,
      question: activeQuestion.question.question,
    });
  }, [
    activeQuestion,
    categoryName,
    broadcastQuestionOpened,
    lockBuzzers,
    unlockScore,
  ]);

  useEffect(() => {
    if (!activeQuestion) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTypingTarget =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if (isTypingTarget) return;

      if (event.key === "Escape") {
        event.preventDefault();
        closeQuestion(roomId);
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        if (!isAnswerRevealed) {
          event.preventDefault();
          playRevealSound();
          revealAnswer(roomId);
        }
        return;
      }

      if (event.key === "1" || event.key === "2") {
        const team = teams[Number(event.key) - 1];
        if (!team || scoreLocked) return;
        event.preventDefault();
        runScoreAction(() => {
          awardTileValue(roomId, team.id);
          playScoreAwardSound();
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeQuestion,
    isAnswerRevealed,
    teams,
    roomId,
    revealAnswer,
    closeQuestion,
    awardTileValue,
    scoreLocked,
    runScoreAction,
  ]);

  const handleReveal = () => {
    if (isAnswerRevealed) return;
    playRevealSound();
    revealAnswer(roomId);
  };

  const handleClose = () => {
    lockBuzzers();
    closeQuestion(roomId);
  };

  return (
    <AnimatePresence>
      {activeQuestion && (
        <motion.div
          key="question-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 md:p-6"
          onClick={handleReveal}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, rotateX: -8 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-jeopardy-blue shadow-2xl ring-2 ring-jeopardy-gold/30"
            onClick={(event) => event.stopPropagation()}
            style={{ perspective: "1000px" }}
          >
            <AnimatePresence>
              {buzzedPlayer && (
                <motion.div
                  key="buzz-banner"
                  initial={{ y: -40, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="bg-gradient-to-r from-amber-500 via-jeopardy-gold to-amber-400 px-4 py-3 text-center shadow-[0_0_30px_rgba(255,215,0,0.55)]"
                >
                  <p className="text-sm font-black uppercase tracking-wide text-jeopardy-blue-dark md:text-lg">
                    {buzzedPlayer.teamName.toUpperCase()} BUZZED IN FIRST!
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="border-b border-jeopardy-gold/30 bg-jeopardy-blue-dark px-6 py-4 text-center">
              <span className="text-3xl font-bold text-jeopardy-gold md:text-4xl">
                ${activeQuestion.question.value.toLocaleString()}
              </span>
            </div>

            <div className="flex flex-1 flex-col items-center justify-center gap-8 overflow-y-auto px-6 py-10 md:px-16">
              <motion.div layout className="w-full text-center">
                <p className="text-2xl font-bold leading-relaxed text-white md:text-4xl lg:text-5xl">
                  {activeQuestion.question.question}
                </p>
              </motion.div>

              <AnimatePresence mode="wait">
                {isAnswerRevealed ? (
                  <motion.div
                    key="answer"
                    initial={{ opacity: 0, y: 30, rotateX: 90 }}
                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                    className="w-full text-center"
                    style={{ transformOrigin: "top center" }}
                  >
                    <div className="mx-auto mb-4 h-px w-24 bg-jeopardy-gold/50" />
                    <p className="text-xl font-bold uppercase tracking-widest text-jeopardy-gold/70 md:text-2xl">
                      Answer
                    </p>
                    <p className="mt-4 text-2xl font-bold leading-relaxed text-jeopardy-gold md:text-4xl lg:text-5xl">
                      {activeQuestion.question.answer}
                    </p>
                  </motion.div>
                ) : (
                  <motion.button
                    key="reveal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    type="button"
                    onClick={handleReveal}
                    className="rounded-full border-2 border-jeopardy-gold/60 bg-jeopardy-gold/10 px-8 py-3 text-lg font-bold text-jeopardy-gold transition hover:bg-jeopardy-gold/25 active:scale-95"
                  >
                    Reveal Answer
                    <span className="ml-2 text-sm font-normal text-jeopardy-gold/60">
                      (Space / Enter)
                    </span>
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <div className="border-t border-jeopardy-gold/30 bg-jeopardy-blue-dark/90 px-4 py-4">
              <div className="mb-4 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={resetBuzzers}
                  className="rounded-lg border border-green-400/50 bg-green-900/50 px-4 py-2 text-sm font-bold text-green-100 transition hover:bg-green-800/70 active:scale-95"
                >
                  Reset / Unlock Buzzers
                </button>
              </div>

              <p className="mb-3 text-center text-xs font-bold uppercase tracking-widest text-jeopardy-gold/70">
                Award Score · Keys 1–2
              </p>
              <div className="mx-auto flex max-w-4xl flex-wrap items-stretch justify-center gap-3">
                {teams.map((team, index) => (
                  <div
                    key={team.id}
                    className={`flex min-w-[10rem] flex-1 flex-col gap-2 rounded-xl bg-black/30 p-3 ring-1 sm:max-w-[14rem] ${
                      buzzedPlayer?.teamId === team.id
                        ? "ring-jeopardy-gold shadow-[0_0_20px_rgba(255,215,0,0.35)]"
                        : "ring-jeopardy-gold/20"
                    }`}
                    style={{ boxShadow: `inset 4px 0 0 ${team.color}` }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-bold text-white">
                        <span className="mr-1.5 text-jeopardy-gold/50">
                          {index + 1}.
                        </span>
                        {team.colorEmoji} {team.name}
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-jeopardy-gold/80">
                        ${team.score.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={scoreLocked}
                        onClick={() =>
                          runScoreAction(() => {
                            awardTileValue(roomId, team.id);
                            playScoreAwardSound();
                          })
                        }
                        className="flex-1 rounded-lg bg-green-900/70 px-2 py-2 text-xs font-bold text-green-100 transition hover:bg-green-800 active:scale-95 disabled:opacity-50 sm:text-sm"
                      >
                        + ${activeQuestion.question.value.toLocaleString()}
                      </button>
                      <button
                        type="button"
                        disabled={scoreLocked}
                        onClick={() =>
                          runScoreAction(() => {
                            deductTileValue(roomId, team.id);
                          })
                        }
                        className="flex-1 rounded-lg bg-red-900/70 px-2 py-2 text-xs font-bold text-red-100 transition hover:bg-red-800 active:scale-95 disabled:opacity-50 sm:text-sm"
                      >
                        − ${activeQuestion.question.value.toLocaleString()}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-4 text-center">
                <button
                  type="button"
                  onClick={handleClose}
                  className="rounded-lg bg-jeopardy-gold px-10 py-3 text-lg font-bold text-jeopardy-blue-dark transition hover:bg-yellow-300 active:scale-95"
                >
                  Close
                  <span className="ml-2 text-sm font-normal opacity-70">
                    (Esc)
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
