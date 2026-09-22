/** Player prefs storage. The live element/snapshot application stays in `use-player`. */

const VOLUME_KEY = "radioscout:volume";
const MUTED_KEY = "radioscout:muted";

/** Fresh-install output level (stored prefs win once the user touches volume). */
export const DEFAULT_VOLUME = 0.25;

export interface PlayerPrefs {
  volume: number;
  muted: boolean;
}

export function loadVolume(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(VOLUME_KEY));
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : DEFAULT_VOLUME;
  } catch {
    return DEFAULT_VOLUME;
  }
}

export function loadMuted(): boolean {
  try {
    return globalThis.localStorage?.getItem(MUTED_KEY) === "1";
  } catch {
    return false;
  }
}

export function persistVolume(volume: number, muted: boolean): void {
  try {
    globalThis.localStorage?.setItem(VOLUME_KEY, String(volume));
    globalThis.localStorage?.setItem(MUTED_KEY, muted ? "1" : "0");
  } catch {
    // Private mode etc — volume just won't persist.
  }
}

/** Read persisted prefs (backup). Never throws. */
export function readPlayerPrefs(): PlayerPrefs {
  if (globalThis.window === undefined) return { volume: DEFAULT_VOLUME, muted: false };
  return { volume: loadVolume(), muted: loadMuted() };
}
