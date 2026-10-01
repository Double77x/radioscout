// Pages Functions file-based routing: referenced by URL path, not by import.
import { fetchIcyTitles } from "../../src/lib/radio/icy";
import { isRecord } from "../../src/lib/utils";

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

interface PagesContext {
  request: Request;
}

type CacheMatch = (key: string) => Promise<Response | undefined>;
type CachePut = (key: string, response: Response) => Promise<void>;

/** Narrowed Workers Cache API surface (CacheStorage.default). */
interface EdgeCache {
  match: CacheMatch;
  put: CachePut;
}

function isEdgeCache(value: unknown): value is EdgeCache {
  if (!isRecord(value)) return false;
  return typeof value.match === "function" && typeof value.put === "function";
}

/** Edge cache when present (production); null in dev middleware and tests. */
function edgeCache(): EdgeCache | null {
  // oxlint-disable-next-line unicorn/no-typeof-undefined -- DOM lib declares caches as always present but it is absent outside the edge runtime; typeof keeps tsc from flagging an always-false comparison
  if (typeof globalThis.caches === "undefined") return null;
  const storage: unknown = globalThis.caches;
  if (!isRecord(storage)) return null;
  const candidate: unknown = storage.default;
  if (!isEdgeCache(candidate)) return null;
  return candidate;
}

function jsonResponse(body: unknown, init?: ResponseInit, cacheable = false): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", cacheable ? "public, max-age=60" : "no-store");
  return Response.json(body, { ...init, headers });
}

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
