/**
 * Desktop audio-visualiser toggle.
 *
 * Opt-in and off by default: the wings need a Web Audio route that the
 * player would otherwise skip whenever leveling is off. Web only, and the
 * component itself gates on laptop width — the APK ignores the key.
 */

/** Persisted toggle (`"1"`/`"0"`, so the generic string hook fits). */
export const VISUALISER_KEY = "radioscout:visualiser";

/** Stored value → on/off, collapsing garbage to off. Never throws. */
export function visualiserEnabled(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}
