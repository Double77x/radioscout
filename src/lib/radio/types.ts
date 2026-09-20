import { z } from "zod";

/**
 * Station model. Clean-room TS port of RadioDroid's
 * `DataRadioStation.DecodeJson()` field set — same radio-browser.info
 * JSON, none of the Parcelable baggage.
 */
export const stationSchema = z.object({
  stationuuid: z.string().min(1),
  name: z.string().catch("Unknown station"),
  /** Direct stream URL (may be a playlist; resolve via `json/url/` first). */
  url: z.string().catch(""),
  /** Server-resolved stream URL when the API provides one. */
  url_resolved: z.string().catch(""),
  homepage: z.string().catch(""),
  favicon: z.string().catch(""),
  tags: z.string().catch(""),
  country: z.string().catch(""),
  countrycode: z.string().catch(""),
  state: z.string().catch(""),
  language: z.string().catch(""),
  codec: z.string().catch(""),
  bitrate: z.coerce.number().catch(0),
  hls: z.coerce.number().catch(0),
  votes: z.coerce.number().catch(0),
  clickcount: z.coerce.number().catch(0),
  clicktrend: z.coerce.number().catch(0),
  lastcheckok: z.coerce.number().catch(1),
  /** Extended backend fields (absent on older mirrors — all default safe). */
  languagecodes: z.string().catch(""),
  iso_3166_2: z.string().catch(""),
  ssl_error: z.coerce.number().catch(0),
  geo_lat: z.coerce.number().catch(0),
  geo_long: z.coerce.number().catch(0),
  lastchangetime_iso8601: z.string().catch(""),
  lastcheckoktime_iso8601: z.string().catch(""),
  clicktimestamp_iso8601: z.string().catch(""),
});

export type Station = z.infer<typeof stationSchema>;

/** Defaults for every field — applied to stored snapshots saved before newer keys existed. */
export const EMPTY_STATION: Station = {
  stationuuid: "",
  name: "Unknown station",
  url: "",
  url_resolved: "",
  homepage: "",
  favicon: "",
  tags: "",
  country: "",
  countrycode: "",
  state: "",
  language: "",
  codec: "",
  bitrate: 0,
  hls: 0,
  votes: 0,
  clickcount: 0,
  clicktrend: 0,
  lastcheckok: 1,
  languagecodes: "",
  iso_3166_2: "",
  ssl_error: 0,
  geo_lat: 0,
  geo_long: 0,
  lastchangetime_iso8601: "",
  lastcheckoktime_iso8601: "",
  clicktimestamp_iso8601: "",
};

/** Fill defaults for snapshots persisted before newer schema keys existed. */
export function withStationDefaults(snapshot: Partial<Station>): Station {
  return { ...EMPTY_STATION, ...snapshot };
}

/** Parse one station; null when the row is missing its uuid. */
export function parseStation(row: unknown): Station | null {
  const parsed = stationSchema.safeParse(row);
  if (!parsed.success) return null;
  const clean = splitQualityFromName(parsed.data.name);
  const apiCodec = /^unknown$/i.test(parsed.data.codec) ? "" : parsed.data.codec;
  return {
    ...parsed.data,
    name: clean.name,
    bitrate: parsed.data.bitrate > 0 ? parsed.data.bitrate : clean.bitrate,
    codec: apiCodec === "" ? clean.codec : apiCodec,
  };
}

/** Parse a station list, dropping malformed rows (mirrors DecodeJson #2). */
export function parseStations(payload: unknown): Station[] {
  if (!Array.isArray(payload)) return [];
  const out: Station[] = [];
  for (const row of payload) {
    const station = parseStation(row);
    if (station) out.push(station);
  }
  return out;
}

/**
 * Upstream rows sometimes carry playlist junk (seen 2026-09-20: a stored
 * `url` of `...aac??direct=true&...%20#EXTINF:0,Absolute%2080s` — a doubled
 * `?` plus an M3U `#EXTINF` line fused onto the query). Browsers request that
 * verbatim, so strip it before handing a URL to `<audio>`. Idempotent — safe
 * on already-clean URLs.
 */
