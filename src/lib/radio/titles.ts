/**
 * Stream-title (song title) probing for the web player subtitle.
 *
 * Opt-in and off by default: each probe is a short upstream stream pull
 * (plus an edge-function call on the shared tiers), so only listeners who
 * want live titles pay it. Native builds ignore this toggle — ExoPlayer
 * reports titles through the bridge event either way.
 */

/** Persisted toggle (`"1"`/`"0"`, so the generic string hook fits). */
export const TITLES_KEY = "radioscout:titles";

/** Stored value → on/off, collapsing garbage to off. Never throws. */
export function titlesEnabled(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

/** Toggle state, off during prerender. Never throws. */
export function readTitlesEnabled(): boolean {
  if (globalThis.window === undefined) return false;
  try {
    return titlesEnabled(globalThis.localStorage?.getItem(TITLES_KEY));
  } catch {
    return false;
  }
}

/**
 * Canonical form for comparing and banking heard titles. Stations re-send
 * the same StreamTitle every few seconds with varying padding, and titles
 * dedupe by string equality — so without this every repeat banks ("Song",
 * "Song " and "Song  " render identically but never match). Trim plus an
 * internal-whitespace collapse; row rendering collapses those runs too, so
 * the stored form always matches what the sheet shows. Never throws.
 */
export function normaliseTrackTitle(raw: string): string {
  return raw.replaceAll(/\s+/g, " ").trim();
}
