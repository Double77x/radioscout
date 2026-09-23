import { filterPlayableStations, parseStation, parseStations, type Station } from "./types";

/**
 * Minimal radio-browser.info client. RadioDroid resolved
 * `all.api.radio-browser.info` over DNS with fallback; browsers can't do
 * DNS, so we hardcode the mirror list and fail over in order — same
 * resilience, zero native code.
 */
const SERVERS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://de2.api.radio-browser.info",
] as const;

const TIMEOUT_MS = 10_000;

async function fetchJson(path: string, init?: RequestInit): Promise<unknown> {
  let lastError: unknown = null;
  for (const base of SERVERS) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!response.ok) {
        lastError = new Error(`radio-browser ${response.status}`);
        continue;
      }
      return (await response.json()) as unknown;
    } catch (error: unknown) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("radio-browser unreachable");
}

function searchParams(params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  return query.size > 0 ? `?${query.toString()}` : "";
}

export interface StationSearch {
  name?: string;
  tag?: string;
  country?: string;
  limit?: number;
  /** Tag charts rank by votes ("highest rated"); everything else by clicks. */
  order?: "clickcount" | "votes";
  /**
   * Content-language filter (directory names, e.g. `["english"]`).
   * One language filters server-side; several fan out (the `language`
   * param only matches a single literal) and merge deduped.
   */
  languages?: string[];
  /** Minimum stream bitrate in kbps (`0`/absent = any quality). Client-side. */
  minBitrate?: number;
}

/** Merge parallel language requests, first language wins on duplicates. */
function dedupeStations(stations: Station[]): Station[] {
  const seen = new Set<string>();
  return stations.filter((station) => {
    if (seen.has(station.stationuuid)) return false;
    seen.add(station.stationuuid);
    return true;
  });
}

/**
 * Filters (languages, quality) shrink every server page, so chart/genre
 * lists walk `offset` pages until `want` playable rows are collected or the
 * directory runs dry — a filtered Top 50 stays 50 instead of ~22.
 * Free-text (`name`) searches manage their own candidate pool in
 * `searchStationsIlike`, so they keep the single-request path below.
 */
const CHART_PAGE_SIZE = 200;
const CHART_MAX_PAGES = 4;

/** Single unfiltered chart fetch still over-fetches: HTTP rows drop after fetch. */
const MAX_SERVER_LIMIT = 300;

function chartFetchCount(limit: number): number {
  return Math.min(MAX_SERVER_LIMIT, Math.max(limit, limit * 3));
}

/** Minimum-bitrate predicate over parsed bitrates (API value + title parse). */
function filterByMinBitrate(stations: Station[], minBitrate: number): Station[] {
  if (minBitrate <= 0) return stations;
  return stations.filter((station) => Number.isFinite(station.bitrate) && station.bitrate >= minBitrate);
}

interface ChartPage {
  tag?: string;
  country?: string;
  language?: string;
  order: "clickcount" | "votes";
  minBitrate: number;
  want: number;
}

async function searchPaged(page: ChartPage): Promise<Station[]> {
  const seen = new Set<string>();
  const out: Station[] = [];
  for (let index = 0; index < CHART_MAX_PAGES && out.length < page.want; index++) {
    const query = searchParams({
      tag: page.tag,
      country: page.country,
      language: page.language,
      limit: CHART_PAGE_SIZE,
      offset: index * CHART_PAGE_SIZE,
      hidebroken: "true",
      order: page.order,
      reverse: "true",
    });
    const raw = parseStations(await fetchJson(`/json/stations/search${query}`));
    if (raw.length === 0) break;
    // Unknown-http rows can't play on an https page or in the APK WebView —
    // drop them so every visible station is playable. Verified upgrade hosts
    // survive as canonical https (see `canonicalStreamUrl`).
    const rows = filterByMinBitrate(filterPlayableStations(raw), page.minBitrate);
    for (const station of rows) {
      if (out.length >= page.want) break;
      if (!seen.has(station.stationuuid)) {
        seen.add(station.stationuuid);
        out.push(station);
      }
    }
    if (raw.length < CHART_PAGE_SIZE) break;
  }
  return out;
}

/** Mirrors the browse/search lists (stations, categories, tags fragments). */
export async function searchStations(search: StationSearch): Promise<Station[]> {
  const languages = (search.languages ?? []).filter((language) => language !== "");
  if (languages.length > 1) {
    const batched = await Promise.all(
      languages.map((language) => searchStations({ ...search, languages: [language] })),
    );
    // Inner calls are already playable-filtered; just dedupe the merge.
    return dedupeStations(batched.flat());
  }
  const minBitrate = search.minBitrate ?? 0;
  // Chart/genre lists page until full; free-text anchors keep one request —
  // the ILIKE matcher manages its own candidate pool from those rows.
  if ((search.name ?? "").trim() === "") {
    return searchPaged({
      tag: search.tag,
      country: search.country,
      language: languages[0],
      order: search.order ?? "clickcount",
      minBitrate,
      want: search.limit ?? 50,
    });
  }
  const query = searchParams({
    name: search.name,
    tag: search.tag,
    country: search.country,
    language: languages[0],
    limit: search.limit ?? 50,
    hidebroken: "true",
    order: search.order ?? "clickcount",
    reverse: "true",
  });
  // Unknown-http rows can't play on an https page or in the APK WebView —
  // drop them so every visible station is playable. Verified upgrade hosts
  // survive as canonical https (see `canonicalStreamUrl`).
  const playable = filterPlayableStations(parseStations(await fetchJson(`/json/stations/search${query}`)));
  return filterByMinBitrate(playable, minBitrate);
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replaceAll(/[\u0300-\u036F]/g, "");
}

