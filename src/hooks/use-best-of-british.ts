import { useQuery } from "@tanstack/react-query";
import { BEST_OF_BRITISH_UUIDS } from "@/data/best-of-british";
import { useIsClient } from "@/hooks/use-is-client";
import { filterPlayableStations, type Station } from "@/lib/radio/types";

/** API stays out of the initial bundle — loaded for the one batch fetch. */
const loadApi = () => import("@/lib/radio/api");

/**
 * Pure shelf processing (unit-tested, no React): playable-only rows,
 * deduped by name (highest votes wins — covers alt feeds of the same
 * station), sorted A–Z for the shelf.
 */
export function processBritishStations(rows: Station[]): Station[] {
  const best = new Map<string, Station>();
  for (const station of filterPlayableStations(rows)) {
    const key = station.name.trim().toLowerCase();
    if (key === "") continue;
    const prev = best.get(key);
    if (!prev || station.votes > prev.votes) best.set(key, station);
  }
  return [...best.values()].toSorted((a, b) => a.name.localeCompare(b.name, "en"));
}

/**
 * Curated "Best of British" shelf: one batched `stationsByUuid` round-trip
 * for the whole list (not one search per station), cached 5 minutes.
 * Client-gated like every other directory query so the prerender emits a
 * skeleton only.
 */
export function useBestOfBritish() {
  const isClient = useIsClient();
  return useQuery({
    queryKey: ["radio", "british"],
    queryFn: () => loadApi().then((api) => api.stationsByUuid(BEST_OF_BRITISH_UUIDS).then(processBritishStations)),
    enabled: isClient,
    staleTime: 1000 * 60 * 5,
  });
}
