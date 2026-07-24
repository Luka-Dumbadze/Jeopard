import { Suspense } from "react";
import BuzzPageClient from "@/components/buzzer/BuzzPageClient";

export default function BuzzPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-jeopardy-blue-dark">
          <p className="text-jeopardy-gold">Loading buzzer…</p>
        </main>
      }
    >
      <BuzzPageClient />
    </Suspense>
  );
}