export function sanitizeStreamUrl(raw: string): string {
  if (raw === "") return "";
  let url = raw.trim();
  if (url === "") return "";
  // M3U playlist line fused onto the URL (literal or %20-encoded space).
  const extinf = url.search(/#EXTINF/i);
  if (extinf >= 0) url = url.slice(0, extinf);
  // Whitespace/newlines from concatenated playlist lines; fragments are never
  // sent to a stream server, so drop those too.
  const boundary = url.search(/[\s#]/);
  if (boundary >= 0) url = url.slice(0, boundary);
  url = url.trim().replace(/(?<trail>\s|%20)+$/i, "");
  // Doubled `?` from `base + "?" + query` joins (`..aac??direct=true`).
  url = url.replaceAll(/\?{2,}/g, "?").replaceAll("?&", "?");
  return url;
}

/** Port of `Utils.urlIndicatesHlsStream()` — HLS needs native handling. */
export function isHlsUrl(streamUrl: string): boolean {
  return /.*\.m3u8(?<suffix>[#?\s].*)?$/.test(sanitizeStreamUrl(streamUrl));
}

/**
 * `true` for plain-`http://` streams. Unplayable from an `https://` page
 * (mixed-content block on web, cleartext block in the APK WebView) — callers
 * should say so instead of showing a generic failure.
 */
export function isInsecureHttpStream(streamUrl: string): boolean {
  return /^http:\/\//i.test(sanitizeStreamUrl(streamUrl));
}

/** Best-known playable URL without a network round-trip (sanitized). */
export function pickPlayableUrl(station: Station): string {
  return sanitizeStreamUrl(station.url_resolved || station.url);
}

const QUALITY_PATTERN = /\b(?<rate>\d+(?:\.\d+)?)\s*(?:k|kbps|kb\/s)\b/i;
const BRACKET_GROUP_PATTERN = /\((?<paren>[^()]*)\)|\[(?<square>[^[\]]*)\]/g;
const CODEC_PATTERN = /\b(?<codec>mp3|aac\+|aac|ogg|opus|flac|wma|m4a|wav)(?![a-zA-Z0-9])/i;

function tidyTitle(raw: string): string {
  return raw
    .replaceAll(/\s{2,}/g, " ")
    .replace(/\s+[-–—:|/]\s*$/u, "")
    .trim();
}

/** Pull a bitrate + codec out of one bracket group; null when nothing useful inside. */
function parseBracketGroup(inner: string): { bitrate: number; codec: string; rest: string } {
  const rate = QUALITY_PATTERN.exec(inner);
  const codec = CODEC_PATTERN.exec(inner);
  const bitrate = rate?.groups?.rate ? Math.round(Number(rate.groups.rate)) : 0;
  let rest = inner;
  if (rate) rest = rest.replace(rate[0], "");
  if (codec?.groups?.codec) rest = rest.replace(codec[0], "");
  rest = tidyTitle(rest.replaceAll(/[-–—:|/,]/g, " "));
  return {
    bitrate: Number.isFinite(bitrate) ? bitrate : 0,
    codec: codec?.groups?.codec ? codec.groups.codec.toUpperCase() : "",
    rest,
  };
}

/**
 * Titles often carry stream facts ("BBC Radio 1 128K", "Classic Vinyl HD
 * 320k AAC", "Jazz FM (128kbps MP3)") while the API reports 0/UNKNOWN.
 * Split those tokens out: clean title + bitrate/codec for the subtitle.
 * Bare codec words are only trusted inside brackets ("MP3 Radio" keeps its
 * name); bare `128K`-style rates are distinctive enough anywhere. Guards
 * callsigns like "102.5 KZOK" (no boundary after the K, so no match).
 */
export function splitQualityFromName(raw: string): { name: string; bitrate: number; codec: string } {
  let name = raw;
  let bitrate = 0;
  let codec = "";
  name = name.replace(BRACKET_GROUP_PATTERN, (_group, paren: string, square: string) => {
    const parsed = parseBracketGroup(paren ?? square ?? "");
    if (parsed.bitrate > 0 && bitrate === 0) bitrate = parsed.bitrate;
    if (parsed.codec !== "" && codec === "") codec = parsed.codec;
    // Drop the brackets only when nothing meaningful remains inside.
    return parsed.rest === "" ? " " : `(${parsed.rest})`;
  });
  const bare = QUALITY_PATTERN.exec(name);
  if (bare?.groups?.rate && bitrate === 0) {
    const parsed = Math.round(Number(bare.groups.rate));
    if (Number.isFinite(parsed)) bitrate = parsed;
  }
  if (bare) name = name.replace(bare[0], "");
  name = tidyTitle(name);
  if (name === "") return { name: raw, bitrate: 0, codec: "" };
  return { name, bitrate, codec };
}
