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
