// Pages Functions file-based routing: referenced by URL path, not by import.
import { fetchIcyTitles, isProbeableStreamUrl } from "../../src/lib/radio/icy";
import { edgeCache, jsonResponse, type PagesContext } from "../../src/lib/edge-cache";

/**
 * Server-side ICY title probe (`GET /api/icy-title?url=<stream>`).
 *
 * Browsers cannot decode most stations client-side (CORS preflight dies on
 * redirects, bodies stay opaque), so the player calls here first and falls
 * back to a direct fetch. The `Cache-Control: public, max-age=60` header
 * alone does not get Pages Function responses edge-cached, so verdicts go
 * through the Cache API explicitly: repeats (same full request URL) are
 * served without waking the probe or touching the station. Errors are
 * never cached.
 *
 * The target is gated by `isProbeableStreamUrl`: plain `http(s)`, no
 * credentials, no loopback/private literals, bounded length. The probe
 * itself stops at an `icy-metaint` ceiling and a byte budget, so one call
 * stays cheap even against a stream that never sends a title. No host
 * allowlist is possible here — stations come from a live third-party
 * directory and the client may hold a resolved variant — and per-IP
 * throttling needs account-level state, so it belongs in a Cloudflare
 * rate-limit rule rather than in this function.
 *
 * The TTL matches the client's ICY poll interval, so a poll almost always
 * finds an expired entry rather than re-reading a verdict it already has.
 * This is the fallback path only — the page reads the stream itself where
 * the browser allows it, and arrives here for the stations that do not.
 */

export async function onRequestGet({ request }: PagesContext): Promise<Response> {
  const target = new URL(request.url).searchParams.get("url") ?? "";
  if (!isProbeableStreamUrl(target)) {
    return jsonResponse({ ok: false, reason: "invalid-target", titles: [] }, { status: 400 });
  }
  const cache = edgeCache();
  if (cache !== null) {
    const hit = await cache.match(request.url);
    if (hit !== undefined) return hit;
  }
  const { outcome, info, titles } = await fetchIcyTitles(target, {
    maxTitles: 1,
    timeoutMs: 18_000,
    userAgent: "RadioScout/0.3 (+https://radioscout.pages.dev)",
  });
  if (outcome === "complete" || (outcome === "timeout" && titles.length > 0)) {
    const response = jsonResponse({ ok: true, titles, info }, { status: 200 }, true, 20);
    if (cache !== null) {
      try {
        await cache.put(request.url, response.clone());
      } catch {
        // Cache write failed; the fresh response below is still fine.
      }
    }
    return response;
  }
  const reason = outcome === "timeout" ? "timeout" : outcome === "http-error" ? `http-${info?.status ?? "?"}` : outcome;
  return jsonResponse({ ok: false, reason, titles, info });
}
