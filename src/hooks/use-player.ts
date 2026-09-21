import { useSyncExternalStore } from "react";
import { isNative } from "@/lib/capacitor";
import { formatCountryName, formatTags } from "@/lib/radio/format";
import { loadMuted, loadVolume, persistVolume, type PlayerPrefs } from "@/lib/radio/prefs";
import {
  isHlsUrl,
  isInsecureHttpStream,
  pickPlayableUrl,
  sanitizeStreamUrl,
  upgradeInsecureUrl,
  type Station,
} from "@/lib/radio/types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

interface PlayerSnapshot {
  station: Station | null;
  status: PlayerStatus;
  error: string | null;
  /** True when the stream needs the native foreground-service plugin. */
  needsNative: boolean;
  volume: number;
  muted: boolean;
}

/**
 * Web playback singleton. One shared `<audio>` element, state fanned out
 * via `useSyncExternalStore` (no context re-renders, SSR-safe snapshot).
 *
 * Port of RadioDroid's `PlayerService` play path at web fidelity:
 * resolve → load → play → MediaSession. True background playback
 * (after the WebView dies), recording, and wake alarms stay native-only —
 * see `playViaNative` stub below for where the Capacitor
 * foreground-service plugin (Media3 + MediaSession) plugs in.
 */

let audio: HTMLAudioElement | null = null;
let playToken = 0;
/** `true` when the pending load is an `http://` stream on an `https://` page (blocked by policy, not offline). */
let lastLoadInsecure = false;
/** Shown instead of the generic failure when the stream is HTTP-only on a secure page. */
const INSECURE_HTTP_MESSAGE =
  "This station only streams over insecure HTTP, which secure pages and the app WebView block. Pick a station with an HTTPS stream, or wait for the native player.";
const listeners = new Set<() => void>();

/** Write prefs to storage and the live element/snapshot. */
export function applyPlayerPrefs(prefs: PlayerPrefs): void {
  const volume = Math.min(1, Math.max(0, Number.isFinite(prefs.volume) ? prefs.volume : 0.9));
  const muted = prefs.muted === true;
  if (audio) audio.volume = muted ? 0 : volume;
  persistVolume(volume, muted);
  emit({ volume, muted });
}

function initialSnapshot(): PlayerSnapshot {
  if (globalThis.window === undefined) {
    return { station: null, status: "idle", error: null, needsNative: false, volume: 0.9, muted: false };
  }
  return { station: null, status: "idle", error: null, needsNative: false, volume: loadVolume(), muted: loadMuted() };
}

let snapshot: PlayerSnapshot = initialSnapshot();

function emit(next: Partial<PlayerSnapshot>): void {
  snapshot = { ...snapshot, ...next };
  for (const notify of listeners) notify();
}

function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

function getSnapshot(): PlayerSnapshot {
  return snapshot;
}

function ensureAudio(): HTMLAudioElement | null {
  if (globalThis.window === undefined) return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.volume = snapshot.muted ? 0 : snapshot.volume;
    audio.addEventListener("playing", () => emit({ status: "playing", error: null }));
    audio.addEventListener("pause", () => {
      if (snapshot.status === "playing" || snapshot.status === "loading") emit({ status: "paused" });
    });
    audio.addEventListener("waiting", () => {
      if (snapshot.status === "playing") emit({ status: "loading" });
    });
    audio.addEventListener("ended", () => emit({ status: "paused" }));
    audio.addEventListener("error", () => {
      if (snapshot.status === "loading") {
        emit({
          status: "error",
          error: lastLoadInsecure
            ? INSECURE_HTTP_MESSAGE
            : "This stream wouldn't play. It may be offline or an unsupported format.",
        });
      }
    });
  }
  return audio;
}

function updateMediaSession(station: Station): void {
  const mediaSession = globalThis.navigator?.mediaSession;
  if (!mediaSession) return;
  try {
    mediaSession.metadata = new MediaMetadata({
      title: station.name,
      artist: formatTags(station.tags) || formatCountryName(station.country, station.countrycode) || "Radio",
      album: "RadioScout",
      artwork:
        station.favicon === ""
          ? []
          : [{ src: upgradeInsecureUrl(station.favicon), sizes: "512x512", type: "image/png" }],
    });
    mediaSession.setActionHandler("play", () => void resume());
    mediaSession.setActionHandler("pause", () => pause());
    mediaSession.setActionHandler("stop", () => stop());
  } catch {
    // MediaSession is progressive enhancement — never break playback.
  }
}

