import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { formatCountryName, formatTags } from "@/lib/radio/format";
import {
  canUseNativeAudio,
  nativePause,
  nativePlay,
  nativeResume,
  nativeSetLeveling,
  nativeSetVolume,
  nativeStop,
  onNativePlaybackStatus,
  type NativePlaybackEvent,
} from "@/lib/native-audio";
import { loadMuted, loadVolume, persistVolume, type PlayerPrefs } from "@/lib/radio/prefs";
import { readLastStation, writeLastStation } from "@/lib/radio/last-played";
import {
  adaptGain,
  adaptGainSteady,
  computeRms,
  effectiveRms,
  readNormalizeEnabled,
  SETTLE_TICKS,
  writeNormalizeEnabled,
} from "@/lib/radio/normalize";
import { queryClient } from "@/lib/query-client";
import {
  isHlsUrl,
  isInsecureHttpStream,
  pickPlayableUrl,
  sanitizeStreamUrl,
  upgradeInsecureUrl,
  type Station,
} from "@/lib/radio/types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

/** Query key for the listening-stats charts (owned here — the recorder lives in `emit`). */
export const LISTENING_KEY = ["radio", "listening"] as const;

/** Audibility threshold: taps shorter than this bank no listening time. */
const MIN_LISTENING_SECONDS = 5;

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
 * Playback singleton. On the APK the Media3 foreground service is the
 * player (lock-screen / shade / headset / Auto controls via MediaSession);
 * everywhere else one shared `<audio>` element is. State fans out via
 * `useSyncExternalStore` (no context re-renders, SSR-safe snapshot).
 *
 * Port of RadioDroid's `PlayerService` play path at web fidelity:
 * resolve → load → play → MediaSession. Recording and wake alarms stay
 * native-only (out of scope, same as before).
 */

let audio: HTMLAudioElement | null = null;
let playToken = 0;
/** `true` while the Media3 service (not `<audio>`) owns playback. */
let usingNative = false;
/** Native event subscription is attached once per session. */
let nativeListenerReady = false;
/** `true` when the pending load is an `http://` stream on an `https://` page (blocked by policy, not offline). */
let lastLoadInsecure = false;
/** Shown instead of the generic failure when the stream is HTTP-only on a secure page. */
const INSECURE_HTTP_MESSAGE =
  "This station only streams over insecure HTTP, which secure pages and the app WebView block. Pick a station with an HTTPS stream.";
const listeners = new Set<() => void>();

/** Write prefs to storage and the live output (service or element). */
export function applyPlayerPrefs(prefs: PlayerPrefs): void {
  const volume = Math.min(1, Math.max(0, Number.isFinite(prefs.volume) ? prefs.volume : 0.9));
  const muted = prefs.muted === true;
  if (audio) audio.volume = muted ? 0 : volume;
  if (usingNative) void nativeSetVolume(volume, muted).catch(() => {});
  persistVolume(volume, muted);
  emit({ volume, muted });
}

function initialSnapshot(): PlayerSnapshot {
  if (globalThis.window === undefined) {
    return { station: null, status: "idle", error: null, needsNative: false, volume: 0.9, muted: false };
  }
  // Quick resume: the previous station returns paused (never autoplaying).
  // Hydration still starts from `serverSnapshot` below and picks this up as
  // a post-hydration update, so the prerender ("Nothing playing") matches.
  const restored = readLastStation();
  return {
    station: restored,
    status: restored ? "paused" : "idle",
    error: null,
    needsNative: false,
    volume: loadVolume(),
    muted: loadMuted(),
  };
}

let snapshot: PlayerSnapshot = initialSnapshot();

/**
 * Static prerender snapshot. The server always renders the idle dock, so
 * hydration must start there too — the restored station applies as a normal
 * post-hydration update. Passing `getSnapshot` here instead would hydrate a
 * stored station over "Nothing playing" markup (React #418) for every
 * returning user.
 */
const serverSnapshot: PlayerSnapshot = {
  station: null,
  status: "idle",
  error: null,
  needsNative: false,
  volume: 0.9,
  muted: false,
};

function getServerSnapshot(): PlayerSnapshot {
  return serverSnapshot;
}

