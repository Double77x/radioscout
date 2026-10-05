import type { QueryClient } from "@tanstack/react-query";
import type { FavouriteRow, HistoryRow } from "./store";
import type { Station } from "./types";

/** One vote per station per device (the server also dedupes per IP/day). */
const KEY = "radioscout:voted";

function readVoted(): Set<string> {
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : []);
  } catch {
    return new Set();
  }
}

export function hasVoted(stationuuid: string): boolean {
  if (globalThis.window === undefined) return false;
  return readVoted().has(stationuuid);
}

export function markVoted(stationuuid: string): void {
  writeVotedIds([...readVoted(), stationuuid]);
}

/** Full voted-id list (backup). Never throws. */
export function readVotedIds(): string[] {
  if (globalThis.window === undefined) return [];
  return [...readVoted()];
}

/** Replace the voted-id list (restore). Never throws. */
export function writeVotedIds(ids: string[]): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(ids.filter((id) => typeof id === "string")));
  } catch {
    // Private mode etc — the button just stays enabled.
  }
}

/**
 * Optimistic +1 across every cache that renders a station's vote count —
 * the detail sheet, the directory lists, and the Saved / Recently played
 * snapshots — so the row and the sheet agree the moment the vote lands.
 * Deliberately no invalidation: the directory counts lag a vote by
 * minutes, so an immediate refetch would snap the row back to the old
 * value behind the sheet's +1. The server converges on the next natural
 * refetch instead. Never throws.
 */
export function bumpCachedVotes(client: QueryClient, stationuuid: string): void {
  try {
    const bump = (station: Station): Station =>
      station.stationuuid === stationuuid ? { ...station, votes: station.votes + 1 } : station;
    const detailKey = ["radio", "detail", stationuuid];
    const detail = client.getQueryData<Station>(detailKey);
    if (detail) client.setQueryData(detailKey, bump(detail));
    // Directory lists (Most loved, search — Best of British derives from top).
    for (const prefix of [
      ["radio", "top"],
      ["radio", "search"],
    ] as const) {
      for (const [key, data] of client.getQueriesData<Station[]>({ queryKey: [...prefix] })) {
        if (Array.isArray(data))
          client.setQueryData(
            key,
            data.map((row) => bump(row)),
          );
      }
    }
    // Saved / Recently played snapshots (keys mirror `use-radio`).
    for (const [key, data] of client.getQueriesData<FavouriteRow[]>({ queryKey: ["radio", "favourites"] })) {
      if (Array.isArray(data)) {
        client.setQueryData(
          key,
          data.map((row) => (row.stationuuid === stationuuid ? { ...row, snapshot: bump(row.snapshot) } : row)),
        );
      }
    }
    for (const [key, data] of client.getQueriesData<HistoryRow[]>({ queryKey: ["radio", "history"] })) {
      if (Array.isArray(data)) {
        client.setQueryData(
          key,
          data.map((row) => (row.stationuuid === stationuuid ? { ...row, snapshot: bump(row.snapshot) } : row)),
        );
      }
    }
  } catch {
    // Cache surgery is cosmetic — the vote itself already landed above.
  }
}
