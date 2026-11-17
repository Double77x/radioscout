#!/usr/bin/env node
/**
 * Playback soak harness: plays a few stations for a long stretch with the tab
 * in the background, and records what the <audio> elements actually did.
 *
 * It answers one question: when playback stops, is that the browser (paused /
 * throttled / discarded) or the engine (transport stall, reconnect loop)?
 *
 *  - It launches the browser the user actually runs (--browser=brave) through a
 *    persistent context, with a throwaway profile, so Playwright's default args
 *    never reach the process and background throttling keeps the browser's own
 *    defaults.
 *  - Every <audio> the engine creates is tracked from before the app boots, so
 *    the log has paused / currentTime / readyState / networkState / error per
 *    element, plus the media stack's own messages over CDP. The engine's
 *    elements are never attached to the DOM, so this is the only way in.
 *  - Every 30s it fires one cheap request at the stream URL from inside the
 *    page, through the same profile and proxy: `probe-failed` beside a
 *    `stalled`/`ended` means the connection path went away (proxy, VPN
 *    extension, firewall), not the engine or the stream. A probe that fails
 *    while the element is playing normally is the probe being blocked, not
 *    the path — that baseline lands in the first minute.
 *  - Tab visibility is logged but cannot be forced: a Playwright-driven
 *    Chromium reports "visible" for every tab, window and minimize state
 *    (verified across Brave 157 and Chromium 158, including a real tab strip
 *    driven over CDP). Switch tabs in the run window by hand and those
 *    transitions land in the log next to the media events — that is how the
 *    hidden-tab case gets captured.
 *
 * Usage:
 *   pnpm soak                                   # 30 min, Chromium, 3 stations
 *   pnpm soak --browser=brave --minutes=30      # the browser that misbehaves
 *   pnpm soak --minutes=2 --names= --stations=<uuid>
 *   pnpm soak --browser=chromium --minutes=30 --out=.tmp-soak-control
 *
 * Output: <out>/run.jsonl (every event), <out>/summary.json, and a verdict
 * printed at the end. Audio plays out loud for the whole run — turn the volume
 * down, and do not mute: a muted tab is not "audible" and the browser is then
 * free to throttle it, which is not the condition being tested.
 */

