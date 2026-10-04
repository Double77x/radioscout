import { isRecord } from "./utils";

/**
 * Shared edge-cache + JSON envelope for the Pages Functions probes
 * (`/api/icy-title`, `/api/bbc-title`). One module so the Cache API
 * ceremony lives in exactly one place — see `docs/STREAM_TITLES.md` for
 * why the explicit `caches.default.put` exists at all.
 */

export interface PagesContext {
  request: Request;
}

type CacheMatch = (key: string) => Promise<Response | undefined>;
type CachePut = (key: string, response: Response) => Promise<void>;

/** Narrowed Workers Cache API surface (CacheStorage.default). */
export interface EdgeCache {
  match: CacheMatch;
  put: CachePut;
}

function isEdgeCache(value: unknown): value is EdgeCache {
  if (!isRecord(value)) return false;
  return typeof value.match === "function" && typeof value.put === "function";
}

/** Edge cache when present (production); null in dev middleware and tests. */
export function edgeCache(): EdgeCache | null {
  // oxlint-disable-next-line unicorn/no-typeof-undefined -- DOM lib declares caches as always present but it is absent outside the edge runtime; typeof keeps tsc from flagging an always-false comparison
  if (typeof globalThis.caches === "undefined") return null;
  const storage: unknown = globalThis.caches;
  if (!isRecord(storage)) return null;
  const candidate: unknown = storage.default;
  if (!isEdgeCache(candidate)) return null;
  return candidate;
}

export function jsonResponse(body: unknown, init?: ResponseInit, cacheable = false, maxAgeSeconds = 60): Response {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("Cache-Control", cacheable ? `public, max-age=${maxAgeSeconds}` : "no-store");
  return Response.json(body, { ...init, headers });
}