/** One-time compat-mode notice per launch (see below). */
let warnedFallback = false;
/** Audible-stretch clock: epoch ms when the current `playing` run began (`0` = none). */
let sessionStart = 0;
/** Station the running stretch belongs to (rolled over on mid-play swaps). */
let sessionStation: Station | null = null;

/** Leveling toggle (module-owned; synced by `setNormalization`). */
let normalizeOn = readNormalizeEnabled();
/** Web Audio graph for the live element (null while playing direct). */
let audioCtx: AudioContext | null = null;
let normGain: GainNode | null = null;
let normAnalyser: AnalyserNode | null = null;
/** True while the live element is routed through the graph. */
let audioRouted = false;
/** Settle ticks left in the fast tune-in phase (0 = steady crawl). */
let settleTicksLeft = 0;
/** Hosts whose streams failed under analysis routing (session-only). */
const blockedHosts = new Set<string>();
/** One direct-replay rescue per element build (error listener below). */
let retriedDirect = false;
/** Scratch window for the analyser (allocated with the graph). */
let analysisBuffer: Float32Array<ArrayBuffer> | null = null;

function emit(next: Partial<PlayerSnapshot>): void {
  const wasPlaying = snapshot.status === "playing";
  snapshot = { ...snapshot, ...next };
  const isPlaying = snapshot.status === "playing";
  // Listening sessions ride the same transitions for web `<audio>` and the
  // native service (both report through here): entering `playing` starts the
  // clock, any other arrival banks the stretch. No effect on SSR — `emit`
  // never runs during prerender.
  if (!wasPlaying && isPlaying) {
    sessionStation = snapshot.station;
    sessionStart = Date.now();
  } else if (wasPlaying && !isPlaying) {
    endListeningSession(Date.now());
  } else if (isPlaying && next.station && next.station.stationuuid !== sessionStation?.stationuuid) {
    // Station swapped mid-play with no interim state — roll the session over.
    endListeningSession(Date.now());
    sessionStation = snapshot.station;
    sessionStart = Date.now();
  }
  for (const notify of listeners) notify();
}

/** Bank one audible stretch (shared by session end and kill-flush). */
function bankListeningSession(station: Station, elapsed: number, now: number): void {
  const started_at = new Date(now - elapsed * 1000).toISOString();
  // Dynamic import keeps Dexie out of this chunk until listening happens.
  void import("@/lib/radio/store")
    .then((store) =>
      store.logListening({ stationuuid: station.stationuuid, name: station.name, started_at, seconds: elapsed }),
    )
    .then(() => queryClient.invalidateQueries({ queryKey: LISTENING_KEY }))
    .catch(() => {});
}

/** Bank the elapsed `playing` stretch, if it clears the tap threshold. */
function endListeningSession(now: number): void {
  const station = sessionStation;
  const elapsed = station !== null && sessionStart > 0 ? Math.round((now - sessionStart) / 1000) : 0;
  sessionStart = 0;
  sessionStation = null;
  if (!station || elapsed < MIN_LISTENING_SECONDS) return;
  bankListeningSession(station, elapsed, now);
}

/**
 * Bank the elapsed stretch WITHOUT ending it (background/kill flush): the
 * clock restarts so totals keep accumulating while backgrounded. Below the
 * tap threshold nothing banks and the clock keeps its original start — those
 * seconds stay pending instead of being dropped.
 */
export function checkpointListeningSession(now: number = Date.now()): void {
  const station = sessionStation;
  if (snapshot.status !== "playing" || station === null || sessionStart <= 0) return;
  const elapsed = Math.round((now - sessionStart) / 1000);
  if (elapsed < MIN_LISTENING_SECONDS) return;
  sessionStart = now;
  bankListeningSession(station, elapsed, now);
}

let flushArmed = false;
let onPageHide: (() => void) | null = null;
let onVisibilityHidden: (() => void) | null = null;

/**
 * Bank partial sessions on tab hide/close. Called once from the app frame —
 * the OS may kill the page with no later events, and `visibilitychange`
 * also fires for background listening, so this checkpoints (banks +
 * restarts) instead of ending: totals keep accumulating.
 */
