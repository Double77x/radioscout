import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { formatCountryName, formatTags } from "@/lib/radio/format";
import {
  canUseNativeAudio,
  nativePause,
  nativePlay,
  nativeResume,
  nativeSetLeveling,
  nativeSetSleepTimer,
  nativeSetVolume,
  nativeStop,
  onNativePlaybackStatus,
  type NativePlaybackEvent,
} from "@/lib/native-audio";
import { DEFAULT_VOLUME, persistVolume, type PlayerPrefs } from "@/lib/radio/prefs";
import { hostOf, parkRecord, type RetiredOutput } from "@/lib/player/elements";
import { buildLevelingGraph, type LevelingGraph } from "@/lib/player/leveling-graph";
import { ReconnectTimer, reconnectDelayMs } from "@/lib/radio/reconnect";
import { normalizeSleepMinutes, SLEEP_FADE_MS } from "@/lib/radio/sleep";
import { writeLastStation } from "@/lib/radio/last-played";
import { emit, getServerSnapshot, getSnapshot, snapshot, subscribe, type PlayerSnapshot } from "@/lib/player/store";
import {
  adaptGain,
  adaptGainSteady,
  computeRms,
  effectiveRms,
  readNormalizeEnabled,
  SETTLE_TICKS,
  writeNormalizeEnabled,
} from "@/lib/radio/normalize";
import {
  isHlsUrl,
  isInsecureHttpStream,
  pickPlayableUrl,
  sanitizeStreamUrl,
  upgradeInsecureUrl,
  type Station,
} from "@/lib/radio/types";

/**
 * Playback singleton. On the APK the Media3 foreground service is the
 * player (lock-screen / shade / headset / Auto controls via MediaSession);
 * everywhere else one shared `<audio>` element is. State fans out via
 * `useSyncExternalStore` (no context re-renders, SSR-safe snapshot — see
 * `lib/player/store`, which owns the snapshot singleton and the listening
 * clock; this module owns elements, transport, leveling and handoff).
 *
 * Port of RadioDroid's `PlayerService` play path at web fidelity:
 * resolve → load → play → MediaSession. Recording and wake alarms stay
 * native-only (out of scope, same as before).
 */

let audio: HTMLAudioElement | null = null;
let playToken = 0;
/** Retry wait for a dropped mid-play stream (backoff + quiet toast). */
const reconnectTimer = new ReconnectTimer();
/** Attempts used in the live retry sequence (`0` = none). */
let reconnectAttempt = 0;
/** True while a retry sequence owns recovery (manual transport clears it). */
let retryingReconnect = false;
/**
 * True once the live output played through at least once. A `loading` error
 * after this is a drop (reconnect); before it, a stillborn tune (verdict).
 * Fresh `play()` replays reset it; `playing` sets it.
 */
let playedThrough = false;
/** `true` while the Media3 service (not `<audio>`) owns playback. */
let usingNative = false;
/** Native event subscription is attached once per session. */
let nativeListenerReady = false;
/** `true` when the pending load is an `http://` stream on an `https://` page (blocked by policy, not offline). */
let lastLoadInsecure = false;
/** Shown instead of the generic failure when the stream is HTTP-only on a secure page. */
const INSECURE_HTTP_MESSAGE =
  "This station only streams over insecure HTTP, which secure pages and the app WebView block. Pick a station with an HTTPS stream.";

/** Write prefs to storage and the live output (service or element). */
export function applyPlayerPrefs(prefs: PlayerPrefs): void {
  const volume = Math.min(1, Math.max(0, Number.isFinite(prefs.volume) ? prefs.volume : DEFAULT_VOLUME));
  const muted = prefs.muted === true;
  // `muted` (not volume 0) is the autoplay-policy signal — keep the element
  // mirrored so a stale flag can never strand playback silent.
  if (audio) {
    audio.muted = muted;
    audio.volume = muted ? 0 : volume;
  }
  if (usingNative) void nativeSetVolume(volume, muted).catch(() => {});
  persistVolume(volume, muted);
  // A manual volume touch cancels an in-flight sleep fade — the user is awake.
  fadeToken += 1;
  emit({ volume, muted });
}

/** One-time compat-mode notice per launch (see below). */
let warnedFallback = false;
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
/** Pending sleep-timer fire handle (null = off; station-independent). */
let sleepTimeout: ReturnType<typeof globalThis.setTimeout> | null = null;
/** Fade generation: manual volume touches bump it to cancel in-flight fades. */
let fadeToken = 0;
/** Hosts whose streams failed under analysis routing (session-only). */
const blockedHosts = new Set<string>();
/** One direct-replay rescue per element build (error listener below). */
let retriedDirect = false;
/** Abort for the live element's listeners (replaced on every element swap). */
let audioAbort: AbortController | null = null;
/** Scratch window for the analyser (allocated with the graph). */
let analysisBuffer: Float32Array<ArrayBuffer> | null = null;

