import { parseStation, parseStations, type Station } from "./types";

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
}

/** Mirrors the browse/search lists (stations, categories, tags fragments). */
export async function searchStations(search: StationSearch): Promise<Station[]> {
  const query = searchParams({
    name: search.name,
    tag: search.tag,
    country: search.country,
    limit: search.limit ?? 50,
    hidebroken: "true",
    order: search.order ?? "clickcount",
    reverse: "true",
  });
  return parseStations(await fetchJson(`/json/stations/search${query}`));
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
export async function searchStationsIlike(query: string, tag?: string, limit = 50): Promise<Station[]> {
  const terms = normalize(query)
    .split(/[\s,/_-]+/)
    .filter((term) => term.length > 1);
  if (terms.length === 0) return [];
  const anchors = terms.toSorted((a, b) => b.length - a.length);
  // Longest terms first, fetched together — the server ranks each by clicks.
  const batched = await Promise.all(anchors.slice(0, 2).map((anchor) => searchStations({ name: anchor, limit: 100 })));
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

/** Most-voted stations — the default landing list. */
export async function topVotedStations(limit = 50): Promise<Station[]> {
  return parseStations(await fetchJson(`/json/stations/topvote/${limit}`));
}

/** Most-clicked stations. */
export async function topClickedStations(limit = 50): Promise<Station[]> {
  return parseStations(await fetchJson(`/json/stations/topclick/${limit}`));
}

/** Refresh favourites/history snapshots by uuid (batch, one round-trip). */
export async function stationsByUuid(uuids: string[]): Promise<Station[]> {
  if (uuids.length === 0) return [];
  const response = await fetchJson("/json/stations/byuuid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uuids: uuids.join(",") }),
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