export function armListeningFlush(): void {
  if (flushArmed || globalThis.window === undefined) return;
  flushArmed = true;
  onPageHide = () => checkpointListeningSession();
  onVisibilityHidden = () => {
    if (globalThis.window.document.visibilityState === "hidden") checkpointListeningSession();
  };
  globalThis.addEventListener("pagehide", onPageHide);
  globalThis.window.document.addEventListener("visibilitychange", onVisibilityHidden);
}

/** Detach the lifecycle flush (owns the `armListeningFlush` handles). */
export function disarmListeningFlush(): void {
  if (!flushArmed) return;
  flushArmed = false;
  if (onPageHide) globalThis.removeEventListener("pagehide", onPageHide);
  if (onVisibilityHidden) globalThis.window?.document?.removeEventListener("visibilitychange", onVisibilityHidden);
  onPageHide = null;
  onVisibilityHidden = null;
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

/** Lowercased hostname of a URL, null when unparseable. Never throws. */
function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

function ensureAudio(): HTMLAudioElement | null {
  if (globalThis.window === undefined) return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.volume = snapshot.muted ? 0 : snapshot.volume;
    // Leveling routes through Web Audio — decided BEFORE any src assignment
    // (`crossOrigin` is load-time state and the source node binds once).
    maybeRouteAudio(audio);
    // Quick resume: point the fresh element at the restored station (no
    // fetch until play — preload stays "none"). Empty URL means the stored
    // row can't play; resume() falls back to the full play path then.
    if (snapshot.station) {
      const local = pickPlayableUrl(snapshot.station);
      if (local !== "") audio.src = local;
    }
    // Native owns playback while `usingNative` — stale `<audio>` events
    // must never flip the snapshot behind the service.
    audio.addEventListener("playing", () => {
      if (!usingNative) emit({ status: "playing", error: null });
    });
    audio.addEventListener("pause", () => {
      if (usingNative) return;
      if (snapshot.status === "playing" || snapshot.status === "loading") emit({ status: "paused" });
    });
    audio.addEventListener("waiting", () => {
      if (usingNative) return;
      if (snapshot.status === "playing") emit({ status: "loading" });
    });
    audio.addEventListener("ended", () => {
      if (!usingNative) emit({ status: "paused" });
    });
    audio.addEventListener("error", () => {
      if (usingNative) return;
      if (snapshot.status === "loading") {
        // A routed load fails when the host sends no CORS headers (the
        // graph can only read CORS-clean streams). Rescue once per element:
        // remember the host, rebuild direct, replay — genuinely offline
        // stations just fail again with the standard error below.
        if (audioRouted && normalizeOn && snapshot.station && !retriedDirect) {
          retriedDirect = true;
          const element = audio;
          const host = element ? hostOf(element.src) : null;
          if (host) blockedHosts.add(host);
          const station = snapshot.station;
          rebuildAudio();
          play(station);
          return;
        }
        emit({
          status: "error",
          error: lastLoadInsecure
            ? INSECURE_HTTP_MESSAGE
            : "This stream wouldn't play. It may be offline or an unsupported format.",
        });
      }
    });
    audio.addEventListener("timeupdate", () => {
      // RMS ticks ride the element clock (~4Hz, no timers): cheap enough to
      // leave wired, gated to active leveling runs.
      if (usingNative || !normalizeOn || !audioRouted || !normGain || !normAnalyser) return;
      if (snapshot.status !== "playing") return;
      adaptTick();
    });
  }
  return audio;
}

/**
 * Route a fresh (sourceless) element through the leveling graph. Skipped
 * when the toggle is off, Web Audio is unavailable, or the pending station's
 * host already proved unanalysable this session.
 */
