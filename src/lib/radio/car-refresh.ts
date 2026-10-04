/**
 * Car-display refresh workaround (APK only).
 *
 * The native side already publishes every ICY title into the platform media
 * session, which is what a Bluetooth stereo reads — verified live with
 * `adb shell dumpsys media_session`, where the title tracks the song. Some
 * stereos still never re-render it: older AVRCP 1.3-era head units only
 * refresh when playback state changes, and a live stream has no track boundary
 * to announce, so they keep the first title they received. Upstream
 * androidx/media#430 reproduces this with the stock Media3 demo.
 *
 * With this on, the service re-seeks to the current position whenever it
 * publishes a title, which re-pushes the platform playback state and makes the
 * stereo re-read it. Off by default: a seek can cost a brief rebuffer, so it
 * only earns its place on a car that is actually showing a stale title.
 */

/** Persisted toggle (`"1"`/`"0"`, so the generic string hook fits). */
export const CAR_REFRESH_KEY = "radioscout:car-refresh";

/** Stored value → on/off, collapsing garbage to off. Never throws. */
export function carRefreshEnabled(value: unknown): boolean {
  return value === "1" || value === 1 || value === true;
}

/** Toggle state, off during prerender. Never throws. */
export function readCarRefreshEnabled(): boolean {
  if (globalThis.window === undefined) return false;
  try {
    return carRefreshEnabled(globalThis.localStorage?.getItem(CAR_REFRESH_KEY));
  } catch {
    return false;
  }
}

/** Replace the selection (settings switch, backup restore). Never throws. */
export function writeCarRefreshEnabled(enabled: boolean): void {
  try {
    globalThis.localStorage?.setItem(CAR_REFRESH_KEY, enabled ? "1" : "0");
  } catch {
    // Private mode etc — the toggle just won't survive reloads.
  }
}