function haystackFor(station: Station): string {
  return normalize(
    [station.name, station.tags, station.country, station.state, station.language, station.codec].join(" "),
  );
}

/**
 * ILIKE-style free-text search. The API's `name` param is one contiguous
 * substring, so "BBC anthem" never matches "BBC RADIO 1 ANTHEMS" —
 * split the query into terms, fetch broad candidates on the longest
 * term, then keep rows where EVERY term appears anywhere in the
 * searchable text (name, tags, country, state, language, codec).
 */
export async function searchStationsIlike(
  query: string,
  tag?: string,
  limit = 50,
  languages: string[] = [],
  minBitrate = 0,
): Promise<Station[]> {
  const terms = normalize(query)
    .split(/[\s,/_-]+/)
    .filter((term) => term.length > 1);
  if (terms.length === 0) return [];
  const anchors = terms.toSorted((a, b) => b.length - a.length);
  // Longest terms first, fetched together — the server ranks each by clicks.
  // Language fan-out (if any) happens inside `searchStations`.
  const batched = await Promise.all(
    anchors.slice(0, 2).map((anchor) => searchStations({ name: anchor, limit: 100, languages, minBitrate })),
  );
  const seen = new Set<string>();
  const candidates: Station[] = [];
  for (const rows of batched) {
    for (const row of rows) {
      if (candidates.length >= limit * 2) break;
      if (!seen.has(row.stationuuid)) {
        seen.add(row.stationuuid);
        candidates.push(row);
      }
    }
  }
  const wantedTag = normalize(tag ?? "");
  return candidates
    .filter((station) => {
      const haystack = haystackFor(station);
      if (!terms.every((term) => haystack.includes(term))) return false;
      if (
        wantedTag !== "" &&
        !normalize(station.tags)
          .split(",")
          .some((t) => t.trim() === wantedTag)
      )
        return false;
      return true;
    })
    .slice(0, limit);
}

/** Most-voted stations — the default landing list (unplayable rows filtered). */
export async function topVotedStations(limit = 50, languages: string[] = [], minBitrate = 0): Promise<Station[]> {
  if (languages.length === 0 && minBitrate <= 0) {
    const count = chartFetchCount(limit);
    return filterPlayableStations(parseStations(await fetchJson(`/json/stations/topvote/${count}`))).slice(0, limit);
  }
  // `topvote` ignores `?language=`, and filtered charts page until full —
  // rank through the search endpoint instead.
  return rankedTopStations("votes", limit, languages, minBitrate);
}

/** Most-clicked stations (unplayable rows filtered). */
export async function topClickedStations(limit = 50, languages: string[] = [], minBitrate = 0): Promise<Station[]> {
  if (languages.length === 0 && minBitrate <= 0) {
    const count = chartFetchCount(limit);
    return filterPlayableStations(parseStations(await fetchJson(`/json/stations/topclick/${count}`))).slice(0, limit);
  }
  return rankedTopStations("clickcount", limit, languages, minBitrate);
}

/**
 * Filtered chart: top `limit` per language, merged by rank. Each leg pages
 * until full (server-ranked, playable- and quality-filtered); the merge
 * re-sorts. No languages means one worldwide leg.
 */
async function rankedTopStations(
  order: "clickcount" | "votes",
  limit: number,
  languages: string[],
  minBitrate = 0,
): Promise<Station[]> {
  const legs = languages.length === 0 ? [undefined] : languages;
  const batched = await Promise.all(
    legs.map((language) => searchStations({ order, languages: language ? [language] : [], limit, minBitrate })),
  );
  return dedupeStations(batched.flat())
    .toSorted((a, b) => b[order] - a[order])
    .slice(0, limit);
}

/** Refresh favourites/history snapshots by uuid (batch, one round-trip). */
export async function stationsByUuid(uuids: string[]): Promise<Station[]> {
  if (uuids.length === 0) return [];
  // The server only reads form-encoded bodies here — a JSON body is
  // silently ignored and answers `[]` (verified 2026-09-21 against de1).
  const response = await fetchJson("/json/stations/byuuid", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ uuids: uuids.join(",") }).toString(),
  });
  return parseStations(response);
}

/**
 * Port of `Utils.getRealStationLink()`: resolves the countable,
 * playable stream URL for a station. Fire-and-forget a second call and
 * the server also records the click.
 */
export async function resolveStreamUrl(stationuuid: string): Promise<string | null> {
  const payload = (await fetchJson(`/json/url/${stationuuid}`)) as { url?: unknown };
  return typeof payload.url === "string" && payload.url !== "" ? payload.url : null;
}

/** Single-station refresh (favourite revalidation). */
export async function stationByUuid(stationuuid: string): Promise<Station | null> {
  const payload = await fetchJson(`/json/stations/byuuid/${stationuuid}`);
  const list = parseStations(payload);
  if (list.length > 0) return list[0] ?? null;
  return parseStation(payload);
}

/** Record a vote. Best-effort — never blocks playback. */
export function voteStation(stationuuid: string): void {
  fetchJson(`/json/vote/${stationuuid}`, { method: "POST" }).catch(() => {});
}

export interface ServerStats {
  stations: number;
  tags: number;
  clicks: number;
  languages: number;
  countries: number;
}

/** Directory totals (station count for the header). Cached aggressively. */
export async function serverStats(): Promise<ServerStats> {
  const payload = (await fetchJson("/json/stats")) as Record<string, unknown>;
  const number = (key: string): number => {
    const value = payload[key];
    return typeof value === "number" && Number.isFinite(value) ? value : 0;
  };
  return {
    stations: number("stations"),
    tags: number("tags"),
    clicks: number("clicks"),
    languages: number("languages"),
    countries: number("countries"),
  };
}