function maybeRouteAudio(element: HTMLAudioElement): void {
  audioRouted = false;
  retriedDirect = false;
  if (!normalizeOn || typeof AudioContext === "undefined") return;
  if (snapshot.station) {
    const host = hostOf(pickPlayableUrl(snapshot.station));
    if (host !== null && blockedHosts.has(host)) return;
  }
  try {
    element.crossOrigin = "anonymous";
    const ctx = new AudioContext();
    const source = ctx.createMediaElementSource(element);
    const gain = ctx.createGain();
    gain.gain.value = 1;
    source.connect(gain);
    gain.connect(ctx.destination);
    // Perceptual tap (K-inspired, measurement only): rumble high-pass plus
    // presence shelf feed a dedicated analyser, whose whisper-quiet tail
    // keeps the branch pulled without touching the audible mix.
    const rumble = ctx.createBiquadFilter();
    rumble.type = "highpass";
    rumble.frequency.value = 60;
    const presence = ctx.createBiquadFilter();
    presence.type = "highshelf";
    presence.frequency.value = 1500;
    presence.gain.value = 4;
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const whisper = ctx.createGain();
    whisper.gain.value = 0.001;
    source.connect(rumble);
    rumble.connect(presence);
    presence.connect(analyser);
    analyser.connect(whisper);
    whisper.connect(ctx.destination);
    audioCtx = ctx;
    normGain = gain;
    normAnalyser = analyser;
    analysisBuffer = new Float32Array(analyser.fftSize);
    audioRouted = true;
    // Fresh graph starts at unity in the fast settle phase (see play()).
    settleTicksLeft = SETTLE_TICKS;
  } catch {
    // Graph unavailable — the element plays directly, leveling skipped.
    audioRouted = false;
  }
}

/** Resume a suspended context (autoplay policy parks it until a gesture). */
function ensureLiveContext(): void {
  if (audioCtx && audioCtx.state === "suspended") {
    void audioCtx.resume().catch(() => {});
  }
}

/** Discard the live element (toggle flips, CORS rescue) and build fresh. */
function rebuildAudio(): HTMLAudioElement | null {
  // No token bump: callers inside play() keep their token (stale-element
  // guards below own the race); callers outside start a fresh play() anyway.
  if (audio) {
    try {
      audio.pause();
    } catch {
      // Teardown races are harmless — the replacement owns audio now.
    }
    try {
      audio.removeAttribute("src");
      audio.load();
    } catch {
      // Same: the old element is detached below regardless.
    }
  }
  if (audioCtx) {
    void audioCtx.close().catch(() => {});
    audioCtx = null;
  }
  normGain = null;
  normAnalyser = null;
  analysisBuffer = null;
  audio = null;
  audioRouted = false;
  return ensureAudio();
}

/**
 * Match the live element to a URL's routing needs. A direct element upgrades
 * to routed when leveling is on and the host is clean; a routed element
 * downgrades to direct for remembered-blocked hosts (a tainted graph would
 * fail the load outright). Toggle-off freezes the live graph at unity gain —
 * no rebuild, no playback glitch.
 */
function ensureRoutedForUrl(url: string): HTMLAudioElement | null {
  const element = ensureAudio();
  if (!element) return null;
  const host = hostOf(url);
  const blocked = host !== null && blockedHosts.has(host);
  const wantRouted = normalizeOn && !blocked && typeof AudioContext !== "undefined";
  if (wantRouted && !audioRouted) return rebuildAudio();
  if (!wantRouted && audioRouted) {
    if (blocked) return rebuildAudio();
    freezeGain();
  }
  return element;
}

/** Park the leveling gain at unity (toggle-off path — analysis just stops). */
function freezeGain(): void {
  if (normGain && audioCtx) {
    try {
      normGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
    } catch {
      normGain.gain.value = 1;
    }
  }
}

/** One RMS tick: settle fast after tune-in, then crawl (never throws). */
function adaptTick(): void {
  const analyser = normAnalyser;
  const gain = normGain;
  const element = audio;
  if (!analyser || !gain || !element) return;
  try {
    if (!analysisBuffer || analysisBuffer.length !== analyser.fftSize) {
      analysisBuffer = new Float32Array(analyser.fftSize);
    }
    analyser.getFloatTimeDomainData(analysisBuffer);
    const effective = effectiveRms(computeRms(analysisBuffer), element.volume);
    if (effective === null) return;
    if (settleTicksLeft > 0) {
      settleTicksLeft -= 1;
      gain.gain.value = adaptGain(gain.gain.value, effective);
    } else {
      gain.gain.value = adaptGainSteady(gain.gain.value, effective);
    }
  } catch {
    // Analysis is progressive enhancement — never break playback.
  }
}

