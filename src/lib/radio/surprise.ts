import type { Station } from "./types";

/**
 * Random station picker for "Surprise me". Pure — takes the candidate list
 * (already playable-filtered by the api layer) and returns one entry.
 * `excludeUuid` avoids replaying what's already in the dock; `random` is
 * injectable so unit tests stay deterministic.
 */
export function pickSurpriseStation(
  stations: Station[],
  excludeUuid?: string | null,
  random: () => number = Math.random,
): Station | null {
  const pool =
    excludeUuid === undefined || excludeUuid === null || excludeUuid === ""
      ? stations
      : stations.filter((station) => station.stationuuid !== excludeUuid);
  if (pool.length === 0) return null;
  const raw = random() * pool.length;
  const index = Math.min(pool.length - 1, Math.max(0, Math.floor(raw)));
  return pool[index] ?? null;
}
