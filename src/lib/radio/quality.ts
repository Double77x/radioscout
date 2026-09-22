/** Minimum-bitrate filter (directory bitrates in kbps, e.g. 128). `0` = any quality. */

export const QUALITY_KEY = "radioscout:min-bitrate";

/** Segmented options, ascending. Unknown bitrates never match a minimum. */
export const QUALITY_OPTIONS = [
  { minBitrate: 0, label: "Any" },
  { minBitrate: 64, label: "64+" },
  { minBitrate: 128, label: "128+" },
  { minBitrate: 192, label: "192+" },
] as const;

const VALID = new Set<number>(QUALITY_OPTIONS.map((option) => option.minBitrate));

/** Stored value → valid minimum, collapsing garbage to any quality. Never throws. */
export function normalizeMinBitrate(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isInteger(parsed) && VALID.has(parsed) ? (parsed as number) : 0;
}

/** Selected minimum bitrate, any quality (`0`) during prerender. Never throws. */
export function readMinBitrate(): number {
  if (globalThis.window === undefined) return 0;
  try {
    return normalizeMinBitrate(globalThis.localStorage?.getItem(QUALITY_KEY));
  } catch {
    return 0;
  }
}

/** Replace the selection (settings picker, backup restore). Never throws. */
export function writeMinBitrate(minBitrate: number): void {
  try {
    globalThis.localStorage?.setItem(QUALITY_KEY, String(normalizeMinBitrate(minBitrate)));
  } catch {
    // Private mode etc — the filter just won't survive reloads.
  }
}

/** Trigger/summary copy: "Any quality" or "128 kbps+". */
export function qualityLabel(minBitrate: number): string {
  return minBitrate > 0 ? `${minBitrate} kbps+` : "Any quality";
}

/**
 * Directory-list predicate. Stations with unknown bitrate (`0`, neither the
 * API nor the title said anything) never match an active minimum — a quality
 * guarantee shouldn't pass rows it can't verify. Saved
 * favourites/history skip this filter (tapping explains playback instead).
 */
export function passesMinBitrate(bitrate: number, minBitrate: number): boolean {
  if (minBitrate <= 0) return true;
  return Number.isFinite(bitrate) && bitrate >= minBitrate;
}