function ensureAudio(): HTMLAudioElement | null {
  if (globalThis.window === undefined) return null;
  if (!audio) {
    audio = new Audio();
    audio.preload = "none";
    audio.volume = snapshot.muted ? 0 : snapshot.volume;
    audio.muted = snapshot.muted;
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
    audioAbort?.abort();
    audioAbort = new AbortController();
    attachLiveListeners(audio, audioAbort.signal);
  }
  return audio;
}
/**
 * Wire the live listener set to an element. Every handler starts with an
 * identity guard so a retired element (pre-swap incoming, mid-teardown
 * predecessor) can never clobber the live snapshot; the owner's
 * AbortController detaches the whole set atomically on swap/teardown.
 */
function attachLiveListeners(element: HTMLAudioElement, signal: AbortSignal): void {
  element.addEventListener(
    "playing",
    () => {
      if (audio !== element) return;
      if (!usingNative) {
        // A (re)connection landing ends any retry sequence.
        playedThrough = true;
        cancelReconnect();
        emit({ status: "playing", error: null });
      }
    },
    { signal },
  );
  element.addEventListener(
    "pause",
    () => {
      if (audio !== element) return;
      if (usingNative) return;
      // A dead element settling mid-sequence must not flip the snapshot out
      // from under the loop (manual pauses cancel first, so a pending
      // sequence here is always the loop's own).
      if (retryingReconnect) return;
      if (snapshot.status === "playing" || snapshot.status === "loading") emit({ status: "paused" });
    },
    { signal },
  );
  element.addEventListener(
    "waiting",
    () => {
      if (audio !== element) return;
      if (usingNative) return;
      if (snapshot.status === "playing") emit({ status: "loading" });
    },
    { signal },
  );
  element.addEventListener(
    "ended",
    () => {
      if (audio !== element) return;
      if (retryingReconnect) return;
      if (!usingNative) emit({ status: "paused" });
    },
    { signal },
  );
  element.addEventListener(
    "error",
    () => {
      if (audio !== element) return;
      if (usingNative) return;
      // Dead-element noise mid-sequence belongs to the loop, not to a
      // verdict — the loop owns recovery until it gives up.
      if (retryingReconnect) return;
      if (snapshot.status === "loading") {
        // A routed load fails when the host sends no CORS headers (the
        // graph can only read CORS-clean streams). Rescue once per element:
        // remember the host, rebuild direct, replay — genuinely offline
        // stations just fail again with the standard error below.
        if (audioRouted && normalizeOn && snapshot.station && !retriedDirect) {
          retriedDirect = true;
          const host = hostOf(element.src);
          if (host) blockedHosts.add(host);
          const station = snapshot.station;
          rebuildAudio();
          play(station);
          return;
        }
        // A load that fails AFTER the stream played through is a drop, not
        // a stillborn tune (drops usually stall through `waiting` first, so
        // they arrive here, not while `playing`). Walk the backoff table.
        if (playedThrough && snapshot.station) {
          playedThrough = false;
          beginReconnect(snapshot.station);
          return;
        }
        // A failed load must not strand the output ducked behind the
        // verdict — the next play() re-ducks anyway.
        try {
          if (audio) audio.muted = snapshot.muted;
        } catch {
          // Element torn down mid-failure — nothing to restore.
        }
        setFadeLevel(userLevel());
        emit({
          status: "error",
          error: lastLoadInsecure
            ? INSECURE_HTTP_MESSAGE
            : "This stream wouldn't play. It may be offline or an unsupported format.",
        });
      }
    },
    { signal },
  );
  element.addEventListener(
    "timeupdate",
    () => {
      if (audio !== element) return;
      // RMS ticks ride the element clock (~4Hz, no timers): cheap enough to
      // leave wired, gated to active leveling runs.
      if (usingNative || !normalizeOn || !audioRouted || !normGain || !normAnalyser) return;
      if (snapshot.status !== "playing") return;
      adaptTick();
    },
    { signal },
  );
}

/**
 * Whether a station's host can be routed through Web Audio (leveling needs
 * CORS headers; remembered-blocked hosts play direct). Pure lookup — the
 * caller decides what to do with a `false`.
 */
function canRouteStation(station: Station | null): boolean {
  if (!normalizeOn || typeof AudioContext === "undefined") return false;
  if (!station) return true;
  const host = hostOf(pickPlayableUrl(station));
  return host === null || !blockedHosts.has(host);
}

/**
 * Route a fresh (sourceless) element through the leveling graph. Skipped
 * when the toggle is off, Web Audio is unavailable, or the pending station's
 * host already proved unanalysable this session.
 */