/**
 * Native bridge stub. When the Capacitor foreground-service plugin lands
 * (Kotlin + Media3, porting `PlayerService.java`), route here first:
 * `if (await NativeAudio.play(url)) return true`. Until then the WebView
 * `<audio>` element is the player on every platform.
 */
function playViaNative(_station: Station, _url: string): Promise<boolean> {
  if (!isNative()) return Promise.resolve(false);
  // No native audio plugin registered yet — fall through to web audio.
  return Promise.resolve(false);
}

async function resolveUrl(station: Station): Promise<string> {
  const local = pickPlayableUrl(station);
  try {
    const { resolveStreamUrl } = await import("@/lib/radio/api");
    const remote = await resolveStreamUrl(station.stationuuid);
    return sanitizeStreamUrl(remote ?? local);
  } catch {
    return local;
  }
}

export function usePlayer(): PlayerSnapshot & {
  play: (station: Station) => void;
  toggle: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
} {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return { ...snap, play, toggle, stop, setVolume, toggleMute };
}

export function play(station: Station): void {
  const token = ++playToken;
  emit({ station, status: "loading", error: null, needsNative: false });

  void (async () => {
    const element = ensureAudio();
    if (!element) {
      emit({ status: "error", error: "Audio isn't available during prerender." });
      return;
    }
    const url = await resolveUrl(station);
    if (token !== playToken) return; // superseded by a newer play()
    if (url === "") {
      emit({ status: "error", error: "This station has no stream URL." });
      return;
    }
    if (isHlsUrl(url) && !element.canPlayType("application/vnd.apple.mpegurl")) {
      // Chrome/Android WebView can't play HLS in <audio> — flag for the
      // native plugin instead of spinning on an error event.
      emit({ needsNative: true, status: "error", error: "This is an HLS stream — needs the native player (APK)." });
      return;
    }
    if (await playViaNative(station, url)) {
      emit({ status: "playing" });
      return;
    }
    // `http://` streams never load from an `https://` page (mixed-content on
    // web, cleartext in the APK WebView) — flag it so both failure paths below
    // explain the policy instead of blaming the station. The `<audio>` source
    // itself is upgraded first: when the host serves TLS this plays cleanly
    // with no per-request mixed-content warnings (HLS playlists fan out into
    // one warning per segment); when it doesn't, the error below still names
    // the policy via `lastLoadInsecure`, computed from the ORIGINAL url.
    lastLoadInsecure = isInsecureHttpStream(url) && globalThis.window?.location?.protocol === "https:";
    try {
      element.src = upgradeInsecureUrl(url);
      element.load();
      await element.play();
      if (token !== playToken) return;
      updateMediaSession(station);
      // History + server click-count, fire-and-forget (port of RadioDroid's
      // play → json/url flow). Dynamic imports keep Dexie out of this chunk
      // until the first play.
      void import("@/lib/radio/store").then((store) => store.logPlay(station)).catch(() => {});
    } catch (error: unknown) {
      if (token !== playToken) return; // abort() from a superseding play()
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "AbortError") {
        emit({
          status: "error",
          error: lastLoadInsecure
            ? INSECURE_HTTP_MESSAGE
            : "Couldn't start playback. Check your connection and try again.",
        });
      }
    }
  })();
}

export function pause(): void {
  audio?.pause();
}

export function resume(): Promise<void> {
  const element = ensureAudio();
  if (!element || !snapshot.station) return Promise.resolve();
  emit({ status: "loading", error: null });
  return element.play().catch(() => {
    emit({ status: "error", error: "Couldn't resume playback." });
  });
}

export function toggle(): void {
  if (!audio || !snapshot.station) return;
  if (snapshot.status === "playing" || snapshot.status === "loading") pause();
  else void resume();
}

/**
 * Card/row press behavior: pause/resume the current station, (re)play
 * anything else. The lists called `play()` unconditionally, so tapping the
 * Pause icon restarted the stream instead of pausing it.
 */
export function togglePlay(station: Station): void {
  if (snapshot.station?.stationuuid === station.stationuuid) toggle();
  else play(station);
}

export function stop(): void {
  ++playToken;
  if (audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }
  emit({ station: null, status: "idle", error: null, needsNative: false });
}

/** 0..1. Dragging above zero unmutes. Persisted for the next session. */
export function setVolume(volume: number): void {
  const clamped = Math.min(1, Math.max(0, volume));
  applyPlayerPrefs({ volume: clamped, muted: clamped === 0 ? snapshot.muted : false });
}

export function toggleMute(): void {
  applyPlayerPrefs({ volume: snapshot.volume, muted: !snapshot.muted });
}
