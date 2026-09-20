import { useSyncExternalStore } from "react";
import type { Station } from "@/lib/radio/types";

/**
 * Global detail-sheet state. The sheet renders once in AppShell, so the
 * player dock, rows and tiles all open the same instance.
 */
let current: Station | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function getSnapshot(): Station | null {
  return current;
}

export function openStationDetail(station: Station): void {
  current = station;
  emit();
}

export function closeStationDetail(): void {
  current = null;
  emit();
}

export function useStationDetail(): { station: Station | null } {
  const station = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { station };
}
