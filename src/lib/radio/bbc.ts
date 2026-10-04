import type { Station } from "./types";

/**
 * Local record guard — this module is also loaded by the dev-server
 * middleware (`scripts/icy-probe-plugin.ts` runs inside vite config
 * resolution, where the `@/` alias does not exist), so it must stay free
 * of app-alias imports like `src/lib/radio/icy.ts` is.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * BBC live metadata via the Radio & Music Services (RMS) JSON feeds.
 *
 * Shoutcast/Icecast `StreamTitle` never reaches us on BBC-style HLS
 * streams, so the player asks the BBC instead — the same feeds behind the
 * BBC Sounds "now playing" line (via `GET /api/bbc-title`, which is what
 * actually fetches RMS; browsers get no CORS headers from RMS, so this
 * module never calls it client-side outside dev middleware).
 *
 * Two feeds, first hit wins:
 * 1. `segments/latest` — the last music segment (`Artist - Track`).
 * 2. `broadcasts/latest` — the on-air programme (`Show - Episode`) for
 *    speech stations and music gaps with nothing recent.
 *
 * Station matching needs no directory: every BBC stream URL and Sounds
 * homepage already carries the service id (`bbc_radio_two`,
 * `bbc_6music`, `bbc_radio_one_anthems`, …), so it is read out of the
 * station row instead of maintained as a list.
 */

export const BBC_RMS_BASE = "https://rms.api.bbc.co.uk/v2";

/** One RMS service id (`bbc_radio_two`), lowercase. Never throws. */
export function bbcServiceIdFromUrl(raw: string): string | null {
  if (typeof raw !== "string" || raw === "") return null;
  const match = /(?<service>bbc_[a-z0-9_]+)/i.exec(raw);
  return match?.groups?.service ? match.groups.service.toLowerCase() : null;
}

/** `true` for well-formed RMS service ids. Never throws. */
export function isBbcServiceId(value: unknown): value is string {
  return typeof value === "string" && /^bbc_[a-z0-9_]+$/i.test(value);
}

/**
 * RMS service id for a station, or null when it is not a BBC feed.
 * Homepage first (canonical Sounds play id), then the resolved and raw
 * stream URLs (Akamai HLS paths and rebroadcast proxies both embed it).
 */
export function bbcServiceIdForStation(station: Pick<Station, "homepage" | "url" | "url_resolved">): string | null {
  for (const candidate of [station.homepage, station.url_resolved, station.url]) {
    const service = bbcServiceIdFromUrl(candidate);
    if (service !== null) return service;
  }
  return null;
}

/**
 * `Artist - Track` from a segment's title pair. Null when both are empty —
 * the caller falls through to the programme feed instead of painting blank.
 */
export function formatBbcTrack(primary: unknown, secondary: unknown): string | null {
  const artist = typeof primary === "string" ? primary.trim() : "";
  const track = typeof secondary === "string" ? secondary.trim() : "";
  if (artist !== "" && track !== "") return `${artist} - ${track}`;
  if (artist !== "") return artist;
  if (track !== "") return track;
  return null;
}

export interface BbcSegment {
  artist: string;
  track: string;
  title: string;
  /** RMS recency line (`Now Playing`, `Less Than a Minute Ago`, …). */
  label: string;
  nowPlaying: boolean;
}

/**
 * Newest music segment in a `segments/latest` payload, or null when there
 * is nothing usable (empty data, blank titles — speech airtime has no
 * segments at all). Never throws.
 */
export function parseBbcSegments(payload: unknown): BbcSegment | null {
  if (!isRecord(payload)) return null;
  const data: unknown = payload.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const first: unknown = data[0];
  if (!isRecord(first)) return null;
  const titles: unknown = first.titles;
  if (!isRecord(titles)) return null;
  const title = formatBbcTrack(titles.primary, titles.secondary);
  if (title === null) return null;
  const offset: unknown = first.offset;
  const label = isRecord(offset) && typeof offset.label === "string" ? offset.label : "";
  return {
    artist: typeof titles.primary === "string" ? titles.primary.trim() : "",
    track: typeof titles.secondary === "string" ? titles.secondary.trim() : "",
    title,
    label,
    nowPlaying: isRecord(offset) && offset.now_playing === true,
  };
}

export interface BbcProgramme {
  /** Combined `Show - Episode` display line. */
  title: string;
  show: string;
  episode: string;
  /** Broadcast window (ISO); drives the boundary-aligned re-probe below. */
  start: string;
  end: string;
}

