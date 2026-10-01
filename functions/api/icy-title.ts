// Pages Functions file-based routing: referenced by URL path, not by import.
import { fetchIcyTitles } from "../../src/lib/radio/icy";

/**
 * Server-side ICY title probe (`GET /api/icy-title?url=<stream>`).
 *
 * Browsers cannot decode most stations client-side (CORS preflight dies on
 * redirects, bodies stay opaque), so the player calls here first and falls
 * back to a direct fetch. Responses carry `Cache-Control: public,
 * max-age=60`: repeats are served from the edge without waking this
 * function or touching the station. Errors are never cached.
 */

interface PagesContext {
  request: Request;
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
  const { outcome, info, titles } = await fetchIcyTitles(target, {
    maxTitles: 1,
    timeoutMs: 18_000,
    userAgent: "RadioScout/0.3 (+https://radioscout.pages.dev)",
  });
  if (outcome === "complete" || (outcome === "timeout" && titles.length > 0)) {
    return jsonResponse({ ok: true, titles, info }, { status: 200 }, true);
  }
  const reason = outcome === "timeout" ? "timeout" : outcome === "http-error" ? `http-${info?.status ?? "?"}` : outcome;
  return jsonResponse({ ok: false, reason, titles, info });
}
