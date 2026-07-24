"use client";

import { motion } from "framer-motion";
import type { Category } from "@/types/game";
import GameTile from "./GameTile";

interface CategoryColumnProps {
  category: Category;
  categoryIndex: number;
  rowCount: number;
}

export default function CategoryColumn({
  category,
  categoryIndex,
  rowCount,
}: CategoryColumnProps) {
  const paddedQuestions = Array.from({ length: rowCount }, (_, index) =>
    category.questions[index] ?? null
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: categoryIndex * 0.08 }}
        className="flex min-h-[4.5rem] items-center justify-center rounded-sm border-2 border-jeopardy-gold/30 bg-jeopardy-blue px-2 py-3 text-center md:min-h-[5.5rem]"
      >
        <h3 className="text-xs font-bold uppercase leading-tight tracking-wide text-jeopardy-gold md:text-sm lg:text-base">
          {category.name}
        </h3>
      </motion.div>

      {paddedQuestions.map((question, questionIndex) =>
        question ? (
          <GameTile
            key={`${categoryIndex}-${questionIndex}`}
            question={question}
            categoryIndex={categoryIndex}
            questionIndex={questionIndex}
          />
        ) : (
          <div
            key={`empty-${categoryIndex}-${questionIndex}`}
            className="aspect-[4/3] w-full rounded-sm bg-jeopardy-blue-dark/40"
            aria-hidden
          />
        )
      )}
    </div>
  );
}
