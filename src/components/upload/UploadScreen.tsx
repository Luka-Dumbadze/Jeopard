"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { GameDataValidationError, parseGameFile } from "@/lib/validateGameData";
import { useGameStore } from "@/store/gameStore";

export default function UploadScreen() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const setGameData = useGameStore((state) => state.setGameData);

  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".json")) {
        setError("Please upload a .json file.");
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const data = await parseGameFile(file);
        setGameData(data);
        router.push("/game");
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
    [router, setGameData]
  );

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);

      const file = event.dataTransfer.files[0];
      if (file) {
        void handleFile(file);
      }
    },
    [handleFile]
  );

  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      void handleFile(file);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark px-6 py-12">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-2xl"
      >
        <div className="mb-10 text-center">
          <motion.h1
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className="text-5xl font-bold tracking-wide text-jeopardy-gold md:text-6xl"
            style={{ textShadow: "0 0 30px rgba(255, 215, 0, 0.4)" }}
          >
            JEOPARDY!
          </motion.h1>
          <p className="mt-4 text-lg text-white/80">
            Upload a JSON game file to start your trivia session
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-2xl border-2 border-dashed p-12 text-center transition-all duration-300 ${
            isDragging
              ? "border-jeopardy-gold bg-jeopardy-blue/60 scale-[1.02]"
              : "border-jeopardy-gold/40 bg-jeopardy-blue/30 hover:border-jeopardy-gold/70 hover:bg-jeopardy-blue/50"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={onFileChange}
          />

          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-jeopardy-gold/10">
            <svg
              className="h-10 w-10 text-jeopardy-gold"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
              />
            </svg>
          </div>

          <p className="text-xl font-bold text-jeopardy-gold">
            {isLoading ? "Loading game..." : "Drop your JSON file here"}
          </p>
          <p className="mt-2 text-sm text-white/60">or click to browse</p>
        </div>

        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4 rounded-lg bg-red-900/50 px-4 py-3 text-center text-sm text-red-200"
          >
            {error}
          </motion.p>
        )}

        <div className="mt-8 rounded-xl bg-black/20 p-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-jeopardy-gold/80">
            Expected JSON Schema
          </h2>
          <pre className="overflow-x-auto text-xs leading-relaxed text-white/70">
{`{
  "title": "Game Title",
  "categories": [
    {
      "name": "Category Name",
      "questions": [
        {
          "value": 100,
          "question": "Your question here?",
          "answer": "The answer"
        }
      ]
    }
  ]
}`}
          </pre>
        </div>
      </motion.div>
    </main>
  );
}
