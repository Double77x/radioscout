import { z } from "zod";
import { version as appVersion } from "../../../package.json";
import { lrcStanzas, plainStanzas, type LyricStanza } from "./lyrics";

/**
 * LRCLIB lookup for the sheet's lyrics row.
 *
 * Called straight from the browser: LRCLIB is CORS-enabled and needs no key.
 * Search (v1) returns the lyrics text in one request; `/api/get` needs a
 * duration we do not have. Timing is irrelevant here, so plain records match
 * too.
 *
 * A search answers `200` with a JSON array (empty when nothing matches). Each
 * record carries `id`, `name`, `trackName`, `artistName`, `albumName`,
 * `duration`, `instrumental`, `hasWordSync`, `plainLyrics`, `syncedLyrics` and
 * `lyricsfile`; this module reads the two lyric texts plus the fields the
 * picker needs.
 *
 * The rules in https://lrclib.net/docs.txt are honoured here: the client names
 * itself (name, version, link — via `Lrclib-Client`, since browsers cannot set
 * `User-Agent`), requests go out one at a time at least `MIN_REQUEST_GAP_MS`
 * apart, and a limiting answer parks the whole client for the server's
 * `Retry-After` plus jitter. Ignoring that header risks a temporary ban.
 */

const SEARCH_ENDPOINT = "https://lrclib.net/api/search";
const CLIENT_NAME = `Scout v${appVersion} (https://radioscout.pages.dev)`;
const TIMEOUT_MS = 6000;
/** Gap between two requests, inside the 200–500 ms the docs ask for. */
const MIN_REQUEST_GAP_MS = 300;
/** Wait used when a limiting answer carries no usable `Retry-After`. */
const RETRY_FALLBACK_MS = 5000;

/** One LRCLIB search record, narrowed to the fields the picker uses. */
export interface LyricsRecord {
  trackName: string;
  artistName: string;
  instrumental: boolean;
  syncedLyrics: string | null;
  plainLyrics: string | null;
}

/** Tolerant on purpose: one malformed record must not sink the response. */
const recordSchema = z.object({
  trackName: z.string(),
  artistName: z.string(),
  instrumental: z.boolean().catch(false),
  syncedLyrics: z.string().nullable().catch(null),
  plainLyrics: z.string().nullable().catch(null),
});

const searchSchema = z.array(recordSchema);

const SEPARATOR = /\s+[-–—]\s+/u;

/**
 * Split a StreamTitle into artist and track. ICY conventions put a spaced
 * hyphen between them; anything without one is treated as the track alone.
 */
export function splitTrackTitle(raw: string): { artist: string | null; title: string } {
  const clean = raw.replaceAll(/\s+/g, " ").trim();
  const index = clean.search(SEPARATOR);
  if (index < 0) {
    const leading = /^[-–—]\s+/u.exec(clean);
    return { artist: null, title: leading ? clean.slice(leading[0].length).trim() : clean };
  }
  const artist = clean.slice(0, index).trim();
  const title = clean.slice(index).replace(SEPARATOR, "").trim();
  return { artist: artist === "" ? null : artist, title };
}

/**
 * Comparison key: case, accents, punctuation and a trailing `feat.`/bracket
 * suffix all vary between ICY and the database, so none of them may decide a
 * match.
 */
function lyricKey(value: string): string {
  return value
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "")
    .toLowerCase()
    .replace(/\b(?:feat|ft|featuring)\.?\s.*$/u, "")
    .replace(/\s*[([]\s*[^)\]]*\s*[)\]]\s*$/u, "")
    .replaceAll(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Artist keys agree when one names the whole of the other (collaborations). */
function artistAgrees(candidate: string, wanted: string): boolean {
  if (candidate === wanted) return true;
  if (candidate === "" || wanted === "") return false;
  return candidate.includes(wanted) || wanted.includes(candidate);
}

/**
 * First record with lyric text whose normalized title matches (and whose
 * artist agrees, when the title named one). Instrumentals and records carrying
 * neither text form are skipped.
 */
export function pickLyricsRecord(records: readonly LyricsRecord[], rawTrack: string): LyricsRecord | null {
  const { artist, title } = splitTrackTitle(rawTrack);
  const titleKey = lyricKey(title);
  if (titleKey === "") return null;
  const artistKey = artist === null ? "" : lyricKey(artist);
  for (const record of records) {
    if (record.instrumental || (record.syncedLyrics === null && record.plainLyrics === null)) continue;
    if (lyricKey(record.trackName) !== titleKey) continue;
    if (artistKey === "") return record;
    // Collaborations and "Salt N Pepa"/"Salt-N-Pepa" variants normalize into
    // keys that contain one another; a common word ("the") is still rejected
    // because the shorter key must be the whole of the longer artist.
    if (artistAgrees(lyricKey(record.artistName), artistKey)) return record;
  }
  return null;
}

/**
 * The best stanzas a record can give. A synced document wins whenever it has
 * one: its timestamps carry the stanza breaks, and the plain text often has
 * none — LRCLIB's plain copy of a song is frequently a single paragraph with
 * no blank lines. Plain is the fallback for records that were never timed.
 */
export function recordStanzas(record: LyricsRecord): LyricStanza[] {
  if (record.syncedLyrics !== null) {
    const synced = lrcStanzas(record.syncedLyrics);
    if (synced.length > 0) return synced;
  }
  return record.plainLyrics === null ? [] : plainStanzas(record.plainLyrics);
}

/**
 * `Retry-After` → milliseconds. The header is either delta-seconds or an HTTP
 * date; a missing, empty or unreadable value falls back to a conservative
 * wait, because retrying too early is what gets a client banned.
 */
export function parseRetryAfter(header: string | null, now: number = Date.now()): number {
  if (header === null || header.trim() === "") return RETRY_FALLBACK_MS;
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  const date = Date.parse(header);
  if (Number.isNaN(date)) return RETRY_FALLBACK_MS;
  return Math.max(0, date - now);
}

/** Nothing may leave the client before this epoch ms (set by a limiting answer). */
let throttledUntil = 0;
/** Start of the last request, for the minimum gap. */
let lastRequestAt = 0;
/** Serialises requests: the docs ask for one at a time. */
let queue: Promise<unknown> = Promise.resolve();

/** Thrown instead of "no lyrics" when LRCLIB asked us to wait. */
class LyricsThrottledError extends Error {
  constructor() {
    super("LRCLIB is rate limiting this client");
    this.name = "LyricsThrottledError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, ms);
  });
}

