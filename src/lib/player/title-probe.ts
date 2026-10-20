import type { TrackKind } from "@/lib/radio/store";
import { bbcNextPollDelayMs, bbcServiceIdForStation } from "@/lib/radio/bbc";
import { directIcyRoute, fetchIcyTitles, type IcyOutcome, type IcyTitle } from "@/lib/radio/icy";
import { loadDirectUnsupported, recordDirectUnsupported } from "@/lib/radio/direct-support";
import { fetchRadioliseTitle } from "@/lib/radio/radiolise";
import { subscribeRadioliseTitle, type RadioliseSubscription } from "@/lib/radio/radiolise-socket";
import { normaliseTrackTitle, readTitlesEnabled } from "@/lib/radio/titles";
import { siteConfig } from "@/lib/site";
import { envString, isRecord } from "@/lib/utils";
import { isHlsUrl, type Station } from "@/lib/radio/types";

/** The engine-owned edges the probe must not absorb (transport stays put). */
export interface TitleProbeHooks {
  /** True while this arm still owns the live play. */
  isCurrent: () => boolean;
  /** Current rendered subtitle, for the changed-title check. */
  currentTrack: () => string | null;
  /** True when the Media3 service owns playback. */
  isNative: () => boolean;
  /** True while the snapshot status is `playing` (BBC reschedule). */
  isPlaying: () => boolean;
  /** Apply a changed title to the dock, session and history. Null clears. */
  applyTitle: (title: string | null, kind: TrackKind) => void;
  /** Hand a BBC title to the APK MediaSession (native only). */
  publishNativeTitle: (title: string) => void;
}

/** One armed play: callbacks and endpoint facts stay fixed until superseded. */
interface ProbeContext {
  hooks: TitleProbeHooks;
  url: string;
  bbcService: string | null;
  controller: AbortController;
}

/** Fresh titles are polled this often; the edge function caches for the same window. */
const ICY_TITLE_POLL_MS = 20_000;
/** Ceiling for a direct read, kept under the poll interval. */
const ICY_DIRECT_TIMEOUT_MS = 10_000;
/** Ceiling for the shared Radiolise lookup; cold stations hang until their first title. */
const RADIOLISE_TIMEOUT_MS = 5000;
/** Consecutive push reconnects; resets on the first pushed title. */
const RADIOLISE_MAX_FAILURES = 3;
/** Backoff between push reconnects: fast first retry, then patience. */
const RADIOLISE_RETRY_MS = [2000, 5000, 10_000, 30_000];

/**
 * Stream URLs this browser could not read directly. A refused `icy-metadata`
 * preflight surfaces as a `TypeError`, indistinguishable from a network error,
 * and the browser logs it un-catchably — so we memoise the URL and go straight
 * to the edge function. Seeded from storage (a week of memory, so a repeat visit
 * never replays the failure); session misses are recorded back.
 */
const directIcyUnsupported: Set<string> = loadDirectUnsupported();

const state: {
  context: ProbeContext | null;
  busy: boolean;
  pollTimer: ReturnType<typeof globalThis.setInterval> | null;
  bbcTimer: ReturnType<typeof globalThis.setTimeout> | null;
  sub: RadioliseSubscription | null;
  retryTimer: ReturnType<typeof globalThis.setTimeout> | null;
  retries: number;
  pushFailures: number;
} = {
  context: null,
  busy: false,
  pollTimer: null,
  bbcTimer: null,
  sub: null,
  retryTimer: null,
  retries: 0,
  pushFailures: 0,
};

