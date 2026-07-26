"use client";

import { useSearchParams } from "next/navigation";
import MobileBuzzerView from "@/components/buzzer/MobileBuzzerView";

export default function BuzzPageClient() {
  const searchParams = useSearchParams();
  const room = searchParams.get("room") ?? "";
  const tournamentId = searchParams.get("t");

  return (
    <MobileBuzzerView initialRoom={room} tournamentId={tournamentId} />
  );
}
