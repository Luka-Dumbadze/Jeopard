"use client";

import { motion } from "framer-motion";
import { playTileOpenSound } from "@/lib/audio";
import type { Question } from "@/types/game";
import { getTileKey } from "@/types/game";
import { useGameStore } from "@/store/gameStore";

interface GameTileProps {
  question: Question;
  categoryIndex: number;
  questionIndex: number;
}

export default function GameTile({
  question,
  categoryIndex,
  questionIndex,
}: GameTileProps) {
  const tileKey = getTileKey(categoryIndex, questionIndex);
  const isUsed = useGameStore((state) => state.usedTiles.has(tileKey));
  const openQuestion = useGameStore((state) => state.openQuestion);

  const handleClick = () => {
    if (isUsed) return;

    playTileOpenSound();
    openQuestion({
      categoryIndex,
      questionIndex,
      question,
    });
  };

  return (
    <motion.button
      type="button"
      disabled={isUsed}
      onClick={handleClick}
      whileHover={isUsed ? undefined : { scale: 1.03 }}
      whileTap={isUsed ? undefined : { scale: 0.97 }}
      className={`tile-shimmer flex aspect-[4/3] w-full items-center justify-center rounded-sm border-2 text-2xl font-bold transition-all duration-200 md:text-3xl lg:text-4xl xl:text-5xl ${
        isUsed
          ? "cursor-not-allowed border-transparent bg-jeopardy-blue-dark/80 text-transparent"
          : "cursor-pointer border-jeopardy-gold/20 bg-jeopardy-blue text-jeopardy-gold hover:border-jeopardy-gold/50 hover:shadow-[0_0_20px_rgba(255,215,0,0.15)]"
      }`}
      aria-label={
        isUsed
          ? `Question worth $${question.value} already played`
          : `Select question worth $${question.value}`
      }
    >
      {!isUsed && `$${question.value.toLocaleString()}`}
    </motion.button>
  );
}
