import RoomPageClient from "@/components/room/RoomPageClient";

interface RoomPageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomPage({ params }: RoomPageProps) {
  const { roomId } = await params;
  return <RoomPageClient roomIdParam={roomId.toUpperCase()} />;
}
