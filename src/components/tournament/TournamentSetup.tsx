"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { useActionLock } from "@/hooks/useActionLock";
import {
  GameDataValidationError,
  parseGameFile,
} from "@/lib/validateGameData";
import { useTournamentStore } from "@/store/tournamentStore";
import {
  DEFAULT_TEAM_PRESETS,
  ROOM_IDS,
  getRoomTeams,
  type RoomId,
} from "@/types/tournament";

export default function TournamentSetup() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasHydrated = useTournamentStore((state) => state.hasHydrated);
  const setHasHydrated = useTournamentStore((state) => state.setHasHydrated);
  const gameData = useTournamentStore((state) => state.gameData);
  const teams = useTournamentStore((state) => state.teams);
  const rooms = useTournamentStore((state) => state.rooms);
  const isTournamentActive = useTournamentStore(
    (state) => state.isTournamentActive
  );
  const setGameData = useTournamentStore((state) => state.setGameData);
  const updateTeamName = useTournamentStore((state) => state.updateTeamName);
  const updateTeamColor = useTournamentStore((state) => state.updateTeamColor);
  const createTournament = useTournamentStore((state) => state.createTournament);
  const resetTournament = useTournamentStore((state) => state.resetTournament);

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [origin, setOrigin] = useState("");
  const [copiedRoom, setCopiedRoom] = useState<RoomId | null>(null);
  const { locked: createLocked, run: runCreate } = useActionLock(800);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const finish = () => setHasHydrated(true);
    if (useTournamentStore.persist.hasHydrated()) {
      finish();
      return;
    }
    return useTournamentStore.persist.onFinishHydration(finish);
  }, [setHasHydrated]);

  const handleFile = useCallback(
    async (file: File) => {
      if (isLoading) return;
      if (!file.name.endsWith(".json")) {
        setError("Please upload a .json file.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await parseGameFile(file);
        setGameData(data);
      } catch (err) {
        if (err instanceof GameDataValidationError) {
          setError(err.message);
        } else {
          setError("Failed to read the file. Please try again.");
        }
      } finally {
        setIsLoading(false);
      }
    },
    [setGameData, isLoading]
  );

  const pairings = useMemo(
    () =>
      ROOM_IDS.map((roomId) => {
        const room = rooms[roomId];
        const [a, b] = getRoomTeams(room, teams);
        return { room, teamA: a, teamB: b };
      }),
    [rooms, teams]
  );

  const canCreate = Boolean(gameData) && teams.length === 8;

  const handleCreate = () => {
    if (!canCreate || createLocked) return;
    runCreate(() => {
      createTournament();
    });
  };

  const copyLink = async (roomId: RoomId) => {
    const url = `${origin}/room/${roomId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedRoom(roomId);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => {
        copyTimerRef.current = null;
        setCopiedRoom(null);
      }, 1500);
    } catch {
      setError("Could not copy link");
    }
  };

  if (!hasHydrated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark">
        <p className="text-jeopardy-gold">Loading...</p>
      </main>
    );
  }

  if (isTournamentActive && gameData) {
    return (
      <main className="min-h-screen bg-jeopardy-blue-dark px-4 py-10 md:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.25em] text-jeopardy-gold/70">
                Master Dashboard
              </p>
              <h1 className="mt-2 text-3xl font-bold text-jeopardy-gold md:text-4xl">
                {gameData.title}
              </h1>
              <p className="mt-2 text-white/70">
                4 პარალელური ოთახი · 8 გუნდი · 1v1 მატჩები
              </p>
            </div>
            <button
              type="button"
              onClick={resetTournament}
              className="rounded-lg bg-red-900/50 px-4 py-2 text-sm font-bold text-red-200 hover:bg-red-800/60"
            >
              Reset Tournament
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {pairings.map(({ room, teamA, teamB }) => {
              const roomUrl = origin ? `${origin}/room/${room.id}` : "";
              const buzzUrl = origin
                ? `${origin}/buzz?room=${encodeURIComponent(room.id)}`
                : "";

              return (
                <motion.article
                  key={room.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-jeopardy-blue/40 p-5 ring-1 ring-jeopardy-gold/25"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-xl font-bold text-jeopardy-gold">
                        {room.labelKa}
                      </h2>
                      <p className="mt-1 text-sm text-white/80">
                        {teamA.colorEmoji} {teamA.name}{" "}
                        <span className="text-white/40">vs</span>{" "}
                        {teamB.colorEmoji} {teamB.name}
                      </p>
                      <p className="mt-2 font-mono text-xs text-white/50">
                        {room.id}
                      </p>
                    </div>
                    {buzzUrl && (
                      <div className="rounded-lg bg-white p-2">
                        <QRCodeSVG value={buzzUrl} size={88} level="M" />
                      </div>
                    )}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/room/${room.id}`}
                      className="rounded-lg bg-jeopardy-gold px-4 py-2 text-sm font-bold text-jeopardy-blue-dark hover:bg-yellow-300"
                    >
                      Open Projector
                    </Link>
                    <button
                      type="button"
                      onClick={() => copyLink(room.id)}
                      className="rounded-lg border border-jeopardy-gold/40 px-4 py-2 text-sm font-bold text-jeopardy-gold hover:bg-jeopardy-gold/10"
                    >
                      {copiedRoom === room.id ? "Copied!" : "Copy Room Link"}
                    </button>
                    {roomUrl && (
                      <a
                        href={buzzUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-white/20 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/5"
                      >
                        Buzz Page
                      </a>
                    )}
                  </div>
                </motion.article>
              );
            })}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-jeopardy-blue-dark px-4 py-10 md:px-8">
      <div className="mx-auto max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <h1
            className="text-4xl font-bold tracking-wide text-jeopardy-gold md:text-5xl"
            style={{ textShadow: "0 0 30px rgba(255, 215, 0, 0.35)" }}
          >
            JEOPARDY TOURNAMENT
          </h1>
          <p className="mt-3 text-white/75">
            4-ოთახიანი ტურნირი · 8 გუნდი · პარალელური 1v1 მატჩები
          </p>
        </motion.div>

        <section className="mt-10 rounded-2xl border border-dashed border-jeopardy-gold/40 bg-jeopardy-blue/30 p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-xl bg-jeopardy-gold/15 px-6 py-3 font-bold text-jeopardy-gold ring-1 ring-jeopardy-gold/40 transition hover:bg-jeopardy-gold/25"
          >
            {isLoading
              ? "Loading..."
              : gameData
                ? `Pack loaded: ${gameData.title}`
                : "Upload Jeopardy JSON Pack"}
          </button>
          {error && (
            <p className="mt-4 rounded-lg bg-red-900/40 px-4 py-2 text-sm text-red-200">
              {error}
            </p>
          )}
        </section>

        <section className="mt-8">
          <h2 className="mb-4 text-lg font-bold text-jeopardy-gold">
            8 გუნდი / Teams
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((team, index) => (
              <div
                key={team.id}
                className="rounded-xl bg-black/25 p-3 ring-1 ring-jeopardy-gold/20"
                style={{ boxShadow: `inset 4px 0 0 ${team.color}` }}
              >
                <div className="mb-2 flex items-center gap-2 text-xs text-white/50">
                  <span>Team {index + 1}</span>
                  <span>·</span>
                  <span>
                    Room {Math.floor(index / 2) + 1}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    aria-label={`Color for ${team.name}`}
                    value={team.color}
                    onChange={(event) => {
                      const preset = DEFAULT_TEAM_PRESETS.find(
                        (item) => item.color === event.target.value
                      );
                      if (!preset) return;
                      updateTeamColor(
                        team.id,
                        preset.color,
                        preset.colorLabelKa,
                        preset.colorEmoji
                      );
                    }}
                    className="rounded bg-black/40 px-2 py-2 text-sm text-white outline-none"
                  >
                    {DEFAULT_TEAM_PRESETS.map((preset) => (
                      <option key={preset.color} value={preset.color}>
                        {preset.colorEmoji} {preset.colorLabelKa}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={team.name}
                    onChange={(event) =>
                      updateTeamName(team.id, event.target.value)
                    }
                    className="min-w-0 flex-1 rounded bg-black/40 px-3 py-2 text-sm font-bold text-white outline-none ring-1 ring-transparent focus:ring-jeopardy-gold/50"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-xl bg-black/20 p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-jeopardy-gold/80">
            Matchups Preview
          </h3>
          <ul className="space-y-2 text-sm text-white/80">
            {pairings.map(({ room, teamA, teamB }) => (
              <li key={room.id}>
                {room.labelKa}: {teamA.colorEmoji} {teamA.name} vs{" "}
                {teamB.colorEmoji} {teamB.name}
              </li>
            ))}
          </ul>
        </section>

        <button
          type="button"
          disabled={!canCreate || createLocked}
          onClick={handleCreate}
          className="mt-8 w-full rounded-2xl bg-jeopardy-gold py-4 text-lg font-bold text-jeopardy-blue-dark transition enabled:hover:bg-yellow-300 enabled:active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {createLocked
            ? "Creating…"
            : "4-ოთახიანი ტურნირის შექმნა (Create 4-Room Tournament)"}
        </button>
      </div>
    </main>
  );
}
