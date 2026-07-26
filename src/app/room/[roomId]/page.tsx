import ErrorBoundary from "@/components/ErrorBoundary";
import RoomPageClient from "@/components/room/RoomPageClient";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return (
    <ErrorBoundary label={`Room ${roomId.toUpperCase()}`}>
      <RoomPageClient roomIdParam={roomId.toUpperCase()} />
    </ErrorBoundary>
  );
}
