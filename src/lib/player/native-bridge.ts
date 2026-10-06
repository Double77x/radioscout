/**
 * Native bridge leaves: the Media3-adjacent pieces with no reconnect or
 * transport coupling. Pure construction plus one parameterized element park
 * — the engine keeps sole ownership of `usingNative`, `normalizeOn` and the
 * retry loop, so `ensureNativeListener` and `playViaNative` stay there:
 * handoff and transport share those bindings on every transition, and a
 * seam between them would move complexity without concentrating it
 * (see `docs/plans/REFACTOR_PLAYER_ENGINE_PLAN.md` Phase 1e assessment).
 *
 * Nothing in here reads player state or emits snapshots. Never throws.
 */
import { formatCountryName, formatTags } from "@/lib/radio/format";
import { pickPlayableUrl, type Station } from "@/lib/radio/types";
import { ddgArtworkUrl, wsrvArtworkUrl } from "@/lib/radio/artwork";
import { destroyHls } from "@/lib/player/hls";

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
  // An hls.js bridge on this element must stop fetching too.
  destroyHls(element);
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
 *
 * Web path only: on native the service owns a real playlist (see
 * `buildSkipPlaylist`) and seeks execute on the player itself.
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

/** One service-side playlist entry: everything the session needs per station. */
export interface NativePlaylistItem {
  stationuuid: string;
  url: string;
  title: string;
  artist: string;
  artwork: string;
}

/** Favourite rows in Saved order as playlist entries (directory URLs — no network). */
export function playlistItems(rows: { stationuuid: string; snapshot: Station }[]): NativePlaylistItem[] {
  return rows.map((row) => ({
    stationuuid: row.stationuuid,
    url: pickPlayableUrl(row.snapshot),
    title: row.snapshot.name,
    artist: nativeTrackArtist(row.snapshot),
    artwork: wsrvArtworkUrl(row.snapshot.favicon),
  }));
}

/**
 * Service-side favourites loop: full Saved order with the current station at
 * `index`, so the session holds a genuine multi-item playlist — `hasNext` /
 * `hasPrevious` stay true at every position (with repeat-all wrapping the
 * ends) and every surface that builds its buttons from the player commands
 * keeps skip visible on every station. A current station outside Saved
 * (search play) is prepended so the audible item is always present; an empty
 * Saved list yields the single audible item (no loop — matching the silent
 * web path, which needs two saved to step anywhere).
 */
export function buildSkipPlaylist(
  current: Station,
  currentUrl: string,
  rows: { stationuuid: string; snapshot: Station }[],
): { items: NativePlaylistItem[]; index: number } {
  const items = playlistItems(rows);
  const index = items.findIndex((item) => item.stationuuid === current.stationuuid);
  const here: NativePlaylistItem = {
    stationuuid: current.stationuuid,
    url: currentUrl,
    title: current.name,
    artist: nativeTrackArtist(current),
    artwork: wsrvArtworkUrl(current.favicon),
  };
  if (index !== -1) {
    items[index] = here;
    return { items, index };
  }
  return { items: [here, ...items], index: 0 };
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
          : [
              { src: wsrvArtworkUrl(station.favicon), sizes: "512x512", type: "image/png" },
              { src: ddgArtworkUrl(station.favicon), sizes: "512x512", type: "image/png" },
            ],
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