function broadcastBounds(entry: Record<string, unknown>): { start: number; end: number } {
  return {
    start: typeof entry.start === "string" ? Date.parse(entry.start) : Number.NaN,
    end: typeof entry.end === "string" ? Date.parse(entry.end) : Number.NaN,
  };
}

/** Milliseconds from `now` to the nearest edge (0 while airing, else the gap). */
function broadcastDistance(entry: Record<string, unknown>, now: number): number {
  const { start, end } = broadcastBounds(entry);
  if (Number.isFinite(start) && Number.isFinite(end) && start <= now && now < end) return 0;
  const past = Number.isFinite(end) && end <= now ? now - end : Number.POSITIVE_INFINITY;
  const future = Number.isFinite(start) && start >= now ? start - now : Number.POSITIVE_INFINITY;
  return Math.min(past, future);
}

/**
 * On-air programme in a `broadcasts/latest` payload: explicit `on_air`
 * flag, else the entry covering `now`, else the entry nearest to now (a
 * stale window must resolve to its most recent row, not its oldest).
 * Null when the payload has no usable programme. Never throws.
 */
export function parseBbcBroadcasts(payload: unknown, now = Date.now()): BbcProgramme | null {
  if (!isRecord(payload)) return null;
  const data: unknown = payload.data;
  if (!Array.isArray(data) || data.length === 0) return null;
  const entries = data.filter((entry): entry is Record<string, unknown> => isRecord(entry));
  if (entries.length === 0) return null;
  const current =
    entries.find((entry) => entry.on_air === true) ??
    entries.reduce((best, entry) => (broadcastDistance(entry, now) < broadcastDistance(best, now) ? entry : best));
  if (current === undefined) return null;
  const programme: unknown = current.programme;
  if (!isRecord(programme)) return null;
  const titles: unknown = programme.titles;
  if (!isRecord(titles)) return null;
  const display = typeof titles.display_title === "string" ? titles.display_title.trim() : "";
  const start = typeof current.start === "string" ? current.start : "";
  const end = typeof current.end === "string" ? current.end : "";
  if (display !== "") {
    return {
      title: display,
      show: typeof titles.primary === "string" ? titles.primary.trim() : "",
      episode: typeof titles.secondary === "string" ? titles.secondary.trim() : "",
      start,
      end,
    };
  }
  const fallback = formatBbcTrack(titles.primary, titles.secondary);
  if (fallback === null) return null;
  return { title: fallback, show: "", episode: "", start, end };
}

export type BbcNowPlaying = ({ kind: "track" } & BbcSegment) | ({ kind: "programme" } & BbcProgramme);

/** RMS rollover lag behind a programme boundary before re-probing. */
export const BBC_BOUNDARY_BUFFER_MS = 10_000;
/** Never schedule a boundary refresh further out than this (sanity cap). */
const BBC_BOUNDARY_MAX_MS = 12 * 3_600_000;
/** Re-poll gap while tracks are landing (or nothing is known yet). */
export const BBC_TRACK_POLL_MS = 30_000;
/**
 * Re-poll gap during speech/programme stretches: music rarely starts
 * mid-show unannounced, so back off hard — the boundary one-shot below
 * owns accuracy, this is only the safety net.
 */
export const BBC_PROGRAMME_POLL_MS = 180_000;

/**
 * Milliseconds until a programme-`end` re-probe should fire, or null when
 * there is nothing sensible to schedule (unparseable, already past, or
 * absurdly far out — the interval loop backstops all of those). Pure, so
 * the engine owns only the timer. Never throws.
 */
export function bbcBoundaryDelayMs(end: unknown, now = Date.now()): number | null {
  if (typeof end !== "string") return null;
  const parsed = Date.parse(end);
  if (!Number.isFinite(parsed)) return null;
  const delay = parsed - now + BBC_BOUNDARY_BUFFER_MS;
  if (delay <= 0 || delay > BBC_BOUNDARY_MAX_MS) return null;
  return delay;
}

export interface BbcPollVerdict {
  kind?: unknown;
  end?: unknown;
}

/**
 * Delay until the next BBC poll after a verdict. Tracks (or nothing yet):
 * hot 30s loop. Programmes: the boundary one-shot when it lands sooner,
 * else the 3-minute safety net — a 3-hour speech show costs ~60 polls, not
 * ~360, and the show change still lands within seconds. Pure. Never throws.
 */