/**
 * Restart leveling for a new station: unity gain plus a fresh fast-settle
 * window, so the previous station's correction never blasts or ducks the
 * next one. Only `play()` calls this (`togglePlay` routes same-station taps
 * to pause/resume), and a rebuilt graph already starts settled-ready.
 */
function resetLevelingForStation(): void {
  settleTicksLeft = SETTLE_TICKS;
  if (normGain) {
    try {
      normGain.gain.value = 1;
    } catch {
      // Graph torn down mid-swap — the rebuild starts at unity anyway.
    }
  }
}

/**
 * Flip the leveling toggle live. On the APK the Media3 service owns audio,
 * so the flag goes straight to its processor and the web graph stays out of
 * it. On web, enabling rebuilds a direct element so the next load routes
 * (replaying the current station when audible); disabling just freezes the
 * graph at unity — the stream never glitches.
 */
export function setNormalization(enabled: boolean): void {
  writeNormalizeEnabled(enabled);
  normalizeOn = enabled;
  if (canUseNativeAudio()) {
    void nativeSetLeveling(enabled).catch(() => {});
    if (usingNative) return;
  }
  if (!enabled) {
    freezeGain();
    return;
  }
  ensureLiveContext();
  if (audio && !audioRouted && snapshot.station && snapshot.status !== "idle") {
    const station = snapshot.station;
    const wasPlaying = snapshot.status === "playing";
    rebuildAudio();
    if (wasPlaying) play(station);
  }
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
 * Mirror native transport state into the snapshot. Attached once, the first
 * time the service is used — the listener lives for the session so headset
 * / lock-screen pauses stay in sync with the dock.
 */
function ensureNativeListener(): void {
  if (nativeListenerReady || !canUseNativeAudio()) return;
  nativeListenerReady = true;
  void onNativePlaybackStatus((event: NativePlaybackEvent) => {
    if (!usingNative) return;
    if (event.status === "playing") emit({ status: "playing", error: null });
    else if (event.status === "paused") emit({ status: "paused" });
    else if (event.status === "loading") emit({ status: "loading" });
    else emit({ status: "error", error: event.error ?? "The native player hit an error." });
  }).catch(() => {
    nativeListenerReady = false;
  });
}

/** Park the web element when the service takes over (no event cross-talk). */
function parkWebAudio(): void {
  if (!audio) return;
  try {
    audio.pause();
  } catch {
    // Element teardown races are harmless — the service owns audio now.
  }
  audio.removeAttribute("src");
  audio.load();
}

/**
 * APK path: hand the resolved URL to the Media3 foreground service, which
 * renders the standard system media UI (notification, lock-screen, headset,
 * Auto) and keeps playing after the WebView dies. `false` on web, or when
 * the bridge rejects — callers fall through to `<audio>`.
 */
async function playViaNative(station: Station, url: string): Promise<boolean> {
  if (!canUseNativeAudio()) return false;
  ensureNativeListener();
  try {
    await nativePlay({
      url,
      title: station.name,
      artist: formatTags(station.tags) || formatCountryName(station.country, station.countrycode) || "Radio",
      artwork: station.favicon,
      volume: snapshot.volume,
      muted: snapshot.muted,
      leveling: normalizeOn,
    });
    usingNative = true;
    parkWebAudio();
    return true;
  } catch {
    // A failed take-over must never leave the previous station audible
    // behind the error snapshot — stop the stray session, then let the
    // caller fall back to `<audio>`.
    void nativeStop().catch(() => {});
    usingNative = false;
    return false;
  }
}

/** History + server click-count, fire-and-forget (port of RadioDroid's play → json/url flow). */
function logPlay(station: Station): void {
  // Dynamic import keeps Dexie out of this chunk until the first play.
  void import("@/lib/radio/store").then((store) => store.logPlay(station)).catch(() => {});
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
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snap, play, toggle, stop, setVolume, toggleMute };
}

