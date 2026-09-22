/**
 * Player store: the snapshot singleton plus the listening-session clock.
 * Single-owner mutable state — only this module assigns `snapshot`;
 * importers treat the live binding as read-only and write via `emit`.
 * Nothing in here touches audio elements, transport, leveling or native —
 * those live in the hook module and import from here, never the reverse.
 */
import { DEFAULT_VOLUME, loadMuted, loadVolume } from "@/lib/radio/prefs";
import { readLastStation } from "@/lib/radio/last-played";
import { queryClient } from "@/lib/query-client";
import type { Station } from "@/lib/radio/types";

export type PlayerStatus = "idle" | "loading" | "playing" | "paused" | "error";

/** Query key for the listening-stats charts (owned here — the recorder lives in `emit`). */
export const LISTENING_KEY = ["radio", "listening"] as const;

/** Audibility threshold: taps shorter than this bank no listening time. */
const MIN_LISTENING_SECONDS = 5;

export interface PlayerSnapshot {
  station: Station | null;
  status: PlayerStatus;
  error: string | null;
  /** True when the stream needs the native foreground-service plugin. */
  needsNative: boolean;
  volume: number;
  muted: boolean;
  /** Sleep-timer deadline as epoch ms (`0` = off; never persisted). */
  sleepEndsAt: number;
}

function initialSnapshot(): PlayerSnapshot {
  if (globalThis.window === undefined) {
    return {
      station: null,
      status: "idle",
      error: null,
      needsNative: false,
      volume: DEFAULT_VOLUME,
      muted: false,
      sleepEndsAt: 0,
    };
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
    sleepEndsAt: 0,
  };
}

export let snapshot: PlayerSnapshot = initialSnapshot();

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
  volume: DEFAULT_VOLUME,
  muted: false,
  sleepEndsAt: 0,
};

export function getServerSnapshot(): PlayerSnapshot {
  return serverSnapshot;
}

const listeners = new Set<() => void>();

export function emit(next: Partial<PlayerSnapshot>): void {
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

/** Audible-stretch clock: epoch ms when the current `playing` run began (`0` = none). */
let sessionStart = 0;
/** Station the running stretch belongs to (rolled over on mid-play swaps). */
let sessionStation: Station | null = null;

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

export function subscribe(notify: () => void): () => void {
  listeners.add(notify);
  return () => {
    listeners.delete(notify);
  };
}

export function getSnapshot(): PlayerSnapshot {
  return snapshot;
}
