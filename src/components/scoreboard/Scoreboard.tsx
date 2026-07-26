"use client";

import { motion } from "framer-motion";
import { useRoomId } from "@/components/room/RoomProvider";
import { useTournamentStore } from "@/store/tournamentStore";
import { getRoomTeams } from "@/types/tournament";

export default function Scoreboard() {
  const roomId = useRoomId();
  const room = useTournamentStore((state) => state.rooms[roomId]);
  const teams = useTournamentStore((state) => state.teams);
  const incrementScore = useTournamentStore((state) => state.incrementScore);
  const decrementScore = useTournamentStore((state) => state.decrementScore);
  const updateTeamName = useTournamentStore((state) => state.updateTeamName);

  const roomTeams = getRoomTeams(room, teams);

  return (
    <aside className="flex w-full shrink-0 flex-col border-b border-jeopardy-gold/20 bg-black/30 lg:w-72 lg:border-b-0 lg:border-r">
      <div className="border-b border-jeopardy-gold/20 px-4 py-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-jeopardy-gold">
          1v1 Scoreboard
        </h2>
        <p className="mt-1 text-xs text-white/50">{room.labelKa}</p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {roomTeams.map((team, index) => (
          <motion.div
            key={team.id}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
            className="rounded-xl bg-jeopardy-blue/60 p-3 ring-1 ring-jeopardy-gold/20"
            style={{ boxShadow: `inset 4px 0 0 ${team.color}` }}
          >
            <div className="mb-2 flex items-center gap-2">
              <span aria-hidden className="text-lg">
                {team.colorEmoji}
              </span>
              <input
                type="text"
                value={team.name}
                onChange={(event) =>
                  updateTeamName(team.id, event.target.value)
                }
                className="min-w-0 flex-1 rounded bg-black/30 px-2 py-1 text-sm font-bold text-white outline-none ring-1 ring-transparent focus:ring-jeopardy-gold/50"
              />
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => decrementScore(roomId, team.id)}
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
                onClick={() => incrementScore(roomId, team.id)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-green-900/60 text-xl font-bold text-green-200 transition hover:bg-green-800 active:scale-95"
                aria-label={`Increase ${team.name} score`}
              >
                +
              </button>
            </div>
          </motion.div>
        ))}
      </div>
    </aside>
  );
}