export function play(station: Station): void {
  const token = ++playToken;
  writeLastStation(station);
  emit({ station, status: "loading", error: null, needsNative: false });
  // New station, new correction: never inherit the last station's gain.
  resetLevelingForStation();

  void (async () => {
    const element = ensureAudio();
    if (!element) {
      emit({ status: "error", error: "Audio isn't available during prerender." });
      return;
    }
    const url = await resolveUrl(station);
    if (token !== playToken) return; // superseded by a newer play()
    if (element !== audio) return; // element rebuilt mid-resolve (leveling toggle)
    if (url === "") {
      emit({ status: "error", error: "This station has no stream URL." });
      return;
    }
    // APK first: the service plays every format (including HLS) with
    // system media UI. Web falls through to `<audio>`.
    if (await playViaNative(station, url)) {
      if (token !== playToken) {
        // Superseded while the bridge connected — stop the stray start.
        void nativeStop().catch(() => {});
        return;
      }
      emit({ status: "playing" });
      logPlay(station);
      return;
    }
    usingNative = false;
    // Match the element to the URL's leveling needs (routed for CORS-clean
    // hosts when the toggle is on, direct otherwise). Each play gets one
    // CORS-rescue replay (error listener below).
    retriedDirect = false;
    const active = ensureRoutedForUrl(url) ?? element;
    ensureLiveContext();
    if (isHlsUrl(url) && !active.canPlayType("application/vnd.apple.mpegurl")) {
      // Chrome/Android WebView can't play HLS in <audio> — and the native
      // bridge just declined — so flag it instead of spinning on an error.
      emit({ needsNative: true, status: "error", error: "This is an HLS stream — needs the native player (APK)." });
      return;
    }
    // `http://` streams never load from an `https://` page (mixed-content on
    // web, cleartext in the APK WebView) — flag it so both failure paths below
    // explain the policy instead of blaming the station. The `<audio>` source
    // itself is upgraded first: when the host serves TLS this plays cleanly
    // with no per-request mixed-content warnings (HLS playlists fan out into
    // one warning per segment); when it doesn't, the error below still names
    // the policy via `lastLoadInsecure`, computed from the ORIGINAL url.
    // The native path above keeps the original URL — Media3 plays HTTP fine.
    lastLoadInsecure = isInsecureHttpStream(url) && globalThis.window?.location?.protocol === "https:";
    try {
      active.src = upgradeInsecureUrl(url);
      active.load();
      await active.play();
      if (active !== audio) {
        // Rebuilt mid-play (leveling toggle) — park the stray element.
        try {
          active.pause();
        } catch {
          // Already torn down; the live element owns audio now.
        }
        return;
      }
      if (token !== playToken) return;
      updateMediaSession(station);
      logPlay(station);
      // The native bridge exists on this device but didn't take playback —
      // say so once per launch. WebView audio has no lockscreen, headset or
      // background survival, so silence here would strand the user with no
      // explanation and no diagnostic trail.
      if (canUseNativeAudio() && !usingNative && !warnedFallback) {
        warnedFallback = true;
        toast("Compatibility playback", {
          description: "The system player didn't start — lockscreen and headset controls are unavailable.",
        });
      }
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
  if (usingNative) {
    // Optimistic for dock snappiness; the service event confirms.
    emit({ status: "paused" });
    void nativePause().catch(() => {
      emit({ status: "error", error: "Couldn't pause playback." });
    });
    return;
  }
  audio?.pause();
}

export function resume(): Promise<void> {
  if (usingNative) {
    if (!snapshot.station) return Promise.resolve();
    emit({ status: "loading", error: null });
    void nativeResume().catch(() => {
      emit({ status: "error", error: "Couldn't resume playback." });
    });
    return Promise.resolve();
  }
  const element = ensureAudio();
  if (!element || !snapshot.station) return Promise.resolve();
  ensureLiveContext();
  if (!element.getAttribute("src")) {
    // Restored row without a playable URL (or a parked element) — run the
    // full resolve path instead of playing silence.
    play(snapshot.station);
    return Promise.resolve();
  }
  emit({ status: "loading", error: null });
  return element.play().catch(() => {
    emit({ status: "error", error: "Couldn't resume playback." });
  });
}

export function toggle(): void {
  // No element yet (fresh load with a restored station): pause() is a safe
  // no-op via `audio?.pause()`, and resume() creates the element on demand —
  // so only the missing station bails. Gating on `audio` instead would leave
  // the row play button dead until something else builds the element.
  if (!snapshot.station) return;
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
  const wasNative = usingNative;
  usingNative = false;
  if (wasNative) void nativeStop().catch(() => {});
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
