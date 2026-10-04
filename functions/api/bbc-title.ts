// Pages Functions file-based routing: referenced by URL path, not by import.
import { fetchBbcNowPlaying, isBbcServiceId, bbcServiceIdFromUrl } from "../../src/lib/radio/bbc";
import { edgeCache, jsonResponse, type PagesContext } from "../../src/lib/edge-cache";

/**
 * Server-side BBC metadata probe (`GET /api/bbc-title?service=<id>` or
 * `?url=<stream>`).
 *
 * BBC HLS streams carry no ICY blocks, and RMS sends browsers no CORS
 * headers, so the player cannot ask the BBC directly — it asks here. Same
 * edge-cache shape as `functions/api/icy-title.ts`: the full request URL
 * is the key, only successful verdicts are stored (60s TTL), failures
 * re-probe every time.
 */

/** Service id from `?service=` directly, else read out of `?url=`. */
export function serviceFromParams(params: URLSearchParams): string | null {
  const direct = params.get("service") ?? "";
  if (isBbcServiceId(direct.trim().toLowerCase())) return direct.trim().toLowerCase();
  const fromUrl = bbcServiceIdFromUrl(params.get("url") ?? "");
  return fromUrl;
}

export async function onRequestGet({ request }: PagesContext): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const service = serviceFromParams(params);
  if (service === null) {
    return jsonResponse({ ok: false, reason: "unknown-bbc-service", title: null }, { status: 400 });
  }
  const cache = edgeCache();
  if (cache !== null) {
    const hit = await cache.match(request.url);
    if (hit !== undefined) return hit;
  }
  const nowPlaying = await fetchBbcNowPlaying(service, {
    timeoutMs: 12_000,
    userAgent: "RadioScout/0.3 (+https://radioscout.pages.dev)",
  });
  if (nowPlaying === null) {
    return jsonResponse({ ok: false, reason: "no-data", service, title: null });
  }
  // Tracks turn over every few minutes, so the BBC verdict caches for 30s
  // (half the ICY TTL) — upstream still sees ~2 pulls per station per minute
  // globally, however many are listening.
  const response = jsonResponse({ ok: true, service, ...nowPlaying }, { status: 200 }, true, 30);
  if (cache !== null) {
    try {
      await cache.put(request.url, response.clone());
    } catch {
      // Cache write failed; the fresh response below is still fine.
    }
  }
  return response;
}
