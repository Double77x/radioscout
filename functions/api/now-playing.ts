/**
 * GET /api/now-playing?url=<stream-url> → `{ "title": string | null }`.
 *
 * Reads one ICY metadata block server-side (browsers can't: no CORS
 * headers on most stations, and `<audio>` exposes no metadata API).
 * Metadata-only: skips the audio interval, reads the title block, closes.
 * Anything unexpected → `{ "title": null }` (the client treats titles as
 * best-effort decoration and falls back to genre tags).
 */

// Pages Functions ship without the workers-types package — structural
// minimal typing keeps this free of new devDependencies.
interface PagesContext {
  request: Request;
}

const TOTAL_TIMEOUT_MS = 12_000;
/** Upper bound for the audio skip (stations use 8–32KB; abuse cap). */
const MAX_INTERVAL_BYTES = 1_000_000;

async function readExactly(reader: ReadableStreamDefaultReader<Uint8Array>, count: number): Promise<Uint8Array> {
  const out = new Uint8Array(count);
  let filled = 0;
  while (filled < count) {
    const { done, value } = await reader.read();
    if (done || !value) throw new Error("stream ended before metadata");
    const take = Math.min(value.length, count - filled);
    out.set(value.subarray(0, take), filled);
    filled += take;
  }
  return out;
}

function parseStreamTitle(block: Uint8Array): string | null {
  // Block: length byte × 16, then `StreamTitle='...';` (latin1).
  if (block.length === 0) return null;
  const body = new TextDecoder("latin1").decode(block.subarray(1, 1 + block[0] * 16));
  const match = /StreamTitle='(?<title>[^']*)'/.exec(body);
  const title = match?.groups?.["title"]?.trim() ?? "";
  return title === "" ? null : title;
}

function jsonTitle(title: string | null, cacheSeconds: number, reason?: string): Response {
  return Response.json(reason === undefined ? { title } : { title, reason }, {
    headers: { "Cache-Control": `public, max-age=${cacheSeconds}` },
  });
}

export async function onRequestGet(context: PagesContext): Promise<Response> {
  const raw = new URL(context.request.url).searchParams.get("url") ?? "";
  let target: URL | null = null;
  try {
    target = new URL(raw);
  } catch {
    return jsonTitle(null, 60, "bad-url");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") return jsonTitle(null, 60, "bad-protocol");
  if (target.hostname === "localhost" || target.hostname === "127.0.0.1" || target.hostname === "[::1]") {
    return jsonTitle(null, 60, "local-host");
  }
  let upstream: Response;
  try {
    upstream = await fetch(target.toString(), {
      headers: { "Icy-MetaData": "1", "User-Agent": "RadioScout/now-playing" },
      signal: AbortSignal.timeout(TOTAL_TIMEOUT_MS),
    });
  } catch (error) {
    return jsonTitle(null, 10, `fetch-fail:${error instanceof Error ? error.message : "unknown"}`);
  }
  try {
    const interval = Math.trunc(Number(upstream.headers.get("icy-metaint") ?? ""));
    if (!upstream.ok || !Number.isFinite(interval) || interval <= 0 || interval > MAX_INTERVAL_BYTES) {
      await upstream.body?.cancel().catch(() => {});
      return jsonTitle(
        null,
        30,
        `no-metaint:status=${upstream.status}:metaint=${upstream.headers.get("icy-metaint") ?? "absent"}`,
      );
    }
    const reader = upstream.body?.getReader();
    if (!reader) return jsonTitle(null, 30, "no-body");
    try {
      await readExactly(reader, interval);
      const lengthByte = await readExactly(reader, 1);
      const blockLength = lengthByte[0] * 16;
      const block = blockLength > 0 ? await readExactly(reader, blockLength) : new Uint8Array(0);
      const full = new Uint8Array(1 + blockLength);
      full[0] = lengthByte[0];
      full.set(block, 1);
      return jsonTitle(parseStreamTitle(full), 30);
    } catch (error) {
      return jsonTitle(null, 10, `short-read:${error instanceof Error ? error.message : "unknown"}`);
    } finally {
      reader.releaseLock();
      await upstream.body?.cancel().catch(() => {});
    }
  } catch {
    return jsonTitle(null, 10, "unexpected");
  }
}
