"use client";

import { useSearchParams } from "next/navigation";
import MobileBuzzerView from "@/components/buzzer/MobileBuzzerView";

export default function BuzzPageClient() {
  const searchParams = useSearchParams();
  const room = searchParams.get("room") ?? "";

  return <MobileBuzzerView initialRoom={room} />;
}
