import { parseStation, type Station } from "@/lib/radio/types";

/**
 * Last-played station (quick resume). Written on every play, never cleared
 * by stop — a reload always offers the previous station, paused. Validated
 * on read so corrupt payloads collapse to worldwide-idle, never a crash.
 */

const KEY = "radioscout:last-station";

/** Most recent station, or null (prerender / empty / corrupt). Never throws. */
export function readLastStation(): Station | null {
  if (globalThis.window === undefined) return null;
  try {
    const raw = globalThis.localStorage?.getItem(KEY);
    if (!raw) return null;
    return parseStation(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

/** Remember a station (best-effort). Never throws. */
export function writeLastStation(station: Station): void {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(station));
  } catch {
    // Private mode etc — resume just won't survive reloads.
  }
}