/** Run `task` after every request already queued, so none overlap. */
function serialise<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task);
  // Keep the chain alive after a failure; the caller still sees the rejection.
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/** Wait for the gap and the server's deadline. False means "do not send". */
async function waitForSlot(signal?: AbortSignal): Promise<boolean> {
  if (Date.now() < throttledUntil) return false;
  const wait = lastRequestAt + MIN_REQUEST_GAP_MS - Date.now();
  if (wait > 0) {
    if (signal?.aborted === true) return false;
    await sleep(wait);
  }
  if (signal?.aborted === true) return false;
  lastRequestAt = Date.now();
  return true;
}

/** Park the client until the server's deadline, plus up to 30% jitter. */
function noteThrottle(response: Response): void {
  const wait = parseRetryAfter(response.headers.get("Retry-After"));
  throttledUntil = Date.now() + wait * (1 + Math.random() * 0.3);
}

/**
 * AbortSignal combinators throw synchronously on older browsers, and a missing
 * `AbortSignal.timeout` is the same failure: no request rather than a crash.
 */
function combineSignals(signal?: AbortSignal): AbortSignal | null {
  try {
    const timeout = AbortSignal.timeout(TIMEOUT_MS);
    return signal === undefined ? timeout : AbortSignal.any([signal, timeout]);
  } catch {
    return null;
  }
}

/** One identified request. Null on a transport failure or an abort. */
async function sendRequest(url: string, signal: AbortSignal): Promise<Response | null> {
  try {
    return await fetch(url, { signal, headers: { "Lrclib-Client": CLIENT_NAME } });
  } catch {
    return null;
  }
}

async function requestStanzas(
  query: URLSearchParams,
  rawTrack: string,
  signal?: AbortSignal,
): Promise<LyricStanza[] | null> {
  const slot = await waitForSlot(signal);
  if (!slot) {
    if (signal?.aborted === true) return null;
    throw new LyricsThrottledError();
  }
  const combined = combineSignals(signal);
  if (combined === null) return null;
  const response = await sendRequest(`${SEARCH_ENDPOINT}?${query.toString()}`, combined);
  if (response === null) return null;
  // Status first: an edge rejection is not guaranteed to be JSON, and a
  // limiting answer must be obeyed rather than parsed.
  if (response.status === 429 || response.status === 503) {
    noteThrottle(response);
    throw new LyricsThrottledError();
  }
  if (!response.ok) return null;
  if (response.headers.get("content-type")?.includes("application/json") !== true) return null;
  const payload: unknown = await response.json().catch(() => null);
  const parsed = searchSchema.safeParse(payload);
  if (!parsed.success) return null;
  const record = pickLyricsRecord(parsed.data, rawTrack);
  if (record === null) return null;
  const stanzas = recordStanzas(record);
  return stanzas.length > 0 ? stanzas : null;
}

export interface FetchLyricsOptions {
  signal?: AbortSignal;
}

/**
 * Fetch a StreamTitle's lyrics as stanzas. `null` means nothing to show (no
 * match, instrumental, offline, timed out) — the block stays away. Throws
 * `LyricsThrottledError` when LRCLIB answered 429/503: the caller must not
 * treat that as "this track has no lyrics", and must not retry before the
 * deadline the server set.
 */
export function fetchLyrics(rawTrack: string, options?: FetchLyricsOptions): Promise<LyricStanza[] | null> {
  const { artist, title } = splitTrackTitle(rawTrack);
  if (title === "") return Promise.resolve(null);
  const query = new URLSearchParams({ track_name: title });
  if (artist !== null) query.set("artist_name", artist);
  return serialise(() => requestStanzas(query, rawTrack, options?.signal));
}
