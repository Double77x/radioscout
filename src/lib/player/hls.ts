/**
 * HLS bridge for browsers with no native HLS demuxer (Firefox desktop has
 * never had one; Chrome/Edge only gained theirs in 142). `hls.js`
 * transmuxes the playlist through MediaSource onto the SAME `<audio>`
 * element the engine already owns — leveling, crossfades, reconnect and
 * verdict logic all keep working — the element just plays a `blob:`
 * MediaSource instead of the `.m3u8` URL directly.
 *
 * Browsers that report native support (Chrome 142+, Safari, iOS) never get
 * here: `needsHlsBridge()` is false and the engine sets `src` as before, so
 * the bridge chunk only downloads when a browser actually needs it.
 *
 * Two deployment notes:
 * - Playlist and segment pulls are XHRs, so `connect-src` must allow
 *   `https:` for arbitrary stream hosts (`public/_headers`).
 * - `enableWorker: false`: the CSP header declares no `worker-src blob:`,
 *   so a transmuxer worker would be blocked silently and stall playback.
 *   Audio transmuxing on the main thread is cheap enough for one stream.
 *
 * Failures inside hls.js never reach the element's own `error` handler, so
 * a fatal error is routed back through it (identity-guarded listeners in
 * `engine`), keeping the reconnect/verdict logic in exactly one place.
 */
import type Hls from "hls.js";
import { isHlsUrl } from "@/lib/radio/types";

/** The engine's live/staged element per output — destroyed on park. */
const instances = new WeakMap<HTMLAudioElement, Hls>();
/** Playlist URL an element was bridged with (its `src` is a `blob:`). */
const sources = new WeakMap<HTMLAudioElement, string>();

/** Verdict when neither native HLS nor MediaSource exists on this page. */
export const HLS_UNSUPPORTED_MESSAGE =
  "This station streams as HLS, which this browser can't decode. Try Chrome, Edge or Safari — or the RadioScout APK.";

/** Handoff variant: the predecessor keeps playing behind the toast. */
export function hlsUnsupportedNote(stationName: string): string {
  return `${stationName} streams as HLS, which this browser can't decode — kept playing the current station.`;
}

/** Whether the element can decode HLS itself (Chrome 142+, Safari, iOS). */
export function hasNativeHls(element: HTMLMediaElement): boolean {
  try {
    return element.canPlayType("application/vnd.apple.mpegurl") !== "";
  } catch {
    // A torn-down element answers no — treat as "no native demuxer".
    return false;
  }
}

/**
 * Whether hls.js could bridge at all: it transmuxes into MediaSource, so a
 * page without `MediaSource`/`ManagedMediaSource` has no route either.
 * Cheap synchronous probe — the bridge chunk itself stays unloaded.
 */
export function canBridgeHls(): boolean {
  if (globalThis.window === undefined) return false;
  return "MediaSource" in globalThis || "ManagedMediaSource" in globalThis;
}

/** True when the URL is HLS and the element can't decode it natively. */
export function needsHlsBridge(element: HTMLMediaElement, url: string): boolean {
  return isHlsUrl(url) && !hasNativeHls(element);
}

/**
 * Attach the bridge to an element and start the stream. `isActive` guards
 * every asynchronous step (chunk import, later fatal errors) — a superseded
 * load attaches nothing and leaves no fetches behind.
 *
 * Rejects when the browser can't do MediaSource either; the caller maps
 * that onto its existing failure path.
 */
export async function attachHls(element: HTMLAudioElement, url: string, isActive: () => boolean): Promise<void> {
  const { default: HlsCtor } = await import("hls.js");
  // Superseded while the chunk loaded (or removed from the module registry
  // by a rebuild): never attach to an element the engine has forgotten.
  if (!isActive()) return;
  if (!HlsCtor.isSupported()) throw new Error("MediaSource cannot decode HLS here.");
  destroyHls(element);
  const hls = new HlsCtor({ enableWorker: false });
  // Decode hiccups get hls.js's own ladder first (reset, then codec swap) —
  // a transient stall must not condemn the stream into a full reload.
  let mediaRecoveries = 0;
  hls.on(HlsCtor.Events.ERROR, (_event, data) => {
    if (!data.fatal) return;
    if (!isActive()) return;
    if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && mediaRecoveries < 2) {
      mediaRecoveries += 1;
      if (mediaRecoveries === 2) hls.swapAudioCodec();
      hls.recoverMediaError();
      return;
    }
    try {
      // Network fatals (its own load retries already exhausted) and dead
      // media fall back to the engine: `waiting` first, because a drop
      // means the buffer ran dry and the live element only recovers from
      // the `loading` state that event establishes (playing -> loading ->
      // error -> reconnect or verdict). The listeners identity-guard.
      element.dispatchEvent(new Event("waiting"));
      element.dispatchEvent(new Event("error"));
    } catch {
      // Element detached mid-teardown — nothing left to fail into.
    }
  });
  hls.attachMedia(element);
  hls.loadSource(url);
  instances.set(element, hls);
  sources.set(element, url);
}

/** Detach the bridge (stops its fetches) before an element is retired. */
export function destroyHls(element: HTMLAudioElement | null): void {
  if (!element) return;
  const hls = instances.get(element);
  instances.delete(element);
  sources.delete(element);
  if (!hls) return;
  try {
    hls.destroy();
  } catch {
    // Already torn down — the caller parks the element regardless.
  }
}

/**
 * Playlist URL behind a bridged element (its `src` is an opaque `blob:`).
 * Failure verdicts that want a real hostname — the CORS rescue marks the
 * host so the next attempt skips leveling — must read this first.
 */
export function hlsSourceUrl(element: HTMLAudioElement): string | null {
  return sources.get(element) ?? null;
}
