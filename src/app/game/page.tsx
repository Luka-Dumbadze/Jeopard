"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy single-game route — redirect to tournament dashboard. */
export default function LegacyGameRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/");
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark">
      <p className="text-jeopardy-gold">Redirecting to tournament dashboard…</p>
    </main>
  );
}