/** Tear down every probe timer, socket and in-flight request. */
export function clearTitleProbe(): void {
  state.context?.controller.abort();
  state.context = null;
  state.busy = false;
  state.sub?.unsubscribe();
  state.sub = null;
  state.retries = 0;
  if (state.retryTimer !== null) {
    globalThis.clearTimeout(state.retryTimer);
    state.retryTimer = null;
  }
  if (state.pollTimer !== null) {
    globalThis.clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
  if (state.bbcTimer !== null) {
    globalThis.clearTimeout(state.bbcTimer);
    state.bbcTimer = null;
  }
}

/** Changed titles only: every probe tier funnels through here. */
function applyProbedTitle(context: ProbeContext, raw: string, kind: TrackKind = "icy"): string | null {
  if (!context.hooks.isCurrent()) return null;
  // Normalised before comparing: stations re-send the same title with varying
  // padding, and the raw strings never match (see titles.ts).
  const normalised = normaliseTrackTitle(raw);
  const title = normalised === "" ? null : normalised;
  if (title === context.hooks.currentTrack()) {
    if (import.meta.env.DEV) console.log("[icy-probe] subtitle (unchanged):", title);
    return null;
  }
  context.hooks.applyTitle(title, kind);
  if (import.meta.env.DEV) console.log("[icy-probe] subtitle:", title);
  return title;
}

/**
 * Push continual updates over the Radiolise WebSocket (web only — native has
 * ExoPlayer, BBC has no ICY to push). A healthy subscription stands the poll
 * loop down; an unexpected drop reconnects with backoff while the fallback
 * chain covers the gap; a station-level error ends the subscription and leaves
 * polling to carry it.
 */
function connectRadiolisePush(context: ProbeContext): void {
  if (context.hooks.isNative() || context.bbcService !== null) return;
  // Eager on purpose: supersede/stop/pause tear the socket down through
  // clearTitleProbe, so a play that never starts costs one handshake.
  if (!context.hooks.isCurrent()) return;
  if (state.pushFailures >= RADIOLISE_MAX_FAILURES) return;
  // Offline: every tier needs the network, and each would log its own
  // un-catchable failure. Stay quiet; the tick below revives the socket when
  // the network returns.
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (state.sub !== null) return;
  state.sub = subscribeRadioliseTitle(context.url, {
    onTitle: (title) => {
      if (!context.hooks.isCurrent()) return;
      state.retries = 0;
      state.pushFailures = 0;
      applyProbedTitle(context, title);
    },
    onStationError: (type) => {
      if (!context.hooks.isCurrent()) return;
      if (import.meta.env.DEV) console.log("[icy-probe] push station error:", type);
      // Stable per-station verdict — exhaust the budget so this play stops
      // opening sockets and polling carries it.
      state.pushFailures = RADIOLISE_MAX_FAILURES;
      state.sub?.unsubscribe();
      state.sub = null;
    },
    onClose: (expected) => {
      state.sub = null;
      if (expected || !context.hooks.isCurrent() || !context.hooks.isPlaying()) return;
      state.pushFailures += 1;
      if (state.pushFailures >= RADIOLISE_MAX_FAILURES) return;
      const delay = RADIOLISE_RETRY_MS[Math.min(state.retries, RADIOLISE_RETRY_MS.length - 1)] ?? 30_000;
      state.retries += 1;
      if (state.retryTimer !== null) globalThis.clearTimeout(state.retryTimer);
      state.retryTimer = globalThis.setTimeout(() => {
        state.retryTimer = null;
        connectRadiolisePush(context);
      }, delay);
    },
  });
}

/** BBC RMS verdict; a non-ok response means "no data right now", not an error. */
async function refreshBbcTitle(context: ProbeContext, service: string): Promise<Record<string, unknown> | null> {
  const query = `service=${encodeURIComponent(service)}`;
  let endpoint: string | null = null;
  if (import.meta.env.DEV) {
    endpoint = `/__bbc/probe?${query}`;
  } else {
    // Dynamic import: @capacitor/core must never load at module scope
    // (node/unit-test contexts have no native bridge).
    const { isNative } = await import("@/lib/capacitor");
    if (isNative()) {
      // APK builds bake no VITE_CANONICAL_URL (CI sets no Vite env and
      // wrangler vars never reach the client), so use the hardcoded site URL
      // instead. Without this the endpoint stays null and BBC titles never
      // leave the device.
      // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- empty env var counts as unset and falls through to the hardcoded site URL
      const canonical = envString("VITE_CANONICAL_URL") || siteConfig.url;
      endpoint = `${canonical.replace(/\/+$/, "")}/api/bbc-title?${query}`;
    } else {
      endpoint = `/api/bbc-title?${query}`;
    }
  }
  if (endpoint === null) return null;
  try {
    const response = await fetch(endpoint, { signal: context.controller.signal });
    if (!response.ok) return null;
    const data: unknown = await response.json();
    if (isRecord(data) && typeof data.title === "string" && data.title.trim() !== "") {
      const kind: TrackKind = data.kind === "programme" ? "programme" : "track";
      const applied = applyProbedTitle(context, data.title, kind);
      if (import.meta.env.DEV) console.log("[bbc-probe] subtitle:", data.title);
      // Native owns audio on the APK but decodes no titles from BBC HLS —
      // hand the probed one to the session (notification, lock, car) down the
      // same in-place path the metadata listener uses. Deduped here and again
      // service-side; the web MediaSession is handled by the engine hook.
      if (applied !== null && context.hooks.isNative()) context.hooks.publishNativeTitle(applied);
      return data;
    }
    return null;
  } catch {
    // Aborted or endpoint unreachable — next poll retries.
    return null;
  }
}

/**
 * Next BBC poll from the verdict just applied: tracks (or nothing yet) stay on
 * the hot loop, programmes back off to their boundary one-shot (or the 3-minute
 * net when the window gives no usable end). One timer does both jobs — no
 * separate interval. Cleared on supersede/pause/stop with the rest of the probe.
 */
function scheduleBbcNext(context: ProbeContext, verdict: Record<string, unknown> | null): void {
  if (state.bbcTimer !== null) {
    globalThis.clearTimeout(state.bbcTimer);
    state.bbcTimer = null;
  }
  state.bbcTimer = globalThis.setTimeout(() => {
    state.bbcTimer = null;
    if (!context.hooks.isCurrent() || !context.hooks.isPlaying()) return;
    refreshOnce(context);
  }, bbcNextPollDelayMs(verdict));
}

/** One poll tick; the chain order and budget behaviour live here. */
function refreshOnce(context: ProbeContext): void {
  // Offline: every tier needs the network and each would log its own
  // un-catchable failure. The snapshot keeps its last title meanwhile.
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  // A push subscription owns continual updates while healthy — polling
  // underneath it only burns requests for titles dedupe would drop.
  if (state.sub?.isOpen() === true) return;
  // Revive a missing socket (post-offline recovery). A subscribed socket still
  // connecting, a pending backoff retry, and an exhausted budget all say no
  // inside; only a clean miss reconnects.
  if (state.sub === null && state.retryTimer === null) connectRadiolisePush(context);
  // A direct read plus an edge fallback can outlast the interval; skip the
  // tick rather than run two probes on one controller.
  if (state.busy) return;
  state.busy = true;
  void (async () => {
    try {
      // BBC feeds carry no ICY blocks and RMS sends browsers no CORS headers,
      // so BBC stations probe the RMS-backed endpoint instead. No push
      // subscription either: it carries the same ICY their HLS feeds lack.
      if (context.bbcService !== null) {
        scheduleBbcNext(context, await refreshBbcTitle(context, context.bbcService));
        return;
      }
      // Chain order on web: shared Radiolise lookup, in-page read, edge
      // fallback — reached only while no push subscription is healthy.
      // Radiolise holds upstream ICY connections open across callers, so a
      // warm station answers in <1s with no audio bytes pulled by anyone — but
      // a cold one hangs until its first title, hence the tight cap and
      // unconditional fall-through. Native keeps the endpoint-first order:
      // ExoPlayer already reports titles over the bridge.
      if (!context.hooks.isNative()) {
        const shared = await fetchRadioliseTitle(context.url, {
          signal: context.controller.signal,
          timeoutMs: RADIOLISE_TIMEOUT_MS,
        });
        if (shared.outcome === "ok" && shared.title !== undefined) {
          applyProbedTitle(context, shared.title);
          return;
        }
      }
      if (!context.hooks.isNative() && !directIcyUnsupported.has(context.url)) {
        // `fetchIcyTitles` promises never to reject, but if it does the edge
        // fallback below is still worth trying — never skip it.
        const direct = await fetchIcyTitles(context.url, {
          maxTitles: 1,
          signal: context.controller.signal,
          timeoutMs: ICY_DIRECT_TIMEOUT_MS,
        }).catch((): { outcome: IcyOutcome; titles: IcyTitle[] } => ({ outcome: "fetch-error", titles: [] }));
        const route = directIcyRoute(direct.outcome, direct.titles);
        if (route.kind === "apply") {
          applyProbedTitle(context, route.title);
          return;
        }
        if (route.kind === "stop") return;
        if (route.memo) {
          directIcyUnsupported.add(context.url);
          recordDirectUnsupported(context.url);
        }
      }
      // Fallback: dev probes server-side through the vite-only /__icy endpoint
      // (no CORS limits, follows redirects); prod web and APK call the
      // edge-cached /api/icy-title function (absolute URL on native, where
      // relative would hit the local shell).
      const probePath = `/api/icy-title?url=${encodeURIComponent(context.url)}&titles=1`;
      let endpoint: string | null = null;
      if (import.meta.env.DEV) {
        endpoint = `/__icy/probe?url=${encodeURIComponent(context.url)}&titles=1`;
      } else {
        // Dynamic import: @capacitor/core must never load at module scope.
        const { isNative } = await import("@/lib/capacitor");
        if (isNative()) {
          const canonical = envString("VITE_CANONICAL_URL");
          endpoint =
            canonical === undefined
              ? null
              : `${canonical.replace(/\/+$/, "")}/api/icy-title?url=${encodeURIComponent(context.url)}`;
        } else {
          endpoint = probePath;
        }
      }
      if (endpoint === null) return;
      try {
        const response = await fetch(endpoint, { signal: context.controller.signal });
        if (!response.ok) return;
        const data: unknown = await response.json();
        if (isRecord(data) && Array.isArray(data.titles)) {
          const first: unknown = data.titles[0];
          if (isRecord(first) && typeof first.title === "string" && first.title.trim() !== "") {
            applyProbedTitle(context, first.title);
          }
        }
      } catch {
        // Endpoint unreachable or aborted — the next poll retries.
      }
    } finally {
      state.busy = false;
    }
  })();
}

/**
 * Track the live StreamTitle for the player subtitle. Probes once immediately
 * (fast first paint, even while loading) then re-polls while playing so track
 * changes replace the subtitle instead of going stale. Web chain: shared
 * Radiolise lookup, in-page read, edge fallback — with a push subscription
 * owning continual updates while healthy. Native keeps the endpoint-first
 * order; ExoPlayer supplies non-BBC titles over the bridge.
 */
export function armTitleProbe(station: Station, url: string, hooks: TitleProbeHooks): void {
  clearTitleProbe();
  state.pushFailures = 0;
  // BBC RMS probing is always on (web + native): the 30s edge verdict is
  // globally cached, so one listener costs nothing extra. Raw ICY probing
  // stays opt-in on web and bridge-driven on native (ExoPlayer decodes it).
  const bbcService = bbcServiceIdForStation(station);
  if (bbcService === null && !readTitlesEnabled()) return;
  // HLS playlists carry no ICY StreamTitle (and a bridged element's own `src`
  // is a `blob:` MediaSource) — probing either just burns a request per play
  // and per poll for a title that can't be there. BBC HLS feeds are exempt:
  // they run their own RMS-backed chain below.
  if (bbcService === null && (!/^https?:/i.test(url) || isHlsUrl(url))) return;
  const context: ProbeContext = { hooks, url, bbcService, controller: new AbortController() };
  state.context = context;
  // The service id is fixed for this arming. ICY stations ride a fixed
  // interval (stood down while the push subscription is healthy); BBC
  // stations chain adaptive timeouts off each verdict, so there is no
  // interval to start for them — the initial refreshOnce arms the chain.
  connectRadiolisePush(context);
  refreshOnce(context);
  if (bbcService === null) {
    state.pollTimer = globalThis.setInterval(() => {
      if (!hooks.isCurrent() || !hooks.isPlaying()) return;
      refreshOnce(context);
    }, ICY_TITLE_POLL_MS);
  }
}
