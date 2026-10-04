/**
 * In-band ICY stream metadata (`StreamTitle`) for the player subtitle.
 *
 * The app plays through plain HTMLAudioElement, which exposes no stream
 * bytes, so titles are decoded with a parallel client-side fetch: request
 * `Icy-MetaData: 1`, count audio bytes against the `icy-metaint` interval
 * and parse the interleaved blocks. Works wherever the server allows CORS;
 * everywhere else it fails silently and the subtitle keeps its fallback.
 * HLS playlists carry no ICY blocks and exit on the headers.
 *
 * `normalizeStreamTitle` runs at the one point a title is extracted, so the
 * edge function and the direct-fetch fallback both get the cleaned value.
 * Native titles do not come through here — ExoPlayer decodes ICY itself.
 */

export interface IcyStreamInfo {
  status: number;
  finalUrl: string;
  contentType: string | null;
  icyName: string | null;
  icyGenre: string | null;
  icyBr: string | null;
  metaint: number | null;
}

export interface IcyTitle {
  /** Seconds since the fetch started. */
  at: number;
  /** Raw StreamTitle value, e.g. "Artist - Track". */
  title: string;
}

export type IcyOutcome = "complete" | "timeout" | "fetch-error" | "http-error" | "no-metaint";

/** What a caller should do with the result of a direct in-page read. */
export type IcyDirectRoute =
  /** Publish this title; the read worked and no fallback is needed. */
  | { readonly kind: "apply"; readonly title: string }
  /**
   * Stop. The station answered but carries no ICY (or errored), so the edge
   * function — which makes the same request server-side — has nothing extra
   * to find and a Worker invocation would be wasted.
   */
  | { readonly kind: "stop" }
  /**
   * Fall back to the edge function. `memo` marks a body this browser could
   * not read, so the caller can skip further direct attempts for that URL:
   * a refused preflight is logged by the browser and cannot be caught.
   */
  | { readonly kind: "edge"; readonly memo: boolean };

/**
 * Decide what a direct in-page read means for the caller.
 *
 * Measured over 12 stations: half hand the browser a readable body and clear
 * the `icy-metadata` preflight, half do not — and JS cannot tell a refused
 * preflight from a plain network error, both arriving as a `TypeError`. So
 * `fetch-error` memoises the URL and lets the edge function carry it, while a
 * timeout (the station may simply be slow) retries direct next poll.
 *
 * Pure so that reasoning stays testable without an audio element.
 */
export function directIcyRoute(outcome: IcyOutcome, titles: readonly IcyTitle[]): IcyDirectRoute {
  const first = titles[0];
  if (first !== undefined && first.title.trim() !== "") return { kind: "apply", title: first.title };
  if (outcome === "no-metaint" || outcome === "http-error") return { kind: "stop" };
  return { kind: "edge", memo: outcome === "fetch-error" };
}

export interface IcyFetchOptions {
  maxTitles?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** False skips the header (demos the no-metadata path). Defaults to true. */
  sendMetaHeader?: boolean;
  /** Node-only; browsers silently drop this forbidden header. */
  userAgent?: string;
  onTrace?: (message: string) => void;
}

/** Parse one metadata block (`StreamTitle='...';StreamUrl='...';`) into pairs. */
export function parseIcyBlock(block: Uint8Array): Record<string, string> {
  const text = new TextDecoder("utf-8", { fatal: false }).decode(block).replaceAll("\0", "");
  const pairs: Record<string, string> = {};
  for (const match of text.matchAll(/(?<key>[A-Za-z]+)='(?<value>[^']*)';/g)) {
    if (match.groups !== undefined) pairs[match.groups.key] = match.groups.value;
  }
  return pairs;
}

/**
 * Zero track length, written by automation systems to close out a spot. Only
 * an explicit zero counts: most stations send no `length` at all.
 */
const AD_BREAK_LENGTH = /\blength="0+:0+:0+"/;

/**
 * Sentinel some automation systems publish in place of a track. Observed on
 * iHeart as both `Spot Block End` (alongside a zero length) and a bare
 * `Spot Block` (no zero length, so {@link AD_BREAK_LENGTH} misses it). Literal
 * because it is a literal: no structural field marks the second shape. Costs
 * only a skipped update if a real track is ever called `Spot Block`.
 */