function maybeRouteAudio(element: HTMLAudioElement): void {
  audioRouted = false;
  retriedDirect = false;
  if (!canRouteStation(snapshot.station)) return;
  const graph = buildLevelingGraph(element);
  if (!graph) {
    audioRouted = false;
    return;
  }
  const { ctx, gain, analyser } = graph;
  audioCtx = ctx;
  normGain = gain;
  normAnalyser = analyser;
  analysisBuffer = new Float32Array(analyser.fftSize);
  audioRouted = true;
  // Fresh graph starts at unity in the fast settle phase (see play()).
  settleTicksLeft = SETTLE_TICKS;
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
  // Detach listeners first — teardown events must never fire into the void.
  audioAbort?.abort();
  audioAbort = null;
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

/** Station-switch crossfade length — old fades out while new sweeps in. */
const CROSSFADE_MS = 1000;
/** Upper bound for an incoming preload before the switch fails loudly. */
const HANDOFF_WATCHDOG_MS = 20_000;

/** Staged incoming station: preloading while the live element keeps playing. */
let incoming: HTMLAudioElement | null = null;
/** Abort for the incoming live listener set (promoted on handoff). */
let incomingAbort: AbortController | null = null;
/** Abort for the incoming pre-handoff pair (playing/error triggers). */
let handoffAbort: AbortController | null = null;
/** Staged leveling graph for the incoming element (null = direct). */
let incomingGraph: LevelingGraph | null = null;
/** Whether the staged graph is bound (mirrors `audioRouted` for live). */
let incomingRouted = false;
/** Rescue replay spent for the staged element (mirrors `retriedDirect`). */
let incomingRetried = false;
/** Handoff watchdog handle (null when no preload is in flight). */
let incomingWatchdog: ReturnType<typeof globalThis.setTimeout> | null = null;
/** Handoff generation: any new play/pause/stop/volume touch cancels the blend. */
let handoffToken = 0;
/** Pre-switch live station + element (restored if the incoming fails). */
let handoffPrev: { station: Station; element: HTMLAudioElement | null } | null = null;

/**
 * Kill a staged incoming switch: abort listeners, park the element, close
 * its staged graph, clear the watchdog. The live element is untouched —
 * the old station simply keeps playing. Idempotent, never throws.
 */
function killIncoming(): void {
  if (incomingWatchdog !== null) {
    globalThis.clearTimeout(incomingWatchdog);
    incomingWatchdog = null;
  }
  handoffAbort?.abort();
  handoffAbort = null;
  const element = incoming;
  const abort = incomingAbort;
  const graph = incomingGraph;
  incoming = null;
  incomingAbort = null;
  incomingGraph = null;
  incomingRouted = false;
  incomingRetried = false;
  handoffPrev = null;
  if (element) parkRecord({ element, abort, ctx: graph?.ctx ?? null });
}

/**
 * Per-element volume ramp for the crossfade pair. Guarded by the handoff
 * token: a superseding transport action cancels the blend and parks the
 * retiring side (the promoted side is owned by the live snapshot then).
 */
function rampElement(
  element: HTMLAudioElement,
  from: number,
  to: number,
  ms: number,
  token: number,
  onDone?: () => void,
  onCancel?: () => void,
): void {
  try {
    element.volume = from;
  } catch {
    onDone?.();
    return;
  }
  if (!(ms > 0)) {
    try {
      element.volume = to;
    } catch {
      // Torn down mid-ramp — the done path still applies.
    }
    onDone?.();
    return;
  }
  let step = 0;
  const tick = () => {
    if (token !== handoffToken) {
      onCancel?.();
      return;
    }
    step += 1;
    try {
      element.volume = from + (to - from) * Math.min(1, step / FADE_STEPS);
    } catch {
      onDone?.();
      return;
    }
    if (step >= FADE_STEPS) {
      onDone?.();
      return;
    }
    globalThis.setTimeout(tick, ms / FADE_STEPS);
  };
  globalThis.setTimeout(tick, ms / FADE_STEPS);
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
    // Cancel any staged handoff first — the replay below starts its own.
    handoffToken += 1;
    killIncoming();
    rebuildAudio();
    if (wasPlaying) play(station);
  }
}

/**
 * Sleep timer: pause playback at a wall-clock deadline. Station-independent
 * (survives switches — only explicit cancel or firing clears it) and never
 * persisted. On the APK the service arms its own deadline too, so screen-off
 * WebView throttling can't trap the radio on all night; the web timeout
 * stays armed as the `<audio>`-mode fallback. Both arms are idempotent —
 * whichever fires first pauses, the other finds nothing playing and clears.
 */
export function setSleepTimer(minutes: number): void {
  clearSleepTimer();
  const validated = normalizeSleepMinutes(minutes);
  if (validated <= 0) {
    emit({ sleepEndsAt: 0 });
    return;
  }
  const endsAt = Date.now() + validated * 60_000;
  emit({ sleepEndsAt: endsAt });
  if (canUseNativeAudio()) void nativeSetSleepTimer(validated * 60).catch(() => {});
  sleepTimeout = globalThis.setTimeout(fireSleepTimer, Math.max(0, endsAt - Date.now()));
  toast("Sleep timer set", { description: `Playback fades out in ${validated} min.` });
}

/** Cancel the sleep timer on both arms. Never throws. */
export function cancelSleepTimer(): void {
  clearSleepTimer();
  emit({ sleepEndsAt: 0 });
  if (canUseNativeAudio()) void nativeSetSleepTimer(0).catch(() => {});
  toast("Sleep timer off");
}

