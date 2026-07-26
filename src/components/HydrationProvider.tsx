"use client";

import { useHydration } from "@/hooks/useHydration";

/**
 * Mounted in the root layout so Zustand `hasHydrated` is always set
 * on browser mount — even when localStorage is empty / persist is bypassed.
 */
export default function HydrationProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useHydration();
  return <>{children}</>;
}
