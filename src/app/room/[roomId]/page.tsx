import { Suspense } from "react";
import ErrorBoundary from "@/components/ErrorBoundary";
import RoomPageClient from "@/components/room/RoomPageClient";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return (
    <ErrorBoundary label={`Room ${roomId.toUpperCase()}`}>
      <Suspense
        fallback={
          <main className="flex min-h-screen items-center justify-center bg-jeopardy-blue-dark">
            <p className="text-jeopardy-gold">Loading room…</p>
          </main>
        }
      >
        <RoomPageClient roomIdParam={roomId.toUpperCase()} />
      </Suspense>
    </ErrorBoundary>
  );
}
