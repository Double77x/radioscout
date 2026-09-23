/**
 * Native bridge leaves: the Media3-adjacent pieces with no reconnect or
 * transport coupling. Pure construction plus one parameterized element park
 * — the engine keeps sole ownership of `usingNative`, `normalizeOn` and the
 * retry loop, so `ensureNativeListener` and `playViaNative` stay there:
 * handoff and transport share those bindings on every transition, and a
 * seam between them would move complexity without concentrating it
 * (see `docs/REFACTOR_PLAYER_ENGINE_PLAN.md` Phase 1e assessment).
 *
 * Nothing in here reads player state or emits snapshots. Never throws.
 */
import { formatCountryName, formatTags } from "@/lib/radio/format";
import { upgradeInsecureUrl, type Station } from "@/lib/radio/types";

/** Shown instead of the generic failure when the stream is HTTP-only on a secure page. */
export const INSECURE_HTTP_MESSAGE =
  "This station only streams over insecure HTTP, which secure pages and the app WebView block. Pick a station with an HTTPS stream.";

/**
 * Service/notification artist line (tags, else country, else generic).
 * Single source for the MediaSession metadata and the native takeover args
 * so the two can never drift apart.
 */
export function nativeTrackArtist(station: Station): string {
  return formatTags(station.tags) || formatCountryName(station.country, station.countrycode) || "Radio";
}

/** Park the web element when the service takes over (no event cross-talk). */
export function parkWebAudioElement(element: HTMLAudioElement | null): void {
  if (!element) return;
  try {
    element.pause();
  } catch {
    // Element teardown races are harmless — the service owns audio now.
  }
  element.removeAttribute("src");
  element.load();
}

/** Transport handlers behind the lock-screen / headset MediaSession actions. */
export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
}

/**
 * Publish the station to the system MediaSession with transport actions.
 * Progressive enhancement — a missing session or a hostile browser leaves
 * playback untouched.
 */
export function updateMediaSession(station: Station, handlers: MediaSessionHandlers): void {
  const mediaSession = globalThis.navigator?.mediaSession;
  if (!mediaSession) return;
  try {
    mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: nativeTrackArtist(station),
      album: "RadioScout",
      artwork:
        station.favicon === ""
          ? []
          : [{ src: upgradeInsecureUrl(station.favicon), sizes: "512x512", type: "image/png" }],
    });
    mediaSession.setActionHandler("play", () => void handlers.onPlay());
    mediaSession.setActionHandler("pause", () => handlers.onPause());
    mediaSession.setActionHandler("stop", () => handlers.onStop());
  } catch {
    // MediaSession is progressive enhancement — never break playback.
  }
}