export function bbcNextPollDelayMs(verdict: BbcPollVerdict | null, now = Date.now()): number {
  if (verdict?.kind === "programme") {
    const boundary = bbcBoundaryDelayMs(verdict.end, now);
    return boundary === null ? BBC_PROGRAMME_POLL_MS : Math.min(boundary, BBC_PROGRAMME_POLL_MS);
  }
  return BBC_TRACK_POLL_MS;
}

/**
 * A segment counts as "current" while it is flagged now-playing or ended
 * under a minute ago (back-to-back tracks gap briefly with
 * `now_playing: false`). Anything older is stale — a news bulletin after
 * music would otherwise pin a 20-minute-old track — so the programme feed
 * takes over instead.
 */
export function isCurrentSegment(segment: BbcSegment): boolean {
  if (segment.nowPlaying) return true;
  return /now playing|less than a minute/i.test(segment.label);
}

export function bbcSegmentsUrl(serviceId: string, limit = 1): string {
  return `${BBC_RMS_BASE}/services/${serviceId}/segments/latest?experience=domestic&offset=0&limit=${limit}`;
}

/**
 * BBC Sounds live page for a service (`live:bbc_radio_two`) — carries the
 * live stream, schedule and recently-played track history. Null unless the
 * id is well-formed, so callers can pass extraction output straight in.
 */
export function bbcSoundsUrl(serviceId: unknown): string | null {
  if (!isBbcServiceId(serviceId)) return null;
  return `https://www.bbc.co.uk/sounds/play/live:${serviceId.toLowerCase()}`;
}
/**
 * The `latest` feed pages ascending by start (default 30/page), so one
 * page often ends hours before now — Radio 4's window runs to 134
 * entries. Arbitrary limits are honoured, so `limit=200` takes the whole
 * window in one request; `fetchBbcBroadcastEntries` pages the remainder
 * when a window ever outgrows that.
 */
export function bbcBroadcastsUrl(serviceId: string, limit = 200, offset = 0): string {
  return `${BBC_RMS_BASE}/broadcasts/latest?service=${serviceId}&experience=domestic&limit=${limit}&offset=${offset}`;
}

/** Full current schedule window across pages (capped at 3). Null when every page fails. */
async function fetchBbcBroadcastEntries(
  service: string,
  fetchImpl: typeof fetch,
  headers: Record<string, string>,
  signal: AbortSignal,
): Promise<Record<string, unknown>[] | null> {
  const PAGE = 200;
  const all: Record<string, unknown>[] = [];
  for (let page = 0; page < 3; page++) {
    const response = await fetchImpl(bbcBroadcastsUrl(service, PAGE, page * PAGE), { headers, signal });
    if (!response.ok) return all.length > 0 ? all : null;
    const payload: unknown = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.data)) return all.length > 0 ? all : null;
    for (const item of payload.data) {
      if (isRecord(item)) all.push(item);
    }
    const total = typeof payload.total === "number" ? payload.total : all.length;
    if (all.length >= total) break;
  }
  return all;
}

export interface BbcFetchOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  userAgent?: string;
  now?: number;
  fetchImpl?: typeof fetch;
}

/**
 * Live BBC metadata: newest music segment when it is current, else the
 * on-air programme. Null on any failure or when both feeds come back
 * empty — the player keeps its genre/country fallback. Never rejects.
 */
export async function fetchBbcNowPlaying(serviceId: string, options?: BbcFetchOptions): Promise<BbcNowPlaying | null> {
  if (!isBbcServiceId(serviceId)) return null;
  const fetchImpl = options?.fetchImpl ?? fetch;
  const userAgent = options?.userAgent;
  const now = options?.now;
  const timeout = AbortSignal.timeout(options?.timeoutMs ?? 10_000);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const headers: Record<string, string> = {};
  if (userAgent !== undefined) headers["User-Agent"] = userAgent;
  try {
    const segments = await fetchImpl(bbcSegmentsUrl(serviceId.toLowerCase()), { headers, signal });
    if (segments.ok) {
      const segment = parseBbcSegments((await segments.json()) as unknown);
      if (segment !== null && isCurrentSegment(segment)) return { kind: "track", ...segment };
    }
  } catch {
    // A dead segments feed must not skip the programme fallback below.
  }
  try {
    const entries = await fetchBbcBroadcastEntries(serviceId.toLowerCase(), fetchImpl, headers, signal);
    if (entries === null) return null;
    const programme = parseBbcBroadcasts({ data: entries }, now);
    if (programme === null) return null;
    return { kind: "programme", ...programme };
  } catch {
    return null;
  }
}
