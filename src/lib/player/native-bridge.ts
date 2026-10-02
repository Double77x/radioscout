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

/** Transport handlers behind the lock-screen / headset / car MediaSession actions. */
export interface MediaSessionHandlers {
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

/**
 * Step target for car skip buttons through Saved favourites in list order,
 * wrapping both directions. Null means "nowhere to go" (fewer than two
 * saved — the press stays a silent no-op); an unknown current station starts
 * at the head, so skipping from idle plays Saved #1.
 */
export function favouriteLoopTarget(
  currentUuid: string | null,
  orderedUuids: string[],
  direction: 1 | -1,
): string | null {
  if (orderedUuids.length < 2) return null;
  const index = currentUuid === null ? -1 : orderedUuids.indexOf(currentUuid);
  if (index === -1) return orderedUuids[0];
  return orderedUuids[(index + direction + orderedUuids.length) % orderedUuids.length];
}

/**
 * Publish the station to the system MediaSession with transport actions.
 * Progressive enhancement — a missing session or a hostile browser leaves
 * playback untouched.
 *
 * `track` is the live `StreamTitle` when one is known. The song takes the
 * title slot and the station moves to the artist slot, which is what a car
 * (Bluetooth AVRCP), the lock screen or Android Auto actually renders: the
 * station alone leaves every one of them showing the same line twice. Without
 * a title the station leads and the tags/country keep the second line.
 */
export function updateMediaSession(
  station: Station,
  handlers: MediaSessionHandlers,
  track: string | null = null,
): void {
  const mediaSession = globalThis.navigator?.mediaSession;
  if (!mediaSession) return;
  try {
    mediaSession.metadata = new MediaMetadata({
      title: track ?? station.name,
      artist: track === null ? nativeTrackArtist(station) : station.name,
      album: "RadioScout",
      artwork:
        station.favicon === ""
          ? []
          : [{ src: upgradeInsecureUrl(station.favicon), sizes: "512x512", type: "image/png" }],
    });
    mediaSession.setActionHandler("play", () => {
      handlers.onPlay();
    });
    mediaSession.setActionHandler("pause", () => {
      handlers.onPause();
    });
    mediaSession.setActionHandler("stop", () => {
      handlers.onStop();
    });
    mediaSession.setActionHandler("nexttrack", () => {
      handlers.onNext();
    });
    mediaSession.setActionHandler("previoustrack", () => {
      handlers.onPrevious();
    });
  } catch {
    // MediaSession is progressive enhancement — never break playback.
  }
}
