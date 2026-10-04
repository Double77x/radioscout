// Pages Functions file-based routing: referenced by URL path, not by import.
import { fetchIcyTitles } from "../../src/lib/radio/icy";
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
 */

export async function onRequestGet({ request }: PagesContext): Promise<Response> {
  const target = new URL(request.url).searchParams.get("url") ?? "";
  if (!target.startsWith("http://") && !target.startsWith("https://")) {
    return jsonResponse({ ok: false, reason: "http(s)-only", titles: [] }, { status: 400 });
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
    const response = jsonResponse({ ok: true, titles, info }, { status: 200 }, true);
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
