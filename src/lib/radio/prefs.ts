/** Player prefs storage. The live element/snapshot application stays in `use-player`. */

const VOLUME_KEY = "radioscout:volume";
const MUTED_KEY = "radioscout:muted";

export interface PlayerPrefs {
  volume: number;
  muted: boolean;
}

export function loadVolume(): number {
  try {
    const value = Number(globalThis.localStorage?.getItem(VOLUME_KEY));
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.9;
  } catch {
    return 0.9;
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
  if (globalThis.window === undefined) return { volume: 0.9, muted: false };
  return { volume: loadVolume(), muted: loadMuted() };
}
