/**
 * In-band ICY stream metadata (`StreamTitle`) for the player subtitle.
 *
 * The app plays through plain HTMLAudioElement, which exposes no stream
 * bytes, so titles are decoded with a parallel client-side fetch: request
 * `Icy-MetaData: 1`, count audio bytes against the `icy-metaint` interval
 * and parse the interleaved blocks. Works wherever the server allows CORS;
 * everywhere else it fails silently and the subtitle keeps its fallback.
 * HLS playlists carry no ICY blocks and exit on the headers.
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
  const timeout = AbortSignal.timeout(options?.timeoutMs ?? 30_000);
  const signal = options?.signal ? AbortSignal.any([options.signal, timeout]) : timeout;
  const titles: IcyTitle[] = [];
  let info: IcyStreamInfo | undefined = undefined;
  try {
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
    let bytesRead = 0;
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
        const title = parseIcyBlock(block).StreamTitle;
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
    const aborted = error instanceof Error && error.name === "AbortError";
    return { outcome: aborted ? "timeout" : "fetch-error", info, titles };
  }
}