function clearSleepTimer(): void {
  if (sleepTimeout !== null) {
    globalThis.clearTimeout(sleepTimeout);
    sleepTimeout = null;
  }
}

/** Deadline hit: clear both arms, then fade out (no-op when not playing). */
function fireSleepTimer(): void {
  sleepTimeout = null;
  emit({ sleepEndsAt: 0 });
  if (canUseNativeAudio()) void nativeSetSleepTimer(0).catch(() => {});
  if (snapshot.status !== "playing") return;
  fadeOutAndPause();
}

/** Fade-step count for every volume ramp (sleep + transport share the shape). */
const FADE_STEPS = 20;
/** Pause/stop fade-out length — felt, not heard as delay. */
const TRANSPORT_FADE_MS = 250;
/** Play/resume fade-in length — kills start-up blasts without feeling slow. */
const PLAY_FADE_MS = 900;

/** Write a fade level to the live output without touching persisted prefs. */
function setFadeLevel(level: number): void {
  if (usingNative) {
    void nativeSetVolume(level, false).catch(() => {});
    return;
  }
  if (audio) {
    try {
      audio.volume = level;
    } catch {
      // Element torn down mid-fade — the pause below still lands.
    }
  }
}

/**
 * Source-of-truth output level (persisted prefs — fade ramps always return
 * here, so the slider never learns a fade position).
 */
function userLevel(): number {
  return snapshot.muted ? 0 : snapshot.volume;
}

/**
 * Token-guarded volume ramp on the live output (never touches persisted
 * prefs). Time-driven chains are the only declarative-free option; the
 * generation token owns their lifetime (no unmount), and any manual volume
 * touch (see `applyPlayerPrefs`) bumps it to abort the ramp.
 */
function fadeRamp(from: number, to: number, ms: number, onDone?: () => void): void {
  const token = ++fadeToken;
  setFadeLevel(from);
  if (!(ms > 0)) {
    setFadeLevel(to);
    onDone?.();
    return;
  }
  let step = 0;
  const tick = () => {
    if (token !== fadeToken) return;
    step += 1;
    setFadeLevel(from + (to - from) * Math.min(1, step / FADE_STEPS));
    if (step >= FADE_STEPS) {
      onDone?.();
      return;
    }
    globalThis.setTimeout(tick, ms / FADE_STEPS);
  };
  globalThis.setTimeout(tick, ms / FADE_STEPS);
}

/** Sweep the live output up from silence (play/resume/station-switch). */
function fadeInFromSilence(): void {
  const target = userLevel();
  if (!(target > 0)) {
    setFadeLevel(0);
    return;
  }
  fadeRamp(0, target, PLAY_FADE_MS);
}

/**
 * Fade the live output to silence, pause, then restore the user's level
 * behind the pause. A manual volume touch bumps the token and aborts —
 * the user is awake, stop fading.
 */
function fadeOutAndPause(): void {
  const start = usingNative ? userLevel() : (audio?.volume ?? 0);
  if (!(start > 0)) {
    pauseNow();
    return;
  }
  fadeRamp(start, 0, SLEEP_FADE_MS, () => {
    pauseNow();
    setFadeLevel(start);
  });
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
    if (event.status === "playing") {
      // A service-side (re)connection landing ends any retry sequence.
      playedThrough = true;
      cancelReconnect();
      emit({ status: "playing", error: null });
    } else if (event.status === "paused") {
      // Headset / lock-screen pauses are user intent — take over from the loop.
      cancelReconnect();
      emit({ status: "paused" });
    } else if (event.status === "loading" && (snapshot.status === "loading" || snapshot.status === "playing")) {
      // A buffering blip on a paused/stopped player must not flip the dock
      // to tuning — loading is only meaningful while starting or audible
      // (mirrors the gated web `waiting` handler below). Paused stays paused
      // through network hiccups; resume surfaces any real failure instead.
      emit({ status: "loading" });
    } else if (snapshot.status === "playing" && snapshot.station && !retryingReconnect) {
      // A service error while audible is a drop (ExoPlayer already retried
      // internally) — walk the same table; the replay goes native-first.
      beginReconnect(snapshot.station);
    } else if (!retryingReconnect) {
      emit({ status: "error", error: event.error ?? "The native player hit an error." });
    }
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
 * Auto) and keeps playing after the WebView dies. `ok: false` on web, or
 * when the bridge rejects — callers fall through to `<audio>`. `handoff` is
 * true when the service overlapped the switch behind the old station (a
 * second player pre-buffers, the two blend over 1s, the session swaps — so
 * the caller skips its fade-in).
 */