const AD_BREAK_SENTINEL = /^spot block\b/i;

/**
 * The song inside a stuffed `StreamTitle`: `<head>text="<song>"<tail>`.
 * `\b` before `text` keeps it off keys that merely end in `text`, and the
 * `s` flag lets a head containing a newline through.
 */
const STUFFED_TITLE = /^(?<head>.*?)\btext="(?<song>[^"]*)"/s;

/**
 * The other stuffed shape, anchored to the start of the value because it
 * carries its own artist: `title="Shoop",artist="SALT-N-PEPA",url="…`. The
 * `url=` value is left unterminated upstream, so it swallows the rest of the
 * block — capturing only the two fields we want discards it.
 */
const KEYED_TITLE = /^title="(?<song>[^"]*)",\s*artist="(?<artist>[^"]*)"/;

/** Join a parsed artist/song pair, dropping whichever half is empty. */
function joinTitle(artist: string, song: string): string {
  const left = artist.trim();
  const right = song.trim();
  if (left === "") return right;
  if (right === "") return left;
  return `${left} - ${right}`;
}

/**
 * Tidy a raw ICY `StreamTitle` for display.
 *
 * ICY delimits fields with single quotes, so an automation system that packs
 * its payload into double-quoted `key="value"` pairs puts the lot inside one
 * `StreamTitle` value — nothing downstream can tell where the title ends.
 * Measured on US stations served by `stream.revma.ihrhls.com`, which uses two
 * shapes for the same data:
 *
 *   Bruno Mars - text="Risk It All" song_spot="M" MediaBaseId="3206087" …
 *   title="Shoop",artist="SALT-N-PEPA",url="song_spot="F" MediaBaseId="0" …
 *
 * Each carries the song in its own field, so pull that out — plus the artist
 * where one is given — and drop the tracking tail. 337 characters become
 * `Bruno Mars - Risk It All`. Titles in neither shape (MusicRadio, somaFM)
 * come back untouched.
 *
 * Returns `""` for an ad-break marker so the caller keeps showing the last
 * real song instead of `Spot Block End`; `fetchIcyTitles` treats `""` as "no
 * title yet" and keeps reading for a real one.
 */
export function normalizeStreamTitle(raw: string): string {
  const title = raw.trim();
  if (title === "") return "";
  if (AD_BREAK_LENGTH.test(title)) return "";
  const keyed = KEYED_TITLE.exec(title);
  if (keyed?.groups !== undefined) {
    const song = keyed.groups.song ?? "";
    return AD_BREAK_SENTINEL.test(song.trim()) ? "" : joinTitle(keyed.groups.artist ?? "", song);
  }
  const stuffed = STUFFED_TITLE.exec(title);
  if (stuffed?.groups === undefined) return title;
  const song = (stuffed.groups.song ?? "").trim();
  if (AD_BREAK_SENTINEL.test(song)) return "";
  return joinTitle((stuffed.groups.head ?? "").replace(/[\s‐-―-]+$/u, ""), song);
}

function concatBytes(left: Uint8Array, right: Uint8Array): Uint8Array {
  const out = new Uint8Array(left.length + right.length);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

/**
 * Decode up to `maxTitles` distinct titles, then destroy the stream. Never
 * rejects: failures resolve with whatever headers and titles made it, plus
 * an outcome naming the stop condition.
 */
export async function fetchIcyTitles(
  target: string,
  options?: IcyFetchOptions,
): Promise<{ outcome: IcyOutcome; info?: IcyStreamInfo; titles: IcyTitle[] }> {
  const maxTitles = options?.maxTitles ?? 1;
  const trace = options?.onTrace;
  const started = Date.now();
  const titles: IcyTitle[] = [];
  let info: IcyStreamInfo | undefined = undefined;
  let bytesRead = 0;
  try {
    // Inside `try` on purpose: the contract is "never rejects", and the
    // AbortSignal combinators throw synchronously on older browsers rather
    // than returning a rejected promise.
    const timeout = AbortSignal.timeout(options?.timeoutMs ?? 30_000);
    const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
    const headers: Record<string, string> = {};
    if (options?.sendMetaHeader !== false) headers["Icy-MetaData"] = "1";
    if (options?.userAgent !== undefined) headers["User-Agent"] = options.userAgent;
    const response = await fetch(target, { headers, redirect: "follow", signal });
    const metaint = Number(response.headers.get("icy-metaint"));
    info = {
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get("content-type"),
      icyName: response.headers.get("icy-name"),
      icyGenre: response.headers.get("icy-genre"),
      icyBr: response.headers.get("icy-br"),
      metaint: Number.isInteger(metaint) && metaint > 0 ? metaint : null,
    };
    trace?.(`status ${info.status}, final ${info.finalUrl}`);
    trace?.(
      `content-type=${info.contentType ?? "(none)"} ` +
        `icy-name=${info.icyName ?? "(none)"} ` +
        `icy-metaint=${info.metaint ?? "(absent)"}`,
    );
    if (!response.ok || info.metaint === null || response.body === null) {
      await response.body?.cancel().catch(() => {});
      return { outcome: response.ok ? "no-metaint" : "http-error", info, titles };
    }
    const interval: number = info.metaint;
    const reader = response.body.getReader();
    let buffered: Uint8Array = new Uint8Array(0);
    let audioToSkip = interval;
    let metaBytesNeeded = 0;
    let emptyBlocks = 0;
    trace?.(`pump start: audio interval ${interval} bytes, waiting for ${maxTitles} distinct titles`);
    try {
      for (;;) {
        if (titles.length >= maxTitles) break;
        if (metaBytesNeeded === 0 && buffered.length < audioToSkip + 1) {
          const next = await reader.read();
          if (next.done) {
            trace?.("stream ended by server");
            break;
          }
          bytesRead += next.value.length;
          buffered = concatBytes(buffered, next.value);
          continue;
        }
        if (metaBytesNeeded === 0) {
          buffered = buffered.slice(audioToSkip);
          audioToSkip = interval;
          const lengthByte = buffered[0];
          buffered = buffered.slice(1);
          metaBytesNeeded = lengthByte * 16;
          if (metaBytesNeeded === 0) {
            emptyBlocks += 1;
            continue;
          }
        }
        if (buffered.length < metaBytesNeeded) {
          const next = await reader.read();
          if (next.done) {
            trace?.("stream ended mid-block");
            break;
          }
          bytesRead += next.value.length;
          buffered = concatBytes(buffered, next.value);
          continue;
        }
        const block = buffered.slice(0, metaBytesNeeded);
        buffered = buffered.slice(metaBytesNeeded);
        metaBytesNeeded = 0;
        const rawTitle = parseIcyBlock(block).StreamTitle;
        const title = rawTitle === undefined ? undefined : normalizeStreamTitle(rawTitle);
        if (title !== undefined && title !== "" && title !== titles.at(-1)?.title) {
          titles.push({ at: (Date.now() - started) / 1000, title });
          trace?.(`title: ${title}`);
        } else {
          emptyBlocks += 1;
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    trace?.(`done: ${titles.length} distinct titles, ${emptyBlocks} empty/repeat blocks, ${bytesRead} bytes read`);
    return { outcome: "complete", info, titles };
  } catch (error) {
    // Node aborts `AbortSignal.timeout()` with `TimeoutError`, manual
    // `AbortController.abort()` with `AbortError` — both mean the window
    // ended, not that the station is unreadable. Anything else is a real
    // read failure. The distinction matters upstream: a timeout retries
    // direct next poll, a fetch-error memoises the URL to the edge fallback.
    //
    // Read `.name` without `instanceof`: a `DOMException` is not an `Error`
    // in every runtime, and gating on it silently misclassifies both aborts
    // as fetch-errors.
    const name =
      typeof error === "object" && error !== null && "name" in error && typeof error.name === "string"
        ? error.name
        : "";
    const timedOut = name === "AbortError" || name === "TimeoutError";
    // Surfaced (not swallowed): without the cause a mid-pump failure is
    // indistinguishable from a dead station — this is what the dev `/__icy`
    // trace and `onTrace` callers show.
    const cause = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    trace?.(`stopped: ${cause} (${bytesRead} bytes read)`);
    return { outcome: timedOut ? "timeout" : "fetch-error", info, titles };
  }
}
