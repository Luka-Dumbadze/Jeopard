"use client";

import { motion } from "framer-motion";
import { useGameStore } from "@/store/gameStore";

export default function Scoreboard() {
  const teams = useGameStore((state) => state.teams);
  const addTeam = useGameStore((state) => state.addTeam);
  const removeTeam = useGameStore((state) => state.removeTeam);
  const updateTeamName = useGameStore((state) => state.updateTeamName);
  const incrementScore = useGameStore((state) => state.incrementScore);
  const decrementScore = useGameStore((state) => state.decrementScore);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-jeopardy-gold/20 bg-black/30 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-jeopardy-gold/20 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-jeopardy-gold">
          Scoreboard
        </h2>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {teams.map((team, index) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-xl bg-jeopardy-blue/60 p-3 ring-1 ring-jeopardy-gold/20"
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                value={team.name}
                onChange={(event) => updateTeamName(team.id, event.target.value)}
                className="min-w-0 flex-1 rounded bg-black/30 px-2 py-1 text-sm font-bold text-white outline-none ring-1 ring-transparent focus:ring-jeopardy-gold/50"
              />
              {teams.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeTeam(team.id)}
                  className="rounded px-2 py-1 text-xs text-white/50 transition hover:bg-red-900/50 hover:text-red-200"
                  aria-label={`Remove ${team.name}`}
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => decrementScore(team.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-red-900/60 text-xl font-bold text-red-200 transition hover:bg-red-800 active:scale-95"
                aria-label={`Decrease ${team.name} score`}
              >
                −
              </button>

              <span
                className={`min-w-[5rem] text-center text-2xl font-bold tabular-nums ${
                  team.score >= 0 ? "text-jeopardy-gold" : "text-red-400"
                }`}
              >
                ${team.score.toLocaleString()}
              </span>

              <button
                type="button"
                onClick={() => incrementScore(team.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-900/60 text-xl font-bold text-green-200 transition hover:bg-green-800 active:scale-95"
                aria-label={`Increase ${team.name} score`}
              >
                +
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="border-t border-jeopardy-gold/20 p-4">
        <button
          type="button"
          onClick={addTeam}
          className="w-full rounded-lg border border-jeopardy-gold/40 bg-jeopardy-gold/10 py-2.5 text-sm font-bold text-jeopardy-gold transition hover:bg-jeopardy-gold/20 active:scale-[0.98]"
        >
          + Add Team
        </button>
      </div>
    </aside>
  );
}