async function playViaNative(
  station: Station,
  url: string,
  wantHandoff: boolean,
): Promise<{ ok: boolean; handoff: boolean }> {
  if (!canUseNativeAudio()) return { ok: false, handoff: false };
  ensureNativeListener();
  // `wantHandoff` arrives precomputed: the caller snapshots audibility
  // BEFORE flipping status to loading (reading it here would always see
  // this play's own loading state — exactly the race that made every
  // switch a cold cutover).
  const handoff = wantHandoff;
  try {
    // Cold start goes in silent — the caller sweeps up with
    // `fadeInFromSilence`, so station switches never blast (muted users stay
    // silent throughout). A handoff keeps the service level untouched.
    await nativePlay({
      url,
      title: station.name,
      artist: formatTags(station.tags) || formatCountryName(station.country, station.countrycode) || "Radio",
      artwork: station.favicon,
      volume: handoff ? snapshot.volume : 0,
      muted: handoff ? snapshot.muted : false,
      leveling: normalizeOn,
      handoff,
    });
    usingNative = true;
    parkWebAudio();
    return { ok: true, handoff };
  } catch {
    // A failed take-over must never leave the previous station audible
    // behind the error snapshot — stop the stray session, then let the
    // caller fall back to `<audio>`.
    void nativeStop().catch(() => {});
    usingNative = false;
    return { ok: false, handoff: false };
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
  play: (station: Station, options?: { fromReconnect?: boolean }) => void;
  toggle: () => void;
  stop: () => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setSleepTimer: (minutes: number) => void;
  cancelSleepTimer: () => void;
} {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return { ...snap, play, toggle, stop, setVolume, toggleMute, setSleepTimer, cancelSleepTimer };
}

/**
 * Guard for staged callbacks (playing/error/watchdog): only the current
 * token, handoff and staged element may proceed. A superseded callback
 * whose element is still staged cleans it up — otherwise a muted preload
 * would linger forever with no owner.
 */
function incomingCurrent(token: number, handoff: number, element: HTMLAudioElement): boolean {
  if (token === playToken && handoff === handoffToken && incoming === element) return true;
  if (incoming === element) killIncoming();
  return false;
}

/**
 * Stage an incoming station: a fresh element preloads the new stream while
 * the live element keeps playing, so the switch has zero silence. The
 * element starts muted at zero (gesture-safe); the handoff unmutes it into
 * the crossfade once it is actually playing. Leveling routes at build time
 * (`crossOrigin` is load-time state) into a staged graph promoted on swap.
 */
function buildIncoming(station: Station, url: string, token: number, handoff: number): void {
  // Preserve the revert target: the stale-preload cleanup below must not
  // eat the predecessor captured at play() time.
  const prev = handoffPrev;
  killIncoming();
  handoffPrev = prev;
  if (globalThis.window === undefined) return;
  const element = new Audio();
  element.preload = "auto";
  element.volume = 0;
  element.muted = true;
  incomingAbort = new AbortController();
  attachLiveListeners(element, incomingAbort.signal);
  // Route before src assignment (same load-time rule as the live path); a
  // routed build that fails falls back to direct below, once.
  incomingRetried = false;
  if (canRouteStation(station)) {
    const graph = buildLevelingGraph(element);
    if (graph) {
      incomingGraph = graph;
      incomingRouted = true;
    }
  }
  handoffAbort = new AbortController();
  const handoffSignal = handoffAbort.signal;
  element.addEventListener(
    "playing",
    () => {
      if (!incomingCurrent(token, handoff, element)) return;
      handoffToIncoming(station, handoff);
    },
    { signal: handoffSignal },
  );
  element.addEventListener(
    "error",
    () => {
      if (!incomingCurrent(token, handoff, element)) return;
      // A routed preload fails on CORS-blocked hosts — rescue once to a
      // direct element (mirrors the live `retriedDirect` path), else fail.
      if (incomingRouted && !incomingRetried) {
        incomingRetried = true;
        const host = hostOf(element.src);
        if (host) blockedHosts.add(host);
        buildIncomingDirect(station, url, token, handoff);
        return;
      }
      failIncomingSwitch(station, url);
    },
    { signal: handoffSignal },
  );
  incoming = element;
  incomingWatchdog = globalThis.setTimeout(() => {
    if (!incomingCurrent(token, handoff, element)) return;
    failIncomingSwitch(station, url);
  }, HANDOFF_WATCHDOG_MS);
  ensureLiveContext();
  try {
    element.src = upgradeInsecureUrl(url);
    element.load();
    void element.play().catch(() => {
      // Play rejection surfaces as an element error (or a stall caught by
      // the watchdog) — never reject unhandled out of the preload.
    });
  } catch {
    failIncomingSwitch(station, url);
  }
}

/** Rebuild a failed routed preload as a direct element (single rescue). */
function buildIncomingDirect(station: Station, url: string, token: number, handoff: number): void {
  // killIncoming parks the failed element (listeners detached, graph
  // closed) — the direct rebuild below starts clean. Preserve the revert
  // target across the cleanup like the first build does.
  const prev = handoffPrev;
  killIncoming();
  handoffPrev = prev;
  if (globalThis.window === undefined) return;
  const element = new Audio();
  element.preload = "auto";
  element.volume = 0;
  element.muted = true;
  incomingAbort = new AbortController();
  attachLiveListeners(element, incomingAbort.signal);
  incomingRetried = true;
  handoffAbort = new AbortController();
  const handoffSignal = handoffAbort.signal;
  element.addEventListener(
    "playing",
    () => {
      if (!incomingCurrent(token, handoff, element)) return;
      handoffToIncoming(station, handoff);
    },
    { signal: handoffSignal },
  );
  element.addEventListener(
    "error",
    () => {
      if (!incomingCurrent(token, handoff, element)) return;
      failIncomingSwitch(station, url);
    },
    { signal: handoffSignal },
  );
  incoming = element;
  incomingWatchdog = globalThis.setTimeout(() => {
    if (!incomingCurrent(token, handoff, element)) return;
    failIncomingSwitch(station, url);
  }, HANDOFF_WATCHDOG_MS);
  ensureLiveContext();
  try {
    element.src = upgradeInsecureUrl(url);
    element.load();
    void element.play().catch(() => {});
  } catch {
    failIncomingSwitch(station, url);
  }
}

/**
 * Promote a ready incoming element: swap module refs, blend the 1s
 * crossfade (old out, new in), retire the predecessor when silent. The old
 * station plays right up to the blend — zero silence on every switch.
 */
function handoffToIncoming(station: Station, handoff: number): void {
  const next = incoming;
  if (!next) return;
  if (incomingWatchdog !== null) {
    globalThis.clearTimeout(incomingWatchdog);
    incomingWatchdog = null;
  }
  handoffAbort?.abort();
  handoffAbort = null;
  // Detach the predecessor's listeners first — its teardown events must
  // never fire into the new snapshot.
  audioAbort?.abort();
  const prevEl = audio;
  const prev: RetiredOutput | null = prevEl ? { element: prevEl, abort: audioAbort, ctx: audioCtx } : null;
  const prevLevel = (() => {
    try {
      return prevEl?.volume ?? 0;
    } catch {
      return 0;
    }
  })();
  audio = next;
  audioAbort = incomingAbort;
  incoming = null;
  incomingAbort = null;
  audioCtx = incomingGraph?.ctx ?? null;
  normGain = incomingGraph?.gain ?? null;
  normAnalyser = incomingGraph?.analyser ?? null;
  analysisBuffer = normAnalyser ? new Float32Array(normAnalyser.fftSize) : null;
  audioRouted = incomingRouted;
  incomingGraph = null;
  incomingRouted = false;
  incomingRetried = false;
  retriedDirect = false;
  handoffPrev = null;
  // The staged context was built outside a gesture task and may be
  // suspended — resume it now (still inside user-activation window from the
  // tap); if it refuses, fall back to direct so the switch never goes
  // silent behind a dead graph.
  ensureLiveContext();
  if (audioCtx && audioRouted) {
    void audioCtx.resume().catch(() => {
      const ctx = audioCtx;
      audioCtx = null;
      normGain = null;
      normAnalyser = null;
      analysisBuffer = null;
      audioRouted = false;
      if (ctx) void ctx.close().catch(() => {});
    });
  }
  emit({ status: "playing", error: null });
  // A promoted handoff is a (re)connection landing — end any retry sequence.
  playedThrough = true;
  cancelReconnect();
  updateMediaSession(station);
  logPlay(station);
  resetLevelingForStation();
  // Blend: predecessor out, successor (unmuted) in. Either chain cancelled
  // by a newer handoff parks the retiring side — no orphaned audio, ever.
  if (prev) {
    rampElement(
      prev.element,
      prevLevel,
      0,
      CROSSFADE_MS,
      handoff,
      () => parkRecord(prev),
      () => parkRecord(prev),
    );
  }
  if (!snapshot.muted) {
    try {
      next.muted = false;
    } catch {
      // Unmute failure just leaves this chain silent — the live error path
      // still owns failures from here.
    }
  }
  rampElement(next, 0, userLevel(), CROSSFADE_MS, handoff);
}

/**
 * Revert the snapshot to the still-playing predecessor and name the failure
 * in a toast. The old station never stopped, so the failed tune is a
 * non-event in the dock — the toast carries the verdict instead.
 */
function revertToPrevious(failedName: string, note?: string): void {
  const prev = handoffPrev;
  killIncoming();
  const prevStation = prev?.station;
  const prevElement = prev?.element;
  if (!prevStation || !prevElement) return;
  let audible = false;
  try {
    audible = !prevElement.paused;
  } catch {
    audible = false;
  }
  emit({ station: prevStation, status: audible ? "playing" : "paused", error: null });
  toast("Couldn't start that station", {
    description: note ?? `${failedName} wouldn't play — kept ${prevStation.name} on.`,
  });
}

/**
 * Incoming preload failed: keep the old station playing and say so. A cold
 * start with nothing to revert to keeps the error state.
 */
function failIncomingSwitch(station: Station, url: string): void {
  if (!handoffPrev?.station) {
    killIncoming();
    // A retry replay failing is a data point, not a verdict — keep walking
    // the backoff table (the snapshot stays `loading` throughout).
    if (retryingReconnect && snapshot.station) {
      continueReconnect(station, url);
      return;
    }
    lastLoadInsecure = isInsecureHttpStream(url) && globalThis.window?.location?.protocol === "https:";
    emit({
      status: "error",
      error: lastLoadInsecure
        ? INSECURE_HTTP_MESSAGE
        : "This stream wouldn't play. It may be offline or an unsupported format.",
    });
    return;
  }
  revertToPrevious(station.name);
}

/**
 * Drop retry state (manual transport takes over from the loop). The timer
 * is cancelled first so an armed wait can never fire behind the takeover.
 */
function cancelReconnect(): void {
  retryingReconnect = false;
  reconnectAttempt = 0;
  reconnectTimer.cancel();
}

/** First drop: quiet toast, `loading` dock, first wait armed. */
function beginReconnect(station: Station): void {
  retryingReconnect = true;
  reconnectAttempt = 1;
  toast("Connection lost", { description: "Retrying the stream…" });
  emit({ status: "loading", error: null });
  reconnectTimer.schedule(1, () => retryStation(station));
}

/**
 * A retry replay failed: walk the backoff table or verdict. The snapshot
 * stays `loading` throughout so the dock shows tuning, not failure.
 */
function continueReconnect(station: Station, url: string): void {
  const next = reconnectAttempt + 1;
  if (reconnectDelayMs(next) === null) {
    // Out of attempts — verdict + notify (the only loud toast in the flow).
    retryingReconnect = false;
    reconnectAttempt = 0;
    lastLoadInsecure = isInsecureHttpStream(url) && globalThis.window?.location?.protocol === "https:";
    const message = lastLoadInsecure
      ? INSECURE_HTTP_MESSAGE
      : "The connection dropped and we couldn't reconnect. Check your connection and try again.";
    emit({ status: "error", error: message });
    toast("Couldn't reconnect", { description: message });
    return;
  }
  reconnectAttempt = next;
  reconnectTimer.schedule(next, () => retryStation(station));
}

/** Retry replay: a cold-start-shaped `play()` with no revert target (the live element is dead). */
function retryStation(station: Station): void {
  play(station, { fromReconnect: true });
  // play() captured the dead predecessor above — there is nothing audible
  // to revert to, so force the cold-start failure branch on another failure.
  handoffPrev = null;
}

export function play(station: Station, options?: { fromReconnect?: boolean }): void {
  const token = ++playToken;
  // A fresh play cancels in-flight fades (a finishing pause-fade must never
  // park or re-level the new station's output) and any staged handoff.
  fadeToken += 1;
  handoffToken += 1;
  // A manual play abandons any retry wait; a retry replay keeps its count
  // (otherwise the loop could never exhaust).
  reconnectTimer.cancel();
  if (options?.fromReconnect !== true) {
    retryingReconnect = false;
    reconnectAttempt = 0;
  }
  // A fresh load hasn't played through yet — a `loading` error from here is
  // a stillborn tune until `playing` says otherwise.
  playedThrough = false;
  // Handoff intent, captured BEFORE the loading emit below overwrites the
  // evidence: true when the service owns output right now — `playing`, or
  // `loading` with a live service (a switch/rebuffer in flight never stops
  // the old station, so it is still audible; a tap landing mid-resolve must
  // still blend). Cold starts have no current item, so the service-side
  // conditions reject a stale `true` there — the native guard owns the final
  // say, this flag only stops suppressing it.
  const serviceAudible = usingNative && (snapshot.status === "playing" || snapshot.status === "loading");
  // Pause state at tap time: a pause landing mid-resolve (below) is a fresh
  // user verdict that aborts this take — honor the silence.
  const pausedAtTap = snapshot.status === "paused";
  const handoff = handoffToken;
  killIncoming();
  // Remember the live output for the handoff (and for the failure revert) —
  // it keeps playing untouched until the new stream is ready.
  handoffPrev = snapshot.station ? { station: snapshot.station, element: audio } : null;
  writeLastStation(station);
  emit({ station, status: "loading", error: null, needsNative: false });

  void (async () => {
    const element = ensureAudio();
    if (!element) {
      emit({ status: "error", error: "Audio isn't available during prerender." });
      return;
    }
    const url = await resolveUrl(station);
    if (token !== playToken) return; // superseded by a newer play()
    if (handoff !== handoffToken) return; // paused/stopped mid-resolve
    if (!pausedAtTap && snapshot.status === "paused") {
      // User paused mid-resolve: honor the silence AND revert the snapshot
      // (it already names the new station, which never started — resume must
      // find the still-parked predecessor, not an empty take).
      const prev = handoffPrev?.station;
      if (prev) emit({ station: prev, status: "paused", error: null });
      return;
    }
    if (element !== audio) return; // element rebuilt mid-resolve (leveling toggle)
    if (url === "") {
      emit({ status: "error", error: "This station has no stream URL." });
      return;
    }
    // APK first: the service plays every format (including HLS) with
    // system media UI. Web falls through to `<audio>`.
    // Drop a stale handoff intent if the user visibly took over mid-resolve
    // (paused/stopped/errored); `loading` is this play's own state, and a
    // `playing` arrival only reconfirms audible output.
    const status = snapshot.status;
    const wantHandoff = serviceAudible && (status === "loading" || status === "playing");
    const takeover = await playViaNative(station, url, wantHandoff);
    if (takeover.ok) {
      if (token !== playToken) {
        // Superseded while the bridge connected — stop the stray start.
        void nativeStop().catch(() => {});
        return;
      }
      emit({ status: "playing" });
      // A service-side (re)connection landing ends any retry sequence.
      playedThrough = true;
      cancelReconnect();
      // A service-side handoff never ducked the output — only cold starts
      // sweep up from silence.
      if (!takeover.handoff) fadeInFromSilence();
      logPlay(station);
      return;
    }
    usingNative = false;
    // Web handoff: the live element keeps playing while a fresh element
    // preloads the new stream (muted, leveled per its own host). On ready
    // the two blend over CROSSFADE_MS; on failure the old station never
    // stopped. Each play gets one CORS-rescue replay (incoming builder).
    if (isHlsUrl(url) && !element.canPlayType("application/vnd.apple.mpegurl")) {
      // Chrome/Android WebView can't play HLS in <audio> — and the native
      // bridge just declined. A cold start flags it; a live station keeps
      // playing behind a toast naming the APK need.
      if (!handoffPrev?.station) {
        killIncoming();
        handoffPrev = null;
        emit({ needsNative: true, status: "error", error: "This is an HLS stream — needs the native player (APK)." });
        return;
      }
      revertToPrevious(
        station.name,
        `${station.name} needs the native player (APK) — kept playing the current station.`,
      );
      return;
    }
    // `http://` flag for later failure verdicts, computed from the ORIGINAL
    // url (the staged element itself is upgraded at load). The native path
    // above keeps the original URL — Media3 plays HTTP fine.
    lastLoadInsecure = isInsecureHttpStream(url) && globalThis.window?.location?.protocol === "https:";
    // Stage the handoff: the live element is untouched from here — it keeps
    // playing until the incoming element blends in (or the switch fails and
    // the snapshot reverts to it).
    ensureLiveContext();
    buildIncoming(station, url, token, handoff);
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
  })();
}

export function pause(): void {
  // Pausing mid-switch abandons it: revert to the still-parked predecessor
  // first (pauseNow below then parks it) — otherwise the dock would name a
  // station that never started, and resume would play the wrong one.
  const prev = handoffPrev?.station ?? null;
  killIncoming();
  if (prev && snapshot.status === "loading") emit({ station: prev, status: "paused", error: null });
  // Only fade audible playback — a loading stream parks immediately.
  if (snapshot.status !== "playing") {
    pauseNow();
    return;
  }
  const start = usingNative ? userLevel() : (audio?.volume ?? 0);
  if (!(start > 0)) {
    pauseNow();
    return;
  }
  fadeRamp(start, 0, TRANSPORT_FADE_MS, () => {
    pauseNow();
    setFadeLevel(start);
  });
}

/** Immediate park (fade end-points, quiet paths, MediaSession stops). */
function pauseNow(): void {
  // A staged handoff dies with the pause — the user took over.
  killIncoming();
  // Manual pauses take over from the retry loop too.
  cancelReconnect();
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
  // Resuming mid-switch keeps the audible predecessor: kill the staged
  // switch, then continue below on the reverted snapshot (playing straight
  // away when it never stopped, replaying it otherwise).
  const prevStation = handoffPrev?.station ?? null;
  const prevEl = handoffPrev?.element ?? null;
  killIncoming();
  // A manual resume takes over from the retry loop too.
  cancelReconnect();
  if (prevStation && snapshot.status === "loading") {
    let audible = false;
    try {
      audible = prevEl !== null && !prevEl.paused;
    } catch {
      audible = false;
    }
    emit({ station: prevStation, status: audible ? "playing" : "paused", error: null });
    if (audible) return Promise.resolve();
  }
  if (usingNative) {
    if (!snapshot.station) return Promise.resolve();
    emit({ status: "loading", error: null });
    void nativeResume().catch(() => {
      setFadeLevel(userLevel());
      emit({ status: "error", error: "Couldn't resume playback." });
    });
    fadeInFromSilence();
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
  // Mirror the mute pref (a stale flag from a failed start would
  // otherwise strand this gesture-driven resume silent) and sweep up.
  element.muted = snapshot.muted;
  setFadeLevel(0);
  return element
    .play()
    .then(() => {
      fadeInFromSilence();
    })
    .catch(() => {
      setFadeLevel(userLevel());
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
  // Only fade audible playback — anything else parks immediately.
  if (snapshot.status !== "playing") {
    stopNow();
    return;
  }
  const start = usingNative ? userLevel() : (audio?.volume ?? 0);
  if (!(start > 0)) {
    stopNow();
    return;
  }
  fadeRamp(start, 0, TRANSPORT_FADE_MS, () => stopNow());
}

function stopNow(): void {
  ++playToken;
  // A finishing fade must never re-level output after the teardown.
  fadeToken += 1;
  // A staged handoff dies with the stop — the user took over.
  killIncoming();
  // A manual stop takes over from the retry loop too.
  cancelReconnect();
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
