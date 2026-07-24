"use client";

import { motion } from "framer-motion";
import type { GameData } from "@/types/game";
import CategoryColumn from "./CategoryColumn";

interface GameBoardProps {
  gameData: GameData;
}

export default function GameBoard({ gameData }: GameBoardProps) {
  const rowCount = Math.max(
    ...gameData.categories.map((category) => category.questions.length),
    1
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="mx-auto w-full max-w-[1600px]"
    >
      <div
        className="grid gap-2 md:gap-3"
        style={{
          gridTemplateColumns: `repeat(${gameData.categories.length}, minmax(0, 1fr))`,
        }}
      >
        {gameData.categories.map((category, categoryIndex) => (
          <CategoryColumn
            key={`${category.name}-${categoryIndex}`}
            category={category}
            categoryIndex={categoryIndex}
            rowCount={rowCount}
          />
        ))}
      </div>
    </motion.div>
  );
}