import { spawn } from "node:child_process";
import { appendFileSync, createWriteStream, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const DEFAULT_STATION_ID = "8c78482a-17db-4057-a7c7-8fa14b3c3ce9";
const DEFAULT_NAMES = "Capital XTRA,Capital Dance";
const API = "https://de1.api.radio-browser.info";
/** A currentTime that has not moved this long while unpaused is a stall. */
const STALL_MS = 20_000;

/** @typedef {import("@playwright/test").Page} Page */

/** @typedef {{ code: number, message: string }} MediaErrorSummary */

/**
 * One media event off a tracked element.
 * @typedef {{
 *   t: number, type: string, vis: DocumentVisibilityState, src: string,
 *   paused: boolean, ct: number, rs: number, ns: number, vol: number,
 *   bufferedEnd: number, err: MediaErrorSummary | null
 * }} MediaEvent
 */

/** @typedef {{ t: number, state: DocumentVisibilityState }} VisibilityEvent */

/** @typedef {{ t: number, text: string }} TextEvent */

/**
 * The page-side recorder, published on `globalThis` before the app boots.
 * @typedef {{
 *   volume: number, live: HTMLAudioElement[], events: MediaEvent[],
 *   visEvents: VisibilityEvent[], text: TextEvent[], observing?: boolean
 * }} Tracker
 */

/**
 * One element's state in a sample.
 * @typedef {{
 *   src: string, paused: boolean, ct: number, rs: number, ns: number,
 *   vol: number, bufferedEnd: number, err: MediaErrorSummary | null
 * }} SampleElement
 */

/**
 * Everything one tick drained out of the page.
 * @typedef {{
 *   t: number, visState: DocumentVisibilityState, hidden: boolean,
 *   els: SampleElement[], events: MediaEvent[],
 *   visEvents: VisibilityEvent[], text: TextEvent[]
 * }} Sample
 */

/**
 * One logged finding. Fields are optional because each shape fills its own.
 * @typedef {{
 *   kind: string, at: number, vis?: string, src?: string, ct?: number,
 *   rs?: number, ns?: number, ms?: number, text?: string, forMs?: number,
 *   level?: string, message?: string, status?: number, url?: string,
 *   failure?: string | null, state?: string, via?: string, bufferedEnd?: number,
 *   detail?: unknown, error?: unknown
 * }} Finding
 */

/**
 * @typedef {{
 *   id: string, name: string, stream: string | null, page: Page | null,
 *   startedAt: number | null, startedMs: number | null, hiddenMs: number,
 *   findings: Finding[], paused: number, ended: number, errors: number,
 *   stalls: number, requests: number, requestFailures: number,
 *   streamRequests: number, lastTickAt: number | null,
 *   ctBySrc: Map<string, { ct: number, t: number }>,
 *   stallBySrc: Map<string, number>, wasPlaying: boolean,
 *   seenSrc: Set<string>, toasts: Set<string>, probes: number,
 *   probeFailures: number, lastProbe: Probe | null
 * }} Station
 */

/** @typedef {{ ok: boolean, ms: number, error?: string }} Probe */

/**
 * @typedef {{
 *   minutes: number, sampleMs: number, probeMs: number, browser: string,
 *   url: string, out: string, profile: string | null, volume: number,
 *   headless: boolean, spawnDev: boolean, stations: string[], names: string[]
 * }} Config
 */

/**
 * @typedef {{
 *   startedAt: string, config: unknown, stations: Station[],
 *   browser: string | null, version: string | null, verdict: string[]
 * }} Summary
 */

/** @type {Record<string, { executablePath?: string }>} */
const BROWSERS = {
  chromium: {},
  brave: { executablePath: String.raw`C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` },
  edge: { executablePath: String.raw`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` },
};

// --- args -------------------------------------------------------------------

/**
 * @param {string[]} argv
 * @returns {Record<string, string | true>}
 */
function parseArgs(argv) {
  /** @type {Record<string, string | true>} */
  const out = {};
  for (const raw of argv) {
    const match = /^--(?<name>[^=]+)(?:=(?<value>.*))?$/.exec(raw);
    if (!match?.groups) continue;
    out[match.groups.name] = match.groups.value ?? true;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
/** @type {Config} */
const config = {
  minutes: Number(args.minutes ?? 30),
  sampleMs: Number(args["sample-ms"] ?? 5000),
  /** 0 turns the path probes off; anything else sets how often they run. */
  probeMs: Number(args["probe-ms"] ?? 30_000),
  browser: String(args.browser ?? "chromium"),
  url: String(args.url ?? "http://localhost:8081").replace(/\/+$/, ""),
  out: path.resolve(String(args.out ?? ".tmp-soak")),
  /** Reuse a real browser profile instead of a throwaway one (close it first). */
  profile: args.profile ? path.resolve(String(args.profile)) : null,
  volume: Number(args.volume ?? 0.08),
  headless: Boolean(args.headless) && args.headless !== "false",
  spawnDev: args["spawn-dev"] !== "false",
  stations: String(args.stations ?? DEFAULT_STATION_ID)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
  names: String(args.names ?? DEFAULT_NAMES)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean),
};

mkdirSync(config.out, { recursive: true });
const startedAt = Date.now();
const runLog = createWriteStream(path.join(config.out, "run.jsonl"), { flags: "a" });

/**
 * One JSONL line per observation, wall clock plus elapsed for reading back.
 * @param {Record<string, unknown>} entry
 */
function log(entry) {
  runLog.write(`${JSON.stringify({ wall: new Date().toISOString(), at: Date.now() - startedAt, ...entry })}\n`);
}

/** @param {string} message */
function note(message) {
  console.log(`[${fmtElapsed()}] ${message}`);
}

function fmtElapsed() {
  const total = Math.round((Date.now() - startedAt) / 1000);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** @param {number} ms */
const sleep = (ms) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Read one of the radio-browser payloads as a list of records. The API is a
 * remote JSON shape, so this is the only place a response is trusted.
 * @param {string} url
 * @param {number} timeoutMs
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
async function fetchRecords(url, timeoutMs) {
  const res = await fetch(url, {
    headers: { "user-agent": "radioscout-soak/1.0" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  /** @type {unknown} */
  const payload = await res.json();
  /** @type {Array<Record<string, unknown>>} */
  const records = [];
  if (!Array.isArray(payload)) return records;
  for (const entry of payload) {
    if (isRecord(entry) && "name" in entry) records.push(entry);
  }
  return records;
}

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === "object" && value !== null;
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function asText(value) {
  return typeof value === "string" ? value : "";
}

// --- dev server -------------------------------------------------------------

async function reachable() {
  try {
    const res = await fetch(config.url, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  if (await reachable()) {
    note(`using the dev server already on ${config.url}`);
    return null;
  }
  if (!config.spawnDev) throw new Error(`nothing is serving ${config.url} and --spawn-dev=false`);
  const port = new URL(config.url).port || "8081";
  note(`starting pnpm dev on port ${port}`);
  const child = spawn("pnpm", ["dev", "--port", port], {
    stdio: "ignore",
    shell: process.platform === "win32",
    cwd: process.cwd(),
  });
  for (let i = 0; i < 120; i++) {
    await sleep(1000);
    if (await reachable()) {
      note("dev server ready");
      return child;
    }
  }
  throw new Error("dev server did not come up within 120s");
}

/** @param {import("node:child_process").ChildProcess | null} child */
function stopServer(child) {
  if (!child) return;
  try {
    if (process.platform === "win32") spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else child.kill("SIGTERM");
  } catch {
    // Leaving a dev server behind is survivable; a throw here is not.
  }
}

// --- stations ---------------------------------------------------------------

/** @param {string} uuid */
async function byUuid(uuid) {
  try {
    const list = await fetchRecords(`${API}/json/stations/byuuid/${uuid}`, 8000);
    const hit = list[0];
    return hit
      ? { id: uuid, name: asText(hit.name), stream: asText(hit.url_resolved) || asText(hit.url) || null }
      : { id: uuid, name: `station ${uuid.slice(0, 8)}`, stream: null };
  } catch {
    return { id: uuid, name: `station ${uuid.slice(0, 8)}`, stream: null };
  }
}

/** @param {string} name */
async function byName(name) {
  try {
    const list = await fetchRecords(
      `${API}/json/stations/search?name=${encodeURIComponent(name)}&limit=10&hidebroken=true&order=votes&reverse=true`,
      8000,
    );
    const hit = list.find(
      (station) => asText(station.url_resolved).startsWith("https://") || asText(station.url).startsWith("https://"),
    );
    return hit
      ? {
          id: asText(hit.stationuuid),
          name: asText(hit.name),
          stream: asText(hit.url_resolved) || asText(hit.url) || null,
        }
      : null;
  } catch {
    return null;
  }
}

// --- page instrumentation ---------------------------------------------------

/**
 * Runs before any app code: wraps the `Audio` constructor so every element the
 * engine builds is recorded, and keeps a rolling log of media events.
 *
 * Published on `globalThis` under `__soak` because the engine's elements are
 * never attached to the DOM — an evaluate() can only reach them through this.
 * The body is serialised into the page, so it may not reference module scope.
 */
/**
 * @param {{ volume: number }} options
 */
function installTracker({ volume }) {
  /** @type {Tracker} */
  const soak = { volume, live: [], events: [], visEvents: [], text: [] };
  Reflect.set(globalThis, "__soak", soak);
  /** @param {HTMLAudioElement} el */
  const track = (el) => {
    soak.live.push(el);
    if (soak.live.length > 24) soak.live.splice(0, soak.live.length - 24);
    /** @param {string} type */
    const capture = (type) => {
      // Volume is re-applied on every start: the engine sets it from prefs, and
      // a muted tab is not "audible" to the browser — keep it quiet but audible.
      if (type === "play" || type === "playing") {
        try {
          el.volume = soak.volume;
        } catch {
          // A volume write on a torn-down element is not interesting.
        }
      }
      let buffered = 0;
      try {
        for (let i = 0; i < el.buffered.length; i++) buffered = Math.max(buffered, el.buffered.end(i));
      } catch {
        buffered = 0;
      }
      soak.events.push({
        t: Date.now(),
        type,
        vis: document.visibilityState,
        src: (el.currentSrc || el.src || "").slice(0, 300),
        paused: el.paused,
        ct: el.currentTime,
        rs: el.readyState,
        ns: el.networkState,
        vol: Number(el.volume.toFixed(2)),
        bufferedEnd: buffered,
        err: el.error ? { code: el.error.code, message: el.error.message } : null,
      });
      if (soak.events.length > 4000) soak.events.splice(0, 1000);
    };
    const types = [
      "loadstart",
      "loadedmetadata",
      "loadeddata",
      "canplay",
      "canplaythrough",
      "play",
      "playing",
      "pause",
      "waiting",
      "stalled",
      "suspend",
      "ended",
      "error",
      "emptied",
      "abort",
      "seeking",
      "seeked",
      "ratechange",
    ];
    for (const type of types) {
      el.addEventListener(type, () => {
        capture(type);
      });
    }
  };
  const OriginalAudio = globalThis.Audio;
  /** @type {ProxyHandler<typeof Audio>} */
  const handler = {
    /** @param {typeof Audio} target @param {string[]} argArray */
    construct(target, argArray) {
      const element = new target(...argArray);
      track(element);
      return element;
    },
  };
  globalThis.Audio = new Proxy(OriginalAudio, handler);
  document.addEventListener("visibilitychange", () => {
    soak.visEvents.push({ t: Date.now(), state: document.visibilityState });
  });
}

/** Drains the tracker and returns one sample of every tracked element. */
function readSample() {
  const key = "__soak";
  // Identity first: `installTracker` is the only publisher, and it publishes a
  // whole tracker, so the value under the key is either that or nothing.
  /** @param {unknown} value @returns {value is Tracker} */
  const isTracker = (value) =>
    typeof value === "object" && value !== null && "live" in value && Reflect.get(globalThis, key) === value;

  const raw = /** @type {unknown} */ (Reflect.get(globalThis, key));
  if (!isTracker(raw)) return null;
  const soak = raw;
  const els = soak.live.map((el) => {
    let bufferedEnd = 0;
    try {
      for (let i = 0; i < el.buffered.length; i++) bufferedEnd = Math.max(bufferedEnd, el.buffered.end(i));
    } catch {
      bufferedEnd = 0;
    }
    return {
      src: (el.currentSrc || el.src || "").slice(0, 300),
      paused: el.paused,
      ct: el.currentTime,
      rs: el.readyState,
      ns: el.networkState,
      vol: Number(el.volume.toFixed(2)),
      bufferedEnd,
      err: el.error ? { code: el.error.code, message: el.error.message } : null,
    };
  });
  return {
    t: Date.now(),
    visState: document.visibilityState,
    hidden: document.hidden,
    els,
    events: soak.events.splice(0),
    visEvents: soak.visEvents.splice(0),
    text: soak.text.splice(0),
  };
}

/**
 * One cheap request at the stream the element is playing, fired from inside the
 * page so it leaves through the same profile, proxy and VPN extension the media
 * load does. An opaque response is enough: the question is only whether the
 * path answers at all. The body is an endless stream, so it is aborted as soon
 * as the headers are in.
 */
async function probeLive() {
  const raw = /** @type {unknown} */ (Reflect.get(globalThis, "__soak"));
  if (typeof raw !== "object" || raw === null || !("live" in raw)) return null;
  const tracked = raw.live;
  if (!Array.isArray(tracked) || tracked.length === 0) return null;
  /** @type {HTMLAudioElement[]} */
  const elements = [];
  for (const entry of tracked) {
    if (entry instanceof HTMLAudioElement) elements.push(entry);
  }
  const element = elements.findLast((el) => !el.paused) ?? elements.at(-1);
  const url = element ? element.currentSrc || element.src : "";
  if (!url) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, 6000);
  const t0 = performance.now();
  try {
    await fetch(url, { mode: "no-cors", cache: "no-store", signal: controller.signal });
    return { ok: true, ms: Math.round(performance.now() - t0) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, ms: Math.round(performance.now() - t0), error: message.slice(0, 160) };
  } finally {
    clearTimeout(timer);
    // Closing an endless response body is the point of the abort.
    controller.abort();
  }
}

const INTERESTING_TEXT = /connection lost|retrying|reconnect|playing|paused|stream|error|blocked/i;

/** Toast copy, so the app's own words land in the log next to the media state. */
function watchToasts() {
  const raw = /** @type {unknown} */ (Reflect.get(globalThis, "__soak"));
  if (typeof raw !== "object" || raw === null || !("text" in raw) || !("observing" in raw)) return;
  const texts = raw.text;
  if (!Array.isArray(texts)) return;
  if (raw.observing) return;
  raw.observing = true;
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        // Whole-app subtree inserts (the first React render) are not toasts.
        const element = node instanceof Element ? node : node.parentElement;
        const holder = element?.closest("[data-sonner-toaster]");
        if (!holder) continue;
        const text = (holder.textContent || "").replaceAll(/\s+/g, " ").trim();
        if (text && text.length < 240) texts.push({ t: Date.now(), text });
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// --- per-station bookkeeping ------------------------------------------------

/**
 * @param {{ id: string, name: string, stream: string | null }} info
 * @returns {Station}
 */
function newStation(info) {
  return {
    ...info,
    page: null,
    startedAt: null,
    startedMs: null,
    hiddenMs: 0,
    findings: [],
    paused: 0,
    ended: 0,
    errors: 0,
    stalls: 0,
    requests: 0,
    requestFailures: 0,
    streamRequests: 0,
    lastTickAt: null,
    ctBySrc: new Map(),
    stallBySrc: new Map(),
    wasPlaying: false,
    seenSrc: new Set(),
    toasts: new Set(),
    probes: 0,
    probeFailures: 0,
    lastProbe: null,
  };
}

/**
 * @param {Station} station
 * @param {string} kind
 * @param {Record<string, unknown>} [detail]
 */
function record(station, kind, detail = {}) {
  station.findings.push({ kind, at: Date.now() - startedAt, ...detail });
  log({ station: station.name, kind, ...detail });
}

/**
 * Turns one sample into findings. Three shapes matter: a pause nobody asked
 * for, an element error or close, and a currentTime that stops moving while the
 * element still claims to be playing.
 */
/**
 * @param {Station} station
 * @param {Sample | null} sample
 */
function inspect(station, sample) {
  if (!sample || !station.page) return;
  const now = sample.t;
  if (sample.hidden) station.hiddenMs += station.lastTickAt ? now - station.lastTickAt : 0;
  station.lastTickAt = now;

  for (const event of sample.events) {
    if (event.type === "pause") {
      // A pause arriving right after `ended` is the browser closing a stream
      // that ended, not a user-visible pause — the ended finding covers it.
      const endedTogether = sample.events.some((e) => e.type === "ended" && Math.abs(e.t - event.t) < 1500);
      if (!endedTogether) {
        station.paused += 1;
        record(station, "paused", {
          vis: event.vis,
          src: event.src,
          ct: Number(event.ct.toFixed(1)),
          rs: event.rs,
          error: event.err,
        });
      }
    } else if (event.type === "ended") {
      station.ended += 1;
      record(station, "ended", { vis: event.vis, src: event.src, ct: Number(event.ct.toFixed(1)) });
    } else if (event.type === "error") {
      station.errors += 1;
      record(station, "error", { vis: event.vis, src: event.src, error: event.err });
    }
  }

  const playing = sample.els.filter((el) => !el.paused && el.ct > 0);
  if (station.wasPlaying && playing.length === 0 && sample.els.length > 0) {
    const live = sample.els.at(-1);
    if (live) {
      record(station, "stopped", {
        vis: sample.visState,
        src: live.src,
        ct: Number(live.ct.toFixed(1)),
        rs: live.rs,
        ns: live.ns,
        error: live.err,
      });
    }
  }
  station.wasPlaying = playing.length > 0;

  for (const el of sample.els) {
    if (!el.src) continue;
    if (!station.seenSrc.has(el.src)) {
      station.seenSrc.add(el.src);
      record(station, "source", { src: el.src, vis: sample.visState });
    }
    const previous = station.ctBySrc.get(el.src);
    station.ctBySrc.set(el.src, { ct: el.ct, t: now });
    if (el.paused) {
      station.stallBySrc.delete(el.src);
      continue;
    }
    if (!previous) continue;
    const advanced = el.ct - previous.ct;
    if (advanced >= 0.5) {
      station.stallBySrc.delete(el.src);
      continue;
    }
    const since = station.stallBySrc.get(el.src) ?? previous.t;
    station.stallBySrc.set(el.src, since);
    if (now - since >= STALL_MS && !station.stallBySrc.get(`${el.src}:reported`)) {
      station.stallBySrc.set(`${el.src}:reported`, now);
      station.stalls += 1;
      record(station, "stalled", {
        vis: sample.visState,
        src: el.src,
        ct: Number(el.ct.toFixed(1)),
        rs: el.rs,
        ns: el.ns,
        bufferedEnd: Number(el.bufferedEnd.toFixed(1)),
        forMs: now - since,
      });
    }
  }

  for (const toast of sample.text) {
    if (station.toasts.has(toast.text)) continue;
    station.toasts.add(toast.text);
    if (INTERESTING_TEXT.test(toast.text)) record(station, "text", { vis: sample.visState, text: toast.text });
  }
  for (const change of sample.visEvents) log({ station: station.name, kind: "visibility", state: change.state });
}

// --- run --------------------------------------------------------------------

/** @type {Summary} */
const summary = {
  startedAt: new Date(startedAt).toISOString(),
  config: { ...config, out: undefined },
  stations: [],
  browser: null,
  version: null,
  verdict: [],
};

async function main() {
  if (config.minutes <= 0) throw new Error("--minutes must be positive");
  const correlation = BROWSERS[config.browser];
  if (!correlation) throw new Error(`unknown --browser=${config.browser} (chromium|brave|edge)`);
  if (correlation.executablePath && !existsSync(correlation.executablePath)) {
    throw new Error(`${config.browser} is not at ${correlation.executablePath}`);
  }

  note(`resolving ${config.stations.length + config.names.length} station(s)`);
  const infos = [];
  for (const uuid of config.stations) infos.push(await byUuid(uuid));
  for (const name of config.names) {
    const hit = await byName(name);
    if (hit) infos.push(hit);
    else note(`could not resolve "${name}" — skipping`);
  }
  if (infos.length === 0) throw new Error("no stations to play");

  const devServer = await ensureServer();
  devServerRef.child = devServer;

  const profileDir = config.profile ?? path.join(config.out, "profile");
  const context = await chromium.launchPersistentContext(profileDir, {
    ...correlation,
    headless: config.headless,
    viewport: null,
    args: [
      "--autoplay-policy=no-user-gesture-required",
      "--no-first-run",
      "--no-default-browser-check",
      "--window-size=1280,900",
    ],
    // Playwright defaults that switch off background behaviour; never wanted here.
    ignoreDefaultArgs: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });
  summary.browser = config.browser;
  summary.version = context.browser()?.version() ?? null;
  log({
    kind: "config",
    config: summary.config,
    browser: summary.browser,
    version: summary.version,
    profile: profileDir,
  });
  await context.addInitScript(installTracker, { volume: config.volume });

  const stations = infos.map((info) => newStation(info));
  summary.stations = stations;

  for (const station of stations) {
    // Reuse the window the persistent context opened, then add tabs.
    const page = context.pages().find((candidate) => candidate.url() === "about:blank") ?? (await context.newPage());
    station.page = page;
    /** @type {Set<string>} */
    const seenHosts = new Set();
    page.on("console", (message) => {
      if (message.type() === "error" || message.type() === "warning")
        log({ station: station.name, kind: "console", level: message.type(), text: message.text().slice(0, 400) });
    });
    page.on("pageerror", (error) => {
      record(station, "pageerror", { message: error.message.slice(0, 400) });
    });
    page.on("request", (request) => {
      const url = request.url();
      if (url.startsWith(config.url)) return;
      station.requests += 1;
      try {
        seenHosts.add(new URL(url).host);
      } catch {
        return;
      }
      if (station.stream && url.startsWith(station.stream.slice(0, station.stream.lastIndexOf("/") + 1)))
        station.streamRequests += 1;
      log({ station: station.name, kind: "request", method: request.method(), url: url.slice(0, 300) });
    });
    page.on("requestfailed", (request) => {
      const url = request.url();
      // The client fails over across radio-browser mirrors by design, and
      // station logos go through an image proxy that ORB blocks harmlessly.
      if (url.includes("radio-browser.info") || url.includes("wsrv.nl")) return;
      // ERR_ABORTED is the engine parking an element, not the network giving up.
      if (request.failure()?.errorText === "net::ERR_ABORTED") return;
      station.requestFailures += 1;
      record(station, "requestfailed", { url: url.slice(0, 300), failure: request.failure()?.errorText ?? null });
    });
    page.on("response", (response) => {
      const status = response.status();
      if (status >= 400) record(station, "response", { status, url: response.url().slice(0, 300) });
    });
    page.on("crash", () => {
      record(station, "crash", {});
    });

    // The media stack's own voice; the DOM cannot explain a decoder or network
    // failure on its own.
    try {
      const cdp = await context.newCDPSession(page);
      await cdp.send("Media.enable");
      cdp.on(
        "Media.playerMessagesLogged",
        (/** @type {{ messages?: Array<{ level?: string, message?: string }> }} */ event) => {
          // The payload carries an array of messages, not one message.
          for (const message of event.messages ?? []) {
            log({
              station: station.name,
              kind: "media-log",
              level: message.level ?? "unknown",
              message: (message.message ?? "").slice(0, 400),
            });
          }
        },
      );
      cdp.on("Media.playerErrorsRaised", (/** @type {{ errors?: unknown[] }} */ event) => {
        for (const mediaError of event.errors ?? []) {
          record(station, "media-error", { detail: mediaError });
        }
      });
      cdp.on(
        "Media.playerPropertiesChanged",
        (/** @type {{ properties?: Array<{ name?: string, value?: unknown }> }} */ event) => {
          for (const property of event.properties ?? []) {
            if (property.name === "kPaused" || property.name === "kReadyState") {
              log({ station: station.name, kind: "media-property", property: property.name, value: property.value });
            }
          }
        },
      );
    } catch (error) {
      note(`Media domain unavailable for ${station.name}: ${error instanceof Error ? error.message : String(error)}`);
    }

    note(`opening ${station.name}`);
    await page.goto(`${config.url}/?play=${encodeURIComponent(station.id)}`, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });
    await page.evaluate(watchToasts);

    let started = false;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const state = await page
        .evaluate(() => {
          const raw = /** @type {unknown} */ (Reflect.get(globalThis, "__soak"));
          if (typeof raw !== "object" || raw === null || !("live" in raw)) return { playing: false, src: "" };
          const candidate = raw.live;
          if (!Array.isArray(candidate)) return { playing: false, src: "" };
          /** @type {HTMLAudioElement[]} */
          const elements = [];
          for (const entry of candidate) {
            if (entry instanceof HTMLAudioElement) elements.push(entry);
          }
          const playing = elements.find((el) => !el.paused && el.currentTime > 0);
          return { playing: Boolean(playing), src: playing ? playing.currentSrc || playing.src : "" };
        })
        .catch(() => ({ playing: false, src: "" }));
      if (state.playing) {
        started = true;
        station.startedAt = Date.now();
        station.startedMs = Date.now() - startedAt;
        record(station, "started", { src: state.src.slice(0, 300) });
        break;
      }
    }
    if (!started) {
      // Autoplay flag not honoured, or the stream never answered: try the
      // control the user would press, then give up loudly.
      await page.bringToFront();
      const control = page.getByRole("button", { name: /play/i }).first();
      if (await control.count().catch(() => 0)) await control.click({ timeout: 5000 }).catch(() => {});
      await sleep(5000);
      const ok = await page
        .evaluate(() => {
          const raw = /** @type {unknown} */ (Reflect.get(globalThis, "__soak"));
          if (typeof raw !== "object" || raw === null || !("live" in raw)) return false;
          const candidate = raw.live;
          if (!Array.isArray(candidate)) return false;
          return candidate.some((el) => el instanceof HTMLAudioElement && !el.paused && el.currentTime > 0);
        })
        .catch(() => false);
      if (ok) {
        started = true;
        station.startedAt = Date.now();
        station.startedMs = Date.now() - startedAt;
        record(station, "started", { via: "click" });
      } else {
        record(station, "failed-to-start", {});
      }
    }
  }

  const visibility = await Promise.all(
    stations.map(
      (station) =>
        station.page?.evaluate(() => document.visibilityState).catch(() => "unknown") ?? Promise.resolve("unknown"),
    ),
  );
  note(`station tabs report ${[...new Set(visibility)].join("/")}; running ${config.minutes} min`);
  if (!visibility.includes("hidden"))
    note("visibility is not forced — switch tabs in that window and the log will record it");

  const deadline = Date.now() + config.minutes * 60_000;
  let tick = 0;
  while (Date.now() < deadline) {
    const remaining = Math.max(250, deadline - Date.now());
    await sleep(Math.min(config.sampleMs, remaining));
    const samples = await Promise.all(
      stations.map((station) => station.page?.evaluate(readSample).catch(() => null) ?? Promise.resolve(null)),
    );
    for (const [index, station] of stations.entries()) inspect(station, samples[index] ?? null);
    tick += 1;
    const probeEvery = config.probeMs > 0 ? Math.max(1, Math.round(config.probeMs / config.sampleMs)) : 0;
    if (probeEvery > 0 && tick % probeEvery === 0) {
      for (const station of stations) {
        const probe = await (station.page?.evaluate(probeLive).catch(() => null) ?? Promise.resolve(null));
        if (!probe) continue;
        station.probes += 1;
        station.lastProbe = probe;
        if (probe.ok) log({ station: station.name, kind: "probe-ok", ms: probe.ms });
        else {
          station.probeFailures += 1;
          record(station, "probe-failed", probe);
        }
      }
    }
    if (tick % 6 === 0) {
      const line = stations
        .map(
          (s) =>
            `${s.name}: ${s.paused ? "PAUSED" : s.stalls ? "STALL" : "ok"}${s.lastProbe?.ok === false ? " path-down" : ""}`,
        )
        .join(" | ");
      note(line);
    }
  }

  for (const station of stations) await station.page?.close().catch(() => {});
  await context.close().catch(() => {});
  stopServer(devServer);

  summarise(stations);
}

/** @param {Station[]} stations */
function summarise(stations) {
  const lines = [
    `run: ${config.minutes} min, ${config.browser} ${summary.version ?? ""}, ${stations.length} station(s)`,
  ];
  const longestHidden = Math.max(...stations.map((s) => s.hiddenMs), 0) / 60_000;
  if (longestHidden < 1) {
    lines.push(
      "NOTE: the station tabs never went hidden, so background throttling was not exercised —",
      "  this run covers the stream and the engine over time, not the hidden-tab case.",
    );
  } else {
    lines.push(`NOTE: the tab was hidden for up to ${longestHidden.toFixed(1)} min of the run.`);
  }

  for (const station of stations) {
    const mins = (station.hiddenMs / 60_000).toFixed(1);
    lines.push(
      "",
      station.name,
      `  id ${station.id}`,
      `  ${station.stream ? `stream ${station.stream.slice(0, 90)}` : "stream unknown"}`,
      `  started: ${station.startedMs === null ? "NO" : `yes, +${(station.startedMs / 1000).toFixed(1)}s`}  hidden: ${mins} min`,
      `  paused ${station.paused} · ended ${station.ended} · errors ${station.errors} · stalls ${station.stalls} · request failures ${station.requestFailures}`,
      `  external requests ${station.requests}, of which stream ${station.streamRequests}`,
    );
    if (station.probes > 0) lines.push(`  path probes ${station.probes}, failed ${station.probeFailures}`);
    if (station.findings.length === 0) lines.push("  findings: none");
    for (const finding of station.findings) {
      const detail = [
        finding.vis ? `vis=${finding.vis}` : null,
        finding.ct === undefined ? null : `t=${finding.ct}s`,
        finding.ms === undefined ? null : `${finding.ms}ms`,
        finding.error ? `err=${JSON.stringify(finding.error)}` : null,
        finding.text ? `"${finding.text}"` : null,
        finding.forMs ? `for=${Math.round(finding.forMs / 1000)}s` : null,
      ]
        .filter(Boolean)
        .join(" ");
      // A pause followed by a fresh source is the engine parking an element
      // while it retries, not the browser stopping playback.
      const teardown =
        finding.kind === "paused" &&
        station.findings.some(
          (other) =>
            (other.kind === "source" || other.kind === "started") &&
            other.at > finding.at &&
            other.at - finding.at < 15_000,
        );
      const suffix = teardown ? "  (engine teardown, not a browser pause)" : "";
      lines.push(`  · ${(finding.at / 1000).toFixed(0).padStart(4)}s ${finding.kind} ${detail}${suffix}`.trimEnd());
    }
    if (station.toasts.size > 0) lines.push(`  app said: ${[...station.toasts].join(" / ").slice(0, 300)}`);
  }

  const anyPause = stations.some((s) => s.paused > 0 || s.stalls > 0 || s.ended > 0 || s.errors > 0);
  lines.push("");
  if (anyPause) {
    const whileHidden = stations.some((s) =>
      s.findings.some((f) => (f.kind === "paused" || f.kind === "ended" || f.kind === "stalled") && f.vis === "hidden"),
    );
    lines.push(
      `verdict: playback broke during the run${whileHidden ? " while the tab was hidden" : ""}. See the findings above;`,
      "  `stalled` / `ended` / `error` are the stream or the engine failing; a `paused` with a",
      "  fresh stream request beside it is the engine parking the old element while it retries.",
    );
  } else {
    lines.push(`verdict: no pause, close, error or stall in ${config.minutes} min.`);
    if (longestHidden < 1) {
      lines.push(
        "  The tab was never hidden, so this clears the stream and the engine, not the hidden-tab case.",
        "  If it still stops when backgrounded, that is the browser's own tab handling: repeat with",
        "  --profile=<your Brave profile> (close Brave first) and switch tabs by hand mid-run.",
      );
    }
  }

  if (stations.some((s) => s.probeFailures > 0)) {
    lines.push(
      "",
      "A probe could not reach the stream host during the run (probe-failed), so at least",
      "  one break was the connection path going away, not the engine or the station ending.",
      "  Compare the probes either side of each finding: path alive while the element is",
      "  silent puts it back on the element; path dead at the same second is the proxy, the",
      "  VPN extension or the firewall. Repeat with that off and the cadence decides it.",
    );
  }

  const text = lines.join("\n");
  console.log(`\n${text}\n`);
  writeFileSync(path.join(config.out, "summary.json"), JSON.stringify({ ...summary, stations, text }, null, 2));
  appendFileSync(path.join(config.out, "summary.txt"), `${text}\n`);
  note(`logs in ${config.out}`);
}

/** @type {{ child: import("node:child_process").ChildProcess | null }} */
const devServerRef = { child: null };
process.on("SIGINT", () => {
  stopServer(devServerRef.child);
  runLog.end();
  process.exit(130);
});

main().catch((error) => {
  console.error(`soak failed: ${error instanceof Error ? error.stack : String(error)}`);
  stopServer(devServerRef.child);
  runLog.end();
  process.exit(1);
});
